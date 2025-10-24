// src/providers/SupabaseProvider.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, SupabaseContextType, RealtimeLog } from "@/contexts/SupabaseContext"; 
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types'; 

// Variáveis de Ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA
// =============================================================================

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; 
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutos de margem
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 10000; 
const PROTOCOL_STABILITY_DELAY_MS = 100; // 🚨 NOVO: Delay para estabilizar setAuth

// Tipos e Funções Auxiliares (Mantidos)
type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure?: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel) => void;
type RecreateClientFn = (isHardReset?: boolean) => SupabaseClient<Database>;
type HandleMessageFn = (type: RealtimeLog['type'], message: any) => void;

// Função getBusinessHoursStatus (Mantida)
const getBusinessHoursStatus = (): { isOpen: boolean; message: string; nextChange?: string } => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    
    const isWeekday = currentDay >= 1 && currentDay <= 5; 
    const isBusinessHour = currentHour >= 8 && currentHour < 18;
    
    if (isWeekday && isBusinessHour) {
        return { isOpen: true, message: '🟢 ABERTO' };
    }
    return { isOpen: false, message: '🔴 FECHADO' };
};

// =============================================================================
// FUNÇÃO: Cria um cliente Supabase com um WebSocket personalizado para LOGS e DEBUG
// =============================================================================
const DEBUG_PROTOCOLS = ['phx_join', 'phx_reply', 'heartbeat', 'access_token'];

const createClientWithLogging = (
    url: string, 
    key: string, 
    getToken: () => Promise<string | null>, 
    isSignedIn: boolean,
    handleRealtimeMessage: HandleMessageFn 
): SupabaseClient<Database> => {
    
    const CustomWebSocket = class extends WebSocket {
        constructor(url: string, protocols?: string | string[]) {
            super(url, protocols);
        }

        send(data: string | ArrayBufferLike | Blob | ArrayBuffer) {
            if (typeof data === 'string') {
                try {
                    const message = JSON.parse(data);
                    handleRealtimeMessage('SENT', message); 
                    
                    if (DEBUG_PROTOCOLS.includes(message.event)) {
                         console.log(`%c[RAW-WS] 📤 SENT Event: ${message.event} | Topic: ${message.topic} | Ref: ${message.ref}`, 'color: #1e88e5', message);
                    }
                } catch (e) { /* Ignora */ }
            }
            super.send(data);
        }

        set onmessage(listener: (event: MessageEvent) => any) {
            super.onmessage = (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data);
                    handleRealtimeMessage('RECEIVED', message); 

                    if (DEBUG_PROTOCOLS.includes(message.event) || message.event.endsWith('_error')) {
                         console.log(`%c[RAW-WS] 📥 RECEIVED Event: ${message.event} | Topic: ${message.topic} | Status: ${message.payload.status}`, 'color: #e53935; font-weight: bold;', message);
                    } else if (message.event === 'postgres_changes') {
                         console.log(`%c[RAW-WS] 📥 RECEIVED DATA: ${message.payload.eventType} for table ${message.payload.table}`, 'color: #43a047');
                    }
                } catch (e) { /* Ignora */ }
                listener(event); 
            };
        }
    } as any;

    return createClient<Database>(url, key, {
        global: {
            fetch: isSignedIn ? async (input, init) => {
                const token = await getToken();
                const headers = new Headers(init?.headers);
                if (token) headers.set('Authorization', `Bearer ${token}`);
                return fetch(input, { ...init, headers });
            } : undefined,
            WebSocket: CustomWebSocket, 
        },
        realtime: {
            timeout: 30000, 
        }
    });
};

// =============================================================================
// COMPONENTE PRINCIPAL: SupabaseProvider
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Estados e Referências (Mantidos)
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
    const setRealtimeEventLogsRef = useRef<React.Dispatch<React.SetStateAction<RealtimeLog[]>> | null>(null);
    const setRealtimeAuthAndChannelSwapRef = useRef<AuthSwapFn | null>(null);
    const handleReconnectRef = useRef<ReconnectFn | null>(null);
    const recreateSupabaseClientRef = useRef<RecreateClientFn | null>(null);
    
    // ... (useEffect inicial e handleRealtimeMessage mantidos) ...
    useEffect(() => {
        const businessStatus = getBusinessHoursStatus();
        console.log(`🏪 ${businessStatus.message}`);
    }, []);

    const handleRealtimeMessage: HandleMessageFn = useCallback((type, message) => {
        if (!isActiveRef.current) return;
        
        if (setRealtimeEventLogsRef.current) {
            
            if (message?.event === 'postgres_changes' || message?.event === 'phx_reply') {
                lastEventTimeRef.current = Date.now();
                setConnectionHealthy(true);
                reconnectAttemptsRef.current = 0;
            }

            setRealtimeEventLogsRef.current(prevLogs => {
                const newLog: RealtimeLog = {
                    timestamp: Date.now(), 
                    type: type,
                    payload: message 
                };
                const MAX_LOGS = 500; 
                const updatedLogs = [newLog, ...prevLogs].slice(0, MAX_LOGS);
                return updatedLogs;
            });
        }
    }, []); 

    // recreateSupabaseClient (Mantido)
    const recreateSupabaseClient: RecreateClientFn = useCallback((isHardReset: boolean = true) => {
        if (isHardReset) {
             console.log('[PROVIDER-INIT] ♻️ Forçando recriação COMPLETA do cliente Supabase e do Socket Realtime');
        } else {
             console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        }
        
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        if (realtimeChannel) {
            realtimeChannel.unsubscribe();
        }
        
        const newClient = createClientWithLogging(
            SUPABASE_URL, 
            SUPABASE_PUBLISHABLE_KEY, 
            () => getToken({ template: 'supabase' }), 
            isSignedIn,
            handleRealtimeMessage 
        );
        
        setSupabaseClient(newClient);
        setRealtimeChannel(null); 
        setConnectionHealthy(false);
        reconnectAttemptsRef.current = 0;
        isRefreshingRef.current = false;
        hasInitializedRef.current = false; 

        return newClient;
    }, [getToken, realtimeChannel, isSignedIn, handleRealtimeMessage]); 
    recreateSupabaseClientRef.current = recreateSupabaseClient;

    // getTokenWithValidation (Com log de debug)
    const getTokenWithValidation = useCallback(async () => {
        try {
             const token = await getToken({ template: 'supabase' });
             if (!token) { console.warn('[AUTH] Token não disponível'); return null; }
             
             try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const remainingMinutes = Math.round((payload.exp * 1000 - Date.now()) / 1000 / 60);
                
                console.log(`%c[AUTH] Token renovado | Expira em: ${remainingMinutes} minutos`, 'color: #9c27b0; font-weight: bold;');
                
                if ((payload.exp * 1000 - Date.now()) < REFRESH_MARGIN_MS) {
                    console.warn('[AUTH] Token prestes a expirar - Abaixo da margem de refresh.');
                }
             } catch(e) {
                 console.error('[AUTH] Erro ao parsear token', e);
             }
             
             return token;
         } catch (error) {
             console.error('[AUTH] Erro ao obter token do Clerk:', error);
             return null;
         }
    }, [getToken]);

    // attachChannelListeners e handleReconnect (Mantidos)
    const attachChannelListeners = (
        channel: RealtimeChannel,
        client: SupabaseClient,
        setHealthy: React.Dispatch<React.SetStateAction<boolean>>,
        setAuthSwap: AuthSwapFn,
        lastEventRef: React.MutableRefObject<number>,
        reconnectHandler: ReconnectFn,
        activeRef: React.MutableRefObject<boolean>
    ) => {
        const handleRealtimeDataEvent = (payload: any) => {
            if (!activeRef.current) return;
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
            handleRealtimeDataEvent
        );
    };

    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current) return;
        
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
            if (isActiveRef.current && supabaseClient) {
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false, true); 
            }
        }, delay);
    }, [supabaseClient]); 
    handleReconnectRef.current = handleReconnect;

    // 🚨 FIX CRÍTICO: setRealtimeAuthAndChannelSwap
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
                
                channelName = 'private:orders'; // Canal para Logado
                
                // 🚨 FIX 1/2: Chama setAuth e espera para estabilização
                await client.realtime.setAuth(newToken);
                console.log(`%c[AUTH-SWAP] 🔑 setAuth() chamado. Aguardando ${PROTOCOL_STABILITY_DELAY_MS}ms para estabilização do token...`, 'color: #9c27b0');
                await new Promise(resolve => setTimeout(resolve, PROTOCOL_STABILITY_DELAY_MS)); 
                
                try {
                    const payload = JSON.parse(atob(newToken.split('.')[1]));
                    expirationTime = payload.exp * 1000;
                } catch (error) {
                    console.error('[AUTH-SWAP] Erro ao parsear EXP do token:', error);
                }
                console.log(`[AUTH-SWAP] ✅ Token aplicado. Usando canal: ${channelName}`);

            } else {
                // Cliente não logado
                channelName = 'public:orders'; // Canal para Deslogado
                console.log(`[AUTH-SWAP] 🅿️ Cliente não logado. Usando canal: ${channelName}`);
                await client.realtime.setAuth(null);
                console.log('[AUTH-SWAP] 🧹 Limpeza de Auth: setAuth(null) executado para canal público.');
            }

            // 🚨 FIX 2/2: Sempre força o SWAP COMPLETO (Nova inscrição) no refresh proativo
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
                        // 🚨 DEBUG CRÍTICO: Loga o status do erro
                        console.error(`%c[AUTH-SWAP] ❌ Erro na inscrição do novo canal '${channelName}'. STATUS DA RESPOSTA DO SOCKET É: ${newChannel.state}`, 'color: #e53935; font-weight: bold;'); 
                        setConnectionHealthy(false); 
                        resolve(false); 
                    }
                });
            });

            if (!swapSuccess) {
                 setConnectionHealthy(false);
                 throw new Error(`Falha na inscrição do novo canal '${channelName}' (timeout/erro).`);
            }
            
            // Agendamento do próximo refresh
            if (isSignedIn && expirationTime) {
                const refreshDelay = expirationTime - Date.now() - REFRESH_MARGIN_MS;
                
                if (refreshDelay > 0) {
                    tokenRefreshTimeoutRef.current = setTimeout(() => {
                        console.log('[SCHEDULER] ⏳ Disparando refresh proativo...');
                        setRealtimeAuthAndChannelSwapRef.current?.(client, true); 
                    }, refreshDelay);
                    console.log(`[SCHEDULER] 📅 Próximo refresh agendado em ${Math.round(refreshDelay / 1000 / 60)} minutos.`);
                } else {
                    console.log('[SCHEDULER] ⚠️ Token abaixo da margem. Disparando refresh Imediato.');
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
    }, [getTokenWithValidation, realtimeChannel, isSignedIn]);
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;
    
    // ... (downloadRealtimeLogs e Effects de Ciclo de Vida mantidos) ...
    // ... (Renderização mantida) ...

    const downloadRealtimeLogs = useCallback(() => { /* ... */ }, [realtimeEventLogs]);
    useEffect(() => { /* ... */ }, [isLoaded, supabaseClient, recreateSupabaseClient]);
    useEffect(() => { setRealtimeEventLogsRef.current = setRealtimeEventLogs; }, [setRealtimeEventLogs]); 
    useEffect(() => { /* ... */ }, [supabaseClient, isLoaded]);
    useEffect(() => { /* ... */ }, [connectionHealthy, realtimeAuthCounter, supabaseClient, realtimeChannel, realtimeEventLogs.length]);
    useEffect(() => { /* ... */ }, [downloadRealtimeLogs]);


    const providerValue: SupabaseContextType = {
        supabaseClient: supabaseClient as SupabaseClient<Database>, 
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

    return (
        <SupabaseContext.Provider value={providerValue}>
            {children}
        </SupabaseContext.Provider>
    );
}
