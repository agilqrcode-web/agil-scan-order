import React, { useEffect, useState, useCallback } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth, useSession } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

// Variáveis de Ambiente
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const REALTIME_CHANNEL_NAME = 'public:orders';

// =============================================================================
// COMPONENTE PRINCIPAL: SupabaseProvider (Versão Simplificada e Robusta)
// =============================================================================

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded } = useAuth();
    const { session } = useSession();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

    const createSupabaseClient = useCallback(() => {
        console.log('[PROVIDER] ⚙️ Criando nova instância do cliente Supabase e do canal Realtime.');
        const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        const channel = client.channel(REALTIME_CHANNEL_NAME);
        
        setSupabaseClient(client);
        setRealtimeChannel(channel);
    }, []);

    // Efeito para criar o cliente Supabase na montagem inicial
    useEffect(() => {
        if (!supabaseClient) {
            createSupabaseClient();
        }
    }, [supabaseClient, createSupabaseClient]);

    // Efeito para autenticar a conexão Realtime quando a sessão do Clerk muda
    useEffect(() => {
        if (!supabaseClient || !isLoaded) {
            if (!isLoaded) console.log('[PROVIDER-AUTH] ⏳ Aguardando Clerk carregar...');
            return;
        }

        const setAuth = async () => {
            if (session) {
                console.log('%c[PROVIDER-AUTH] 🔑 Usuário logado. Obtendo token e autenticando Realtime...', 'color: #9c27b0;');
                const token = await getToken({ template: 'supabase' });
                if (token) {
                    await supabaseClient.realtime.setAuth(token);
                    console.log('%c[PROVIDER-AUTH] ✅ Realtime autenticado.', 'color: #9c27b0; font-weight: bold;');
                } else {
                    console.warn('[PROVIDER-AUTH] ⚠️ Token do Clerk não obtido mesmo com sessão ativa.');
                }
            } else {
                console.log('[PROVIDER-AUTH] 👤 Usuário deslogado. Limpando autenticação do Realtime.');
                // Limpa a autenticação se o usuário estiver deslogado
                await supabaseClient.realtime.setAuth(null);
            }
        };

        setAuth();

    }, [isLoaded, session, getToken, supabaseClient]);


    // Renderização
    if (!isLoaded || !supabaseClient || !realtimeChannel) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    return (
        <SupabaseContext.Provider value={{ supabaseClient, realtimeChannel }}>
            {children}
        </SupabaseContext.Provider>
    );
}
