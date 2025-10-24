import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, SupabaseContextType, RealtimeLog } from "@/contexts/SupabaseContext"; // Importação Corrigida
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
// 🛑 VALOR DE PRODUÇÃO FINAL: O refresh acontecerá 5 minutos antes da expiração do token
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 10000; // 10 segundos (para detectar o erro rápido)

type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure?: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel) => void;
type RecreateClientFn = (isHardReset?: boolean) => SupabaseClient<Database>;

// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Note que SupabaseClient deve ser tipado com Database
    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
    const [realtimeEventLogs, setRealtimeEventLogs] = useState<RealtimeLog[]>([]);

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

    const recreateSupabaseClient: RecreateClientFn = useCallback((isHardReset: boolean = true) => {
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
            realtimeChannel.unsubscribe();
        }
        
        // 3. Cria um novo cliente
        const newClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: {
                // APENAS adiciona o fetcher se o usuário estiver logado (isSignedIn)
                fetch: isSignedIn ? async (input, init) => {
                    const token = await getToken();
                    const headers = new Headers(init?.headers);
                    if (token) headers.set('Authorization', `Bearer ${token}`);
                    return fetch(input, { ...init, headers });
                } : undefined, // Se não estiver logado, não injeta o fetcher de token.
            },
        });
        
        // 4. Atualiza o estado
        setSupabaseClient(newClient);
        setRealtimeChannel(null); 
        setConnectionHealthy(false);
        reconnectAttemptsRef.current = 0;
        isRefreshingRef.current = false;
        hasInitializedRef.current = false; 

        return newClient;
    }, [getToken, realtimeChannel, isSignedIn]); 
    recreateSupabaseClientRef.current = recreateSupabaseClient;


    const getTokenWithValidation = useCallback(async () => {
        // Esta função só é chamada quando isSignedIn é true
        try {
            const token = await getToken({ template: 'supabase' }); 
            if (!token) {
                console.warn('[AUTH] Token não disponível');
                return null;
            }

            try {
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
                return token; 
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
        // 🛑 MUDANÇA PRINCIPAL: Captura o evento em vez de logar
        const handleRealtimeEvent = (payload: any) => {
            if (!activeRef.current) return;
            
            // 🆕 Armazena o log do evento (em vez de logar no console)
            setRealtimeEventLogs(prevLogs => {
                const newLog: RealtimeLog = {
                    timestamp: Date.now(),
                    payload: payload
                };
                const MAX_LOGS = 500; 
                const updatedLogs = [newLog, ...prevLogs].slice(0, MAX_LOGS);
                return updatedLogs;
            });

            lastEventRef.current = Date.now();
            setHealthy(true);
            reconnectAttemptsRef.current = 0;
        };

        channel.on('SUBSCRIBED', () => {
            if (!activeRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setHealthy(true);
            lastEventRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', ({ reason, code }) => {
            if (!activeRef.current) return;
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

        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeEvent
        );
    };

    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current) return;
        
        if (!isSignedIn) {
            console.log('[RECONNECT-PUBLIC] 🔄 Tentando reinscrever canal público...');
            channel.subscribe(status => {
                if (status === 'SUBSCRIBED') {
                     console.log('[RECONNECT-PUBLIC] ✅ Re-inscrito com sucesso.');
                     setConnectionHealthy(true);
                     reconnectAttemptsRef.current = 0;
                } else if (status === 'CHANNEL_ERROR') {
                     recreateSupabaseClientRef.current!(false); 
                }
            });
            return;
        }

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT-AUTH] 🛑 Máximo de tentativas atingido. Parando e forçando recriação.');
            setConnectionHealthy(false);
            recreateSupabaseClientRef.current!(true); 
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[RECONNECT-AUTH] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);

        setTimeout(() => {
            if (isActiveRef.current && supabaseClient && isSignedIn) {
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false, true); 
            }
        }, delay);
    }, [supabaseClient, isSignedIn, recreateSupabaseClient]); 
    handleReconnectRef.current = handleReconnect;

    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure = false) => {
        if (isRefreshingRef.current && !isRetryAfterFailure) {
            console.log('[AUTH-SWAP] ⏳ Autenticação/Swap já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        
        let oldChannel: RealtimeChannel | null = realtimeChannel;
        
        if (isSignedIn && isRetryAfterFailure) {
            console.log('[AUTH-SWAP] 🔨 Retry de Falha: Forçando recriação de cliente para estado limpo.');
            recreateSupabaseClientRef.current!(true);
            isRefreshingRef.current = false;
            return false;
        }

        let success = false;
        let expirationTime: number | null = null;
        
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        try {
            let channelName: string;
            
            if (isSignedIn) {
                const newToken = await getTokenWithValidation();
                if (!newToken) {
                    await client?.realtime.setAuth(null); setConnectionHealthy(false);
                    throw new Error("Token não pôde ser obtido/validado.");
                }
                
                if (isProactiveRefresh && oldChannel) {
                    await client.realtime.setAuth(newToken);
                    console.log('[AUTH-SWAP] 🔄 Refresh Suave: Token aplicado no socket existente. Não é necessário swap.');
                    
                    try {
                        const payload = JSON.parse(atob(newToken.split('.')[1]));
                        expirationTime = payload.exp * 1000;
                    } catch (error) {
                        console.error('[AUTH-SWAP] Erro ao parsear EXP do token:', error);
                    }
                    
                    if (expirationTime) {
                        const refreshDelay = expirationTime - Date.now() - REFRESH_MARGIN_MS;
                        if (refreshDelay > 0) {
                            tokenRefreshTimeoutRef.current = setTimeout(() => {
                                console.log('[SCHEDULER] ⏳ Disparando refresh proativo...');
                                setRealtimeAuthAndChannelSwapRef.current?.(client, true);
                            }, refreshDelay);
                            console.log(`[SCHEDULER] 📅 Próximo refresh agendado em ${Math.round(refreshDelay / 1000 / 60)} minutos.`);
                        } else if (refreshDelay > -1 * REFRESH_MARGIN_MS) { 
                            console.warn('[SCHEDULER] ⚠️ Token prestes a expirar! Refresh imediato acionado.');
                            setRealtimeAuthAndChannelSwapRef.current?.(client, true);
                        }
                    }
                    
                    isRefreshingRef.current = false;
                    return true; 
                }

                channelName = 'private:orders_auth';
                
                await client.realtime.setAuth(newToken);
                
                try {
                    const payload = JSON.parse(atob(newToken.split('.')[1]));
                    expirationTime = payload.exp * 1000;
                } catch (error) {
                    console.error('[AUTH-SWAP] Erro ao parsear EXP do token:', error);
                }
                console.log(`[AUTH-SWAP] ✅ Token aplicado. Usando canal: ${channelName}`);

            } else {
                channelName = 'public:orders';
                console.log(`[AUTH-SWAP] 🅿️ Cliente não logado. Usando canal: ${channelName}`);
                await client.realtime.setAuth(null);
                console.log('[AUTH-SWAP] 🧹 Limpeza de Auth: setAuth(null) executado para canal público.');
            }


            const newChannel = client.channel(channelName); 
            
            const authSwapFn = setRealtimeAuthAndChannelSwapRef.current!;
            const reconnectFn = handleReconnectRef.current!;

            attachChannelListeners(
                newChannel, client, setConnectionHealthy, 
                authSwapFn, 
                lastEventTimeRef, reconnectFn, 
                isActiveRef
            );
            
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
                        console.error(`[AUTH-SWAP] ❌ Erro na inscrição do novo canal '${channelName}'.`); 
                        setConnectionHealthy(false); 
                        resolve(false); 
                    }
                });
            });

            if (!swapSuccess) {
                 setConnectionHealthy(false);
                 if (isSignedIn) {
                     throw new Error("Falha na inscrição do novo canal (timeout/erro).");
                 } else {
                     console.error('[AUTH-SWAP-PUBLIC] Falha na inscrição do canal público. Verifique a RLS.');
                 }
            }
            
            if (isSignedIn && expirationTime && !isProactiveRefresh) {
                const refreshDelay = expirationTime - Date.now() - REFRESH_MARGIN_MS;
                
                if (refreshDelay > 0) {
                    tokenRefreshTimeoutRef.current = setTimeout(() => {
                        console.log('[SCHEDULER] ⏳ Disparando refresh proativo...');
                        setRealtimeAuthAndChannelSwapRef.current?.(client, true); 
                    }, refreshDelay);
                    console.log(`[SCHEDULER] 📅 Próximo refresh agendado em ${Math.round(refreshDelay / 1000 / 60)} minutos.`);
                } else if (refreshDelay > -1 * REFRESH_MARGIN_MS) { 
                    console.warn('[SCHEDULER] ⚠️ Token prestes a expirar! Refresh imediato acionado.');
                    setRealtimeAuthAndChannelSwapRef.current?.(client, true);
                }
            }

            success = true;
        } catch (error) {
            console.error('[AUTH-SWAP] ‼️ Erro fatal na autenticação/swap:', error);
            
            if (isSignedIn && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                console.log('[AUTH-SWAP-RETRY] 🔨 Falha crítica de AUTH. Recriando cliente e tentando novamente...');
                recreateSupabaseClientRef.current!(true); 
                return false; 
            }
            
            setConnectionHealthy(false);
            success = false;
            
            if (client && oldChannel) {
                 handleReconnectRef.current?.(oldChannel);
            }

        } finally {
            isRefreshingRef.current = false;
        }
        return success;
    }, [getTokenWithValidation, realtimeChannel, isSignedIn, recreateSupabaseClient]);
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;

    const downloadRealtimeLogs = useCallback(() => {
        if (realtimeEventLogs.length === 0) {
            console.log('[DOWNLOAD] Sem logs de Realtime para baixar.');
            return;
        }

        const logData = {
            metadata: {
                timestamp: new Date().toISOString(),
                count: realtimeEventLogs.length,
                env: import.meta.env.MODE,
            },
            logs: realtimeEventLogs,
        };

        const json = JSON.stringify(logData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `realtime_logs_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`[DOWNLOAD] ✅ ${realtimeEventLogs.length} logs de Realtime baixados.`);
    }, [realtimeEventLogs]);

    // Effect 1: Create Client
    useEffect(() => {
        if (isLoaded && !supabaseClient) { 
            recreateSupabaseClient(false); 
        }
    }, [isLoaded, supabaseClient, recreateSupabaseClient]);

    // Effect 2: Inicialização e Health Check
    useEffect(() => {
        if (!supabaseClient || !isLoaded) { 
            return;
        }

        if (hasInitializedRef.current) {
            return;
        }
        
        hasInitializedRef.current = true;
        isActiveRef.current = true;

        console.log('[LIFECYCLE] 🚀 Iniciando primeiro canal realtime');
        setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);


        const healthCheckInterval = setInterval(() => {
            if (!isActiveRef.current || !realtimeChannel || realtimeChannel.state !== 'joined') return;

            const now = Date.now();
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
            setRealtimeChannel(null);
            setConnectionHealthy(false);
        };
        
    }, [supabaseClient, isLoaded]);

    // Effect 3: Logs de Status
    useEffect(() => {
        if (supabaseClient && realtimeChannel) {
             console.log(`[STATUS] Conexão: ${connectionHealthy ? '✅ Saudável' : '❌ Instável'}. Auth Counter: ${realtimeAuthCounter}. Logs Realtime Capturados: ${realtimeEventLogs.length}`);
        }
    }, [connectionHealthy, realtimeAuthCounter, supabaseClient, realtimeChannel, realtimeEventLogs.length]);

    // Effect 4: Expor a função de download no console (APENAS em DEV)
    useEffect(() => {
        if (import.meta.env.DEV) { 
            if (typeof window !== 'undefined') {
                (window as any).supabaseDownloadLogs = downloadRealtimeLogs;
                console.log('[DEBUG] 🌐 Função de download de logs Realtime está disponível no console via: `supabaseDownloadLogs()`');

                return () => {
                    delete (window as any).supabaseDownloadLogs;
                };
            }
        }
    }, [downloadRealtimeLogs]);

    // -------------------------------------------------------------------------
    // Renderização
    // -------------------------------------------------------------------------

    // O valor do provedor agora usa a interface SupabaseContextType corrigida
    const providerValue: SupabaseContextType = {
        supabaseClient: supabaseClient as SupabaseClient<Database>, // Assumindo que a tipagem da DB é correta
        realtimeChannel,
        connectionHealthy,
        realtimeAuthCounter,
        recreateSupabaseClient: recreateSupabaseClientRef.current!,
        downloadRealtimeLogs,
        realtimeEventLogs, 
    };

    if (!isLoaded || !supabaseClient) { 
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    // O valor deve ser do tipo SupabaseContextType (não pode ser nulo se passou na checagem)
    return (
        <SupabaseContext.Provider value={providerValue}>
            {children}
        </SupabaseContext.Provider>
    );
}
