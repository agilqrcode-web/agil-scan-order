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
  // 1. Create a single Supabase client instance and store it in state.
  const [supabase] = useState(() => createSupabaseClient());
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    // 2. This effect runs whenever the user's sign-in state changes.
    const setSession = async () => {
      if (isSignedIn) {
        try {
          // 3. Get the token from Clerk.
          const clerkToken = await getToken({ template: 'agilqrcode' });
          if (clerkToken) {
            // 4. Set the session in the Supabase client.
            // This updates the authentication state without recreating the client.
            await supabase.auth.setSession({ access_token: clerkToken, refresh_token: clerkToken });
            console.log("Supabase session updated with Clerk token.");
          }
        } catch (error) {
          console.error("Error setting Supabase session:", error);
        }
      } else {
        // If the user signs out, clear the session.
        await supabase.auth.signOut();
        console.log("Supabase session cleared.");
      }
    };

    setSession();
  }, [isSignedIn, getToken, supabase]);

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
