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
  
  // Refs for robust token renewal
  const renewTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef<boolean>(false); // Lock to prevent concurrent renewals
  const lastTokenRef = useRef<string | null>(null);    // Store the last used token

  // This function is now "armored" based on Supabase agent's advice
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
        isRefreshingRef.current = false;
        return;
      }

      console.log('[RT-AUTH] Attempting to refresh Realtime auth token.');
      const token = await getToken({ template: 'supabase' });

      if (lastTokenRef.current === token) {
        console.log('[RT-AUTH] Token is the same as last time. Skipping setAuth.');
        isRefreshingRef.current = false;
        return;
      }

      if (!token) {
        console.warn('[RT-AUTH] Null token received from Clerk. Clearing auth.');
        await client.realtime.setAuth(null);
        lastTokenRef.current = null;
        isRefreshingRef.current = false;
        return;
      }

      await client.realtime.setAuth(token);
      lastTokenRef.current = token; // Store the new token after it has been successfully set
      console.log('[RT-AUTH] client.realtime.setAuth() called successfully.');

      // Schedule the next renewal
      const payload = decodeJwtPayload(token);
      const exp = payload?.exp ?? null;
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
      }
      if (exp) {
        const safetyMarginMs = 2 * 60 * 1000; // 2 minutes
        const nowMs = Date.now();
        const renewInMs = (exp * 1000) - nowMs - safetyMarginMs;
        const timeout = Math.max(renewInMs, 30000); // 30 seconds minimum timeout

        console.log(`[RT-AUTH-DIAG] Token exp: ${exp}, Now: ${Math.floor(nowMs / 1000)}, RenewInMs: ${renewInMs}, FinalTimeout: ${timeout}`);

        renewTimerRef.current = window.setTimeout(() => setRealtimeAuth(client), timeout);
      }
    } catch (e) {
      console.error('[RT-AUTH] Error during realtime auth flow:', e);
      try { await client.realtime.setAuth(null); } catch {}
      lastTokenRef.current = null;
    } finally {
      isRefreshingRef.current = false; // Release lock in all cases
    }
  }, [isSignedIn, getToken]);


  // Effect to create the client and the channel instance once
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk loaded — creating Supabase client and channel instance.');

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

      const ch = client.channel('public:orders');
      setRealtimeChannel(ch);
    }
  }, [isLoaded, getToken, supabaseClient]);


  // Effect to manage the authentication lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;

    setRealtimeAuth(supabaseClient);

    // The fallback interval is removed to prevent conflicts with the smart scheduling.

    return () => {
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
      // Deprecated values, kept for compatibility if other hooks use them, but they do nothing.
      realtimeAuthCounter: 0,
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
