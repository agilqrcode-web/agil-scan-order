// Savepoint before refactoring to a reactive real-time connection strategy.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadRaw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadRaw);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  
  const renewTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const lastTokenRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // FIX: useRef to hold the latest version of the auth function, preventing stale closures in setTimeout.
  const authFnRef = useRef<((client: SupabaseClient<Database>) => Promise<void>) | null>(null);

  const setRealtimeAuth = useCallback(async (client: SupabaseClient<Database>) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Renovação já em progresso. Pulando.');
      return;
    }
    isRefreshingRef.current = true;
    console.log('[AUTH] 3. Processo de autenticação do canal iniciado.');

    try {
      if (!client || !isSignedIn) {
        try { await client?.realtime.setAuth(null); } catch {}
        lastTokenRef.current = null;
        return;
      }

      console.log('[AUTH] --> Pedindo novo token ao Clerk (com skipCache: true)...');
      const token = await getToken({ template: 'supabase', skipCache: true });

      if (lastTokenRef.current === token) {
        console.log('[AUTH] --> Token idêntico ao anterior. Renovação pulada. (OK)');
        return;
      }

      if (!token) {
        console.warn('[AUTH] --> Token nulo recebido do Clerk. Limpando autenticação.');
        await client.realtime.setAuth(null);
        lastTokenRef.current = null;
        return;
      }
      
      console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
      await client.realtime.setAuth(token);
      lastTokenRef.current = token;
      console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');

      const payload = decodeJwtPayload(token);
      const exp = payload?.exp ?? null;
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      if (exp) {
        // FIX: Increased safety margin to 5 minutes for robustness.
        const safetyMarginMs = 5 * 60 * 1000;
        const nowMs = Date.now();
        const renewInMs = (exp * 1000) - nowMs - safetyMarginMs;
        const timeout = Math.max(renewInMs, 30000);
        console.log(`[AUTH] ----> Próxima renovação agendada para daqui a ~${Math.round(timeout / 60000)} minutos.`);
        // Use the ref to call the latest auth function, avoiding stale closure.
        renewTimerRef.current = window.setTimeout(() => authFnRef.current?.(client), timeout);
      }
    } catch (e) {
      console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
      lastTokenRef.current = null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getToken]);

  // Update the ref on every render to point to the latest auth function.
  useEffect(() => {
    authFnRef.current = setRealtimeAuth;
  });

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

  // Effect 2: Consolidated Channel & Auth Lifecycle
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    console.log('[LIFECYCLE] 🚀 2. Cliente Supabase pronto. Iniciando ciclo de vida do canal...');
    const channel = supabaseClient.channel('public:orders');

    const handleReconnect = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channel.state === 'closed') {
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(1000 * (2 ** attempts), 60000);
        console.log(`[LIFECYCLE] 🔄 Conexão perdida. Tentando reconectar em ${delay / 1000}s (tentativa ${attempts + 1}).`);
        
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectAttemptsRef.current = attempts + 1;
          console.log('[LIFECYCLE] --> Tentando se inscrever novamente...');
          channel.subscribe();
        }, delay);
      }
    };

    console.log('[LIFECYCLE] --> Anexando listeners de SUBSCRIBED e CLOSED.');
    channel.on('SUBSCRIBED', () => {
      console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      console.warn(`[LIFECYCLE] ❌ ATENÇÃO: Canal fechado. Acionando lógica de reconexão...`);
      handleReconnect();
    });

    setRealtimeChannel(channel);

    console.log('[LIFECYCLE] --> Disparando autenticação inicial (inscrição será feita pelos hooks).');
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log('[LIFECYCLE] 🧹 Limpando... Removendo canal e timers.');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (renewTimerRef.current) clearTimeout(renewTimerRef.current);
      supabaseClient.removeChannel(channel);
      setRealtimeChannel(null);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth]);

  // Effect 3: The "Wake-Up Call"
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient) {
        console.log('👁️ Aba se tornou visível. Verificando saúde da conexão...');
        setRealtimeAuth(supabaseClient);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseClient, setRealtimeAuth]);

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