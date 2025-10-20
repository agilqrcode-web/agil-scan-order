// SupabaseProvider.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from './SupabaseContext';
import { Spinner } from '@/components/ui/spinner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const HEALTH_CHECK_INTERVAL = 60 * 1000; // 60s
const TOKEN_REFRESH_MARGIN = 2 * 60 * 1000; // 2 minutes before exp
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 8;
const TOKEN_MIN_SAFE_MS = 90 * 1000; // consider token still valid if > 90s left

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);

  const isRefreshingRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastEventTimeRef = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(true);
  const currentTokenExpRef = useRef<number | null>(null);
  const lastAppliedTokenRef = useRef<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  // token refresh scheduling & backoff
  const tokenRefreshTimerRef = useRef<number | null>(null);
  const backoffAttemptRef = useRef<number>(0);

  const channelName = 'public:orders';

  const parseTokenExp = (token: string | null) => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000;
    } catch {
      return null;
    }
  };

  const getTokenWithValidation = useCallback(async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return null;
      const expMs = parseTokenExp(token);
      if (expMs) currentTokenExpRef.current = expMs;
      return token;
    } catch (e) {
      console.error('[AUTH] getToken error', e);
      return null;
    }
  }, [getToken]);

  const clearScheduledTokenRefresh = () => {
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  };

  const scheduleTokenRefresh = (expMs: number | null) => {
    // limpa timer anterior
    clearScheduledTokenRefresh();
    if (!expMs) return;
    const now = Date.now();
    // refreshAt: exp - margin, mas pelo menos 5s no futuro
    const refreshAt = Math.max(now + 5000, expMs - TOKEN_REFRESH_MARGIN);
    const delay = Math.max(1000, refreshAt - now);
    console.log('[AUTH] agendando refresh do token em (ms):', delay);
    tokenRefreshTimerRef.current = window.setTimeout(async () => {
      console.log('[AUTH] timer de refresh disparou — tentando renovar token');
      try {
        await setRealtimeAuthSafe(clientRef.current!);
        backoffAttemptRef.current = 0;
      } catch (e) {
        console.error('[AUTH] falha no refresh agendado', e);
        const backoff = Math.min(60_000, 1000 * Math.pow(2, backoffAttemptRef.current));
        backoffAttemptRef.current++;
        console.log(`[AUTH] agendando retry com backoff ${backoff}ms`);
        tokenRefreshTimerRef.current = window.setTimeout(() => {
          scheduleTokenRefresh(Date.now() + backoff);
        }, backoff);
      }
    }, delay);
  };

  // setRealtimeAuthSafe (nova versão com agendamento)
  const setRealtimeAuthSafe = useCallback(async (client: SupabaseClient | null) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ setRealtimeAuth called but already refreshing - skip');
      return;
    }
    if (!client) return;
    isRefreshingRef.current = true;
    try {
      if (!isSignedIn) {
        console.log('[AUTH] usuário não autenticado — limpando auth do realtime');
        try { await client.realtime.setAuth(null); } catch {}
        clearScheduledTokenRefresh();
        lastAppliedTokenRef.current = null;
        setConnectionHealthy(false);
        return;
      }

      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH] Token inválido ao tentar setAuth');
        try { await client.realtime.setAuth(null); } catch {}
        setConnectionHealthy(false);
        return;
      }

      const expMs = parseTokenExp(token);
      if (expMs) currentTokenExpRef.current = expMs;

      // If same token and not near expiry -> skip
      if (lastAppliedTokenRef.current === token) {
        const remainingMs = (currentTokenExpRef.current || 0) - Date.now();
        if (remainingMs > TOKEN_MIN_SAFE_MS) {
          console.log('[AUTH] Token já aplicado e com folga -> skip');
          scheduleTokenRefresh(expMs);
          setConnectionHealthy(true);
          return;
        }
      }

      // Best-effort: unsubscribe existing subs to avoid stale state
      try {
        const subs = (client as any).getSubscriptions?.() || [];
        subs.forEach((s: any) => {
          try { s.unsubscribe(); } catch {}
        });
      } catch (e) {
        // non-fatal
      }

      await client.realtime.setAuth(token);
      lastAppliedTokenRef.current = token;
      setRealtimeAuthCounter((p) => p + 1);
      setConnectionHealthy(true);
      scheduleTokenRefresh(expMs);
      backoffAttemptRef.current = 0;
      console.log('[AUTH] ✅ Token aplicado com sucesso no realtime');
    } catch (error) {
      console.error('[AUTH] erro ao aplicar token', error);
      setConnectionHealthy(false);
      // schedule retry with backoff
      const backoff = Math.min(60_000, 1000 * Math.pow(2, backoffAttemptRef.current));
      backoffAttemptRef.current++;
      tokenRefreshTimerRef.current = window.setTimeout(() => {
        setRealtimeAuthSafe(client);
      }, backoff);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [getToken, isSignedIn]);

  const handleReconnect = useCallback(async (channel?: RealtimeChannel) => {
    if (!isActiveRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[RECONNECT] atingiu tentativas máximas');
      return;
    }
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    console.log(`[RECONNECT] tentativa ${reconnectAttemptsRef.current}, delay ${delay}ms`);
    setTimeout(async () => {
      if (!isActiveRef.current || !supabaseClient) return;
      try {
        await setRealtimeAuthSafe(supabaseClient);
        if (channel) channel.subscribe();
      } catch (e) {
        console.error('[RECONNECT] erro ao reconectar', e);
      }
    }, delay);
  }, [supabaseClient, setRealtimeAuthSafe]);

  // create client once
  useEffect(() => {
    if (!isLoaded) return;
    if (!clientRef.current) {
      console.log('[PROVIDER-INIT] Criando cliente Supabase (one-time)');
      clientRef.current = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input, init) => {
            const token = await getToken();
            const headers = new Headers(init?.headers);
            if (token) headers.set('Authorization', `Bearer ${token}`);
            return fetch(input, { ...init, headers });
          },
        },
      });
      setSupabaseClient(clientRef.current);
    }
  }, [isLoaded, getToken]);

  // mount channel (guarded)
  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;
    console.log('[LIFECYCLE] Iniciando canal realtime (guarded)');

    // create channel (public for testing)
    const channel = supabaseClient.channel(channelName, { config: { private: false } });

    // debug immediate states
    console.log('[CHANNEL] created', { name: channelName, state: channel.state });
    setTimeout(() => console.log('[CHANNEL] state after 1s', channel.state), 1000);
    setTimeout(() => console.log('[CHANNEL] state after 5s', channel.state), 5000);

    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);
      console.log('[EVENT] realtime payload', payload);
      try {
        window.dispatchEvent(new CustomEvent('order:notification:received', { detail: payload }));
      } catch {}
    };

    channel.on('SUBSCRIBED', () => {
      if (!isActiveRef.current) return;
      console.log('[LIFECYCLE] Channel SUBSCRIBED');
      setConnectionHealthy(true);
      lastEventTimeRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      if (!isActiveRef.current) return;
      console.warn('[LIFECYCLE] Channel CLOSED');
      setConnectionHealthy(false);
      handleReconnect(channel);
    });

    channel.on('ERROR', (err: any) => {
      if (!isActiveRef.current) return;
      console.error('[LIFECYCLE] Channel ERROR', err);
      setConnectionHealthy(false);

      const msg = err?.message?.toString?.() || '';
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('jwt')) {
        console.warn('[AUTH] erro relacionado a token detectado, limpando e renovando imediatamente');
        lastAppliedTokenRef.current = null;
        clearScheduledTokenRefresh();
        (async () => {
          try {
            await setRealtimeAuthSafe(supabaseClient);
            setTimeout(() => {
              try { channel.subscribe(); } catch {}
            }, 300);
          } catch (e) {
            console.error('[AUTH] falha ao renovar token após erro', e);
            handleReconnect(channel);
          }
        })();
        return;
      }

      // outros erros -> reconnect
      handleReconnect(channel);
    });

    // Listen for DB changes on orders table
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeEvent);

    // Immediately subscribe (should trigger SUBSCRIBED if succeeds)
    try {
      channel.subscribe((status, err) => {
        console.log('[SUBSCRIBE-CALLBACK] status:', status, 'error:', err);
      });
    } catch (e) {
      console.error('[SUBSCRIBE] falhou ao chamar subscribe()', e);
    }

    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      // if no events for 5 minutes, mark unhealthy (only if channel joined)
      if ((channel.state === 'joined' || channel.state === 'SUBSCRIBED') && timeSinceLastEvent > 5 * 60 * 1000) {
        console.warn('[HEALTH-CHECK] sem eventos há 5+ minutos, forçando refresh');
        setConnectionHealthy(false);
        (async () => {
          try { if (channel && channel.state !== 'closed') await channel.unsubscribe(); } catch {}
          await setRealtimeAuthSafe(supabaseClient);
          setTimeout(() => { if (isActiveRef.current) channel.subscribe(); }, 500);
        })();
      }

      // Token pre-refresh if close to expiry
      const expMs = currentTokenExpRef.current;
      if (expMs && expMs - Date.now() < TOKEN_REFRESH_MARGIN) {
        console.log('[HEALTH-CHECK] token próximo do fim - renovando');
        setRealtimeAuthSafe(supabaseClient);
      }
    }, HEALTH_CHECK_INTERVAL);

    // periodic defensive refresh (in addition to scheduled)
    const tokenRefreshTicker = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      setRealtimeAuthSafe(supabaseClient);
    }, Math.max(30 * 1000, TOKEN_REFRESH_MARGIN / 2));

    setRealtimeChannel(channel);
    // apply auth once
    setRealtimeAuthSafe(supabaseClient);

    return () => {
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenRefreshTicker);
      clearScheduledTokenRefresh();
      try {
        if (channel && channel.state !== 'closed') channel.unsubscribe();
      } catch (e) {
        console.warn('[LIFECYCLE] erro ao unsubscribe:', e);
      }
      setRealtimeChannel(null);
      setConnectionHealthy(false);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuthSafe, handleReconnect]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('[VISIBILITY] visible -> ensure auth');
        setRealtimeAuthSafe(supabaseClient);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [supabaseClient, isSignedIn, setRealtimeAuthSafe]);

  const refreshConnection = useCallback(async () => {
    if (realtimeChannel) {
      try { if (realtimeChannel.state !== 'closed') await realtimeChannel.unsubscribe(); } catch {}
    }
    if (supabaseClient) {
      await setRealtimeAuthSafe(supabaseClient);
      if (realtimeChannel) {
        setTimeout(() => realtimeChannel.subscribe(), 300);
      }
    }
  }, [supabaseClient, realtimeChannel, setRealtimeAuthSafe]);

  const requestReconnect = useCallback(async () => {
    await refreshConnection();
    return true;
  }, [refreshConnection]);

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
      connectionHealthy,
      realtimeAuthCounter,
      requestReconnect,
      setRealtimeAuth: async (client: SupabaseClient) => await setRealtimeAuthSafe(client),
      refreshConnection,
    }}>
      {children}
      <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${connectionHealthy ? 'bg-green-500' : 'bg-red-500'} z-50 border border-white shadow-lg`} title={connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} />
    </SupabaseContext.Provider>
  );
}
