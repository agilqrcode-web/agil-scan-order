import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from "@clerk/clerk-react"; // Use useAuth
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
  const { isSignedIn, getToken } = useAuth(); // Use useAuth
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    async function createAndSetSupabaseClient() {
      if (isSignedIn) {
        const clerkToken = await getToken({ template: 'agilqrcode' }); // Get the latest token
        const newSupabaseClient = createSupabaseClient(clerkToken);
        setSupabase(newSupabaseClient);
      } else {
        // If not signed in, create a public client
        setSupabase(createSupabaseClient());
      }
    }

    createAndSetSupabaseClient(); // Initial call

    // Periodically re-create the Supabase client with a fresh Clerk token
    const intervalId = setInterval(() => {
      console.log("Attempting to refresh Supabase client with new Clerk token...");
      createAndSetSupabaseClient();
    }, 5 * 60 * 1000); // Every 5 minutes (adjust as needed)

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [isSignedIn, getToken]); // Depend on isSignedIn and getToken

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
