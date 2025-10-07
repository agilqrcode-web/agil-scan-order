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
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token && token !== lastTokenRef.current) {
            console.debug('[SupabaseProvider] Applying new token to Realtime.');
            supabaseClient.realtime.setAuth(token);
            lastTokenRef.current = token;
          }
        } catch (e) {
          console.error('[SupabaseProvider] Error getting token for Realtime auth.', e);
        }
      } else {
        console.debug('[SupabaseProvider] User signed out, clearing Realtime auth.');
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
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token && token !== lastTokenRef.current) {
            console.debug('[SupabaseProvider] Periodic refresh: Applying new token to Realtime.');
            supabaseClient.realtime.setAuth(token);
            lastTokenRef.current = token;
          }
        } catch (e) {
          // Errors are expected.
        }
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