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

    const scheduleTokenRefresh = useCallback((token: string) => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }

        try {
            const jwtPayload = JSON.parse(atob(token.split('.')[1]));
            const expiresAt = jwtPayload.exp * 1000;
            const refreshIn = expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS;

            if (refreshIn > 0) {
                console.log(`%c[SCHEDULER] 📅 Agendando próxima renovação de token em ${Math.round(refreshIn / 1000 / 60)} minutos.`, 'color: green;');
                refreshTimeoutRef.current = setTimeout(async () => {
                    console.log('%c[SCHEDULER] ⏳ Hora de renovar! Obtendo novo token... ', 'color: green; font-weight: bold;');
                    const newToken = await getToken({ template: 'supabase' });
                    if (newToken && client) {
                        await client.realtime.setAuth(newToken);
                        console.log('%c[SCHEDULER] ✅ Token renovado e sincronizado com Supabase.', 'color: green; font-weight: bold;');
                        scheduleTokenRefresh(newToken); // Re-agenda a próxima renovação
                    }
                }, refreshIn);
            }
        } catch (error) {
            console.error('[SCHEDULER] ❌ Erro ao decodificar token e agendar renovação:', error);
        }
    }, [getToken, client]);

    useEffect(() => {
        if (!client || !isLoaded) {
            return;
        }

        const setAuthAndSchedule = async () => {
            if (isSignedIn) {
                console.log('%c[PROVIDER-AUTH] 🔑 Sessão ativa. Obtendo token inicial e agendando renovação...', 'color: #ff9800;');
                const token = await getToken({ template: 'supabase' });
                if (token) {
                    await client.realtime.setAuth(token);
                    console.log('%c[PROVIDER-AUTH] ✅ Realtime autenticado.', 'color: #ff9800; font-weight: bold;');
                    scheduleTokenRefresh(token);
                }
            } else {
                console.log('[PROVIDER-AUTH] 👤 Usuário deslogado. Limpando autenticação e agendamento.');
                await client.realtime.setAuth(null);
                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }
            }
        };

        setAuthAndSchedule();

        // Cleanup na desmontagem do componente
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [isLoaded, isSignedIn, getToken, client, scheduleTokenRefresh]);

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
