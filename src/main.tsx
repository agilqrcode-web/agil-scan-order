import { createRoot } from 'react-dom/client';
import { ClerkProvider, useSession } from "@clerk/clerk-react";
import App from './App.tsx';
import './index.css';
import { createSupabaseClient } from "@/integrations/supabase/client";
import React, { useEffect, useState } from 'react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

const SupabaseContext = React.createContext(null);

function SupabaseProvider({ children }) {
  const { session } = useSession();
  const [supabase, setSupabase] = useState(null);

  useEffect(() => {
    async function createClient() {
      if (session) {
        const clerkToken = await session.getToken({ template: 'supabase' });
        const newSupabaseClient = createSupabaseClient(clerkToken);
        setSupabase(newSupabaseClient);
      } else {
        // If no session, create a public client
        setSupabase(createSupabaseClient());
      }
    }
    createClient();
  }, [session]);

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
