import React, { useEffect, useState } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const REALTIME_CHANNEL_NAME = 'public:orders';

// --- SINGLETON PATTERN ---
// O cliente e o canal são criados uma única vez quando o módulo é carregado.
// Isso os torna resilientes a remontagens do componente React.
console.log('[PROVIDER-INIT] ⚙️ Criando instância singleton do cliente Supabase e do canal Realtime.');
const supabaseClientInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const realtimeChannelInstance = supabaseClientInstance.channel(REALTIME_CHANNEL_NAME);
// --- FIM DO SINGLETON PATTERN ---

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    // Os estados agora apenas mantêm a referência para as instâncias singleton.
    const [client] = useState<SupabaseClient<Database> | null>(supabaseClientInstance);
    const [channel] = useState<RealtimeChannel | null>(realtimeChannelInstance);

    // Efeito para autenticar a conexão Realtime.
    // Roda apenas quando o status de login muda ou quando o Clerk termina de carregar.
    useEffect(() => {
        if (!client || !isLoaded) {
            if (!isLoaded) console.log('[PROVIDER-AUTH] ⏳ Aguardando Clerk carregar...');
            return;
        }

        const setAuth = async () => {
            if (isSignedIn) {
                console.log('%c[PROVIDER-AUTH] 🔑 Usuário logado. Obtendo token e autenticando Realtime...', 'color: #ff9800;');
                const token = await getToken({ template: 'supabase' });
                if (token) {
                    // A SDK do Supabase é inteligente e só enviará o novo token se ele for diferente do anterior.
                    await client.realtime.setAuth(token);
                    console.log('%c[PROVIDER-AUTH] ✅ Realtime autenticado.', 'color: #ff9800; font-weight: bold;');
                } else {
                    console.warn('[PROVIDER-AUTH] ⚠️ Token do Clerk não obtido mesmo com sessão ativa.');
                }
            } else {
                console.log('[PROVIDER-AUTH] 👤 Usuário deslogado. Limpando autenticação do Realtime.');
                await client.realtime.setAuth(null);
            }
        };

        setAuth();

    // DEPENDÊNCIAS ESTÁVEIS: Este efeito agora só roda quando o status de login realmente muda.
    }, [isLoaded, isSignedIn, getToken, client]);


    if (!isLoaded || !client || !channel) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner />
            </div>
        );
    }

    return (
        <SupabaseContext.Provider value={{ supabaseClient: client, realtimeChannel: channel }}>
            {children}
        </SupabaseContext.Provider>
    );
}
