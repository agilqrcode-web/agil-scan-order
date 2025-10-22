// SupabaseProvider.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

// =============================================================================
// ⚙️ CONFIGURAÇÕES E CONSTANTES
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_MS = 30 * 1000; // Renovar 30 segundos antes da expiração (Preciso)

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;


// =============================================================================
// 🛠️ FUNÇÕES AUXILIARES (Debounce e Horário - ASSUMA QUE ESTÃO IMPLEMENTADAS)
// =============================================================================

// Função auxiliar de debounce
const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: number | undefined;
    
    const debouncedFunction = (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
    
    (debouncedFunction as any).cancel = () => {
        clearTimeout(timeoutId);
    };
    
    return debouncedFunction;
};

// ... (Restante das funções getBusinessHoursStatus, formatTime, etc., que você já tem)
// Nota: Certifique-se de que estas funções estejam implementadas e importadas corretamente.
const BUSINESS_HOURS_CONFIG = { /* ... (Mantido do código anterior) ... */ };
const formatTime = (decimalHours: number): string => { return ""; /* Implementação */ };
const getBusinessHoursStatus = (): { isOpen: boolean; message: string; nextChange?: string } => { return { isOpen: true, message: "Aberto" }; /* Implementação */ };


// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Refs e Estados...
    const supabaseClientRef = useRef<SupabaseClient<Database> | null>(null);
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
    const tokenRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
    const [isChannelReady, setIsChannelReady] = useState(false); 
    
    const isRefreshingRef = useRef<boolean>(false);
    const reconnectAttemptsRef = useRef<number>(0);
    const lastEventTimeRef = useRef<number>(Date.now());
    const isActiveRef = useRef<boolean>(true);

    // Log inicial de horário (MANTIDO)
    useEffect(() => { /* ... (Mantido) ... */ }, []);


    // Função 1: Obtém, aplica e valida o token, retornando o exp para agendamento
    const setRealtimeAuthAndGetExpiry = useCallback(async (client: SupabaseClient<Database>): Promise<number | null> => {
        console.log('[AUTH] 3. Processo de autenticação do cliente iniciado.');
        
        try {
            if (!isSignedIn) {
                await client.realtime.setAuth(null);
                console.log('[AUTH] ⚠️ Usuário não logado. Usando Realtime anônimo.');
                setConnectionHealthy(true);
                return null; // Sem expiração para anônimo
            }

            const token = await getToken({ template: 'supabase' });
            if (!token) throw new Error("Token não obtido.");

            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp * 1000;
            const remainingMinutes = Math.round((exp - Date.now()) / 1000 / 60);

            await client.realtime.setAuth(token);
            console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos`);
            console.log('[AUTH] ✅ Token aplicado com sucesso no cliente.');

            setConnectionHealthy(true);
            
            return exp;
        } catch (error) {
            console.error('[AUTH] ‼️ Erro na autenticação:', error);
            setConnectionHealthy(false);
            return null;
        }
    }, [isSignedIn, getToken]);

    // Função 4: Backoff exponencial otimizado (MANTIDO)
    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current || !supabaseClientRef.current) return;
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido. Parando.');
            return;
        }

        const client = supabaseClientRef.current;
        const delayTime = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        
        console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delayTime}ms (REATIVA)`);
        
        setTimeout(() => {
            if (isActiveRef.current && client) {
                createAndSwapChannelRef.current?.(client, channel, 'REACTIVE');
            }
        }, delayTime);
    }, []);


    // Função 3: Troca Atômica de Canal (NOVA LÓGICA CENTRAL)
    const createAndSwapChannelRef = useRef<((client: SupabaseClient<Database>, oldChannel: RealtimeChannel | null, reason: 'PROACTIVE' | 'REACTIVE') => Promise<void>) | null>(null);

    const createAndSwapChannel = useCallback(async (client: SupabaseClient<Database>, oldChannel: RealtimeChannel | null, reason: 'PROACTIVE' | 'REACTIVE') => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setConnectionHealthy(false);
        console.log(`[SWAP] 🧠 ${reason} - Iniciando troca atômica de canal...`);

        try {
            // 1. Renovar e aplicar o token no cliente Realtime
            const exp = await setRealtimeAuthAndGetExpiry(client);
            
            if (exp !== null) {
                // 2. Agendar o próximo refresh (BASEADO NO EXPIRATION)
                if (tokenRefreshTimeoutRef.current) clearTimeout(tokenRefreshTimeoutRef.current);
                const delay = Math.max(0, exp - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
                
                tokenRefreshTimeoutRef.current = setTimeout(() => {
                    if (isActiveRef.current) {
                        console.log('[TOKEN-SCHEDULER] ⏳ Hora de renovar o token proativamente.');
                        createAndSwapChannelRef.current?.(client, realtimeChannelRef.current, 'PROACTIVE');
                    }
                }, delay);
                console.log(`[SCHEDULER] ⏱️ Próxima renovação agendada para daqui a ${Math.ceil(delay / 60000)} minutos.`);
            }

            // 3. Criação do NOVO canal
            const newChannel = client.channel('public:orders');

            // 4. Anexar Handlers ao NOVO canal
            newChannel.on('SUBSCRIBED', () => {
                console.log('[SWAP] ✅ NOVO Canal inscrito com sucesso. Finalizando troca.');
                setConnectionHealthy(true);
                lastEventTimeRef.current = Date.now(); // 💡 Atualiza tempo no sucesso
                reconnectAttemptsRef.current = 0;
                setIsChannelReady(true);

                // Troca Atômica de Refs
                if (oldChannel && oldChannel !== newChannel) {
                    console.log('[SWAP] 🗑️ Removendo canal antigo.');
                    client.removeChannel(oldChannel);
                }
                realtimeChannelRef.current = newChannel;

                // 🌟 ATUALIZAÇÃO FINAL: Incrementa o contador para notificar os hooks de Realtime
                setRealtimeAuthCounter(prev => prev + 1); 

            }).on('CLOSED', () => {
                if (!isActiveRef.current) return;
                console.warn('[SWAP] ❌ Canal fechado. Acionando reconexão reativa (Backoff).');
                setConnectionHealthy(false);
                // ⚠️ Se o canal fechar, iniciamos uma reconexão para um NOVO SWAP
                handleReconnect(newChannel);
            
            }).on('error', (error) => {
                if (!isActiveRef.current) return;
                console.error('[SWAP] 💥 Erro no NOVO canal:', error);
                setConnectionHealthy(false);
                // ⚠️ Se der erro, iniciamos uma reconexão para um NOVO SWAP
                handleReconnect(newChannel);
            });
            // ❌ REMOVIDO: O listener de 'postgres_changes' para 'orders' foi removido daqui.
            // O useRealtimeOrders é o único responsável por isso.

            // 5. Inscrição do NOVO canal
            newChannel.subscribe();
            
        } catch (error) {
            console.error('[SWAP] Falha fatal no processo de troca:', error);
            setConnectionHealthy(false);
        } finally {
            isRefreshingRef.current = false;
        }
    }, [setRealtimeAuthAndGetExpiry, handleReconnect, isSignedIn]);

    useEffect(() => {
        createAndSwapChannelRef.current = createAndSwapChannel;
    }, [createAndSwapChannel]);


    // Effect 1: Create Client and Channel (Inicialização)
    useEffect(() => {
        if (!isLoaded) return;

        console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
        const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: {
                fetch: async (input, init) => {
                    const token = await getToken();
                    const headers = new Headers(init?.headers);
                    if (token) headers.set('Authorization', `Bearer ${token}`);
                    return fetch(input, { ...init, headers });
                },
            },
        });
        supabaseClientRef.current = client;
        setSupabaseClient(client); 

        isActiveRef.current = true;
        console.log('[LIFECYCLE] 🚀 Inicializando canal realtime');

        // Na inicialização, chamamos o SWAP sem um canal antigo
        createAndSwapChannelRef.current?.(client, null, 'PROACTIVE');

        // Cleanup
        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos (Cleanup do Init)');
            isActiveRef.current = false;
            if (realtimeChannelRef.current) {
                client.removeChannel(realtimeChannelRef.current);
            }
            if (tokenRefreshTimeoutRef.current) {
                clearTimeout(tokenRefreshTimeoutRef.current);
            }
            realtimeChannelRef.current = null;
        };
    }, [isLoaded, getToken, createAndSwapChannel]);


    // Effect 2: Health Check (Mantido e agora depende dos eventos do SUBSCRIBED/CLOSED)
    useEffect(() => {
        const client = supabaseClientRef.current;
        
        // Dependemos de isChannelReady para garantir que o canal foi criado pelo menos uma vez
        if (!isChannelReady || !client) return;

        // HEALTH CHECK
        const healthCheckInterval = setInterval(() => {
            const channel = realtimeChannelRef.current;
            if (!isActiveRef.current || !channel) return;
            
            const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
            const isChannelSubscribed = channel.state === 'joined';
            const businessStatus = getBusinessHoursStatus();
            
            // ⚠️ O Health Check agora usa o lastEventTimeRef para detectar silêncio.
            if (isChannelSubscribed && timeSinceLastEvent > HEALTH_CHECK_INTERVAL * 2 && businessStatus.isOpen) {
                console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há mais de 10 minutos (2x o intervalo). Recuperação proativa.');
                createAndSwapChannelRef.current?.(client, channel, 'PROACTIVE');
            }
        }, HEALTH_CHECK_INTERVAL);

        return () => {
            clearInterval(healthCheckInterval);
        };
    }, [isChannelReady]); 


    // Effect 3: Wake-Up Call (COM DEBOUNCE - MANTIDO)
    useEffect(() => {
        const client = supabaseClientRef.current;
        const channel = realtimeChannelRef.current;

        const checkVisibilityAndReconnect = () => {
            if (document.visibilityState === 'visible' && client && isSignedIn) {
                console.log('👁️ Aba visível - verificando conexão (Forçando troca de canal)');
                // Dispara a troca completa.
                createAndSwapChannelRef.current?.(client, channel, 'REACTIVE');
            }
        };
        
        const debouncedReconnect = debounce(checkVisibilityAndReconnect, 1000);

        document.addEventListener('visibilitychange', debouncedReconnect);
        
        return () => {
            document.removeEventListener('visibilitychange', debouncedReconnect);
            (debouncedReconnect as any).cancel?.();
        };
    }, [isSignedIn]);


    // Funções de Contexto (Atualizadas)
    const refreshConnection = useCallback(async () => {
        const client = supabaseClientRef.current;
        const channel = realtimeChannelRef.current;

        if (client) {
            console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
            await createAndSwapChannelRef.current?.(client, channel, 'PROACTIVE');
        }
    }, []); 

    const requestReconnect = useCallback(async () => {
        await refreshConnection();
        return true;
    }, [refreshConnection]);


    if (!supabaseClient || !isChannelReady) {
        // Renderizar um Spinner ou null aqui
        return <Spinner />; 
    }

    return (
        <SupabaseContext.Provider value={{
            supabaseClient, 
            realtimeChannel: realtimeChannelRef.current,
            connectionHealthy,
            realtimeAuthCounter,
            requestReconnect,
            setRealtimeAuth: () => supabaseClient && createAndSwapChannelRef.current?.(supabaseClient, realtimeChannelRef.current, 'PROACTIVE'),
            refreshConnection,
        }}>
            {children}
        </SupabaseContext.Provider>
    );
}
