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

  // This effect creates a single, wrapped Supabase client instance.
  // This client is enhanced to automatically inject the Clerk token into every HTTP request.
  useEffect(() => {
    if (supabaseClient) return; // Execute only once

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
              // If getToken fails, proceed with the original request without the auth header.
              return fetch(input, init);
            }
          },
        },
      });
      setSupabaseClient(client);
    }
  }, [isLoaded, getToken, supabaseClient]);

  // This effect is responsible for keeping the Realtime connection authenticated.
  // It runs whenever the user's sign-in status changes or the client is initialized.
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
        // If the user signs out, clear the Realtime authentication
        console.debug('[SupabaseProvider] User signed out, clearing Realtime auth.');
        supabaseClient.realtime.setAuth(null);
        lastTokenRef.current = null;
      }
    };

    setRealtimeAuth();

  }, [supabaseClient, isLoaded, isSignedIn, getToken]);

  // This is a fallback mechanism. It periodically attempts to refresh the Realtime token
  // to prevent it from expiring, as a safeguard against missed updates.
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
          // Errors are expected if the network is down or Clerk session has ended.
        }
      }
    }, 1000 * 60 * 30); // Refresh every 30 minutes

    return () => clearInterval(interval);
  }, [supabaseClient, isSignedIn, getToken]);

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
