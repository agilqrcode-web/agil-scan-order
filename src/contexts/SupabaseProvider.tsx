import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const REALTIME_CHANNEL_NAME = 'public:orders';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutos

// --- SINGLETON PATTERN ---
console.log('[PROVIDER-INIT] ⚙️ Criando instância singleton do cliente Supabase e do canal Realtime.');
const supabaseClientInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const realtimeChannelInstance = supabaseClientInstance.channel(REALTIME_CHANNEL_NAME);
// --- FIM DO SINGLETON PATTERN ---

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();
    const [client] = useState<SupabaseClient<Database> | null>(supabaseClientInstance);
    const [channel] = useState<RealtimeChannel | null>(realtimeChannelInstance);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const syncAuthAndSchedule = useCallback(async () => {
        if (!client || !isLoaded || !isSignedIn) {
            return; // Guarda para garantir que temos tudo o que precisamos
        }

        console.log('%c[AUTH-SYNC] 🔄 Sincronizando token...', 'color: purple;');
        const token = await getToken({ template: 'supabase' });

        if (token) {
            await client.realtime.setAuth(token);
            console.log('%c[AUTH-SYNC] ✅ Token sincronizado com Supabase.', 'color: purple; font-weight: bold;');

            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }

            try {
                const jwtPayload = JSON.parse(atob(token.split('.')[1]));
                const expiresAt = jwtPayload.exp * 1000;
                const refreshIn = expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS;

                if (refreshIn > 0) {
                    console.log(`%c[SCHEDULER] 📅 Agendando próxima renovação em ${Math.round(refreshIn / 1000 / 60)} minutos.`, 'color: green;');
                    refreshTimeoutRef.current = setTimeout(syncAuthAndSchedule, refreshIn);
                }
            } catch (error) {
                console.error('[SCHEDULER] ❌ Erro ao agendar renovação:', error);
            }
        }
    }, [client, isLoaded, isSignedIn, getToken]);

    // Efeito 1: Lida com a mudança de estado de login (login/logout)
    useEffect(() => {
        if (isLoaded) {
            if (!isSignedIn) {
                console.log('[PROVIDER-AUTH] 👤 Usuário deslogado. Limpando autenticação e agendamento.');
                client?.realtime.setAuth(null);
                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }
            }
        }
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [isLoaded, isSignedIn, client]);

    // Efeito 2: A Correção Definitiva para reconexões (hibernação, etc.)
    useEffect(() => {
        if (!client) return;
        const socket = client.realtime.socket;
        if (!socket) return;

        const handleReconnect = () => {
            console.log('%c[SOCKET-LIFECYCLE] 🔌 Conexão aberta/restabelecida, re-sincronizando token.', 'color: blue; font-weight: bold;');
            syncAuthAndSchedule();
        };

        socket.on('open', handleReconnect);
        console.log('[SOCKET-LIFECYCLE] ✅ Listener para o evento "open" do socket foi adicionado.');

        // Força a conexão inicial se ainda não estiver conectado
        if (!socket.isConnected()) {
            client.realtime.connect();
        }

        return () => {
            if (socket) {
                socket.off('open', handleReconnect);
                console.log('[SOCKET-LIFECYCLE] 🧹 Listener do evento "open" do socket foi removido.');
            }
        };
    }, [client, syncAuthAndSchedule]);

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
