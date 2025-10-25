import React, { useEffect, useState, useCallback, useRef } from 'react';
// CORREÇÃO DE BUILD: 'RealtimeSubscriptionState' foi removido desta importação.
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'; 
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, SupabaseContextType, RealtimeLog } from "@/contexts/SupabaseContext"; 
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types'; 

// Variáveis de Ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA (Ajustes de Timing)
// =============================================================================

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutos de margem
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 15000; // AUMENTADO para 15s para dar mais tempo para o swap
const PROTOCOL_STABILITY_DELAY_MS = 300; // AUMENTADO para 300ms para estabilizar setAuth

// 🚨 FLAG CRÍTICO: Desativado para usar o fluxo de RLS/Token em produção.
const FORCE_PUBLIC_CHANNEL = false; 

// Tipos e Funções Auxiliares
type AuthSwapFn = (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure?: boolean) => Promise<boolean>;
type ReconnectFn = (channel: RealtimeChannel, client: SupabaseClient) => void;
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
const DEBUG_PROTOCOLS = ['phx_join', 'phx_reply', 'heartbeat', 'access_token', 'unsub'];

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
                // Usa o fetch com token APENAS se estiver logado e NÃO forçado ao público
                fetch: isSignedIn && !FORCE_PUBLIC_CHANNEL ? async (input, init) => { 
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

    // Estados e Referências
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
    
    // Efeito de Log Inicial
    useEffect(() => {
        const businessStatus = getBusinessHoursStatus();
        console.log(`🏪 ${businessStatus.message}`);
    }, []);

    // Função para lidar com mensagens de log RAW do WebSocket
    const handleRealtimeMessage: HandleMessageFn = useCallback((type, message) => {
        if (!isActiveRef.current) return;
        
        if (setRealtimeEventLogsRef.current) {
            
            // Se recebermos uma resposta OK ou dados, consideramos a conexão saudável
            if (message?.event === 'postgres_changes' || (message?.event === 'phx_reply' && message?.payload?.status === 'ok')) {
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

    // Função para recriar o cliente Supabase do zero
    const recreateSupabaseClient: RecreateClientFn = useCallback((isHardReset: boolean = true) => {
        if (isHardReset) {
             console.log('%c[PROVIDER-INIT] ♻️ Forçando recriação COMPLETA do cliente Supabase e do Socket Realtime (Hard Reset)', 'color: #ff9800; font-weight: bold;');
        } else {
             console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        }
        
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        // CORREÇÃO DE BUILD APLICADA AQUI: Usando string literal para o estado do canal
        if (supabaseClient) { 
            supabaseClient.getChannels().forEach(channel => {
                // Os estados possíveis são: 'subscribed', 'joining', 'closed', 'errored'
                if (channel.state === 'subscribed' || channel.state === 'joining') {
                    console.log(`[PROVIDER-INIT] 🧹 Removendo canal ativo: ${channel.topic}`);
                    supabaseClient.removeChannel(channel);
                }
            });
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
    }, [getToken, supabaseClient, isSignedIn, handleRealtimeMessage]); 
    recreateSupabaseClientRef.current = recreateSupabaseClient;

    // Função para obter o token do Clerk com validação e log de expiração (Mantida)
    const getTokenWithValidation = useCallback(async () => {
        try {
             const token = await getToken({ template: 'supabase' });
             if (!token) { console.warn('[AUTH] Token não disponível ou usuário deslogado.'); return null; }
             
             try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const remainingMinutes = Math.round((payload.exp * 1000 - Date.now()) / 1000 / 60);
                
                console.log(`%c[AUTH] Token renovado | Expira em: ${remainingMinutes} minutos`, 'color: #9c27b0; font-weight: bold;');
                
                if ((payload.exp * 1000 - Date.now()) < REFRESH_MARGIN_MS) {
                    console.warn('[AUTH] Token prestes a expirar - Abaixo da margem de refresh.');
                }
             } catch(e) {
                 console.error('[AUTH] Erro ao parsear token JWT:', e);
             }
             
             return token;
         } catch (error) {
             console.error('[AUTH] Erro ao obter token do Clerk:', error);
             return null;
         }
    }, [getToken]);

    // Função para adicionar listeners ao canal Realtime (APENAS ciclo de vida)
    const attachChannelListeners = (
        channel: RealtimeChannel,
        client: SupabaseClient,
        setHealthy: React.Dispatch<React.SetStateAction<boolean>>,
        lastEventRef: React.MutableRefObject<number>,
        reconnectHandler: ReconnectFn,
        activeRef: React.MutableRefObject<boolean>
    ) => {
        // ESTA FUNÇÃO GERE APENAS O CICLO DE VIDA DO CANAL (SUBSCRIBED, CLOSED, ERROR).
        // OS LISTENERS DE DADOS (postgres_changes para 'orders') SÃO GERENCIADOS PELO useRealtimeOrders.

        channel.on('SUBSCRIBED', () => {
             if (!activeRef.current) return;
             console.log(`[LIFECYCLE] ✅ Canal '${channel.topic}' inscrito com sucesso`);
             setHealthy(true);
             lastEventRef.current = Date.now();
             reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', ({ reason, code }) => {
             if (!activeRef.current) return;
             console.warn(`[LIFECYCLE] ❌ Canal '${channel.topic}' fechado. Motivo: ${reason || 'N/A'}. Código: ${code || 'N/A'}`);
             setHealthy(false);
             reconnectHandler(channel, client);
        });

        channel.on('error', (error) => {
             if (!activeRef.current) return;
             console.error(`[LIFECYCLE] 💥 Erro no canal '${channel.topic}':`, error);
             setHealthy(false);
             reconnectHandler(channel, client);
        });
    };

    // Função para lidar com a reconexão em caso de erro
    const handleReconnect: ReconnectFn = useCallback((channel: RealtimeChannel, client: SupabaseClient) => {
        if (!isActiveRef.current || isRefreshingRef.current) {
            console.log('[RECONNECT-AUTH] ⏳ Ignorando reconexão: Provider inativo ou já em refresh.');
            return;
        }
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT-AUTH] 🛑 Máximo de tentativas atingido. Forçando recriação completa.');
            setConnectionHealthy(false);
            recreateSupabaseClientRef.current!(true); 
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[RECONNECT-AUTH] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms. Re-autenticando e fazendo SWAP...`);

        setTimeout(() => {
            if (isActiveRef.current) {
                // Tenta re-autenticar e trocar o canal com o flag de retry
                setRealtimeAuthAndChannelSwapRef.current?.(client, false, true); 
            }
        }, delay);
    }, []); 
    handleReconnectRef.current = handleReconnect;

    // Função Crítica: Autentica o Realtime e Faz o Swap do Canal
    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure = false) => {
        if (isRefreshingRef.current && !isRetryAfterFailure) {
            console.log('[AUTH-SWAP] ⏳ Autenticação/Swap já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        
        // Hard Reset no retry: Se a falha for persistente, precisamos de um novo cliente limpo.
        if (isRetryAfterFailure && reconnectAttemptsRef.current >= 3) {
            console.log('%c[AUTH-SWAP] 🔨 Tentativas excedidas: Forçando Hard Reset para limpar estado de socket/auth.', 'color: #ff9800;');
            recreateSupabaseClientRef.current!(true);
            isRefreshingRef.current = false;
            return false; 
        }

        let oldChannel: RealtimeChannel | null = realtimeChannel;
        let success = false;
        let expirationTime: number | null = null;
        
        // Limpa o agendamento de refresh anterior
        if (tokenRefreshTimeoutRef.current) {
            clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        try {
            let channelName: string; 
            let newToken: string | null = null;
            
            // 1. OBTENÇÃO DO TOKEN E DECISÃO DO CANAL (Private/Public)
            if (isSignedIn && !FORCE_PUBLIC_CHANNEL) {
                newToken = await getTokenWithValidation();
                channelName = 'private:orders'; 
            } else {
                channelName = 'public:orders'; 
            }

            // 2. APLICAÇÃO DA AUTENTICAÇÃO
            if (newToken) {
                // Aplica o novo token
                await client.realtime.setAuth(newToken);
                console.log(`%c[AUTH-SWAP] 🔑 setAuth() chamado. Aguardando ${PROTOCOL_STABILITY_DELAY_MS}ms para estabilização do token.`, 'color: #9c27b0');
                await new Promise(resolve => setTimeout(resolve, PROTOCOL_STABILITY_DELAY_MS)); 
                
                try {
                    const payload = JSON.parse(atob(newToken.split('.')[1]));
                    expirationTime = payload.exp * 1000;
                } catch (error) { /* Ignora */ }
            } else {
                // Limpa autenticação (para anônimo/público)
                await client.realtime.setAuth(null);
                console.log('[AUTH-SWAP] 🧹 Limpeza de Auth: setAuth(null) executado.');
            }

            console.log(`[AUTH-SWAP] ✅ Token aplicado. Usando canal: ${channelName}`);


            // 3. Cria novo canal e faz o SWAP (Lógica Atômica)
            const newChannel = client.channel(channelName); 
            
            const reconnectFn = handleReconnectRef.current!;

            // Adiciona listeners de ciclo de vida (SUBSCRIBED, ERROR, CLOSED)
            attachChannelListeners(
                newChannel, client, setConnectionHealthy, 
                lastEventTimeRef, reconnectFn, 
                isActiveRef
            );
            
            // Tenta subscrever no novo canal
            const swapSuccess = await new Promise<boolean>(resolve => {
                const timeout = setTimeout(() => {
                    console.warn('[AUTH-SWAP] ⚠️ Timeout na inscrição do novo canal. Status final: ' + newChannel.state);
                    resolve(false);
                }, CHANNEL_SUBSCRIBE_TIMEOUT); 

                newChannel.subscribe(status => {
                    if (status === 'SUBSCRIBED') {
                        clearTimeout(timeout);
                        console.log(`[AUTH-SWAP] ✅ Novo canal '${newChannel.topic}' inscrito. Realizando swap atômico...`);
                        
                        if (oldChannel) {
                            // SWAP ATÔMICO: Desinscrever o canal antigo APÓS o novo ter se conectado com sucesso.
                            try {
                                client.removeChannel(oldChannel);
                                console.log(`[AUTH-SWAP] 🧹 Canal antigo '${oldChannel.topic}' removido.`);
                            } catch (e) {
                                console.error(`[AUTH-SWAP] 🚨 Erro ao remover canal antigo ${oldChannel.topic}:`, e);
                            }
                        }
                        
                        setRealtimeChannel(newChannel);
                        setConnectionHealthy(true); 
                        setRealtimeAuthCounter(prev => prev + 1); // Incrementar o contador
                        resolve(true);
                    } else if (status === 'CHANNEL_ERROR') {
                        clearTimeout(timeout);
                        console.error(`%c[AUTH-SWAP] ❌ Erro na inscrição do novo canal '${newChannel.topic}'. STATUS DA RESPOSTA DO SOCKET É: ${newChannel.state}.`, 'color: #e53935; font-weight: bold;'); 
                        resolve(false); 
                    }
                });
            });

            if (!swapSuccess) {
                 setConnectionHealthy(false);
                 console.warn('[AUTH-SWAP] ⚠️ Falha na inscrição do canal. O listener de erro tentará reconectar ou Hard Reset se necessário.');
            }
            
            // 4. Agendamento do próximo refresh
            if (isSignedIn && expirationTime && !FORCE_PUBLIC_CHANNEL && swapSuccess) { 
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

            success = swapSuccess;
        } catch (error) {
            console.error('[AUTH-SWAP] ‼️ Erro fatal na autenticação/swap:', error);
            setConnectionHealthy(false);
            // No caso de erro fatal, tenta uma reconexão rápida como fallback
            handleReconnectRef.current?.(oldChannel || client.channel('dummy'), client);
            success = false;
        } finally {
            isRefreshingRef.current = false;
        }
        return success;
    }, [getTokenWithValidation, realtimeChannel, isSignedIn]);
    setRealtimeAuthAndChannelSwapRef.current = setRealtimeAuthAndChannelSwap;
    

    // =============================================================================
    // 🚀 EFEITO PRINCIPAL DE INICIALIZAÇÃO E CICLO DE VIDA
    // =============================================================================

    useEffect(() => {
        if (!isLoaded || hasInitializedRef.current) {
            if (!isLoaded) console.log('[PROVIDER-INIT] ⏳ Clerk não carregado.');
            return;
        }
        
        console.log('[PROVIDER-INIT] 🚀 Iniciando o ciclo de vida Supabase (Clerk isLoaded = true)');
        
        // 1. Cria o Cliente Supabase
        const newClient = recreateSupabaseClientRef.current!(false); 

        // 2. Inicia a conexão Realtime e Autenticação
        const initConnection = async () => {
            const success = await setRealtimeAuthAndChannelSwapRef.current?.(newClient, false);
            
            if (success) {
                hasInitializedRef.current = true;
                console.log('[PROVIDER-INIT] ✅ Inicialização de conexão concluída com sucesso.');
            } else {
                 console.warn('[PROVIDER-INIT] ⚠️ Falha na inicialização da conexão Realtime. O listener do canal tentará reconexão se o problema persistir.');
                 hasInitializedRef.current = true;
            }
        }

        initConnection();

        // Função de Cleanup (Geral)
        return () => {
            isActiveRef.current = false;
            if (tokenRefreshTimeoutRef.current) {
                clearTimeout(tokenRefreshTimeoutRef.current);
            }
            console.log('[PROVIDER-INIT] 🔴 Cleanup do Provider: Referências desativadas.');
        };
    }, [isLoaded]); 
    

    // Efeito para sincronizar a função de logs
    useEffect(() => {
        setRealtimeEventLogsRef.current = setRealtimeEventLogs;
    }, [setRealtimeEventLogs]); 

    // Função de download de logs
    const downloadRealtimeLogs = useCallback(() => {
        const jsonString = JSON.stringify(realtimeEventLogs, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `supabase-realtime-logs-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[LOGS] Logs de Realtime baixados.');
    }, [realtimeEventLogs]);


    // Renderização
    const providerValue: SupabaseContextType = {
        supabaseClient: supabaseClient as SupabaseClient<Database>, 
        realtimeChannel,
        connectionHealthy,
        realtimeAuthCounter,
        recreateSupabaseClient: recreateSupabaseClientRef.current!,
        downloadRealtimeLogs,
        realtimeEventLogs, 
    };

    // Se o Clerk não carregou ou o cliente Supabase não foi criado, mostra o spinner
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
