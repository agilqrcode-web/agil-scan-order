import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Removido 'delay'

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    
    const isRefreshingRef = useRef<boolean>(false);
    const reconnectTimerRef = useRef<number | null>(null);
    const reconnectAttemptsRef = useRef<number>(0);
    const authFnRef = useRef<((client: SupabaseClient<Database>) => Promise<void>) | null>(null);

    // Função central: APENAS define o token de autenticação
    const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
        if (isRefreshingRef.current) {
            console.log('[AUTH] ⏳ Autenticação já em progresso. Pulando.');
            return;
        }
        isRefreshingRef.current = true;
        console.log('[AUTH] 3. Processo de autenticação do canal iniciado.');

        try {
            if (!client || !isSignedIn) {
                try { await client?.realtime.setAuth(null); } catch {}
                realtimeChannel?.unsubscribe();
                return;
            }

            console.log('[AUTH] --> Pedindo novo token ao Clerk...');
            const token = await getToken({ template: 'supabase' }); 

            if (!token) {
                console.warn('[AUTH] --> Token nulo recebido do Clerk. Limpando autenticação.');
                await client.realtime.setAuth(null);
                realtimeChannel?.unsubscribe();
                return;
            }
            
            console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
            // A ÚNICA AÇÃO AQUI É AUTENTICAR A CONEXÃO
            await client.realtime.setAuth(token); 
            console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');

            // O subscribe/unsubscribe foi removido daqui!

        } catch (e) {
            console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
        } finally {
            isRefreshingRef.current = false;
        }
    }, [isSignedIn, getToken, realtimeChannel]);

    useEffect(() => {
        authFnRef.current = setRealtimeAuth;
    });

    // Effect 1: Create Client (Criação do Cliente Supabase)
    useEffect(() => {
        if (isLoaded && !supabaseClient) {
            console.log('[PROVIDER-INIT] ⚙️ 1. Clerk carregado. Criando cliente Supabase.');
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

    // Effect 2: Reactive Channel & Auth Lifecycle (Gerencia a vida do Canal e Reações a Erros)
    useEffect(() => {
        if (!supabaseClient || !isLoaded) {
            return;
        }
        
        // CORREÇÃO DO LOOP: IMPEDE A RE-CRIAÇÃO DESNECESSÁRIA
        if (realtimeChannel) {
            return;
        }

        console.log('[LIFECYCLE] 🚀 2. Cliente Supabase pronto. Iniciando ciclo de vida do canal...');
        const channel = supabaseClient.channel('public:orders');

        const handleRecovery = (reason: 'CLOSED' | 'ERROR') => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            
            const attempts = reconnectAttemptsRef.current;
            const delayTime = Math.min(1000 * (2 ** attempts), 30000);
            console.log(`[LIFECYCLE] 🔄 Tentando recuperar conexão em ${delayTime / 1000}s (tentativa ${attempts + 1}). Motivo: ${reason}`);
            
            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectAttemptsRef.current = attempts + 1;
                console.log('[LIFECYCLE] --> Etapa 1: Re-autenticando...');
                
                // 1. Força a re-autenticação (define o novo token)
                authFnRef.current?.(supabaseClient);
                
                // 2. Re-inscrição (usando o novo token)
                if (channel.state === 'closed' || channel.state === 'errored') {
                    channel.subscribe(); 
                    console.log('[LIFECYCLE] --> Etapa 2: Tentando se inscrever novamente com novo token.');
                } else {
                     // Caso raro: o canal pode estar em outro estado, apenas garante que o subscribe rode
                     channel.subscribe();
                }

            }, delayTime);
        };

        channel.on('SUBSCRIBED', () => {
            console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectAttemptsRef.current = 0;
        });

        channel.on('CLOSED', () => {
            console.warn(`[LIFECYCLE] ❌ ATENÇÃO: Canal fechado. Acionando lógica de recuperação automática.`);
            handleRecovery('CLOSED');
        });

        channel.on('error', (error) => {
            console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
            handleRecovery('ERROR');
        });

        setRealtimeChannel(channel);

        console.log('[LIFECYCLE] --> Disparando autenticação inicial.');
        authFnRef.current?.(supabaseClient);

        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando... Removendo canal e timers.');
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            supabaseClient.removeChannel(channel); 
        };
    }, [supabaseClient, isLoaded, setRealtimeAuth, realtimeChannel]);

    // Effect 3: Renovação Proativa do Token (Garante que o token seja sempre renovado)
    useEffect(() => {
        if (!supabaseClient || !isSignedIn) {
            return;
        }

        const RENEW_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

        const renewAuth = () => {
            console.log('[AUTH-INTERVAL] ⏱️ Renovação periódica agendada acionada. Forçando novo token.');
            authFnRef.current?.(supabaseClient); 
        };

        // Delay para garantir que a inicialização do Effect 2 termine antes de iniciar a renovação
        const initialTimer = window.setTimeout(() => {
            renewAuth();
            const intervalId = window.setInterval(renewAuth, RENEW_INTERVAL_MS);
            return () => {
                console.log('[AUTH-INTERVAL] 🧹 Limpando intervalo de renovação.');
                window.clearInterval(intervalId);
            };
        }, 5000); 

        return () => {
            window.clearTimeout(initialTimer);
        };
    }, [supabaseClient, isSignedIn]);

    // Effect 4: The "Wake-Up Call"
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
                console.log('👁️ Aba se tornou visível. Verificando saúde da conexão e token.');
                authFnRef.current?.(supabaseClient);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [supabaseClient, isSignedIn]);


    if (!supabaseClient || !realtimeChannel) {
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
            realtimeAuthCounter: 0,
            requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
            setRealtimeAuth: () => supabaseClient && authFnRef.current?.(supabaseClient),
        }}>
            {children}
        </SupabaseContext.Provider>
    );
}
