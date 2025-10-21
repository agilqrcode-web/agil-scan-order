import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// ... (Funções utilitárias isBusinessHours, formatTime, getBusinessHoursStatus - OMITIDAS PARA BREVIDADE, MANTENHA O CÓDIGO ANTERIOR AQUI) ...

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
const TOKEN_REFRESH_MARGIN = 15 * 60 * 1000; // 15 minutos
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

// =============================================================================
// 🏗️ COMPONENTE PRINCIPAL
// =============================================================================

// Função utilitária para introduzir um pequeno delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
    
    const isRefreshingRef = useRef<boolean>(false);
    const reconnectAttemptsRef = useRef<number>(0);
    const lastEventTimeRef = useRef<number>(Date.now());
    const isActiveRef = useRef<boolean>(true);
    const setRealtimeAuthRef = useRef<((client: SupabaseClient<Database>) => Promise<boolean>) | null>(null); // Retorna boolean para sucesso

    // ... (Log inicial de status de horários - MANTENHA O CÓDIGO ANTERIOR AQUI) ...

    // ✅ Função otimizada para obter token com validação
    const getTokenWithValidation = useCallback(async () => {
        // ... (Implementação anterior - MANTENHA O CÓDIGO ANTERIOR AQUI) ...
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) return null;

            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const exp = payload.exp * 1000;
                const remainingMinutes = Math.round((exp - Date.now()) / 1000 / 60);
                
                console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos`);
                
                if (remainingMinutes < 5) console.warn('[AUTH] Token prestes a expirar');
                
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

    // Função central: APENAS define o token de autenticação no cliente
    const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>): Promise<boolean> => {
        if (isRefreshingRef.current) {
            console.log('[AUTH] ⏳ Autenticação já em progresso');
            return false;
        }
        isRefreshingRef.current = true;

        try {
            if (!client || !isSignedIn) {
                try { 
                    await client?.realtime.setAuth(null); 
                    setConnectionHealthy(false);
                } catch {}
                return false;
            }

            const token = await getTokenWithValidation();
            if (!token) {
                await client.realtime.setAuth(null);
                setConnectionHealthy(false);
                return false;
            }
            
            // A ÚNICA AÇÃO AQUI É AUTENTICAR O CLIENTE
            await client.realtime.setAuth(token); 
            console.log('[AUTH] ✅ Token aplicado com sucesso no cliente.');
            setConnectionHealthy(true);
            setRealtimeAuthCounter(prev => prev + 1);
            return true;
        } catch (error) {
            console.error('[AUTH] ‼️ Erro na autenticação:', error);
            setConnectionHealthy(false);
            return false;
        } finally {
            isRefreshingRef.current = false;
        }
    }, [isSignedIn, getTokenWithValidation]);
    
    // NOVO: Função para forçar a re-inscrição do canal
    const forceChannelReconnect = useCallback(async (client: SupabaseClient<Database>, channel: RealtimeChannel, reason: 'PROACTIVE' | 'REACTIVE') => {
        console.log(`[RECONNECT] 🧠 ${reason} - Forçando re-inscrição do canal...`);

        // 1. Define o NOVO token no cliente (setAuth)
        const authSuccess = await setRealtimeAuth(client);
        
        if (!authSuccess) {
            console.warn('[RECONNECT] Falha ao obter ou aplicar novo token. Pulando re-inscrição.');
            return;
        }

        // 2. Garante que o canal está limpo antes de re-inscrever
        if (channel.state === 'joined' || channel.state === 'joining' || channel.state === 'subscribed') {
            console.log('[RECONNECT] Desinscrevendo do canal...');
            channel.unsubscribe(); 
            await delay(100); // Pequeno delay para garantir o estado 'closed'
        }

        // 3. Força a RE-INSCRIÇÃO. Isso obriga o servidor a revalidar o token.
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[RECONNECT] ✅ Sucesso: Canal re-inscrito com novo token.');
                reconnectAttemptsRef.current = 0;
            } else if (status === 'CHANNEL_ERROR') {
                 console.error('[RECONNECT] ‼️ Erro ao re-inscrever após setAuth. Tentando novamente...');
                 // Aciona a lógica de recuperação reativa
                 if (reason === 'PROACTIVE') handleReconnect(channel); 
            }
        });
    }, [setRealtimeAuth]); // setRealtimeAuth é uma dependência crucial

    // Atualiza a ref da função de autenticação
    useEffect(() => {
        setRealtimeAuthRef.current = setRealtimeAuth;
    });

    // ✅ Backoff exponencial otimizado (LÓGICA REATIVA: após a queda)
    const handleReconnect = useCallback((channel: RealtimeChannel) => {
        if (!isActiveRef.current || !supabaseClient) return;
        
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido');
            return;
        }

        const delayTime = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        
        console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delayTime}ms (REATIVA)`);
        
        // Chamamos o forceChannelReconnect após o delay de backoff
        setTimeout(() => {
            if (isActiveRef.current && supabaseClient) {
                forceChannelReconnect(supabaseClient, channel, 'REACTIVE');
            }
        }, delayTime);
    }, [supabaseClient, forceChannelReconnect]);


    // Effect 1: Create Client (SEM ALTERAÇÃO)
    useEffect(() => {
        // ... (Implementação anterior - MANTENHA O CÓDIGO ANTERIOR AQUI) ...
        if (isLoaded && !supabaseClient) {
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
            setSupabaseClient(client);
        }
    }, [isLoaded, getToken, supabaseClient]);

    // Effect 2: Canal RealTime (LÓGICA REATIVA)
    useEffect(() => {
        if (!supabaseClient || !isLoaded || realtimeChannel) {
            return;
        }

        isActiveRef.current = true;
        console.log('[LIFECYCLE] 🚀 Iniciando canal realtime');
        const channel = supabaseClient.channel('public:orders');

        // ... (Handlers SUBSCRIBED, CLOSED, ERROR e postgres_changes - MANTENHA O CÓDIGO ANTERIOR AQUI) ...
        // CLOSED E ERROR DEVEM CHAMAR handleReconnect(channel);

        channel.on('SUBSCRIBED', () => {
            if (!isActiveRef.current) return;
            console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
            setConnectionHealthy(true);
            lastEventTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', (error) => {
            if (!isActiveRef.current) return;
            console.warn(`[LIFECYCLE] ❌ Canal fechado. Motivo: ${error?.reason || 'Desconhecido'}. Acionando reconexão reativa.`);
            setConnectionHealthy(false);
            handleReconnect(channel);
        });

        channel.on('error', (error) => {
            if (!isActiveRef.current) return;
            console.error('[LIFECYCLE] 💥 Erro no canal:', error);
            setConnectionHealthy(false);
            handleReconnect(channel);
        });
        
        // Listener para eventos do banco (MANTENHA O CÓDIGO ANTERIOR AQUI)

        // =========================================================================
        // 🧠 HEALTH CHECK INTELIGENTE COM GESTÃO DE HORÁRIOS
        // =========================================================================
        const healthCheckInterval = setInterval(() => {
             // ... (Lógica de Health Check - MANTENHA O CÓDIGO ANTERIOR AQUI) ...
             if (!isActiveRef.current) return;
            
             const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
             const isChannelSubscribed = channel.state === 'joined';
             const businessStatus = getBusinessHoursStatus();
             
             if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000) {
                 if (businessStatus.isOpen) {
                     console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 5+ minutos durante horário comercial');
                     setConnectionHealthy(false);
                     // Recuperação proativa via forceChannelReconnect
                     forceChannelReconnect(supabaseClient, channel, 'PROACTIVE');
                 } else {
                     console.log('[HEALTH-CHECK] 💤 Sem eventos - Comportamento normal (fora do horário comercial)');
                 }
             }
        }, HEALTH_CHECK_INTERVAL);


        // ✅ Token Refresh Otimizado (LÓGICA PROATIVA)
        const tokenRefreshInterval = setInterval(() => {
            if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
            
            // CHAMA A FUNÇÃO QUE FORÇA setAuth + unsubscribe + subscribe
            console.log('[TOKEN-REFRESH] 🔄 Refresh PROATIVO (15min). Forçando re-inscrição.');
            forceChannelReconnect(supabaseClient, channel, 'PROACTIVE');
        }, TOKEN_REFRESH_MARGIN);


        setRealtimeChannel(channel);
        forceChannelReconnect(supabaseClient, channel, 'PROACTIVE'); // Inscrição inicial forçada

        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando recursos');
            isActiveRef.current = false;
            clearInterval(healthCheckInterval);
            clearInterval(tokenRefreshInterval);
            supabaseClient.removeChannel(channel); 
            setRealtimeChannel(null);
            setConnectionHealthy(false);
        };
    }, [supabaseClient, isLoaded, isSignedIn, handleReconnect, realtimeChannel, forceChannelReconnect]);

    // Effect 3: Wake-Up Call (APENAS setAuth para economizar)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
                console.log('👁️ Aba visível - verificando conexão (apenas setAuth)');
                // Apenas setAuth aqui deve ser suficiente, pois a visibilidade geralmente não significa que o token expirou.
                setRealtimeAuthRef.current?.(supabaseClient); 
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [supabaseClient, isSignedIn]);

    // Funções de Contexto
    const refreshConnection = useCallback(async () => {
        if (supabaseClient && realtimeChannel) {
            console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
            forceChannelReconnect(supabaseClient, realtimeChannel, 'PROACTIVE');
        }
    }, [supabaseClient, realtimeChannel, forceChannelReconnect]);

    const requestReconnect = useCallback(async () => {
        await refreshConnection();
        return true;
    }, [refreshConnection]);

    if (!supabaseClient || !realtimeChannel) {
        // ... (Renderização do Spinner)
    }

    return (
        <SupabaseContext.Provider value={{
            supabaseClient,
            realtimeChannel,
            connectionHealthy,
            realtimeAuthCounter,
            requestReconnect,
            setRealtimeAuth: () => supabaseClient && setRealtimeAuthRef.current?.(supabaseClient).then(() => {}), // Adaptação para Promise<void>
            refreshConnection,
        }}>
           {/* ... (children e indicador visual) ... */}
        </SupabaseContext.Provider>
    );
}
