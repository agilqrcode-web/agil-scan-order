import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth, useSession } from "@clerk/clerk-react";
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
  const { isSignedIn, getToken } = useAuth();
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);

  useEffect(() => {
    const setSupabaseSession = async () => {
      console.log(`SupabaseProvider: useEffect triggered. isSignedIn: ${isSignedIn}`);
      if (isSignedIn) {
        try {
          console.log('SupabaseProvider: Attempting to set Supabase session with Clerk JWT...');
          const token = await getToken();
          if (token) {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: '' // Clerk gerencia refresh
            });
            console.log('SupabaseProvider: Supabase client session updated with Clerk JWT.');
          }
        } catch (error) {
          console.error("SupabaseProvider: Error setting session:", error);
        } finally {
          setIsSupabaseReady(true);
        }
      } else if (isSignedIn === false) {
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