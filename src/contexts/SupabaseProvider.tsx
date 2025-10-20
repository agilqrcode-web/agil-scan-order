// SupabaseProvider.tsx ok
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from './SupabaseContext';
import { Spinner } from '@/components/ui/spinner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Configuráveis
const CHANNEL_NAME = 'public:orders';
const CHANNEL_PRIVATE = true; // default: private channels for postgres_changes (mude para false se seu projeto permitir public)
const HEALTH_CHECK_INTERVAL = 60 * 1000; // 60s
const TOKEN_REFRESH_MARGIN = 2 * 60 * 1000; // 2 minutes before exp
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 8;
const TOKEN_MIN_SAFE_MS = 90 * 1000;

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

  const tokenRefreshTimerRef = useRef<number | null>(null);
  const backoffAttemptRef = useRef<number>(0);

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
    clearScheduledTokenRefresh();
    if (!expMs) return;
    const now = Date.now();
    const refreshAt = Math.max(now + 5000, expMs - TOKEN_REFRESH_MARGIN);
    const delay = Math.max(1000, refreshAt - now);
    console.log('[AUTH] scheduling token refresh in (ms):', delay);
    tokenRefreshTimerRef.current = window.setTimeout(async () => {
      try {
        await setRealtimeAuthSafe(clientRef.current!);
        backoffAttemptRef.current = 0;
      } catch (e) {
        console.error('[AUTH] scheduled refresh failed', e);
        const backoff = Math.min(60_000, 1000 * Math.pow(2, backoffAttemptRef.current));
        backoffAttemptRef.current++;
        tokenRefreshTimerRef.current = window.setTimeout(() => {
          scheduleTokenRefresh(Date.now() + backoff);
        }, backoff);
      }
    }, delay);
  };

  const setRealtimeAuthSafe = useCallback(async (client: SupabaseClient | null) => {
    if (isRefreshingRef.current) return;
    if (!client) return;
    isRefreshingRef.current = true;
    try {
      if (!isSignedIn) {
        try { await (client as any).realtime.setAuth(null); } catch {}
        clearScheduledTokenRefresh();
        lastAppliedTokenRef.current = null;
        setConnectionHealthy(false);
        return;
      }

      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH] no token available for setAuth');
        try { await (client as any).realtime.setAuth(null); } catch {}
        setConnectionHealthy(false);
        return;
      }

      const expMs = parseTokenExp(token);
      if (expMs) currentTokenExpRef.current = expMs;

      if (lastAppliedTokenRef.current === token) {
        const remainingMs = (currentTokenExpRef.current || 0) - Date.now();
        if (remainingMs > TOKEN_MIN_SAFE_MS) {
          scheduleTokenRefresh(expMs);
          setConnectionHealthy(true);
          return;
        }
      }

      // Prefer realtime.setAuth
      try {
        if (typeof (client as any).realtime.setAuth === 'function') {
          await (client as any).realtime.setAuth(token);
          lastAppliedTokenRef.current = token;
          setRealtimeAuthCounter((p) => p + 1);
          setConnectionHealthy(true);
          scheduleTokenRefresh(expMs);
          backoffAttemptRef.current = 0;
          console.log('[AUTH] realtime.setAuth applied successfully');
          return;
        }
      } catch (err) {
        console.warn('[AUTH] realtime.setAuth failed, falling back to re-instantiation', err);
      }

      // Fallback: re-instantiate client with token-injecting fetch wrapper
      console.log('[AUTH] fallback re-instantiating client with token');
      const newClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input: RequestInfo, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${token}`);
            return fetch(input, { ...init, headers });
          },
        },
      });

      // swap client
      clientRef.current = newClient;
      setSupabaseClient(newClient);
      lastAppliedTokenRef.current = token;
      setRealtimeAuthCounter((p) => p + 1);
      scheduleTokenRefresh(expMs);
      setConnectionHealthy(true);
      console.log('[AUTH] fallback re-instantiation complete');
    } catch (error) {
      console.error('[AUTH] error applying token', error);
      setConnectionHealthy(false);
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
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    console.log(`[RECONNECT] attempt ${reconnectAttemptsRef.current}, delay ${delay}ms`);
    setTimeout(async () => {
      if (!isActiveRef.current || !supabaseClient) return;
      try {
        await setRealtimeAuthSafe(supabaseClient);
        if (channel) {
          try { channel.subscribe(); } catch {}
        }
      } catch (e) {
        console.error('[RECONNECT] error reconnecting', e);
      }
    }, delay);
  }, [supabaseClient, setRealtimeAuthSafe]);

  // create client once
  useEffect(() => {
    if (!isLoaded) return;
    if (!clientRef.current) {
      console.log('[PROVIDER-INIT] Creating Supabase client (one-time)');
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
      setSupabaseClient(client);
      // Expor cliente na janela para fins de depuração
      (window as any).supabaseClient = client;
    }
  }, [isLoaded, getToken]);

  // mount channel (await setAuth before subscribe)
  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;
    console.log('[LIFECYCLE] Starting realtime channel (guarded)');

    const channel = supabaseClient.channel(CHANNEL_NAME, { config: { private: CHANNEL_PRIVATE } });
    setRealtimeChannel(channel);

    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);
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
      const msg = (err?.message || '').toString().toLowerCase();
      if (msg.includes('token') || msg.includes('jwt') || msg.includes('expired')) {
        lastAppliedTokenRef.current = null;
        clearScheduledTokenRefresh();
        (async () => {
          try {
            await setRealtimeAuthSafe(supabaseClient);
            setTimeout(() => { try { channel.subscribe(); } catch {} }, 300);
          } catch (e) {
            console.error('[AUTH] failed to renew after error', e);
            handleReconnect(channel);
          }
        })();
        return;
      }
      // If bindings mismatch, log and try more-specific subscription
      if (err?.message && err.message.includes('mismatch between server and client bindings')) {
        console.warn('[LIFECYCLE] mismatch bindings detected — trying specific INSERT subscription as fallback');
        try {
          // remove any existing postgres_changes listeners then re-subscribe specifically for INSERT
          channel.removeAllListeners?.('postgres_changes');
        } catch {}
        try {
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeEvent);
          // we'll attempt subscribe below (subscribe is awaited after setAuth)
        } catch (e) {
          console.error('[LIFECYCLE] fallback specific subscription failed', e);
        }
      } else {
        handleReconnect(channel);
      }
    });

    // attach postgres_changes handler (general)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeEvent);

    (async () => {
      try {
        // Ensure auth applied before subscribing
        await setRealtimeAuthSafe(supabaseClient);
        // Wait a small tick to ensure server processed auth
        await new Promise((r) => setTimeout(r, 250));
        // Subscribe and capture callback result
        channel.subscribe((status, err) => {
          console.log('[SUBSCRIBE-CALLBACK] status:', status, 'error:', err);
          if (status === 'CLOSED' && err) {
            if (err.message && err.message.includes('mismatch between server and client bindings')) {
              // try specific subscription: unsubscribe and set specific handler + subscribe
              console.warn('[SUBSCRIBE] closed with bindings mismatch -> trying specific INSERT subscription');
              try {
                channel.removeAllListeners?.('postgres_changes');
              } catch {}
              channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handleRealtimeEvent);
              try {
                channel.subscribe();
              } catch (e) {
                console.error('[SUBSCRIBE] retry specific subscription failed', e);
                handleReconnect(channel);
              }
              return;
            }
          }
          if (status === 'ERRORED' || status === 'CLOSED') {
            handleReconnect(channel);
          }
        });
      } catch (e) {
        console.error('[LIFECYCLE] error during subscribe flow', e);
        handleReconnect(channel);
      }
    })();

    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      if ((channel.state === 'joined' || channel.state === 'SUBSCRIBED') && timeSinceLastEvent > 5 * 60 * 1000) {
        console.warn('[HEALTH-CHECK] no events for 5+ minutes, forcing refresh');
        setConnectionHealthy(false);
        (async () => {
          try { if (channel && channel.state !== 'closed') await channel.unsubscribe(); } catch {}
          await setRealtimeAuthSafe(supabaseClient);
          setTimeout(() => { if (isActiveRef.current) channel.subscribe(); }, 500);
        })();
      }
      const expMs = currentTokenExpRef.current;
      if (expMs && expMs - Date.now() < TOKEN_REFRESH_MARGIN) {
        setRealtimeAuthSafe(supabaseClient);
      }
    }, HEALTH_CHECK_INTERVAL);

    const tokenRefreshTicker = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      setRealtimeAuthSafe(supabaseClient);
    }, Math.max(30 * 1000, TOKEN_REFRESH_MARGIN / 2));

    return () => {
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenRefreshTicker);
      clearScheduledTokenRefresh();
      try {
        if (channel && channel.state !== 'closed') channel.unsubscribe();
      } catch (e) {
        console.warn('[LIFECYCLE] unsubscribe error:', e);
      }
      setRealtimeChannel(null);
      setConnectionHealthy(false);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuthSafe, handleReconnect]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
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
