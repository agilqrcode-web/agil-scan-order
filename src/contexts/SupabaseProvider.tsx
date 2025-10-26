import React, { useEffect, useState } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth, useSession } from '@clerk/clerk-react';
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
    const { session } = useSession(); // Usado para obter um gatilho de renovação confiável

    const [client] = useState<SupabaseClient<Database> | null>(supabaseClientInstance);
    const [channel] = useState<RealtimeChannel | null>(realtimeChannelInstance);

    useEffect(() => {
        if (!client || !isLoaded) {
            if (!isLoaded) console.log('[PROVIDER-AUTH] ⏳ Aguardando Clerk carregar...');
            return;
        }

        const setAuth = async () => {
            if (isSignedIn) {
                console.log('%c[PROVIDER-AUTH] 🔑 Sessão ativa. Sincronizando token com o Realtime...', 'color: #ff9800;');
                const token = await getToken({ template: 'supabase' });
                if (token) {
                    await client.realtime.setAuth(token);
                    console.log('%c[PROVIDER-AUTH] ✅ Realtime autenticado/sincronizado.', 'color: #ff9800; font-weight: bold;');
                }
            } else {
                console.log('[PROVIDER-AUTH] 👤 Usuário deslogado. Limpando autenticação do Realtime.');
                await client.realtime.setAuth(null);
            }
        };

        setAuth();

    // A CORREÇÃO CRÍTICA:
    // Dependemos de `session?.expireAt`, que muda especificamente quando o Clerk
    // emite um novo token com uma nova data de expiração. Isso fornece um gatilho
    // confiável para re-executar o efeito e chamar `setAuth` com o novo token.
    // Usamos `.getTime()` para passar um valor primitivo (número) para o array de dependências.
    }, [isLoaded, isSignedIn, session?.expireAt?.getTime(), getToken, client]);

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
