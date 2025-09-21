import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import { createSupabaseClient } from "@/integrations/supabase/client";
import React, { useEffect, useState } from 'react';
import { SupabaseContext } from "@/contexts/SupabaseContext";

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
          console.log("User is signed in. Updating Supabase client with new token.");
          const clerkToken = await getToken({ template: 'agilqrcode' });
          const newSupabaseClient = createSupabaseClient(clerkToken);
          setSupabase(newSupabaseClient);
        } catch (error) {
          console.error("Error updating Supabase client:", error);
        }
      } else {
        // If user signs out, create a new public (unauthenticated) client.
        console.log("User is signed out. Creating new public Supabase client.");
        setSupabase(createSupabaseClient());
      }
    };

    updateSupabaseClient();

    // No event listeners for focus or visibility change needed anymore.
    // This logic is now purely reactive to the authentication state.

  }, [isSignedIn, getToken]); // Effect runs when auth state changes

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider 
    publishableKey={PUBLISHABLE_KEY}
    afterSignInUrl="/onboarding"
    afterSignUpUrl="/onboarding"
  >
    <SupabaseProvider>
      <App />
    </SupabaseProvider>
  </ClerkProvider>
);
