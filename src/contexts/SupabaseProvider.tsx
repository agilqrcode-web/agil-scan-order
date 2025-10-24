import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, SupabaseContextType, RealtimeLog } from "@/contexts/SupabaseContext"; 
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types'; 

// Variáveis de Ambiente
// 🚨 ATENÇÃO: Verifique se estas chaves estão definidas corretamente no seu ambiente Vercel/VITE
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// ⚙️ CONFIGURAÇÕES DE PERFORMANCE E RESILIÊNCIA
// =============================================================================

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutos de margem
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const CHANNEL_SUBSCRIBE_TIMEOUT = 10000; 
const PROTOCOL_STABILITY_DELAY_MS = 100; // FIX: Delay para estabilizar setAuth

// 🚨 NOVO FLAG DE DEBUG: ATIVADO PARA ISOLAR PROBLEMA RLS
// Com TRUE, todos os usuários (logados ou não) se conectam ao canal 'public:orders'.
const FORCE_PUBLIC_CHANNEL = true;

// Tipos e Funções Auxiliares
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
                // Se não forçarmos o canal público, usamos o fetch com token para requisições REST/RPC
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

    // Função para recriar o cliente Supabase do zero
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
        hasInitializedRef.current = false; // Resetamos a inicialização para tentar novamente no effect

        return newClient;
    }, [getToken, realtimeChannel, isSignedIn, handleRealtimeMessage]); 
    recreateSupabaseClientRef.current = recreateSupabaseClient;

    // Função para obter o token do Clerk com validação e log de expiração
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

    // Função para adicionar listeners ao canal Realtime
    const attachChannelListeners = (
        channel: RealtimeChannel,
        client: SupabaseClient,
        setHealthy: React.Dispatch<React.SetStateAction<boolean>>,
        setAuthSwap: AuthSwapFn,
        lastEventRef: React.MutableRefObject<number>,
        reconnectHandler: ReconnectFn,
        activeRef: React.MutableRefObject<boolean>
    ) => {
        // Listener de dados de pedidos (mantido)
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

        // Listener para a tabela 'orders'
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeDataEvent
        );
    };

    // Função para lidar com a reconexão em caso de erro
    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current) return;
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT-AUTH] 🛑 Máximo de tentativas atingido. Parando e forçando recriação.');
            setConnectionHealthy(false);
            // Força um Hard Reset para limpar o estado e tentar uma nova conexão limpa
            recreateSupabaseClientRef.current!(true); 
            return;
        }

        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;

        console.log(`[RECONNECT-AUTH] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);

        setTimeout(() => {
            if (isActiveRef.current && supabaseClient) {
                // Tenta re-autenticar e trocar o canal com o flag de retry
                setRealtimeAuthAndChannelSwapRef.current?.(supabaseClient, false, true); 
            }
        }, delay);
    }, [supabaseClient]); 
    handleReconnectRef.current = handleReconnect;

    // Função Crítica: Autentica o Realtime e Faz o Swap do Canal
    const setRealtimeAuthAndChannelSwap = useCallback(async (client: SupabaseClient, isProactiveRefresh: boolean, isRetryAfterFailure = false) => {
        if (isRefreshingRef.current && !isRetryAfterFailure) {
            console.log('[AUTH-SWAP] ⏳ Autenticação/Swap já em progresso');
            return false;
        }
        isRefreshingRef.current = true;
        
        // Se for um Retry após falha e o usuário estiver logado E NO MODO PRIVADO, forçamos a recriação.
        if (isSignedIn && isRetryAfterFailure && !FORCE_PUBLIC_CHANNEL) {
            console.log('[AUTH-SWAP] 🔨 Retry de Falha: Forçando recriação de cliente para estado limpo.');
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
            
            // 🚨 FLUXO PRINCIPAL: Se estiver logado E NÃO for para forçar o público
            if (isSignedIn && !FORCE_PUBLIC_CHANNEL) {
                // FLUXO DE CANAL PRIVADO (Original, requer RLS)
                const newToken = await getTokenWithValidation();
                if (!newToken) {
                    await client?.realtime.setAuth(null); setConnectionHealthy(false);
                    throw new Error("Token não pôde ser obtido/validado.");
                }
                
                channelName = 'private:orders'; 
                
                // FIX: Chama setAuth e espera para estabilização do protocolo
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
                // FLUXO DE CANAL PÚBLICO (Forçado ou Deslogado)
                channelName = 'public:orders'; 
                console.log(`%c[AUTH-SWAP] 🅿️ Usando canal PÚBLICO: ${channelName}. (FORCE_PUBLIC_CHANNEL: ${FORCE_PUBLIC_CHANNEL} | isSignedIn: ${isSignedIn})`, 'color: #f57f17');
                await client.realtime.setAuth(null);
                console.log('[AUTH-SWAP] 🧹 Limpeza de Auth: setAuth(null) executado para canal público.');
            }

            // Cria novo canal e faz o SWAP COMPLETO na re-inscrição
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
                        resolve(true);
                    } else if (status === 'CHANNEL_ERROR') {
                        clearTimeout(timeout);
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
            
            // Agendamento do próximo refresh - APENAS SE ESTIVERMOS NO MODO PRIVADO
            if (isSignedIn && expirationTime && !FORCE_PUBLIC_CHANNEL) { 
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
            
            // Se falha na autenticação (token expirado/inválido)
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                console.log('[AUTH-SWAP-RETRY] 🔨 Falha crítica de AUTH. Recriando cliente e tentando novamente...');
                // Chama a função de reconexão para aplicar o backoff e retry
                handleReconnectRef.current?.(oldChannel || client.channel('dummy')); 
            } else {
                setConnectionHealthy(false);
            }
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
        // 🛑 Condição para evitar execução: Clerk ainda não carregou OU já inicializamos e não é para recriar
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
                 console.error('[PROVIDER-INIT] ‼️ Falha na inicialização da conexão Realtime.');
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

    // Função de download de logs (Placeholder)
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
