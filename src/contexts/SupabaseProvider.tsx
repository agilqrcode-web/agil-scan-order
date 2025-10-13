import React, { useEffect, useState, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const TOKEN_RENEWAL_INTERVAL = 55 * 60 * 1000; // 55 minutes

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState(0);

  // This useEffect handles the creation of the Supabase client.
  // It runs once after Clerk is loaded.
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[SupabaseProvider] Clerk is loaded, creating Supabase client.');
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          // This fetch interceptor is for standard API requests (e.g., via RPC), not Realtime.
          fetch: async (input: RequestInfo, init?: RequestInit) => {
            try {
              // Use the standard getToken() for API calls.
              const token = await getToken();
              const headers = new Headers(init?.headers);
              if (token) {
                headers.set('Authorization', `Bearer ${token}`);
              }
              return fetch(input, { ...init, headers });
            } catch (e) {
              return fetch(input, init);
            }
          },
        },
      });
      setSupabaseClient(client);
    }
  }, [isLoaded, supabaseClient]);

  // Memoized function to handle Realtime authentication to ensure stable reference
  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (isSignedIn) {
      console.log('[RT-AUTH] Attempting to set/refresh Realtime auth.');
      try {
        const token = await getToken({ template: 'supabase' });
        if (token) {
          client.realtime.setAuth(token);
          setRealtimeAuthCounter(prev => {
            console.log(`[RT-DEBUG] realtimeAuthCounter incremented: ${prev} -> ${prev + 1}`);
            return prev + 1;
          });
          console.log('[RT-AUTH] Realtime auth has been set/refreshed.');
        } else {
          console.warn('[RT-AUTH] Null token received. Realtime auth not set.');
          setRealtimeAuthCounter(0);
        }
      } catch (e) {
        console.error('[RT-AUTH] Error getting token for Realtime auth:', e);
        setRealtimeAuthCounter(0);
      }
    } else {
      console.log('[RT-AUTH] User is not signed in. Clearing Realtime auth.');
      client.realtime.setAuth(null);
      setRealtimeAuthCounter(0);
    }
  }, [isSignedIn, getToken]);

  // This useEffect handles the initial authentication and re-authentication on sign-in changes.
  useEffect(() => {
    if (supabaseClient && isLoaded) {
      setRealtimeAuth(supabaseClient);
    }
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

  // This useEffect sets up the proactive token renewal timer.
  useEffect(() => {
    if (!supabaseClient) return;

    console.log('[RT-RENEW] Setting up proactive token renewal timer.');
    const timer = setInterval(() => {
      setRealtimeAuth(supabaseClient);
    }, TOKEN_RENEWAL_INTERVAL);

    return () => {
      console.log('[RT-RENEW] Clearing proactive token renewal timer.');
      clearInterval(timer);
    };
  }, [supabaseClient, setRealtimeAuth]);

  if (!supabaseClient) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  // useRealtimeOrders(); // Moved to DashboardLayoutContent

  return (
    <SupabaseContext.Provider value={{ supabaseClient, realtimeAuthCounter }}>
      {children}
    </SupabaseContext.Provider>
  );
}
