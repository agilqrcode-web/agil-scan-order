import React, { useEffect, useRef, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (supabaseClient) return;

    if (isLoaded) {
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input: RequestInfo, init?: RequestInit) => {
            try {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, supabaseClient]);

  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;

    const setRealtimeAuth = async () => {
      console.log('[AUDIT-TOKEN] Auth effect triggered. User signed in:', isSignedIn);
      if (isSignedIn) {
        try {
          console.log('[AUDIT-TOKEN] Attempting to get token for Realtime auth...');
          const token = await getToken();
          if (token && token !== lastTokenRef.current) {
            console.log(`[AUDIT-TOKEN] New token obtained. Starts: ${token.substring(0, 10)}, Ends: ${token.substring(token.length - 10)}`);
            console.log('[AUDIT-TOKEN] Applying new token to Realtime client...');
            supabaseClient.realtime.setAuth(token);
            console.log('[AUDIT-TOKEN] setAuth(token) called.');
            lastTokenRef.current = token;
          } else if (token === lastTokenRef.current) {
            console.log('[AUDIT-TOKEN] Token is the same as before. No auth change needed.');
          }
        } catch (e) {
          console.error('[AUDIT-TOKEN] Error getting token for Realtime auth.', e);
        }
      } else {
        console.log('[AUDIT-TOKEN] User signed out. Clearing Realtime auth.');
        supabaseClient.realtime.setAuth(null);
        lastTokenRef.current = null;
      }
    };

    setRealtimeAuth();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!supabaseClient) return;

    const interval = setInterval(async () => {
      console.log('[AUDIT-TOKEN] Periodic refresh (30min interval) triggered.');
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token && token !== lastTokenRef.current) {
            console.log(`[AUDIT-TOKEN] Periodic refresh: New token obtained. Starts: ${token.substring(0, 10)}, Ends: ${token.substring(token.length - 10)}`);
            console.log('[AUDIT-TOKEN] Periodic refresh: Applying new token to Realtime client...');
            supabaseClient.realtime.setAuth(token);
            console.log('[AUDIT-TOKEN] Periodic refresh: setAuth(token) called.');
            lastTokenRef.current = token;
          }
        } catch (e) {
          console.warn('[AUDIT-TOKEN] Periodic refresh: Could not get token. This might be expected if tab is in background.');
        }
      } else {
        console.log('[AUDIT-TOKEN] Periodic refresh: User not signed in.');
      }
    }, 1000 * 60 * 30);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient, isSignedIn]);

  if (!supabaseClient) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <SupabaseContext.Provider value={supabaseClient}>
      {children}
    </SupabaseContext.Provider>
  );
}