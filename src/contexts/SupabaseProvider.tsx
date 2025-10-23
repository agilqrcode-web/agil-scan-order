import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// 🕒 SEÇÃO CRÍTICA: GESTÃO INTELIGENTE DE HORÁRIOS DE FUNCIONAMENTO
// =============================================================================

const BUSINESS_HOURS_CONFIG = {
    days: {
        1: { name: 'Segunda', open: 8, close: 18, enabled: true },
        2: { name: 'Terça', open: 8, close: 18, enabled: true },
        3: { name: 'Quarta', open: 8, close: 18, enabled: true },
        4: { name: 'Quinta', open: 8, close: 18, enabled: true },
        5: { name: 'Sexta', open: 8, close: 18, enabled: true },
        6: { name: 'Sábado', open: 8, close: 13, enabled: true },
        0: { name: 'Domingo', open: 0, close: 0, enabled: false }
    }
} as const;

type DayIndex = keyof typeof BUSINESS_HOURS_CONFIG.days;

const formatTime = (decimalHours: number): string => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const getBusinessHoursStatus = (): { isOpen: boolean; message: string; nextChange?: string } => {
    const now = new Date();
    const currentDay = now.getDay() as DayIndex;
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour + (currentMinutes / 60);

    const todayConfig = BUSINESS_HOURS_CONFIG.days[currentDay];

    if (!todayConfig || !todayConfig.enabled) {
        let nextDay = (currentDay + 1) % 7 as DayIndex;
        while (BUSINESS_HOURS_CONFIG.days[nextDay] && !BUSINESS_HOURS_CONFIG.days[nextDay].enabled) {
            nextDay = (nextDay + 1) % 7 as DayIndex;
        }
        const nextDayConfig = BUSINESS_HOURS_CONFIG.days[nextDay];

        return {
            isOpen: false,
            message: `🔒 ${todayConfig?.name || 'Hoje'} - FECHADO (abre ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h)`,
            nextChange: `Próxima abertura: ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h`
        };
    }

    const isOpen = currentTime >= todayConfig.open && currentTime < todayConfig.close;

    if (isOpen) {
        return {
            isOpen: true,
            message: `🟢 ${todayConfig.name} - ABERTO (${formatTime(todayConfig.open)}h - ${formatTime(todayConfig.close)}h)`,
            nextChange: `Fecha às ${formatTime(todayConfig.close)}h`
        };
    } else {
        if (currentTime < todayConfig.open) {
            return {
                isOpen: false,
                message: `🔴 ${todayConfig.name} - FECHADO (abre às ${formatTime(todayConfig.open)}h)`,
                nextChange: `Abre às ${formatTime(todayConfig.open)}h`
            };
        } else {
            let nextDay = (currentDay + 1) % 7 as DayIndex;
            while (BUSINESS_HOURS_CONFIG.days[nextDay] && !BUSINESS_HOURS_CONFIG.days[nextDay].enabled) {
                nextDay = (nextDay + 1) % 7 as DayIndex;
            }

            const nextDayConfig = BUSINESS_HOURS_CONFIG.days[nextDay];
            return {
                isOpen: false,
                message: `🔴 ${todayConfig.name} - FECHADO (abre ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h)`,
                nextChange: `Próxima abertura: ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h`
            };
        }
    }
};

// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA
// =============================================================================

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
// 🛑 VALOR DE DEBUG: Força o refresh em ~1 minuto (60 min - 59 min)
const REFRESH_MARGIN_MS = 5 * 60 * 1000; 
// 📝 Lembrete: Reverter para 5 * 60 * 1000 (5 minutos) após o teste ser validado.
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 10000; // 10 segundos (para detectar o erro rápido)

type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure?: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel) => void;
type RecreateClientFn = () => SupabaseClient;

// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);

    const isRefreshingRef = useRef<boolean>(false);
    const reconnectAttemptsRef = useRef<number>(0);
    const lastEventTimeRef = useRef<number>(Date.now());
    const isActiveRef = useRef<boolean>(true);
    const tokenRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasInitializedRef = useRef<boolean>(false); 

    const setRealtimeAuthAndChannelSwapRef = useRef<AuthSwapFn | null>(null);
    const handleReconnectRef = useRef<ReconnectFn | null>(null);
    const recreateSupabaseClientRef = useRef<RecreateClientFn | null>(null);
    
    // Log inicial do status de horários
    useEffect(() => {
        const businessStatus = getBusinessHoursStatus();
        console.log(`🏪 ${businessStatus.message}`);
        if (businessStatus.nextChange) {
            console.log(`   ⏰ ${businessStatus.nextChange}`);
        }
    }, []);

    // -------------------------------------------------------------------------
    // Funções Auxiliares (Refs e Callbacks)
    // -------------------------------------------------------------------------

    const recreateSupabaseClient = useCallback((isHardReset: boolean = true) => {
        if (isHardReset) {
             console.log('[PROVIDER-INIT] ♻️ Forçando recriação COMPLETA do cliente Supabase e do Socket Realtime');
        } else {
             console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        }
        
        // 1. Limpa o Timeout de Refresh
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        // 2. Unsubscribe no canal antigo (se existir)
        if (realtimeChannel) {
            // Unsubscribing é importante para limpar os listeners
            realtimeChannel.unsubscribe();
        }
        
        // 3. Cria um novo cliente
        // O fetch global garante que TODAS as requisições REST (ex: RLS, rpc) usem o token mais fresco.
        const newClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: {
                fetch: async (input, init) => {
                    const token = await getToken();
                    const headers = new Headers(init?.headers);
                    if (token) headers.set('Authorization', `Bearer ${token}`);
                    return fetch(input, { ...init, headers });
                },
            },
        });
        
        // 4. Atualiza o estado
        setSupabaseClient(newClient);
        setRealtimeChannel(null); // Zera o canal para que o useEffect 2 possa recriá-lo
        setConnectionHealthy(false);
        reconnectAttemptsRef.current = 0;
        isRefreshingRef.current = false;
        hasInitializedRef.current = false; // Permite que o Effect 2 (Inicialização) rode com o novo cliente

        return newClient;
    }, [getToken, realtimeChannel]);
    recreateSupabaseClientRef.current = recreateSupabaseClient;


    const getTokenWithValidation = useCallback(async () => {
        try {
            // Pega o token do Clerk com o template 'supabase'
            const token = await getToken({ template: 'supabase' }); 
            if (!token) {
                console.warn('[AUTH] Token não disponível');
                return null;
            }

            try {
                // Decodifica o payload para calcular a expiração
                const payload = JSON.parse(atob(token.split('.')[1]));
                const exp = payload.exp * 1000;
                const remainingMs = exp - Date.now();
                const remainingMinutes = Math.round(remainingMs / 1000 / 60);

                console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos`);

                if (remainingMs < REFRESH_MARGIN_MS) {
                    console.warn('[AUTH] Token prestes a expirar - Abaixo da margem de refresh.');
                }

                return token;
            } catch (parseError) {
                console.error('[AUTH] Erro ao parsear token, retornando token não validado:', parseError);
                return token; // Retorna o token mesmo com erro de parse
            }
        } catch (error) {
            console.error('[AUTH] Erro ao obter token do Clerk:', error);
            return null;
        }
    }, [getToken]);

    const attachChannelListeners = (
        channel: RealtimeChannel,
        client: SupabaseClient,
        setHealthy: React.Dispatch<React.SetStateAction<boolean>>,
        setAuthSwap: AuthSwapFn,
        lastEventRef: React.MutableRefObject<number>,
        reconnectHandler: ReconnectFn,
        activeRef: React.MutableRefObject<boolean>
    ) => {
        const handleRealtimeEvent = (payload: any) => {
            if (!activeRef.current) return;
            console.log('[REALTIME-EVENT] ✅ Evento recebido');
            lastEventRef.current = Date.now();
            setHealthy(true);
            reconnectAttemptsRef.current = 0;
        };

        // ... (Listeners de SUBSCRIBED, CLOSED, error permanecem IGUAIS)

        channel.on('SUBSCRIBED', () => {
            if (!activeRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setHealthy(true);
            lastEventRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', ({ reason, code }) => {
            if (!activeRef.current) return;
            // IMPORTANTE: Este log dirá se a falha é por "jwt expired" ou "invalid token"
            console.warn(`[LIFECYCLE] ❌ Canal fechado. Motivo: ${reason || 'N/A'}. Código: ${code || 'N/A'}`);
            setHealthy(false);
            reconnectHandler(channel);
        });

        channel.on('error', (error) => {
            if (!activeRef.current) return;
            console.error('[LIFECYCLE] 💥 Erro no canal:', error);
            setHealthy(false);
            reconnectHandler(channel);
        });

        // Este listener é interno ao provedor para marcar a conexão como saudável
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeEvent
        );
    };

    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current) return;

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido. Parando.');
            setConnectionHealthy(false);
            // 🛑 MUDANÇA: Se atingir o máximo, forçamos a recriação.
            recreateSupabaseClientRef.current!(true); 
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);

        setTimeout(() => {
            if (isActiveRef.current && supabaseClient && isSignedIn) {
                // Passa o flag de que é uma tentativa de reconexão
                // A nova lógica irá forçar a recriação do cliente se isRetryAfterFailure for true
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false, true); 
            }
        }, delay);
    }, [supabaseClient, isSignedIn]); 
    handleReconnectRef.current = handleReconnect;

    // 🛑 AUTH & SWAP: Onde a mágica da robustez acontece
    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure = false) => {
        if (isRefreshingRef.current && !isRetryAfterFailure) {
            console.log('[AUTH-SWAP] ⏳ Autenticação/Swap já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        let effectiveClient = client;

        // 🎯 MUDANÇA CRÍTICA: Se for refresh proativo ou retry, FORCE a recriação do cliente/socket
        if (isProactiveRefresh || isRetryAfterFailure) {
            console.log(`[AUTH-SWAP] 🔨 ${isProactiveRefresh ? 'Refresh Proativo' : 'Retry de Falha'}: Forçando recriação de cliente para estado limpo.`);
            
            // 1. Recria o cliente e zera o estado
            recreateSupabaseClientRef.current!(true); 
            
            // 2. O React vai detectar o novo 'supabaseClient' no estado
            // 3. Isso dispara o 'Effect 2: Inicialização'
            // 4. A inicialização será feita com o novo cliente e este bloco de código será encerrado.
            isRefreshingRef.current = false;
            return false; 
        }

        let success = false;
        let oldChannel: RealtimeChannel | null = realtimeChannel;
        let expirationTime: number | null = null;
        
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        try {
            if (!effectiveClient || !isSignedIn) {
                try { await effectiveClient?.realtime.setAuth(null); setConnectionHealthy(false); } catch { }
                return false;
            }

            const newToken = await getTokenWithValidation();
            if (!newToken) {
                await effectiveClient.realtime.setAuth(null);
                setConnectionHealthy(false);
                throw new Error("Token não pôde ser obtido/validado.");
            }

            try {
                const payload = JSON.parse(atob(newToken.split('.')[1]));
                expirationTime = payload.exp * 1000;
            } catch (error) {
                console.error('[AUTH-SWAP] Erro ao parsear EXP do token:', error);
            }
            
            // 1. Aplica o novo token ao socket existente (apenas para o primeiro init)
            await effectiveClient.realtime.setAuth(newToken);
            console.log('[AUTH-SWAP] ✅ Token aplicado ao Realtime Client.');

            // 2. Cria o novo canal para inscrição
            const newChannel = effectiveClient.channel('private:orders_auth'); 
            
            const authSwapFn = setRealtimeAuthAndChannelSwapRef.current!;
            const reconnectFn = handleReconnectRef.current!;

            attachChannelListeners(
                newChannel, effectiveClient, setConnectionHealthy, 
                authSwapFn, 
                lastEventTimeRef, reconnectFn, 
                isActiveRef
            );
            
            // 3. Tenta se inscrever (aguarda o SUBSCRIBED)
            const swapSuccess = await new Promise<boolean>(resolve => {
                const timeout = setTimeout(() => {
                    console.warn('[AUTH-SWAP] ⚠️ Timeout na inscrição do novo canal.');
                    resolve(false);
                }, CHANNEL_SUBSCRIBE_TIMEOUT); 

                newChannel.subscribe(status => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        console.log('[AUTH-SWAP] ✅ Novo canal inscrito. Realizando swap...');
                        
                        if (oldChannel) {
                            oldChannel.unsubscribe();
                            console.log('[AUTH-SWAP] 🧹 Canal antigo desinscrito.');
                        }
                        
                        setRealtimeChannel(newChannel);
                        setConnectionHealthy(true); 
                        setRealtimeAuthCounter(prev => prev + 1);
                        reconnectAttemptsRef.current = 0;
                        resolve(true);
                    } else if (status === 'CHANNEL_ERROR') {
                        clearTimeout(timeout);
                        console.error('[AUTH-SWAP] ❌ Erro na inscrição do novo canal.');
                        setConnectionHealthy(false); 
                        resolve(false); 
                    }
                });
            });

            if (!swapSuccess) {
                 setConnectionHealthy(false);
                 throw new Error("Falha na inscrição do novo canal (timeout/erro)."); 
            }
            
            // 4. Agenda o próximo refresh
            if (expirationTime) {
                const refreshDelay = expirationTime - Date.now() - REFRESH_MARGIN_MS;
                
                if (refreshDelay > 0) {
                    tokenRefreshTimeoutRef.current = setTimeout(() => {
                        console.log('[SCHEDULER] ⏳ Disparando refresh proativo...');
                        // Chama o refresh, que AGORA vai RECRIAR o cliente/socket
                        setRealtimeAuthAndChannelSwapRef.current?.(effectiveClient, true); 
                    }, refreshDelay);
                    console.log(`[SCHEDULER] 📅 Próximo refresh agendado em ${Math.round(refreshDelay / 1000 / 60)} minutos.`);
                } else if (refreshDelay > -1 * REFRESH_MARGIN_MS) { 
                    console.warn('[SCHEDULER] ⚠️ Token prestes a expirar! Refresh imediato acionado.');
                    // Chama o refresh, que AGORA vai RECRIAR o cliente/socket
                    setRealtimeAuthAndChannelSwapRef.current?.(effectiveClient, true);
                }
            }

            success = true;
        } catch (error) {
            console.error('[AUTH-SWAP] ‼️ Erro fatal na autenticação/swap:', error);

            // 🛑 MUDANÇA: Se falhar, forçamos a recriação, que é o caminho de Hard Reset
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                console.log('[AUTH-SWAP-RETRY] 🔨 Falha crítica. Recriando cliente e tentando novamente...');
                recreateSupabaseClientRef.current!(true); 
                return false; // Retorna falso para deixar o Effect 2 lidar com a nova inicialização
            }
            
            setConnectionHealthy(false);
            success = false;
            
            if (effectiveClient && oldChannel) {
                 // Caso o hard reset falhe (improvável), tentamos a lógica de backoff de reconexão
                 handleReconnectRef.current?.(oldChannel);
            }

        } finally {
            isRefreshingRef.current = false;
        }
        return success;
    }, [getTokenWithValidation, realtimeChannel, isSignedIn, recreateSupabaseClient]);
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;

    // Effect 1: Create Client (Executa apenas na primeira montagem)
    useEffect(() => {
        if (isLoaded && !supabaseClient) {
            recreateSupabaseClient(false); // Cria o cliente pela primeira vez (Hard Reset = false)
        }
    }, [isLoaded, supabaseClient, recreateSupabaseClient]);

    // Effect 2: Inicialização e Health Check (Dispara quando o cliente muda)
    useEffect(() => {
        // Roda na primeira montagem OU quando o cliente é RE-CRIADO
        if (!supabaseClient || !isLoaded || !isSignedIn) {
            return;
        }
        
        // Evita rodar a lógica de inicialização de canal se o cliente já tiver um canal vivo ou
        // se o flag de inicialização já tiver sido setado (o flag é limpo na recriação)
        if (hasInitializedRef.current) {
            return;
        }
        
        // --- ORQUESTRAÇÃO INICIAL ---
        hasInitializedRef.current = true;
        isActiveRef.current = true;

        console.log('[LIFECYCLE] 🚀 Iniciando primeiro canal realtime');
        // Usa o cliente recém-criado/re-criado. isProactiveRefresh = false, isRetry = false.
        setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);


        // --- HEALTH CHECK INTELIGENTE COM RECUPERAÇÃO SUAVE ---
        const healthCheckInterval = setInterval(() => {
            if (!isActiveRef.current || !realtimeChannel || realtimeChannel.state !== 'joined') return;

            const now = Date.now();
            // Se não houve eventos há 6 minutos (maior que o intervalo de 5 min)
            if (now - lastEventTimeRef.current > HEALTH_CHECK_INTERVAL + (60 * 1000)) { 
                console.warn('[HEALTH-CHECK] 💔 Falha no Health Check. Nenhum evento há muito tempo. Forçando reconexão.');
                setConnectionHealthy(false);
                handleReconnectRef.current?.(realtimeChannel);
            }

        }, HEALTH_CHECK_INTERVAL);


        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos');
            isActiveRef.current = false;
            hasInitializedRef.current = false; 
            clearInterval(healthCheckInterval);
            if (tokenRefreshTimeoutRef.current) {
                clearTimeout(tokenRefreshTimeoutRef.current);
            }
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
            }
            // Não zeramos supabaseClient aqui para evitar loop infinito
            setRealtimeChannel(null);
            setConnectionHealthy(false);
        };
        
    }, [supabaseClient, isLoaded, isSignedIn]); // 🎯 Agora depende de supabaseClient para rodar na recriação

    // Effect 3: Logs de Status (Apenas para visualização)
    useEffect(() => {
        if (supabaseClient && realtimeChannel) {
             console.log(`[STATUS] Conexão: ${connectionHealthy ? '✅ Saudável' : '❌ Instável'}. Auth Counter: ${realtimeAuthCounter}`);
        }
    }, [connectionHealthy, realtimeAuthCounter, supabaseClient, realtimeChannel]);

    // -------------------------------------------------------------------------
    // Renderização
    // -------------------------------------------------------------------------

    const providerValue = {
        supabaseClient,
        realtimeChannel,
        connectionHealthy,
        realtimeAuthCounter,
        recreateSupabaseClient: recreateSupabaseClientRef.current!,
    };

    if (!isLoaded || !supabaseClient || !isSignedIn) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    return (
        <SupabaseContext.Provider value={providerValue as any}>
            {children}
        </SupabaseContext.Provider>
    );
}
