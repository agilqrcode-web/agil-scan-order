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
        return {
            isOpen: false,
            message: `🔒 ${todayConfig?.name || 'Hoje'} - FECHADO`
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
const REFRESH_MARGIN_MS = 30 * 1000; // 30 segundos antes da expiração real
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel) => void;

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

    const setRealtimeAuthAndChannelSwapRef = useRef<AuthSwapFn | null>(null);
    const handleReconnectRef = useRef<ReconnectFn | null>(null);
    
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

    const getTokenWithValidation = useCallback(async () => {
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

                if (remainingMs < 2 * 60 * 1000) {
                    console.warn('[AUTH] Token prestes a expirar');
                }

                return token;
            } catch (parseError) {
                console.error('[AUTH] Erro ao parsear token:', parseError);
                return token;
            }
        } catch (error) {
            console.error('[AUTH] Erro ao obter token:', error);
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

        channel.on('SUBSCRIBED', () => {
            if (!activeRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setHealthy(true);
            lastEventRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', () => {
            if (!activeRef.current) return;
            console.warn('[LIFECYCLE] ❌ Canal fechado');
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

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido. Parando.');
            setConnectionHealthy(false);
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);

        setTimeout(() => {
            if (isActiveRef.current && supabaseClient && isSignedIn) {
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false); 
            }
        }, delay);
    }, [supabaseClient, isSignedIn]); 
    handleReconnectRef.current = handleReconnect;

    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean) => {
        if (isRefreshingRef.current) {
            console.log('[AUTH-SWAP] ⏳ Autenticação/Swap já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        let success = false;
        let newToken: string | null = null;
        let oldChannel: RealtimeChannel | null = null;
        let expirationTime: number | null = null;
        
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        try {
            if (!client || !isSignedIn) {
                try {
                    await client?.realtime.setAuth(null);
                    setConnectionHealthy(false);
                } catch { }
                return false;
            }

            newToken = await getTokenWithValidation();
            if (!newToken) {
                await client.realtime.setAuth(null);
                setConnectionHealthy(false);
                return false;
            }

            try {
                const payload = JSON.parse(atob(newToken.split('.')[1]));
                expirationTime = payload.exp * 1000;
            } catch (error) {
                console.error('[AUTH-SWAP] Erro ao parsear EXP do token:', error);
            }
            
            await client.realtime.setAuth(newToken);
            console.log('[AUTH-SWAP] ✅ Token aplicado ao Realtime Client.');

            oldChannel = realtimeChannel;
            const newChannel = client.channel('public:orders');
            
            const authSwapFn = setRealtimeAuthAndChannelSwapRef.current!;
            const reconnectFn = handleReconnectRef.current!;

            attachChannelListeners(
                newChannel, client, setConnectionHealthy, 
                authSwapFn, 
                lastEventTimeRef, reconnectFn, 
                isActiveRef
            );
            
            const swapSuccess = await new Promise<boolean>(resolve => {
                newChannel.subscribe(status => {
                    if (status === 'SUBSCRIBED') {
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
                        console.error('[AUTH-SWAP] ❌ Erro na inscrição do novo canal.');
                        resolve(false); 
                    }
                    
                    if (newChannel.state === 'joining' || newChannel.state === 'joined') {
                        console.log(`[TIMING-FIX] 🧠 Status inicial: ${newChannel.state}. Forçando reatividade.`);
                        setConnectionHealthy(true);
                    }
                });
            });

            if (!swapSuccess) throw new Error("Falha na inscrição do novo canal.");
            
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

            success = true;
        } catch (error) {
            console.error('[AUTH-SWAP] ‼️ Erro fatal na autenticação/swap:', error);
            if (oldChannel) setRealtimeChannel(oldChannel); 
            setConnectionHealthy(false);
            success = false;
        } finally {
            isRefreshingRef.current = false;
        }
        return success;
    }, [getTokenWithValidation, realtimeChannel, isSignedIn]); 
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;

    // Effect 1: Create Client
    useEffect(() => {
        if (isLoaded && !supabaseClient) {
            console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
            const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                global: {
                    fetch: async (input, init) => {
                        const token = await getToken();
                        const headers = new Headers(init?.headers);
                        if (token) headers.set('Authorization', `Bearer ${token}`);
                        return fetch(input, { ...init, headers });
                    },
                },
            });
            setSupabaseClient(client);
        }
    }, [isLoaded, getToken, supabaseClient]);

    // Effect 2: Inicialização e Health Check (CORRIGIDO PARA RODAR APENAS NA MONTAGEM)
    useEffect(() => {
        // ⭐️ CORREÇÃO: Removemos a dependência 'realtimeChannel'
        // A condição de saída 'realtimeChannel' garante que a inicialização só ocorra uma vez.
        if (!supabaseClient || !isLoaded || realtimeChannel) {
            return;
        }

        isActiveRef.current = true;
        
        // --- ORQUESTRAÇÃO INICIAL ---
        console.log('[LIFECYCLE] 🚀 Iniciando primeiro canal realtime');
        setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);


        // --- HEALTH CHECK INTELIGENTE COM RECUPERAÇÃO SUAVE ---
        const healthCheckInterval = setInterval(() => {
            if (!isActiveRef.current || !realtimeChannel) return;

            const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
            const isChannelSubscribed = realtimeChannel.state === 'joined';
            const businessStatus = getBusinessHoursStatus();

            if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000) {
                if (businessStatus.isOpen) {
                    console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 5+ minutos durante horário comercial. Tentando re-autenticação/swap suave.');
                    setConnectionHealthy(false);
                    setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);
                } else {
                    console.log('[HEALTH-CHECK] 💤 Sem eventos - Comportamento normal (fora do horário comercial)');
                }
            }
        }, HEALTH_CHECK_INTERVAL);


        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos');
            isActiveRef.current = false;
            clearInterval(healthCheckInterval);
            if (tokenRefreshTimeoutRef.current) {
                clearTimeout(tokenRefreshTimeoutRef.current);
            }
            // Zera o canal para permitir a remontagem se o componente for *realmente* desmontado (ex: troca de rota principal)
            if (realtimeChannel) {
                realtimeChannel.unsubscribe();
            }
            setRealtimeChannel(null);
            setConnectionHealthy(false);
        };
        
    }, [supabaseClient, isLoaded]); // Apenas dependências que causam a primeira inicialização.

    // Effect 3: Wake-Up Call
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
                console.log('👁️ Aba visível - verificando conexão e autenticação');
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [supabaseClient, isSignedIn]);

    // Funções de reconexão
    const refreshConnection = useCallback(async () => {
        console.log('[RECONNECT] 🔄 Reconexão manual solicitada (via Swap)');
        if (supabaseClient) {
            await setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false);
        }
    }, [supabaseClient]);

    const requestReconnect = useCallback(async (maxAttempts?: number) => {
        console.log('[RECONNECT] 🔄 Reconexão via requestReconnect');
        await refreshConnection();
        return true;
    }, [refreshConnection]);

    if (!supabaseClient || !realtimeChannel || (!connectionHealthy && isSignedIn && isLoaded)) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spinner size="large" />
            </div>
        );
    }

    return (
        <SupabaseContext.Provider value={{
            supabaseClient,
            realtimeChannel,
            connectionHealthy,
            realtimeAuthCounter,
            requestReconnect,
            setRealtimeAuth: () => supabaseClient && setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false),
            refreshConnection,
        }}>
            {children}

            <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
                connectionHealthy ? 'bg-green-500' : 'bg-red-500'
            } z-50 border border-white shadow-lg`}
                title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} | ${getBusinessHoursStatus().message}`} />
        </SupabaseContext.Provider>
    );
}
