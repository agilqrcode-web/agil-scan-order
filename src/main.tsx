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
  const [supabase, setSupabase] = useState(() => createSupabaseClient());

  useEffect(() => {
    const updateSupabaseClient = async () => {
      if (isSignedIn) {
        try {
          const clerkToken = await getToken({ template: 'agilqrcode' });
          const newSupabaseClient = createSupabaseClient(clerkToken);
          setSupabase(newSupabaseClient);
        } catch (error) {
          console.error("Error updating Supabase client:", error);
        }
      } else {
        setSupabase(createSupabaseClient());
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
  const { isLoaded } = useAuth();

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