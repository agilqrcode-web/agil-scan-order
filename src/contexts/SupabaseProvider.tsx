import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Simple JWT payload decoder
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

  // This function will be stable
  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (!client || !isSignedIn) {
      try { await client?.realtime.setAuth(null); } catch {}
      return;
    }

    console.log('[RT-AUTH] Refreshing Realtime auth token.');
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[RT-AUTH] Null token received from Clerk.');
        await client.realtime.setAuth(null);
        return;
      }

      // Call setAuth and trust the SDK to handle it.
      await client.realtime.setAuth(token);
      console.log('[RT-AUTH] client.realtime.setAuth() called successfully.');

      // Schedule the next renewal based on the new token's expiration
      const payload = decodeJwtPayload(token);
      const exp = payload?.exp ?? null;
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
      }
      if (exp) {
        const safetyMarginMs = 2 * 60 * 1000; // 2 minutes
        const nowMs = Date.now();
        const renewInMs = (exp * 1000) - nowMs - safetyMarginMs;
        const timeout = Math.max(renewInMs, 5000); // minimum 5 seconds
        console.log(`[RT-AUTH] Scheduling next token renewal in ${Math.round(timeout / 1000)}s.`);
        renewTimerRef.current = window.setTimeout(() => setRealtimeAuth(client), timeout);
      }

    } catch (e) {
      console.error('[RT-AUTH] Error during realtime auth flow:', e);
      try { await client.realtime.setAuth(null); } catch {}
    }
  }, [isSignedIn, getToken]);


  // Effect to create the client and the channel instance once
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk loaded — creating Supabase client and channel instance.');

      // Create client with an auth interceptor for regular fetches
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input: RequestInfo, init?: RequestInit) => {
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
      });

      setSupabaseClient(client);

      // Create a single, stable channel instance.
      // Subscription is handled by consumer hooks.
      const ch = client.channel('public:orders');
      setRealtimeChannel(ch);
    }
  }, [isLoaded, getToken, supabaseClient]);


  // Effect to manage the authentication lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;

    // 1. Set auth immediately when client is ready or user signs in/out
    setRealtimeAuth(supabaseClient);

    // 2. Set up a fallback interval timer for renewal
    const fallbackIntervalMs = 55 * 60 * 1000; // 55 minutes
    const intervalId = setInterval(() => {
      console.log('[RT-AUTH] Triggering fallback periodic token renewal.');
      setRealtimeAuth(supabaseClient);
    }, fallbackIntervalMs);

    // 3. Cleanup on unmount
    return () => {
      clearInterval(intervalId);
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
      }
      if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
      }
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, realtimeChannel]);


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
      // These are no longer needed with the simplified approach
      realtimeAuthCounter: 0,
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
