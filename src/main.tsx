import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth, useSession } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import React, { useEffect, useState, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from './integrations/supabase/types'; // Importar o tipo Database

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    if (isLoaded) {
      // Cria um novo cliente Supabase com um interceptor de fetch.
      // Este interceptor garante que cada requisição HTTP (Storage, DB, etc.)
      // tenha um token do Clerk novo e válido.
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input, init) => {
            const token = await getToken();
            const headers = new Headers(init?.headers);
            if (token) {
              headers.set("Authorization", `Bearer ${token}`);
            }
            return fetch(input, { ...init, headers });
          },
        },
      });

      // Autentica a conexão WebSocket do Realtime.
      // Isso é separado do fetch e é crucial para o funcionamento do Realtime.
      if (isSignedIn) {
        getToken().then(token => {
          if (token) {
            client.realtime.setAuth(token);
          }
        });
      }
      
      setSupabaseClient(client);
    }
    // }, [isLoaded, isSignedIn, getToken]); // Original principle, causes infinite loop due to getToken function reference changing on every render.
    }, [isLoaded, isSignedIn]); // Corrected dependencies to prevent loop while maintaining reactivity to auth state changes.

  // Efeito para renovar o token do Realtime periodicamente e evitar que a conexão seja fechada pelo servidor.
  useEffect(() => {
    if (!supabaseClient || !isSignedIn) {
      return;
    }

    // Tokens do Clerk expiram em 60 minutos. Renovamos a cada 30 para garantir.
    const interval = setInterval(() => {
      getToken().then(token => {
        if (token) {
          console.log("SupabaseProvider: Periodically refreshing Realtime auth token.");
          supabaseClient.realtime.setAuth(token);
        }
      });
    }, 1000 * 60 * 30);

    return () => {
      clearInterval(interval);
    };
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

function AppWithProviders() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <SupabaseProvider>
      <App />
    </SupabaseProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignInUrl="/onboarding"
      afterSignUpUrl="/onboarding"
    >
      <AppWithProviders />
    </ClerkProvider>
  </React.StrictMode>
);