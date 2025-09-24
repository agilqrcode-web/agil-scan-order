import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth, useSession } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import React, { useEffect, useState } from 'react';
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
  const { isSignedIn, getToken } = useAuth();
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    const initializeSupabase = async () => {
      console.log(`SupabaseProvider: useEffect triggered. isSignedIn: ${isSignedIn}`);

      // Sempre criar uma nova instância do cliente Supabase para garantir que os cabeçalhos sejam atualizados
      const newSupabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: localStorage,
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {},
        },
      });

      if (isSignedIn) {
        try {
          console.log('SupabaseProvider: Attempting to set Supabase session with Clerk JWT...');
          const token = await getToken();
          console.log('SupabaseProvider: Token obtained:', token ? `Length: ${token.length}` : 'null');

          if (token) {
            // Definir o token de acesso para a sessão do Supabase
            await newSupabaseClient.auth.setSession({
              access_token: token,
              refresh_token: '' // Clerk gerencia refresh
            });
            // Definir o cabeçalho de autorização globalmente para todas as requisições HTTP
            newSupabaseClient.realtime.setAuth(token); // Para Realtime
            newSupabaseClient.functions.setAuth(token); // Para Edge Functions
            // Para requisições REST (Storage, PostgREST), o setSession já deveria cuidar, mas vamos garantir
            // A forma mais robusta é garantir que o fetcher subjacente use o token da sessão atual.
            // Como o setSession atualiza o cliente, ele deve ser suficiente para o Storage.
            console.log('SupabaseProvider: Supabase client session updated with Clerk JWT.');
          } else {
            console.log('SupabaseProvider: No token available, skipping session setup.');
          }
        } catch (error) {
          console.error("SupabaseProvider: Error setting session:", error);
        } finally {
          setSupabaseClient(newSupabaseClient);
          setIsSupabaseReady(true);
        }
      } else if (isSignedIn === false) {
        try {
          console.log('SupabaseProvider: User not signed in. Signing out Supabase session.');
          await newSupabaseClient.auth.signOut();
        } catch (error) {
          console.error('SupabaseProvider: Error signing out Supabase session:', error);
        } finally {
          setSupabaseClient(newSupabaseClient);
          setIsSupabaseReady(true);
        }
      } else { // isSignedIn is undefined (initial load)
        setSupabaseClient(newSupabaseClient);
        setIsSupabaseReady(true);
      }
    };

    if (typeof isSignedIn !== 'undefined') {
      initializeSupabase();
    }
  }, [isSignedIn, getToken]);

  if (!isSupabaseReady || !supabaseClient) {
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
  console.log(`AppWithProviders: Clerk isLoaded: ${isLoaded}`);

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