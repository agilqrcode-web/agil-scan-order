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
  const { isSignedIn, getToken, sessionId } = useAuth();
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    console.log("SupabaseProvider useEffect triggered.");
    console.log("isSignedIn:", isSignedIn, "sessionId:", sessionId);

    let intervalId: NodeJS.Timeout; // Declare intervalId here

    async function initializeSupabaseClient() {
      console.log("initializeSupabaseClient called.");
      if (isSignedIn) {
        try {
          console.log("Attempting to get Clerk token...");
          // Force a refresh of the token if it's near expiration or expired
          const clerkToken = await getToken({ template: 'agilqrcode', force: true });
          console.log("Clerk token obtained (or refreshed). Length:", clerkToken?.length);
          const newSupabaseClient = createSupabaseClient(clerkToken);
          setSupabase(newSupabaseClient);
          console.log("Supabase client initialized/refreshed with Clerk token.");
        } catch (error) {
          console.error("Error getting Clerk token or initializing Supabase client:", error);
          setSupabase(createSupabaseClient());
          console.log("Supabase client initialized as public due to error.");
        }
      } else {
        setSupabase(createSupabaseClient());
        console.log("Supabase client initialized as public (not signed in).");
      }
    }

    initializeSupabaseClient();

    // Set up a timer to re-initialize the Supabase client before the token expires
    // Clerk JWT lifetime is 3600 seconds (1 hour). Refresh every 55 minutes (3300 seconds).
    if (isSignedIn) {
      intervalId = setInterval(() => {
        console.log("Proactively refreshing Supabase client due to timer.");
        initializeSupabaseClient();
      }, 3300 * 1000); // 3300 seconds * 1000 ms/s
    }

    // Cleanup function for useEffect
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

  }, [isSignedIn, getToken, sessionId]);

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
