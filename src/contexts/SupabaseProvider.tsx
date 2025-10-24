// src/providers/SupabaseProvider.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, SupabaseContextType, RealtimeLog } from "@/contexts/SupabaseContext"; 
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types'; // Verifique se o caminho está correto

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA
// =============================================================================

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 10000; // 10 segundos

// Tipos para funções de referência
type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure?: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel) => void;
type RecreateClientFn = (isHardReset?: boolean) => SupabaseClient<Database>;
type HandleMessageFn = (type: RealtimeLog['type'], message: any) => void;

// =============================================================================
// 🆕 FUNÇÃO: Cria um cliente Supabase com um WebSocket personalizado para LOGS
// =============================================================================

const createClientWithLogging = (
    url: string, 
    key: string, 
    getToken: () => Promise<string | null>, 
    isSignedIn: boolean,
    handleRealtimeMessage: HandleMessageFn
): SupabaseClient<Database> => {
    
    // Cria um objeto WebSocket personalizado para interceptar todas as mensagens
    const CustomWebSocket = class extends WebSocket {
        constructor(url: string, protocols?: string | string[]) {
            super(url, protocols);
        }

        send(data: string | ArrayBufferLike | Blob | ArrayBuffer) {
            if (typeof data === 'string') {
                try {
                    const message = JSON.parse(data);
                    // Captura a mensagem ANTES de ser enviada (SENT)
                    handleRealtimeMessage('SENT', message); 
                } catch (e) {
                    // Ignora mensagens que não são JSON (ex: pings/conexão)
                }
            }
            super.send(data);
        }

        set onmessage(listener: (event: MessageEvent) => any) {
            // Intercepta a função onmessage original
            super.onmessage = (event: MessageEvent) => {
                try {
                    const message = JSON.parse(event.data);
                    // Captura a mensagem APÓS ser recebida (RECEIVED)
                    handleRealtimeMessage('RECEIVED', message); 
                } catch (e) {
                    // Ignora se não for JSON
                }
                // Chama o listener original para que o Supabase processe o evento
                listener(event); 
            };
        }
    } as any;

    return createClient<Database>(url, key, {
        global: {
            // Lógica de injeção de token no fetcher
            fetch: isSignedIn ? async (input, init) => {
                const token = await getToken();
                const headers = new Headers(init?.headers);
                if (token) headers.set('Authorization', `Bearer ${token}`);
                return fetch(input, { ...init, headers });
            } : undefined,
            // Injeção do WebSocket customizado
            WebSocket: CustomWebSocket, 
        },
    });
};

// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

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

    // Função de status de horário (mantida para contexto)
    useEffect(() => {
        // Lógica de log inicial do status de horários (omitted for brevity)
    }, []);

    // -------------------------------------------------------------------------
    // Funções Auxiliares (Logs e Cliente)
    // -------------------------------------------------------------------------

    // 🆕 FUNÇÃO: Captura TODAS as mensagens do WebSocket e atualiza o estado
    const handleRealtimeMessage: HandleMessageFn = useCallback((type, message) => {
        if (!isActiveRef.current) return;
        
        // Se for uma mensagem de DADOS, atualize o health check (timestamp do último evento)
        if (message?.event === 'postgres_changes') {
            lastEventTimeRef.current = Date.now();
            setConnectionHealthy(true);
            reconnectAttemptsRef.current = 0;
        }

        // Armazena o log bruto
        setRealtimeEventLogs(prevLogs => {
            const newLog: RealtimeLog = {
                timestamp: Date.now(), 
                type: type,
                payload: message 
            };
            const MAX_LOGS = 500; 
            const updatedLogs = [newLog, ...prevLogs].slice(0, MAX_LOGS);
            return updatedLogs;
        });
    }, []);

    const recreateSupabaseClient: RecreateClientFn = useCallback((isHardReset: boolean = true) => {
        if (isHardReset) {
             console.log('[PROVIDER-INIT] ♻️ Forçando recriação COMPLETA do cliente Supabase e do Socket Realtime');
        } else {
             console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        }
        
        // 1. Limpa Timeout
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        // 2. Unsubscribe
        if (realtimeChannel) {
            realtimeChannel.unsubscribe();
        }
        
        // 3. Cria um novo cliente COM LOGGING
        const newClient = createClientWithLogging(
            SUPABASE_URL, 
            SUPABASE_PUBLISHABLE_KEY, 
            () => getToken({ template: 'supabase' }), 
            isSignedIn,
            handleRealtimeMessage 
        );
        
        // 4. Reset do estado
        setSupabaseClient(newClient);
        setRealtimeChannel(null); 
        setConnectionHealthy(false);
        reconnectAttemptsRef.current = 0;
        isRefreshingRef.current = false;
        hasInitializedRef.current = false; 

        return newClient;
    }, [getToken, realtimeChannel, isSignedIn, handleRealtimeMessage]); 
    recreateSupabaseClientRef.current = recreateSupabaseClient;


    const getTokenWithValidation = useCallback(async () => {
        // ... (Lógica de validação e log de token - mantida) ...
        try {
             const token = await getToken({ template: 'supabase' });
             if (!token) { console.warn('[AUTH] Token não disponível'); return null; }
             // ... (lógica de parse e log de expiração) ...
             return token;
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
        // Função que é chamada no RECEBIMENTO de postgres_changes (para health check)
        const handleRealtimeDataEvent = (payload: any) => {
            if (!activeRef.current) return;
            // Apenas atualiza o health check, o log já foi capturado pelo WebSocket
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

        // Adiciona o listener de dados para o health check (apenas para a tabela 'orders')
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeDataEvent
        );
    };

    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        // ... (Lógica de reconexão mantida) ...
        if (!isActiveRef.current) return;
        
        // ... (lógica de reconexão pública e autenticada com retry) ...
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT-AUTH] 🛑 Máximo de tentativas atingido. Parando e forçando recriação.');
            setConnectionHealthy(false);
            recreateSupabaseClientRef.current!(true); 
            return;
        }
        
        // ... (lógica de delay e setTimeout) ...
        
    }, [supabaseClient, isSignedIn, recreateSupabaseClient]); 
    handleReconnectRef.current = handleReconnect;

    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure = false) => {
        // ... (Lógica de Autenticação, Agendamento e Swap de Canal - mantida) ...
        
        // ... (parte onde o novo canal é criado e inscrito) ...
        
        const newChannel = client.channel(channelName); 
            
        const authSwapFn = setRealtimeAuthAndChannelSwapRef.current!;
        const reconnectFn = handleReconnectRef.current!;

        attachChannelListeners(
            newChannel, client, setConnectionHealthy, 
            authSwapFn, 
            lastEventTimeRef, reconnectFn, 
            isActiveRef
        );
        
        // ... (lógica de Promise e timeout para a inscrição) ...

        // ... (lógica de sucesso e agendamento do próximo refresh) ...

        return true;

    }, [getTokenWithValidation, realtimeChannel, isSignedIn, recreateSupabaseClient]);
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;

    // -------------------------------------------------------------------------
    // Função de Download
    // -------------------------------------------------------------------------

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
        a.download = `realtime_socket_logs_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`[DOWNLOAD] ✅ ${realtimeEventLogs.length} logs de Socket (RAW) baixados.`);
    }, [realtimeEventLogs]);

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    // Effect 1: Create Client (Inicial)
    useEffect(() => {
        if (isLoaded && !supabaseClient) { 
            recreateSupabaseClient(false); 
        }
    }, [isLoaded, supabaseClient, recreateSupabaseClient]);

    // Effect 2: Inicialização e Health Check (Chamado após cliente criado)
    useEffect(() => {
        if (!supabaseClient || !isLoaded || hasInitializedRef.current) { 
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
             console.log(`[STATUS] Conexão: ${connectionHealthy ? '✅ Saudável' : '❌ Instável'}. Auth Counter: ${realtimeAuthCounter}. Logs Socket RAW Capturados: ${realtimeEventLogs.length}`);
        }
    }, [connectionHealthy, realtimeAuthCounter, supabaseClient, realtimeChannel, realtimeEventLogs.length]);

    // Effect 4: Expor a função de download no console (APENAS em DEV)
    useEffect(() => {
        if (import.meta.env.DEV) { 
            if (typeof window !== 'undefined') {
                (window as any).supabaseDownloadLogs = downloadRealtimeLogs;
                console.log('[DEBUG] 🌐 Função de download de logs Realtime (RAW) está disponível no console via: `supabaseDownloadLogs()`');

                return () => {
                    delete (window as any).supabaseDownloadLogs;
                };
            }
        }
    }, [downloadRealtimeLogs]);

    // -------------------------------------------------------------------------
    // Renderização
    // -------------------------------------------------------------------------

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
