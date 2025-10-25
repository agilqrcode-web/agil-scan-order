// src/contexts/SupabaseProvider.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, RealtimeLog } from './SupabaseContext';
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// CONFIG
const CHANNEL_TOPIC = 'private:orders'; // ajuste conforme seu tópico real
const SUBSCRIBE_TIMEOUT_MS = 10_000; // timeout para SUBSCRIBED
const REFRESH_MARGIN_MS = 60 * 1000; // renovar 60s antes da expiração
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
    const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
    const [connectionHealthy, setConnectionHealthy] = useState(false);
    const [realtimeAuthCounter, setRealtimeAuthCounter] = useState(0);

    // logs para debug
    const [realtimeEventLogs, setRealtimeEventLogs] = useState<RealtimeLog[]>([]);
    const addLog = useCallback((type: RealtimeLog['type'], payload: any) => {
        setRealtimeEventLogs(prev => [...prev.slice(-200), { timestamp: Date.now(), type, payload }]);
    }, []);

    // refs
    const isRefreshingRef = useRef(false);
    const isActiveRef = useRef(true);
    const tokenRefreshTimeoutRef = useRef<number | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const lastEventTimeRef = useRef(Date.now());
    const clientRef = useRef<SupabaseClient<Database> | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Utility: cria client singleton (recriável)
    const createSupabaseClient = useCallback((anonKey = SUPABASE_ANON_KEY) => {
        const client = createClient<Database>(SUPABASE_URL, anonKey, {
            global: {
                // requests do REST usam getToken para autenticar
                fetch: async (input, init) => {
                    try {
                        const token = await getToken();
                        const headers = new Headers(init?.headers);
                        if (token) headers.set('Authorization', `Bearer ${token}`);
                        return fetch(input, { ...init, headers });
                    } catch (e) {
                        return fetch(input, init);
                    }
                },
            },
        });
        clientRef.current = client;
        setSupabaseClient(client);
        return client;
    }, [getToken]);

    // Recreate client (public function)
    const recreateSupabaseClient = useCallback(async (isHardReset = false) => {
        try {
            console.warn('[SUPABASE] 🔁 Recriando Supabase client (hardReset=' + isHardReset + ')');
            // cleanup old channel if exists
            try {
                channelRef.current?.unsubscribe();
            } catch (e) { /* ignore */ }
            channelRef.current = null;
            setRealtimeChannel(null);
            setConnectionHealthy(false);

            // Create new client
            const newClient = createSupabaseClient();
            reconnectAttemptsRef.current = 0;
            return newClient;
        } catch (error) {
            console.error('[SUPABASE] ❌ Erro ao recriar client:', error);
            return null;
        }
    }, [createSupabaseClient]);

    // Exported function should be stable
    const recreateSupabaseClientRef = useRef(recreateSupabaseClient);
    recreateSupabaseClientRef.current = recreateSupabaseClient;

    // Decodifica token e retorna exp ms
    const decodeTokenExpMs = (token: string | null) => {
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000;
        } catch (e) {
            console.warn('[AUTH] ⚠️ Falha ao decodificar token:', e);
            return null;
        }
    };

    // Get token with validation
    const getTokenWithValidation = useCallback(async () => {
        try {
            const token = await getToken({ template: 'supabase' });
            if (!token) return null;
            const expMs = decodeTokenExpMs(token);
            if (!expMs) return token;
            const remaining = Math.round((expMs - Date.now()) / 1000);
            console.log(`[AUTH] Token expira em ${remaining}s`);
            return token;
        } catch (e) {
            console.error('[AUTH] Erro ao obter token', e);
            return null;
        }
    }, [getToken]);

    // Attach handlers for a channel (logs + lastEvent)
    const attachChannelHandlers = useCallback((ch: RealtimeChannel) => {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            addLog('RECEIVED', { kind: 'postgres_changes', payload });
            lastEventTimeRef.current = Date.now();
        });

        ch.on('SUBSCRIBED', () => {
            console.log('[CHANNEL] SUBSCRIBED');
            addLog('RECEIVED', { kind: 'lifecycle', event: 'SUBSCRIBED' });
            setConnectionHealthy(true);
            lastEventTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
        });

        ch.on('CLOSED', (e) => {
            console.warn('[CHANNEL] CLOSED', e);
            addLog('RECEIVED', { kind: 'lifecycle', event: 'CLOSED', detail: e });
            setConnectionHealthy(false);
            // tentativa de reconexão suave
            if (isActiveRef.current) {
                attemptReconnect(ch);
            }
        });

        ch.on('error', (err) => {
            console.error('[CHANNEL] ERROR', err);
            addLog('RECEIVED', { kind: 'lifecycle', event: 'ERROR', detail: err });
            setConnectionHealthy(false);
            if (isActiveRef.current) {
                attemptReconnect(ch);
            }
        });
    }, []);

    // Attempt reconnect with backoff (tries to swap auth/channel)
    const attemptReconnect = useCallback((failedChannel?: RealtimeChannel) => {
        if (!isActiveRef.current) return;
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[RECONNECT] Max attempts reached');
            return;
        }
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        console.log(`[RECONNECT] Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);
        setTimeout(() => {
            if (!clientRef.current) {
                recreateSupabaseClientRef.current?.(true);
                return;
            }
            // força swap de auth/channel
            swapAuthAndChannel(clientRef.current, false);
        }, delay);
    }, []);

    // Core: swapAuthAndChannel -> aplica token, cria novo channel, aguarda SUBSCRIBED, faz swap
    const swapAuthAndChannel = useCallback(async (client: SupabaseClient<Database> | null, isProactive = true) => {
        if (!client) {
            console.warn('[AUTH-SWAP] Cliente não disponível para swap.');
            return false;
        }
        if (isRefreshingRef.current) {
            console.log('[AUTH-SWAP] Já em progresso.');
            return false;
        }
        isRefreshingRef.current = true;
        let success = false;
        if (tokenRefreshTimeoutRef.current) {
            window.clearTimeout(tokenRefreshTimeoutRef.current);
            tokenRefreshTimeoutRef.current = null;
        }

        try {
            if (!isSignedIn) {
                // se usuário não autenticado, limpa auth no realtime
                try { await client.realtime.setAuth(null); } catch (e) { /* ignore */ }
                setConnectionHealthy(false);
                isRefreshingRef.current = false;
                return false;
            }

            const token = await getTokenWithValidation();
            if (!token) {
                console.warn('[AUTH-SWAP] Token não disponível para swap');
                setConnectionHealthy(false);
                isRefreshingRef.current = false;
                return false;
            }

            // Aplica token ao realtime (socket)
            try {
                await client.realtime.setAuth(token);
                console.log('[AUTH-SWAP] setAuth() aplicado');
            } catch (e) {
                console.error('[AUTH-SWAP] Falha ao setAuth():', e);
                // fallback: recriar client
                await recreateSupabaseClientRef.current?.(true);
                isRefreshingRef.current = false;
                return false;
            }

            // Cria novo channel e attach handlers
            const newChannel = client.channel(CHANNEL_TOPIC, { config: { private: true } });

            attachChannelHandlers(newChannel);

            // Promise que espera SUBSCRIBED com timeout
            const subscribed = await new Promise<boolean>((resolve) => {
                let resolved = false;
                const timeout = window.setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        resolve(false);
                    }
                }, SUBSCRIBE_TIMEOUT_MS);

                newChannel.subscribe((status) => {
                    if (resolved) return;
                    if (status === 'SUBSCRIBED') {
                        resolved = true;
                        window.clearTimeout(timeout);
                        resolve(true);
                    } else if (status === 'CHANNEL_ERROR') {
                        resolved = true;
                        window.clearTimeout(timeout);
                        resolve(false);
                    }
                });
            });

            if (!subscribed) {
                console.warn('[AUTH-SWAP] Timeout ou erro ao inscrever novo canal.');
                // fallback: tentar recriar client (hard)
                await recreateSupabaseClientRef.current?.(true);
                isRefreshingRef.current = false;
                return false;
            }

            // Se novo canal inscrito, remove canal antigo somente após novo estar SUBSCRIBED
            try {
                const old = channelRef.current;
                if (old && old !== newChannel) {
                    try { old.unsubscribe(); } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore */ }

            // Atualiza refs e states
            channelRef.current = newChannel;
            setRealtimeChannel(newChannel);
            setConnectionHealthy(true);
            setRealtimeAuthCounter(c => c + 1);
            reconnectAttemptsRef.current = 0;

            // Agenda refresh com base no exp do token
            const expMs = decodeTokenExpMs(token);
            if (expMs) {
                const refreshAt = expMs - REFRESH_MARGIN_MS;
                const delay = Math.max(0, refreshAt - Date.now());
                if (delay <= 0) {
                    // token muito próximo da expiração -> refresh imediato
                    console.warn('[AUTH-SWAP] Token muito próximo da expiração -> refresh imediata');
                    tokenRefreshTimeoutRef.current = window.setTimeout(() => {
                        swapAuthAndChannel(client, true);
                    }, 1000);
                } else {
                    tokenRefreshTimeoutRef.current = window.setTimeout(() => {
                        swapAuthAndChannel(client, true);
                    }, delay);
                    console.log('[AUTH-SWAP] Próximo refresh agendado em', Math.round(delay / 1000), 's');
                }
            }

            success = true;
            addLog('SENT', { kind: 'auth-swap', status: 'success' });
        } catch (error) {
            console.error('[AUTH-SWAP] Erro no swap:', error);
            addLog('SENT', { kind: 'auth-swap', status: 'error', error });
            // fallback try recreate client
            await recreateSupabaseClientRef.current?.(true);
            success = false;
        } finally {
            isRefreshingRef.current = false;
        }

        return success;
    }, [attachChannelHandlers, getTokenWithValidation, isSignedIn, addLog]);

    // Inicialização do client
    useEffect(() => {
        if (!isLoaded) return;
        if (!clientRef.current) {
            const client = createSupabaseClient();
            // não inicia canal automaticamente até o usuário estar logado
            clientRef.current = client;
        }
    }, [isLoaded, createSupabaseClient]);

    // Quando o usuário entra, inicia o processo de swap/criação de canal
    useEffect(() => {
        if (!isLoaded || !clientRef.current) return;
        if (!isSignedIn) {
            // Se usuario deslogou, limpa canal e cancela refresh
            try { channelRef.current?.unsubscribe(); } catch (e) {}
            channelRef.current = null;
            setRealtimeChannel(null);
            setConnectionHealthy(false);
            if (tokenRefreshTimeoutRef.current) {
                window.clearTimeout(tokenRefreshTimeoutRef.current);
                tokenRefreshTimeoutRef.current = null;
            }
            return;
        }

        // usuário logado -> iniciar swap (cria canal) imediatamente
        swapAuthAndChannel(clientRef.current, false);
    }, [isLoaded, isSignedIn, swapAuthAndChannel]);

    // Health check simples: se sem eventos por 6+ min, tenta swap
    useEffect(() => {
        const id = window.setInterval(() => {
            if (!isActiveRef.current) return;
            const ch = channelRef.current;
            if (!ch) return;
            const since = Date.now() - lastEventTimeRef.current;
            if (since > (6 * 60 * 1000) && isSignedIn) {
                console.warn('[HEALTH] Sem eventos há >6min, forçando swap.');
                swapAuthAndChannel(clientRef.current, false);
            }
        }, 2 * 60 * 1000); // 2 minutos
        return () => clearInterval(id);
    }, [swapAuthAndChannel, isSignedIn]);

    // Visibility: ao voltar ao tab, verificamos a conexão e forçamos swap leve
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible' && isSignedIn && clientRef.current) {
                console.log('[VISIBILITY] Aba visível -> verificando conexões');
                swapAuthAndChannel(clientRef.current, false);
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [swapAuthAndChannel, isSignedIn]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            try { channelRef.current?.unsubscribe(); } catch (e) { /* ignore */ }
            if (tokenRefreshTimeoutRef.current) window.clearTimeout(tokenRefreshTimeoutRef.current);
        };
    }, []);

    // download logs helper
    const downloadRealtimeLogs = useCallback(() => {
        const data = JSON.stringify(realtimeEventLogs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `realtime-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [realtimeEventLogs]);

    // Expose recreate function
    const recreateFn = useCallback(async (isHardReset = false) => {
        return recreateSupabaseClientRef.current?.(isHardReset) ?? null;
    }, []);

    // Spinner logic: wait initialization
    if (!supabaseClient || !isLoaded) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Spinner size="large" />
            </div>
        );
    }

    // If signed in require channel and healthy
    if (isSignedIn && (!realtimeChannel || !connectionHealthy)) {
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
            connectionHealthy,
            realtimeAuthCounter,
            recreateSupabaseClient: recreateFn,
            realtimeEventLogs,
            downloadRealtimeLogs
        }}>
            {children}
            <div
                className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${connectionHealthy ? 'bg-green-500' : 'bg-red-500'} z-50 border border-white shadow-lg`}
                title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'}`} />
        </SupabaseContext.Provider>
    );
}
