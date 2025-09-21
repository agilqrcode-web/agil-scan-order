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
  // Initialize with a public client immediately.
  const [supabase, setSupabase] = useState(() => createSupabaseClient());

  // Memoize the token refresh function.
  const refreshSupabaseToken = React.useCallback(async () => {
    if (isSignedIn) {
      try {
        console.log("Refreshing Supabase token on focus/visibility change...");
        const clerkToken = await getToken({ template: 'agilqrcode' });
        const newSupabaseClient = createSupabaseClient(clerkToken);
        setSupabase(newSupabaseClient);
        console.log("Supabase client refreshed with new token.");
      } catch (error) {
        console.error("Error refreshing Supabase token:", error);
      }
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    // Initial check when the component mounts or user signs in.
    refreshSupabaseToken();

    // Set up event listeners to refresh the token when the tab becomes active.
    window.addEventListener('visibilitychange', refreshSupabaseToken);
    window.addEventListener('focus', refreshSupabaseToken);

    // Cleanup function to remove event listeners.
    return () => {
      window.removeEventListener('visibilitychange', refreshSupabaseToken);
      window.removeEventListener('focus', refreshSupabaseToken);
    };
  }, [refreshSupabaseToken]);

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
