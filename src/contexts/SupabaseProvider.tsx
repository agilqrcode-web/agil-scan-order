// SupabaseProvider.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, type SupabaseClient, type RealtimeChannel, type RealtimeSubscription } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from './SupabaseContext';
import { Spinner } from '@/components/ui/spinner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 6;
const TOKEN_MIN_SAFE_MS = 2 * 60 * 1000;

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
  const isMountingRef = useRef<boolean>(false);

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
      if (expMs) {
        currentTokenExpRef.current = expMs;
      }
      return token;
    } catch (e) {
      console.error('[AUTH] getToken error', e);
      return null;
    }
  }, [getToken]);

  const setRealtimeAuthSafe = useCallback(async (client: SupabaseClient) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Autenticação já em progresso - skip');
      return;
    }
    isRefreshingRef.current = true;
    try {
      if (!client || !isSignedIn) {
        try { await client?.realtime.setAuth(null); } catch {}
        setConnectionHealthy(false);
        return;
      }

      const token = await getTokenWithValidation();
      if (!token) {
        console.warn('[AUTH] Token inválido ao tentar setAuth');
        await client.realtime.setAuth(null);
        setConnectionHealthy(false);
        return;
      }

      if (lastAppliedTokenRef.current === token) {
        const remainingMs = (currentTokenExpRef.current || 0) - Date.now();
        if (remainingMs > TOKEN_MIN_SAFE_MS) {
          console.log('[AUTH] Token já aplicado e válido - skip');
          setConnectionHealthy(true);
          return;
        }
      }

      // Unsubscribe existing subscriptions to avoid stale auth state (best-effort)
      try {
        const subs = (client as any).getSubscriptions?.() || [];
        subs.forEach((s: RealtimeSubscription) => {
          try { s.unsubscribe(); } catch {}
        });
      } catch (e) {}

      await client.realtime.setAuth(token);
      lastAppliedTokenRef.current = token;
      setRealtimeAuthCounter((p) => p + 1);
      setConnectionHealthy(true);
      console.log('[AUTH] ✅ Token aplicado com sucesso no realtime');
    } catch (error) {
      console.error('[AUTH] erro ao aplicar token', error);
      setConnectionHealthy(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [getTokenWithValidation, isSignedIn]);

  const handleReconnect = useCallback(async (channel?: RealtimeChannel) => {
    if (!isActiveRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    setTimeout(async () => {
      if (!isActiveRef.current || !supabaseClient) return;
      try {
        await setRealtimeAuthSafe(supabaseClient);
        if (channel) channel.subscribe();
      } catch (e) {
        console.error('[RECONNECT] erro', e);
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
    if (isMountingRef.current) {
      console.log('[LIFECYCLE] Montagem já em progresso - skip');
      return;
    }
    isMountingRef.current = true;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;
    console.log('[LIFECYCLE] Iniciando canal realtime (guarded)');

    const channel = supabaseClient.channel('public:orders');

    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);
      // Emit custom event for sinon/notification system + console log
      try {
        window.dispatchEvent(new CustomEvent('order:notification', { detail: payload }));
      } catch {}
    };

    channel.on('SUBSCRIBED', () => {
      if (!isActiveRef.current) return;
      console.log('[LIFECYCLE] Canal inscrito com sucesso');
      setConnectionHealthy(true);
      lastEventTimeRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      if (!isActiveRef.current) return;
      console.warn('[LIFECYCLE] Canal fechado');
      setConnectionHealthy(false);
      handleReconnect(channel);
    });

    channel.on('ERROR', (err: any) => {
      if (!isActiveRef.current) return;
      console.error('[LIFECYCLE] Erro no canal:', err);
      setConnectionHealthy(false);
      const msg = err?.message || '';
      if (typeof msg === 'string' && msg.toLowerCase().includes('token')) {
        lastAppliedTokenRef.current = null;
        setRealtimeAuthSafe(supabaseClient);
      } else {
        handleReconnect(channel);
      }
    });

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleRealtimeEvent);

    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      if (channel.state === 'joined' && timeSinceLastEvent > 5 * 60 * 1000) {
        console.warn('[HEALTH-CHECK] Sem eventos há 5+ minutos durante atividade esperada');
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

    const tokenRefreshInterval = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      setRealtimeAuthSafe(supabaseClient);
    }, TOKEN_REFRESH_MARGIN);

    setRealtimeChannel(channel);
    setRealtimeAuthSafe(supabaseClient);

    return () => {
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenRefreshInterval);
      try {
        if (channel && channel.state !== 'closed') channel.unsubscribe();
      } catch (e) {
        console.warn('[LIFECYCLE] erro ao unsubscribing:', e);
      }
      setRealtimeChannel(null);
      setConnectionHealthy(false);
      isMountingRef.current = false;
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
