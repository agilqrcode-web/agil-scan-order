import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadRaw);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  
  const renewTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const lastTokenRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (isRefreshingRef.current) {
      console.log('[RT-AUTH] Refresh already in progress. Skipping.');
      return;
    }
    isRefreshingRef.current = true;

    try {
      if (!client || !isSignedIn) {
        try { await client?.realtime.setAuth(null); } catch {} 
        lastTokenRef.current = null;
        return;
      }

      console.log('[RT-AUTH] Attempting to refresh Realtime auth token.');
      const token = await getToken({ template: 'supabase' });

      if (lastTokenRef.current === token) {
        console.log('[RT-AUTH] Token is the same as last time. Skipping setAuth.');
        return;
      }

      if (!token) {
        console.warn('[RT-AUTH] Null token received from Clerk. Clearing auth.');
        await client.realtime.setAuth(null);
        lastTokenRef.current = null;
        return;
      }

      await client.realtime.setAuth(token);
      lastTokenRef.current = token;
      console.log('[RT-AUTH] client.realtime.setAuth() called successfully.');

      const payload = decodeJwtPayload(token);
      const exp = payload?.exp ?? null;
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      if (exp) {
        const safetyMarginMs = 2 * 60 * 1000;
        const nowMs = Date.now();
        const renewInMs = (exp * 1000) - nowMs - safetyMarginMs;
        const timeout = Math.max(renewInMs, 30000);
        console.log(`[RT-AUTH-DIAG] Token exp: ${exp}, Now: ${Math.floor(nowMs / 1000)}, RenewInMs: ${renewInMs}, FinalTimeout: ${timeout}`);
        renewTimerRef.current = window.setTimeout(() => setRealtimeAuth(client), timeout);
      }
    } catch (e) {
      console.error('[RT-AUTH] Error during realtime auth flow:', e);
      lastTokenRef.current = null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getToken]);

  // Effect 1: Create Client
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk loaded. Creating Supabase client.');
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
    }
  }, [isLoaded, getToken, supabaseClient]);

  // Effect 2: Consolidated Channel & Auth Lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    console.log('[RT-LIFECYCLE] Initializing channel and auth flow...');
    const channel = supabaseClient.channel('public:orders');

    const handleReconnect = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channel.state === 'closed') {
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(1000 * (2 ** attempts), 60000);
        console.log(`[RT-LIFECYCLE] Connection lost. Attempting to reconnect in ${delay / 1000}s (attempt ${attempts + 1}).`);
        
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectAttemptsRef.current = attempts + 1;
          console.log('[RT-LIFECYCLE] Reconnect attempt: calling subscribe()');
          channel.subscribe();
        }, delay);
      }
    };

    channel.on('SUBSCRIBED', () => {
      console.log(`[RT-LIFECYCLE] SUBSCRIBED to ${channel.topic}. Resetting reconnect attempts.`);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      console.warn('[RT-LIFECYCLE] Channel CLOSED. Initiating reconnect logic.');
      handleReconnect();
    });

    setRealtimeChannel(channel);

    // Authenticate and then subscribe
    console.log('[RT-LIFECYCLE] Setting auth and subscribing...');
    setRealtimeAuth(supabaseClient).then(() => {
      if (channel.state !== 'joined' && channel.state !== 'subscribed') {
        channel.subscribe();
      }
    });

    return () => {
      console.log('[RT-LIFECYCLE] Cleanup: Removing channel.');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      supabaseClient.removeChannel(channel);
      setRealtimeChannel(null);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

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
      realtimeAuthCounter: 0,
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
