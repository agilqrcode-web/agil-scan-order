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
  
  const isRefreshingRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

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

  // Effect 2: Reactive Channel & Auth Lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    console.log('[LIFECYCLE] 🚀 2. Cliente Supabase pronto. Iniciando ciclo de vida do canal...');
    const channel = supabaseClient.channel('public:orders');

    const handleRecovery = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      
      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * (2 ** attempts), 30000); // Max 30s delay
      console.log(`[LIFECYCLE] 🔄 Tentando recuperar conexão em ${delay / 1000}s (tentativa ${attempts + 1}).`);
      
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectAttemptsRef.current = attempts + 1;
        console.log('[LIFECYCLE] --> Etapa 1: Re-autenticando canal...');
        setRealtimeAuth(supabaseClient).then(() => {
            console.log('[LIFECYCLE] --> Etapa 2: Tentando se inscrever novamente...');
            channel.subscribe();
        });
      }, delay);
    };

    channel.on('SUBSCRIBED', () => {
      console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      console.warn(`[LIFECYCLE] ❌ ATENÇÃO: Canal fechado. Acionando lógica de recuperação automática.`);
      handleRecovery();
    });

    channel.on('error', (error) => {
      console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
      console.log('[LIFECYCLE] --> Acionando lógica de recuperação devido a erro.');
      handleRecovery();
    });

    setRealtimeChannel(channel);

    console.log('[LIFECYCLE] --> Disparando autenticação inicial (inscrição será feita pelos hooks).');
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log('[LIFECYCLE] 🧹 Limpando... Removendo canal e timers.');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      supabaseClient.removeChannel(channel);
      setRealtimeChannel(null);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

  // Effect 3: The "Wake-Up Call"
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('👁️ Aba se tornou visível. Verificando saúde da conexão...');
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
      realtimeAuthCounter: 0,
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
