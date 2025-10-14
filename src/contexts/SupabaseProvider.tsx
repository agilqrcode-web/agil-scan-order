import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

// Config
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
// Prefer margin-based renewal. If you prefer fixed interval, change below.
const SAFETY_MARGIN_SECONDS = 120; // renew if < 2 minutes left
const DEFAULT_RENEW_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes fallback
const SETAUTH_CONFIRM_DELAY_MS = 350; // wait after setAuth before checking channel
const RECONNECT_MAX_ATTEMPTS = 3;

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

// Global helper delay function
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null); // for context expose
  const [isRealtimeReadyForSubscription, setIsRealtimeReadyForSubscription] = useState(false);
  const renewTimerRef = useRef<number | null>(null);
  const reconnectLockRef = useRef(false);

  // create client once clerk loaded
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk is loaded, creating Supabase client.');

      const initializeSupabaseClient = async () => {
        let authOptions: any = {};
        if (isSignedIn) {
          console.log('[SupabaseProvider] User is signed in, attempting to get initial auth token for client creation.');
          const token = await getToken();
          if (token) {
            authOptions = { auth: { accessToken: token } };
          }
        }

        const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          ...authOptions,
          global: {
            fetch: async (input: RequestInfo, init?: RequestInit) => {
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

        setSupabaseClient(client);

        // create channel reference but do not auto-subscribe here; subscription will be handled by hooks
        const ch = client.channel('public:notifications');
        realtimeChannelRef.current = ch;
        setRealtimeChannel(ch);
      };

      initializeSupabaseClient();
    }
  }, [isLoaded, supabaseClient, isSignedIn, getToken]);



  // schedule renewal using exp if available
  const scheduleRenewal = useCallback((exp?: number | null) => {
    if (renewTimerRef.current) {
      clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
    if (!exp) {
      // fallback periodic renewal
      renewTimerRef.current = window.setTimeout(() => {
        if (supabaseClient) setRealtimeAuth(supabaseClient);
      }, DEFAULT_RENEW_INTERVAL_MS);
      return;
    }
    const nowMs = Date.now();
    const renewAtMs = (exp * 1000) - SAFETY_MARGIN_SECONDS * 1000;
    const ms = Math.max(renewAtMs - nowMs, 5000); // at least 5s
    renewTimerRef.current = window.setTimeout(() => {
      if (supabaseClient) setRealtimeAuth(supabaseClient);
    }, ms);
  }, [supabaseClient, setRealtimeAuth]);

  // controlled reconnect (used if channel closed after setAuth)
  const attemptReconnectWithBackoff = useCallback(async (maxAttempts = RECONNECT_MAX_ATTEMPTS) => {
    if (!supabaseClient) return false;
    if (reconnectLockRef.current) return false;
    reconnectLockRef.current = true;
    try {
      let attempt = 0;
      let delayMs = 500;
      while (attempt < maxAttempts) {
        attempt++;
        // cleanup existing channel
        try {
          if (realtimeChannelRef.current) {
            try { await realtimeChannelRef.current.unsubscribe(); } catch {} // AWAIT HERE
            realtimeChannelRef.current = null;
          }
        } catch {} // AWAIT HERE
        // recreate channel and subscribe
        try {
          const ch = supabaseClient.channel('public:notifications');
          realtimeChannelRef.current = ch;
          setRealtimeChannel(ch);
          ch.subscribe();
          await delay(SETAUTH_CONFIRM_DELAY_MS + 100); // wait a bit
          if (realtimeChannelRef.current && realtimeChannelRef.current.state === 'SUBSCRIBED') {
            reconnectLockRef.current = false;
            return true;
          }
        } catch (err) {
          console.warn('[RT-RECONNECT] subscribe attempt failed', attempt, err);
        }
        await delay(delayMs);
        delayMs *= 2;
      }
      console.error('[RT-RECONNECT] reconnect attempts exhausted');
      return false;
    } finally {
      reconnectLockRef.current = false;
    }
  }, [supabaseClient, delay]); // ADDED delay to dependencies

  // central setRealtimeAuth function
  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (!client) return;
    if (isSignedIn) {
      console.log('[RT-AUTH] Attempting to set/refresh Realtime auth.');
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) {
          console.warn('[RT-AUTH] Null token received. Clearing auth.');
          await client.realtime.setAuth(null);
          setIsRealtimeReadyForSubscription(false);
          return;
        }

        const payload = decodeJwtPayload(token);
        const now = Math.floor(Date.now() / 1000);
        const exp = payload?.exp ?? null;
        console.log('[RT-AUTH] token exp:', exp, 'now:', now);

        // If token is very close to expiry, try to fetch a fresh token once
        if (exp && exp - now < SAFETY_MARGIN_SECONDS) {
          console.warn('[RT-AUTH] Token near expiry, attempting immediate refresh before setAuth.');
          const token2 = await getToken({ template: 'supabase' });
          if (token2) {
            // prefer fresh token if different
            // (no strong equality check here to keep it simple)
          }
        }

        console.log(`[RT-AUTH] Calling client.realtime.setAuth() with token length: ${token.length}`);
        await client.realtime.setAuth(token);
        console.log('[RT-AUTH] client.realtime.setAuth() call completed. Waiting briefly to confirm channel state...');
        await delay(SETAUTH_CONFIRM_DELAY_MS);

        // check channel state if channel exists
        const ch = realtimeChannelRef.current;
        const chState = ch?.state ?? null;
        console.log('[RT-AUTH] Channel state after setAuth:', chState);
        if (!ch || chState === 'SUBSCRIBED') {
          setIsRealtimeReadyForSubscription(true);
          scheduleRenewal(exp ?? null);
        }
        else {
          // channel not subscribed -> attempt controlled reconnect
          setIsRealtimeReadyForSubscription(false);
          const ok = await attemptReconnectWithBackoff();
          setIsRealtimeReadyForSubscription(Boolean(ok));
          // schedule renewal if ok and exp known
          if (ok) scheduleRenewal(exp ?? null);
        }
      }
      catch (e) {
        console.error('[RT-AUTH] Error getting token for Realtime auth:', e);
        try { await client.realtime.setAuth(null); } catch {} // AWAIT HERE
        setIsRealtimeReadyForSubscription(false);
      }
    }
    else {
      console.log('[RT-AUTH] User is not signed in. Clearing Realtime auth.');
      try { await client.realtime.setAuth(null); } catch {} // AWAIT HERE
      setIsRealtimeReadyForSubscription(false);
    }
  }, [isSignedIn, getToken, scheduleRenewal, attemptReconnectWithBackoff, delay]); // ADDED delay to dependencies

  // initial auth when client ready / sign-in changes
  useEffect(() => {
    if (supabaseClient && isLoaded) {
      setRealtimeAuth(supabaseClient);
    }
    return () => {};
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

  // proactive renewal fallback (in case scheduling using exp didn't run)
  useEffect(() => {
    if (!supabaseClient) return;
    const timer = setInterval(() => {
      setRealtimeAuth(supabaseClient);
    }, DEFAULT_RENEW_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [supabaseClient, setRealtimeAuth]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
        renewTimerRef.current = null;
      }
      if (realtimeChannelRef.current) {
        try { realtimeChannelRef.current.unsubscribe(); } catch {} // AWAIT HERE
        realtimeChannelRef.current = null;
      }
    };
  }, []);

  if (!supabaseClient) {
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
      isRealtimeReadyForSubscription,
      requestReconnect: () => attemptReconnectWithBackoff(3),
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
