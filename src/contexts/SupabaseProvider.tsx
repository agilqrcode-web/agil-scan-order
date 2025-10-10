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
  const [isRealtimeAuthed, setIsRealtimeAuthed] = useState(false);
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
  }, [isLoaded, supabaseClient, getToken]);

  // This useEffect solely manages the Realtime authentication state.
  // It runs when the client is created or the user's sign-in status changes.
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    const setRealtimeAuth = async () => {
      if (isSignedIn) {
        console.log('[RT-AUTH] User is signed in. Attempting to set Realtime auth.');
        try {
          // Using the 'supabase' template as requested for the stability test.
          const token = await getToken({ template: 'supabase' });

          if (token) {
            console.log('[RT-AUTH] Token obtained. Applying to Realtime client.');
            supabaseClient.realtime.setAuth(token);
            setIsRealtimeAuthed(true);
            console.log('[RT-AUTH] Realtime auth has been set.');
          } else {
            console.warn('[RT-AUTH] Null token received. Realtime auth not set.');
            setIsRealtimeAuthed(false);
          }
        } catch (e) {
          console.error('[RT-AUTH] Error getting token for Realtime auth:', e);
          setIsRealtimeAuthed(false);
        }
      } else {
        console.log('[RT-AUTH] User is not signed in. Clearing Realtime auth.');
        supabaseClient.realtime.setAuth(null);
        setIsRealtimeAuthed(false);
      }
    };

    setRealtimeAuth();
  }, [supabaseClient, isSignedIn, isLoaded, getToken]);

  if (!supabaseClient) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <SupabaseContext.Provider value={{ supabaseClient, isRealtimeAuthed }}>
      {children}
    </SupabaseContext.Provider>
  );
}