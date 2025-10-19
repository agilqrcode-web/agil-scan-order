import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    
    // --- Refs para gerenciar o estado da autenticação e reconexão ---
    const isRefreshingRef = useRef<boolean>(false);
    const reconnectTimerRef = useRef<number | null>(null);
    const reconnectAttemptsRef = useRef<number>(0);
    const authFnRef = useRef<((client: SupabaseClient<Database>) => Promise<void>) | null>(null);

    // Função central para autenticar (ou re-autenticar) o canal Realtime
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
                // Força o canal a se fechar em caso de logout
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
            await client.realtime.setAuth(token);
            console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');

            // >>> A LINHA CRÍTICA: FORÇA A RE-INSCRIÇÃO APÓS A RENOVAÇÃO DO TOKEN <<<
            if (realtimeChannel) {
                // Remove a inscrição atual e força uma nova.
                // Isso garante que o canal 'public:orders' use o novo token.
                realtimeChannel.unsubscribe().subscribe(); 
                console.log('[AUTH] ----> Canal Realtime forçado a re-inscrever com novo token.');
            }

        } catch (e) {
            console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
        } finally {
            isRefreshingRef.current = false;
        }
    }, [isSignedIn, getToken, realtimeChannel]); // Adicionado realtimeChannel nas dependências

    // Atualiza a ref da função de autenticação a cada render
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

        console.log('[LIFECYCLE] 🚀 2. Cliente Supabase pronto. Iniciando ciclo de vida do canal...');
        const channel = supabaseClient.channel('public:orders');

        const handleRecovery = (reason: 'CLOSED' | 'ERROR') => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            
            const attempts = reconnectAttemptsRef.current;
            const delay = Math.min(1000 * (2 ** attempts), 30000);
            console.log(`[LIFECYCLE] 🔄 Tentando recuperar conexão em ${delay / 1000}s (tentativa ${attempts + 1}). Motivo: ${reason}`);
            
            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectAttemptsRef.current = attempts + 1;
                console.log('[LIFECYCLE] --> Etapa 1: Re-autenticando e re-inscrevendo o canal...');
                
                // Força a re-autenticação, que agora contém a lógica de re-inscrição forçada
                authFnRef.current?.(supabaseClient);
                
                // Nota: O authFnRef.current já chama subscribe() internamente. 
                // Se o .subscribe() inicial do hook falhou, ele será re-executado aqui.
                if (channel.state !== 'joined' && channel.state !== 'subscribed') {
                    channel.subscribe();
                }

            }, delay);
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
        setRealtimeAuth(supabaseClient);

        return () => {
            console.log('[LIFECYCLE] 🧹 Limpando... Removendo canal e timers.');
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            // O removeChannel é importante para evitar vazamento de memória se o componente for desmontado
            supabaseClient.removeChannel(channel); 
            setRealtimeChannel(null);
        };
    }, [supabaseClient, isLoaded, setRealtimeAuth]);

    // Effect 3: Renovação Proativa do Token (Garante que o token seja sempre renovado)
    useEffect(() => {
        if (!supabaseClient || !isSignedIn) {
            return;
        }

        const RENEW_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

        const renewAuth = () => {
            console.log('[AUTH-INTERVAL] ⏱️ Renovação periódica agendada acionada. Forçando novo token.');
            // Usa a ref para chamar a função mais atualizada, que agora força a re-inscrição
            authFnRef.current?.(supabaseClient); 
        };

        renewAuth(); 
        const intervalId = window.setInterval(renewAuth, RENEW_INTERVAL_MS);

        return () => {
            console.log('[AUTH-INTERVAL] 🧹 Limpando intervalo de renovação.');
            window.clearInterval(intervalId);
        };
    }, [supabaseClient, isSignedIn]); // setRealtimeAuth não é necessário aqui, pois usamos authFnRef

    // Effect 4: The "Wake-Up Call"
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
                console.log('👁️ Aba se tornou visível. Verificando saúde da conexão e token.');
                authFnRef.current?.(supabaseClient); // Usa a ref
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
