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

/**
 * 🎯 OBJETIVO: Evitar falsos positivos no health check quando o restaurante
 * está naturalmente fechado, sem pedidos.
 */
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
} as const; // Use 'as const' para tipagem mais estrita

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
// Removemos o TOKEN_REFRESH_MARGIN, pois não faremos o refresh proativo a cada 15 minutos
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

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

    // Log inicial do status de horários
    useEffect(() => {
        const businessStatus = getBusinessHoursStatus();
        console.log(`🏪 ${businessStatus.message}`);
        if (businessStatus.nextChange) {
            console.log(`   ⏰ ${businessStatus.nextChange}`);
        }
    }, []);

    // ✅ Função otimizada para obter token com validação
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

    const setRealtimeAuth = useCallback(async (client: SupabaseClient) => {
        if (isRefreshingRef.current) {
            console.log('[AUTH] ⏳ Autenticação já em progresso');
            return false; // Retorna false para indicar que não houve nova autenticação
        }
        isRefreshingRef.current = true;
        let success = false;

        try {
            if (!client || !isSignedIn) {
                try {
                    await client?.realtime.setAuth(null);
                    setConnectionHealthy(false);
                } catch { }
                return false;
            }

            const token = await getTokenWithValidation();
            if (!token) {
                await client.realtime.setAuth(null);
                setConnectionHealthy(false);
                return false;
            }

            await client.realtime.setAuth(token);
            console.log('[AUTH] ✅ Token aplicado com sucesso');
            setConnectionHealthy(true);
            setRealtimeAuthCounter(prev => prev + 1);
            success = true;
        } catch (error) {
            console.error('[AUTH] ‼️ Erro na autenticação:', error);
            setConnectionHealthy(false);
            success = false;
        } finally {
            isRefreshingRef.current = false;
        }
        return success;
    }, [isSignedIn, getTokenWithValidation]);

    // ✅ Backoff exponencial otimizado
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
                setRealtimeAuth(supabaseClient).then(authSuccess => {
                    if (authSuccess) {
                        // Se a autenticação foi OK, tenta reinscribir o canal
                        channel.subscribe();
                    }
                });
            }
        }, delay);
    }, [supabaseClient, isSignedIn, setRealtimeAuth]);

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

    // Effect 2: Canal RealTime com Gestão Inteligente e Correção de Timing
    useEffect(() => {
        if (!supabaseClient || !isLoaded) {
            return;
        }

        isActiveRef.current = true;
        console.log('[LIFECYCLE] 🚀 Criando canal realtime');
        const channel = supabaseClient.channel('public:orders');

        const handleRealtimeEvent = (payload: any) => {
            if (!isActiveRef.current) return;
            console.log('[REALTIME-EVENT] ✅ Evento recebido');
            lastEventTimeRef.current = Date.now();
            setConnectionHealthy(true);
            reconnectAttemptsRef.current = 0;
        };

        // --- LISTENERS DE ESTADO DO CANAL ---
        channel.on('SUBSCRIBED', () => {
            if (!isActiveRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setConnectionHealthy(true);
            lastEventTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', () => {
            if (!isActiveRef.current) return;
            console.warn('[LIFECYCLE] ❌ Canal fechado');
            setConnectionHealthy(false);
            handleReconnect(channel);
        });

        channel.on('error', (error) => {
            if (!isActiveRef.current) return;
            console.error('[LIFECYCLE] 💥 Erro no canal:', error);
            setConnectionHealthy(false);
            handleReconnect(channel);
        });

        // Listener para eventos do banco (apenas para o Health Check e lastEventTimeRef)
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeEvent
        );

        // --- HEALTH CHECK INTELIGENTE COM GESTÃO DE HORÁRIOS ---
        const healthCheckInterval = setInterval(() => {
            if (!isActiveRef.current) return;

            const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
            const isChannelSubscribed = channel.state === 'joined';
            const businessStatus = getBusinessHoursStatus();

            if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000) {
                if (businessStatus.isOpen) {
                    console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 5+ minutos durante horário comercial. Tentando reconexão.');
                    setConnectionHealthy(false);

                    // Recuperação proativa
                    channel.unsubscribe().then(() => {
                        setTimeout(() => {
                            if (isActiveRef.current) {
                                // Tenta reautenticar (caso o token tenha expirado silenciosamente) e resubscribe
                                setRealtimeAuth(supabaseClient).then(authSuccess => {
                                    if (authSuccess) channel.subscribe();
                                });
                            }
                        }, 5000);
                    });
                } else {
                    console.log('[HEALTH-CHECK] 💤 Sem eventos - Comportamento normal (fora do horário comercial)');
                }
            }
        }, HEALTH_CHECK_INTERVAL);

        // --- ORQUESTRAÇÃO E CORREÇÃO DE TIMING ---
        setRealtimeChannel(channel);
        
        // 1. Inicia a autenticação do Realtime
        setRealtimeAuth(supabaseClient).then(authSuccess => {
            if (authSuccess) {
                // 2. Se a autenticação foi bem-sucedida, inicia a inscrição
                channel.subscribe(status => {
                    // 3. Verifica o status pelo callback de subscribe (mais robusto)
                    if (status === 'SUBSCRIBED') {
                        setConnectionHealthy(true);
                        setRealtimeAuthCounter(prev => prev + 1);
                        console.log('[TIMING-FIX] ✅ SUBSCRIBED via Callback, forçando estado saudável.');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('[TIMING-FIX] ❌ Erro imediato no canal:', channel.state);
                    }
                    
                    // 4. CORREÇÃO CRÍTICA: Verifica o estado interno (joining/joined) para mitigar eventos perdidos.
                    if (channel.state === 'joining' || channel.state === 'joined') {
                        console.log(`[TIMING-FIX] 🧠 Status inicial: ${channel.state}. Forçando reatividade.`);
                        setConnectionHealthy(true);
                        setRealtimeAuthCounter(prev => prev + 1);
                    }
                });
            }
        });


        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos');
            isActiveRef.current = false;
            clearInterval(healthCheckInterval);
            // Removed: clearInterval(tokenRefreshInterval)
            channel.unsubscribe();
            setRealtimeChannel(null);
            setConnectionHealthy(false);
        };
    }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, handleReconnect]);

    // Effect 3: Wake-Up Call (Mantido, mas simplificado sem refresh proativo)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
                console.log('👁️ Aba visível - verificando conexão e autenticação');
                // Apenas garante que o token esteja aplicado, se necessário.
                setRealtimeAuth(supabaseClient);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [supabaseClient, isSignedIn, setRealtimeAuth]);

    // ✅ Funções de reconexão
    const refreshConnection = useCallback(async () => {
        console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
        if (realtimeChannel) {
            // Desinscrição com limpeza de listeners
            realtimeChannel.unsubscribe().then(() => {
                if (supabaseClient) {
                    // Re-autentica e re-inscreve
                    setRealtimeAuth(supabaseClient).then(authSuccess => {
                        if (authSuccess) realtimeChannel.subscribe();
                    });
                }
            });
        } else if (supabaseClient) {
            // Tenta apenas reautenticar se o canal ainda não existe (edge case)
            await setRealtimeAuth(supabaseClient);
        }
    }, [supabaseClient, realtimeChannel, setRealtimeAuth]);

    const requestReconnect = useCallback(async (maxAttempts?: number) => {
        console.log('[RECONNECT] 🔄 Reconexão via requestReconnect');
        await refreshConnection();
        return true;
    }, [refreshConnection]);

    if (!supabaseClient || !realtimeChannel || (!connectionHealthy && isSignedIn && isLoaded)) {
        // Exibimos o spinner enquanto o cliente é criado OU o canal está conectando
        // Se o usuário está logado e o canal ainda não está saudável, isso pode ser rápido e evita flash
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
            setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
            refreshConnection,
        }}>
            {children}

            {/* Indicador visual com status de horário comercial */}
            <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
                connectionHealthy ? 'bg-green-500' : 'bg-red-500'
            } z-50 border border-white shadow-lg`}
                title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} | ${getBusinessHoursStatus().message}`} />
        </SupabaseContext.Provider>
    );
}
