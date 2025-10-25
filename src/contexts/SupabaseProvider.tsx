// src/contexts/SupabaseProvider.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext, RealtimeLog } from './SupabaseContext';
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

// ENV
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// CONFIG
const CHANNEL_TOPIC = 'public:orders';
const SUBSCRIBE_TIMEOUT_MS = 12_000;
const REFRESH_MARGIN_MS = 60 * 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const PROTOCOL_STABILITY_DELAY_MS = 120;

// SINGLETON LOCKS
let globalClientSingleton: SupabaseClient<Database> | null = null;
let creatingClientPromise: Promise<SupabaseClient<Database>> | null = null;

// Helper: decode exp
const decodeTokenExpMs = (token: string | null) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [connectionHealthy, setConnectionHealthy] = useState(false);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState(0);
  const [realtimeEventLogs, setRealtimeEventLogs] = useState<RealtimeLog[]>([]);

  const isRefreshingRef = useRef(false);
  const tokenRefreshTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const lastEventTimeRef = useRef(Date.now());
  const isActiveRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient<Database> | null>(null);

  // Append log helper
  const addLog = useCallback((type: RealtimeLog['type'], payload: any) => {
    setRealtimeEventLogs(prev => {
      const next = [...prev, { timestamp: Date.now(), type, payload }];
      return next.slice(-300);
    });
  }, []);

  // Create or return singleton client. Ensures single GoTrue instance in page.
  const getOrCreateClient = useCallback(async (): Promise<SupabaseClient<Database>> => {
    if (globalClientSingleton) {
      return globalClientSingleton;
    }
    if (creatingClientPromise) {
      return creatingClientPromise;
    }

    creatingClientPromise = (async () => {
      // createClient must be created once per page to avoid multiple GoTrue clients
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          fetch: async (input, init) => {
            try {
              const token = await getToken();
              const headers = new Headers(init?.headers);
              if (token) headers.set('Authorization', `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            } catch {
              return fetch(input, init);
            }
          },
        },
        realtime: { timeout: 30_000 },
      });
      globalClientSingleton = client;
      clientRef.current = client;
      setSupabaseClient(client);
      creatingClientPromise = null;
      return client;
    })();

    return creatingClientPromise;
  }, [getToken]);

  // Cleanly dispose client (unsubscribe channels) but DO NOT create a new GoTrue instance blindly.
  const disposeClient = useCallback(() => {
    try {
      channelRef.current?.unsubscribe();
    } catch {}
    channelRef.current = null;
    setRealtimeChannel(null);
    setConnectionHealthy(false);
    // DO NOT null globalClientSingleton to avoid re-creating GoTrue multiple times;
    // instead we reuse the existing globalClientSingleton unless the page is reloaded.
    clientRef.current = globalClientSingleton;
  }, []);

  // Swap auth + channel atomically
  const swapAuthAndChannel = useCallback(async (client: SupabaseClient<Database> | null, isProactive = false) => {
    if (!client) return false;
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;
    if (tokenRefreshTimeoutRef.current) {
      window.clearTimeout(tokenRefreshTimeoutRef.current);
      tokenRefreshTimeoutRef.current = null;
    }

    try {
      if (!isSignedIn) {
        // not signed in: clear auth and use public
        try { await client.realtime.setAuth(null); } catch {}
        setConnectionHealthy(false);
        isRefreshingRef.current = false;
        return false;
      }

      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH-SWAP] Token ausente');
        setConnectionHealthy(false);
        isRefreshingRef.current = false;
        return false;
      }

      // apply token to realtime socket
      try {
        await client.realtime.setAuth(token);
        addLog('SENT', { kind: 'setAuth', note: 'applied' });
      } catch (e) {
        console.error('[AUTH-SWAP] setAuth failed', e);
        // If setAuth fails, we attempt a gentle fallback: unsubscribe old channel and clear state,
        // but avoid creating a new GoTrue instance (to prevent multiple instances).
        disposeClient();
        isRefreshingRef.current = false;
        return false;
      }

      // wait tiny stabilization
      await new Promise(r => setTimeout(r, PROTOCOL_STABILITY_DELAY_MS));

      // create new channel and subscribe
      const newChannel = client.channel(CHANNEL_TOPIC, { config: { private: true } });

      // attach lifecycle handlers
      newChannel.on('SUBSCRIBED', () => {
        addLog('RECEIVED', { event: 'SUBSCRIBED', topic: CHANNEL_TOPIC });
        setConnectionHealthy(true);
        lastEventTimeRef.current = Date.now();
        reconnectAttemptsRef.current = 0;
      });
      newChannel.on('CLOSED', (e) => {
        addLog('RECEIVED', { event: 'CLOSED', detail: e });
        setConnectionHealthy(false);
        // schedule reconnect/backoff
        attemptReconnect();
      });
      newChannel.on('ERROR', (e) => {
        addLog('RECEIVED', { event: 'ERROR', detail: e });
        setConnectionHealthy(false);
        attemptReconnect();
      });
      // also listen to postgres_changes minimal to mark liveliness
      newChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        addLog('RECEIVED', { kind: 'postgres_changes', payload });
        lastEventTimeRef.current = Date.now();
      });

      const subscribed = await new Promise<boolean>((resolve) => {
        let done = false;
        const t = window.setTimeout(() => {
          if (!done) {
            done = true;
            resolve(false);
          }
        }, SUBSCRIBE_TIMEOUT_MS);

        newChannel.subscribe((status) => {
          if (done) return;
          if (status === 'SUBSCRIBED') {
            done = true;
            clearTimeout(t);
            resolve(true);
          } else if (status === 'CHANNEL_ERROR') {
            done = true;
            clearTimeout(t);
            resolve(false);
          }
        });
      });

      if (!subscribed) {
        addLog('RECEIVED', { event: 'SUBSCRIBE_TIMEOUT' });
        // cleanup newChannel to avoid leaks
        try { newChannel.unsubscribe(); } catch {}
        // attempt a gentle dispose (not full recreate) to avoid multiple GoTrue clients
        disposeClient();
        isRefreshingRef.current = false;
        return false;
      }

      // if subscribed, swap: unsubscribe old channel AFTER new is stable
      const old = channelRef.current;
      if (old && old !== newChannel) {
        try { old.unsubscribe(); } catch {}
      }

      channelRef.current = newChannel;
      setRealtimeChannel(newChannel);
      setRealtimeAuthCounter(c => c + 1);
      setConnectionHealthy(true);

      // schedule next refresh based on token exp
      const expMs = decodeTokenExpMs(token);
      if (expMs) {
        const refreshAt = expMs - REFRESH_MARGIN_MS;
        const delay = Math.max(0, refreshAt - Date.now());
        tokenRefreshTimeoutRef.current = window.setTimeout(() => {
          swapAuthAndChannel(client, true);
        }, delay);
      }

      isRefreshingRef.current = false;
      return true;
    } catch (err) {
      console.error('[AUTH-SWAP] unexpected error', err);
      isRefreshingRef.current = false;
      return false;
    }
  }, [addLog]);

  // reconnect backoff
  const attemptReconnect = useCallback(() => {
    if (!clientRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[RECONNECT] max attempts reached');
      return;
    }
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    setTimeout(() => {
      swapAuthAndChannel(clientRef.current, false);
    }, delay);
  }, [swapAuthAndChannel]);

  // Init client once when Clerk loaded
  useEffect(() => {
    if (!isLoaded) return;
    let mounted = true;
    (async () => {
      const client = await getOrCreateClient();
      if (!mounted) return;
      clientRef.current = client;
      setSupabaseClient(client);
      // If user is signed in, do initial swap
      if (isSignedIn) {
        swapAuthAndChannel(client, false);
      }
    })();
    return () => { mounted = false; };
  }, [isLoaded, isSignedIn, getOrCreateClient, swapAuthAndChannel]);

  // When sign-in state changes
  useEffect(() => {
    if (!isLoaded || !clientRef.current) return;
    if (!isSignedIn) {
      // user signed out: clear auth on realtime and unsubscribe
      (async () => {
        try { await clientRef.current?.realtime.setAuth(null); } catch {}
      })();
      try { channelRef.current?.unsubscribe(); } catch {}
      channelRef.current = null;
      setRealtimeChannel(null);
      setConnectionHealthy(false);
      if (tokenRefreshTimeoutRef.current) {
        window.clearTimeout(tokenRefreshTimeoutRef.current);
        tokenRefreshTimeoutRef.current = null;
      }
    } else {
      // user signed in: ensure swap
      swapAuthAndChannel(clientRef.current, false);
    }
  }, [isLoaded, isSignedIn, swapAuthAndChannel]);

  // Visibility check: when coming back, ensure swap
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && clientRef.current && isSignedIn) {
        swapAuthAndChannel(clientRef.current, false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isSignedIn, swapAuthAndChannel]);

  // Simple health polling to trigger swap if no events recently
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!channelRef.current || !isSignedIn) return;
      const since = Date.now() - lastEventTimeRef.current;
      if (since > (6 * 60 * 1000)) {
        swapAuthAndChannel(clientRef.current, false);
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSignedIn, swapAuthAndChannel]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      try { channelRef.current?.unsubscribe(); } catch {}
      if (tokenRefreshTimeoutRef.current) window.clearTimeout(tokenRefreshTimeoutRef.current);
      // do NOT null globalClientSingleton here; keep single instance for page duration
    };
  }, []);

  // expose recreate function (gentle)
  const recreateSupabaseClient = useCallback(async (isHardReset = false) => {
    // Gentle approach: dispose channels and reuse global client singleton
    try {
      disposeClient();
      const client = await getOrCreateClient();
      clientRef.current = client;
      setSupabaseClient(client);
      if (isSignedIn) {
        await swapAuthAndChannel(client, false);
      }
      return client;
    } catch (e) {
      console.error('[RECREATE] error', e);
      return null;
    }
  }, [disposeClient, getOrCreateClient, swapAuthAndChannel, isSignedIn]);

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

  // render guard
  if (!isLoaded || !supabaseClient) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

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
      recreateSupabaseClient,
      realtimeEventLogs,
      downloadRealtimeLogs
    }}>
      {children}
      <div
        className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${connectionHealthy ? 'bg-green-500' : 'bg-red-500'} z-50 border border-white shadow-lg`}
        title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'}`}
      />
    </SupabaseContext.Provider>
  );
}
