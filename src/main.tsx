import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import { supabase } from "@/integrations/supabase/client";
import React, { useEffect, useState } from 'react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, getToken } = useAuth(); // Usar getToken de useAuth
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    const setSupabaseSession = async () => {
      console.log(`SupabaseProvider: useEffect triggered. isSignedIn: ${isSignedIn}`);
      if (isSignedIn) {
        try {
          console.log("SupabaseProvider: Getting token with 'agilqrcode' template...");
          const token = await getToken({ template: "agilqrcode" });
          if (!token) {
            throw new Error("Clerk token not found.");
          }

          // DEBUG: Log the token to inspect it
          console.log("CLERK TOKEN:", token);
          
          console.log('SupabaseProvider: Attempting to set Supabase session...');
          await supabase.auth.setSession({ access_token: token, refresh_token: token });
          console.log('SupabaseProvider: Supabase client session updated.');

        } catch (error) {
          console.error("SupabaseProvider: Error setting session:", error);
        } finally {
          setIsSupabaseReady(true);
        }
      } else if (isSignedIn === false) { // Apenas executa se o status for conhecido
        try {
          console.log('SupabaseProvider: User not signed in. Signing out Supabase session.');
          await supabase.auth.signOut();
        } catch (error) {
          console.error('SupabaseProvider: Error signing out Supabase session:', error);
        } finally {
          setIsSupabaseReady(true);
        }
      }
    };

    // Não faz nada até que o status de autenticação do Clerk seja conhecido
    if (typeof isSignedIn !== 'undefined') {
      setSupabaseSession();
    }
  }, [isSignedIn, getToken]);

  if (!isSupabaseReady) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <SupabaseContext.Provider value={supabase}>
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