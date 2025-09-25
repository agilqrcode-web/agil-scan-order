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
  const { getToken } = useAuth();
  const [supabaseClient] = useState(() =>
    createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        // A função fetch customizada intercepta cada requisição
        fetch: async (input, init) => {
          // Obtém o token mais recente do Clerk
          const token = await getToken();

          // Garante que o cabeçalho de autorização exista
          const headers = new Headers(init?.headers);
          headers.set("Authorization", `Bearer ${token}`);
          
          // Realiza a requisição original com o cabeçalho atualizado
          return fetch(input, { ...init, headers });
        },
      },
    })
  );

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