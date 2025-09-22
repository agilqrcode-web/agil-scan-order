import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth, useSession } from "@clerk/clerk-react"; // Adicionado useSession
import App from './App.tsx';
import './index.css';
import { supabase } from "@/integrations/supabase/client"; // Importa a instância singleton
import React, { useEffect } from 'react'; // Removido useState
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

function SupabaseProvider({ children }) {
  const { isSignedIn } = useAuth();
  const { session } = useSession(); // Obtém o objeto de sessão completo do Clerk

  useEffect(() => {
    const updateSupabaseClientSession = async () => {
      console.log(`SupabaseProvider: useEffect triggered. isSignedIn: ${isSignedIn}`);
      if (isSignedIn && session) {
        try {
          console.log('SupabaseProvider: Attempting to set Supabase session with Clerk session...');
          // Constrói um objeto de sessão compatível com Supabase a partir da sessão do Clerk
          await supabase.auth.setSession({
            access_token: session.accessToken,
            // O refresh_token é opcional para setSession se o access_token for válido
            // e o Supabase não for gerenciar o refresh. Clerk gerencia isso.
            refresh_token: session.refreshToken || '', // Fornecer se disponível, ou string vazia
            expires_in: session.expireAt ? (session.expireAt - Math.floor(Date.now() / 1000)) : 3600, // Tempo restante
            token_type: 'Bearer',
            user: {
              id: session.user.id,
              aud: 'authenticated',
              role: 'authenticated',
              email: session.user.primaryEmailAddress?.emailAddress || '',
              // Adicione outros metadados do usuário se necessário para RLS do Supabase
            } as any, // Usar 'as any' temporariamente se o tipo 'User' do Supabase for mais restritivo
          });
          console.log('SupabaseProvider: Supabase client session updated with Clerk token.');
        } catch (error) {
          console.error("SupabaseProvider: Error updating Supabase client session:", error);
        }
      } else if (!isSignedIn) {
        // Se não estiver logado, limpa a sessão do Supabase
        console.log('SupabaseProvider: User not signed in. Attempting to sign out Supabase session.');
        try {
          await supabase.auth.signOut();
          console.log('SupabaseProvider: Supabase session signed out.');
        } catch (error) {
          console.error('SupabaseProvider: Error signing out Supabase session:', error);
        }
      }
    };
    updateSupabaseClientSession();
  }, [isSignedIn, session]); // Depende de isSignedIn e session

  return (
    <SupabaseContext.Provider value={supabase}> // Fornece a instância global singleton
      {children}
    </SupabaseContext.Provider>
  );
}

// Este componente garante que SupabaseProvider seja renderizado apenas
// após o Clerk ter carregado, prevenindo uma condição de corrida.
function AppWithProviders() {
  const { isLoaded, isSignedIn } = useAuth();
  console.log(`AppWithProviders: Clerk isLoaded: ${isLoaded}, isSignedIn: ${isSignedIn}`);

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