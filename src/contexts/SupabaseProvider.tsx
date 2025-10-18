import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [resetCounter, setResetCounter] = useState(0); // O "botão de reset"
  
  const isRefreshingRef = useRef<boolean>(false);

  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Autenticação já em progresso. Pulando.');
      return;
    }
    isRefreshingRef.current = true;
    console.log('[AUTH] 3. Processo de autenticação do canal iniciado.');

    try {
      if (!client || !isSignedIn) {
        try { await client?.realtime.setAuth(null); } catch {}
        return;
      }

      console.log('[AUTH] --> Pedindo novo token ao Clerk...');
      const token = await getToken({ template: 'supabase' });

      if (!token) {
        console.warn('[AUTH] --> Token nulo recebido do Clerk. Limpando autenticação.');
        await client.realtime.setAuth(null);
        return;
      }
      
      console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
      await client.realtime.setAuth(token);
      console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');
    } catch (e) {
      console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getToken]);

  // Effect 1: Create Client
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[PROVIDER-INIT] ⚙️ 1. Clerk carregado. Criando cliente Supabase.');
      const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (input, init) => {
            const token = await getToken();
            const headers = new Headers(init?.headers);
            if (token) headers.set('Authorization', `Bearer ${token}`);
            return fetch(input, { ...init, headers });
          },
        },
      });
      setSupabaseClient(client);
    }
  }, [isLoaded, getToken, supabaseClient]);

  // Effect 2: The Self-Healing Channel Lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    console.log(`[LIFECYCLE] 🚀 Tentativa de conexão #${resetCounter + 1}. Criando novo canal...`);
    const channel = supabaseClient.channel('public:orders');

    const triggerReset = (reason: string) => {
      console.warn(`[LIFECYCLE] 🔄 ${reason}. Acionando reset completo do canal.`);
      // Apenas incrementa o contador. O useEffect cuidará do resto.
      setResetCounter(c => c + 1);
    };

    channel.on('SUBSCRIBED', () => {
      console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
    });

    channel.on('CLOSED', () => triggerReset('Canal fechado pelo servidor'));
    
    channel.on('error', (error) => {
      console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
      triggerReset('Erro detectado no canal');
    });

    setRealtimeChannel(channel);

    console.log('[LIFECYCLE] --> Disparando autenticação inicial...');
    setRealtimeAuth(supabaseClient);

    // A função de limpeza é crucial. Ela roda sempre que o useEffect é re-executado (ou seja, no reset).
    return () => {
      console.log(`[LIFECYCLE] 🧹 Limpando e destruindo canal da tentativa #${resetCounter + 1}...`);
      supabaseClient.removeChannel(channel);
      setRealtimeChannel(null);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, resetCounter]); // O resetCounter na dependência é a chave

  // Effect 3: The "Wake-Up Call" (ainda útil para re-autenticar ao voltar para a aba)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('👁️ Aba se tornou visível. Verificando saúde da autenticação...');
        setRealtimeAuth(supabaseClient);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseClient, isSignedIn, setRealtimeAuth]);

  if (!supabaseClient || !realtimeChannel) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <SupabaseContext.Provider value={{
      supabaseClient,
      realtimeChannel,
      realtimeAuthCounter: 0, // Deprecated, mas mantido para não quebrar outros componentes
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}