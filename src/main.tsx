import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import { createSupabaseClient } from "@/integrations/supabase/client";
import React, { useEffect, useState } from 'react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function SupabaseProvider({ children }) {
  const { isSignedIn, getToken } = useAuth();
  const [supabase, setSupabase] = useState(() => {
    console.log('SupabaseProvider: Initializing Supabase client.');
    return createSupabaseClient();
  });

  useEffect(() => {
    const updateSupabaseClient = async () => {
      console.log(`SupabaseProvider: useEffect triggered. isSignedIn: ${isSignedIn}`);
      if (isSignedIn) {
        try {
          console.log('SupabaseProvider: Attempting to get Clerk token...');
          const clerkToken = await getToken({ template: 'agilqrcode' });
          console.log(`SupabaseProvider: Clerk token obtained (length: ${clerkToken?.length || 0}).`);
          const newSupabaseClient = createSupabaseClient(clerkToken);
          setSupabase(newSupabaseClient);
          console.log('SupabaseProvider: Supabase client updated with Clerk token.');
        } catch (error) {
          console.error("SupabaseProvider: Error updating Supabase client:", error);
        }
      } else {
        setSupabase(createSupabaseClient());
        console.log('SupabaseProvider: Supabase client reset to unauthenticated.');
      }
    };
    updateSupabaseClient();
  }, [isSignedIn, getToken]);

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

// This new component ensures that SupabaseProvider is only rendered
// after Clerk has loaded, preventing a race condition.
function AppWithProviders() {
  const { isLoaded, isSignedIn } = useAuth();
  console.log(`AppWithProviders: Clerk isLoaded: ${isLoaded}, isSignedIn: ${isSignedIn}`);

  if (!isLoaded) {
    // You can render a global loading spinner here if you like
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