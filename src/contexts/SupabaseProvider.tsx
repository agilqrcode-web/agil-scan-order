import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Configuration (tweak as needed)
const SAFETY_MARGIN_SECONDS = 120; // renew if token has < 2 minutes remaining
const DEFAULT_RENEW_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes fallback
const SETAUTH_CONFIRM_DELAY_MS = 350; // wait after setAuth before checking channel state
const RECONNECT_MAX_ATTEMPTS = 3; // internal reconnect attempts
const RECONNECT_INITIAL_DELAY_MS = 500; // backoff base

// Simple JWT payload decoder (no external libs)
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
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null); // exposed to context
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0); // fallback counter

  const renewTimerRef = useRef<number | null>(null);
  const reconnectLockRef = useRef<boolean>(false);
  const setRealtimeAuthRef = useRef<typeof setRealtimeAuth | null>(null);

  // Helper: delay
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Create client once Clerk is loaded
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk loaded — creating Supabase client.');

      const initializeSupabaseClient = async () => {
        let authOptions: any = {};
        if (isSignedIn) {
          try {
            console.log('[SupabaseProvider] Signed in — obtaining initial token for client creation.');
            const token = await getToken();
            if (token) {
              authOptions = { auth: { accessToken: token } };
            }
          } catch (err) {
            console.warn('[SupabaseProvider] Failed to get initial token during client creation.', err);
          }
        }

        const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          ...authOptions,
          global: {
            // Interceptor for normal API fetches (not realtime)
            fetch: async (input: RequestInfo, init?: RequestInit) => {
              try {
                const token = await getToken();
                const headers = new Headers(init?.headers);
                if (token) headers.set('Authorization', `Bearer ${token}`);
                return fetch(input, { ...init, headers });
              } catch (e) {
                // If getToken fails, fall back to default fetch
                return fetch(input, init);
              }
            },
          },
        });

        setSupabaseClient(client);

        // Create a channel reference but DO NOT auto-subscribe here.
        const ch = client.channel('public:notifications');
        realtimeChannelRef.current = ch;
        setRealtimeChannel(ch);
      };

      initializeSupabaseClient();
    }
  }, [isLoaded, supabaseClient, isSignedIn, getToken]);

  // Schedule renewal using token exp if available
  const scheduleRenewal = useCallback((exp?: number | null) => {
    if (renewTimerRef.current) {
      clearTimeout(renewTimerRef.current);
      renewTimerRef.current = null;
    }
    if (!exp) {
      // fallback periodic renewal
      renewTimerRef.current = window.setTimeout(() => {
        if (supabaseClient && setRealtimeAuthRef.current) setRealtimeAuthRef.current(supabaseClient);
      }, DEFAULT_RENEW_INTERVAL_MS);
      return;
    }
    const nowMs = Date.now();
    const renewAtMs = (exp * 1000) - SAFETY_MARGIN_SECONDS * 1000;
    const ms = Math.max(renewAtMs - nowMs, 5000); // at least 5s
    renewTimerRef.current = window.setTimeout(() => {
      if (supabaseClient) setRealtimeAuth(supabaseClient);
    }, ms);
  }, [supabaseClient]);

  // Controlled reconnect with lock/backoff. Returns true if reconnected.
  const attemptReconnectWithBackoff = useCallback(async (maxAttempts = RECONNECT_MAX_ATTEMPTS) => {
    if (!supabaseClient) return false;
    if (reconnectLockRef.current) {
      console.log('[RT-RECONNECT] Reconnect already in progress (lock).');
      return false;
    }
    reconnectLockRef.current = true;
    try {
      let attempt = 0;
      let delayMs = RECONNECT_INITIAL_DELAY_MS;
      while (attempt < maxAttempts) {
        attempt++;
        // Clean up existing channel
        try {
          if (realtimeChannelRef.current) {
            try { await realtimeChannelRef.current.unsubscribe(); } catch { /* ignore */ }
            realtimeChannelRef.current = null;
          }
        } catch {}

        // Recreate channel and try subscribe
        try {
          const ch = supabaseClient.channel('public:notifications');
          realtimeChannelRef.current = ch;
          setRealtimeChannel(ch);
          ch.subscribe();
          // small wait for state to update
          await delay(SETAUTH_CONFIRM_DELAY_MS + 150);
          if (realtimeChannelRef.current && realtimeChannelRef.current.state === 'SUBSCRIBED') {
            console.log('[RT-RECONNECT] Reconnected on attempt', attempt);
            reconnectLockRef.current = false;
            return true;
          }
        } catch (err) {
          console.warn('[RT-RECONNECT] subscribe attempt failed', attempt, err);
        }
        await delay(delayMs);
        delayMs *= 2; // exponential backoff
      }
      console.error('[RT-RECONNECT] All reconnect attempts exhausted.');
      return false;
    } finally {
      reconnectLockRef.current = false;
    }
  }, [supabaseClient]);

  // Central setRealtimeAuth (stable reference)
  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    setRealtimeAuthRef.current = setRealtimeAuth;
    if (!client) return;
    if (isSignedIn) {
      console.log('[RT-AUTH] Attempting to set/refresh Realtime auth.');
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) {
          console.warn('[RT-AUTH] Null token received. Clearing auth.');
          await client.realtime.setAuth(null);
          return;
        }

        const payload = decodeJwtPayload(token);
        const now = Math.floor(Date.now() / 1000);
        const exp = payload?.exp ?? null;
        console.log('[RT-AUTH] token exp:', exp, 'now:', now);

        // If token is near expiry, attempt to fetch a fresh one before setting
        if (exp && exp - now < SAFETY_MARGIN_SECONDS) {
          console.warn('[RT-AUTH] Token near expiry — refreshing once before setAuth.');
          try {
            await getToken({ template: 'supabase' }); // one attempt for fresh token
          } catch (e) {
            /* non-fatal */
          }
        }

        console.log('[RT-AUTH] Calling client.realtime.setAuth(...)');
        await client.realtime.setAuth(token);
        await delay(SETAUTH_CONFIRM_DELAY_MS);

        const ch = realtimeChannelRef.current;
        const chState = ch?.state ?? null;
        console.log('[RT-AUTH] Channel state after setAuth:', chState);

        if (!ch || chState !== 'SUBSCRIBED') {
          // Attempt internal reconnect first (lock/backoff)
          const reconnected = await attemptReconnectWithBackoff();
          if (!reconnected) {
            // Internal attempts failed — increment fallback counter to notify hooks
            console.warn('[RT-AUTH] Internal reconnection failed — incrementing realtimeAuthCounter as fallback.');
            setRealtimeAuthCounter((c) => c + 1);
          } else {
            // Successfully reconnected internally — do NOT increment counter
            console.log('[RT-AUTH] Internal reconnect succeeded; counter unchanged.');
            // Optional no-op to keep stable: setRealtimeAuthCounter(c => c);
          }
        } else {
          // Channel is subscribed — nothing to do
          console.log('[RT-AUTH] Channel is SUBSCRIBED after setAuth.');
        }

        // Schedule renewal based on exp if available
        scheduleRenewal(exp ?? null);
      } catch (e) {
        console.error('[RT-AUTH] Error during realtime auth flow:', e);
        try { await client.realtime.setAuth(null); } catch {}
        // As a last-resort, increment counter to notify watchers
        setRealtimeAuthCounter((c) => c + 1);
      }
    } else {
      console.log('[RT-AUTH] User not signed in — clearing Realtime auth.');
      try { await client.realtime.setAuth(null); } catch {}
    }
    }, [isSignedIn, getToken, scheduleRenewal, attemptReconnectWithBackoff, delay, setIsRealtimeReadyForSubscription]);

  // Trigger initial auth flow when client ready or sign-in state changes
  useEffect(() => {
    if (supabaseClient && isLoaded) {
      setRealtimeAuth(supabaseClient);
    }
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

  // Fallback periodic renewal (in addition to scheduleRenewal)
  useEffect(() => {
    if (!supabaseClient) return;
    const id = setInterval(() => {
      setRealtimeAuth(supabaseClient);
    }, DEFAULT_RENEW_INTERVAL_MS);
    return () => clearInterval(id);
  }, [supabaseClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (renewTimerRef.current) {
        clearTimeout(renewTimerRef.current);
        renewTimerRef.current = null;
      }
      if (realtimeChannelRef.current) {
        try { realtimeChannelRef.current.unsubscribe(); } catch {}
        realtimeChannelRef.current = null;
      }
    };
  }, []);

  // Expose requestReconnect util for hooks that want to trigger controlled reconnect
  const requestReconnect = useCallback(async (attempts = RECONNECT_MAX_ATTEMPTS) => {
    return attemptReconnectWithBackoff(attempts);
  }, [attemptReconnectWithBackoff]);

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
      realtimeAuthCounter,
      requestReconnect,
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
