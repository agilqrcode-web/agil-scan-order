// SupabaseProvider.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Configuráveis
const MIN_VALIDITY_MS = 2 * 60 * 1000; // 2 minutos mínimos de validade
const SHORT_TOKEN_RETRY_MS = 30 * 1000; // se token curto, re-tentar em 30s
const WATCHDOG_INTERVAL_MS = 20 * 1000; // Cão de Guarda verifica a cada 20s

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const isRefreshingRef = useRef<boolean>(false);
  const lastTokenRef = useRef<string | null>(null);
  const lastAuthAtRef = useRef<number | null>(null);
  const pendingForceRecreateRef = useRef<boolean>(false);
  const watchdogTimerRef = useRef<number | null>(null); // Ref para o Cão de Guarda

  const decodeExp = (token: string): number | null => {
    try {
      const b64 = token.split('.')[1];
      const json = JSON.parse(atob(b64));
      return typeof json.exp === 'number' ? json.exp : null;
    } catch (e) {
      return null;
    }
  };

  const getValidToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return null;
      const exp = decodeExp(token);
      if (!exp) return token;

      const remainingMs = (exp * 1000) - Date.now();
      console.log('[AUTH] token exp (s):', exp, 'remainingMs:', remainingMs);
      if (remainingMs >= MIN_VALIDITY_MS) return token;

      console.warn('[AUTH] Token recebido com validade curta (< MIN_VALIDITY_MS). Tentando obter token fresco skipCache.');
      const fresh = await getToken({ template: 'supabase', skipCache: true });
      if (!fresh) return token;

      const freshExp = decodeExp(fresh);
      const freshRemaining = freshExp ? (freshExp * 1000) - Date.now() : Number.POSITIVE_INFINITY;
      console.log('[AUTH] fresh token remainingMs:', freshRemaining);
      if (freshRemaining >= MIN_VALIDITY_MS) return fresh;

      return null;
    } catch (e) {
      console.error('[AUTH] erro ao obter token válido', e);
      return null;
    }
  }, [getToken]);

  const forceRecreateChannel = useCallback(async (client: SupabaseClient<Database> | null) => {
    if (pendingForceRecreateRef.current || !client) return;
    pendingForceRecreateRef.current = true;

    try {
      console.log('[LIFECYCLE] Forçando remoção e recriação do canal (forceRecreateChannel)...');
      if (realtimeChannel) {
        try { client.removeChannel(realtimeChannel); } catch {}
        setRealtimeChannel(null);
      }
      setResetCounter(c => c + 1);
    } finally {
      setTimeout(() => { pendingForceRecreateRef.current = false; }, 2000); // Cooldown
    }
  }, [realtimeChannel]);

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
        lastTokenRef.current = null;
        return;
      }

      const token = await getValidToken();

      if (!token) {
        console.warn('[AUTH] Token válido não obtido. Agendando nova tentativa em', SHORT_TOKEN_RETRY_MS, 'ms');
        setTimeout(() => setRealtimeAuth(client), SHORT_TOKEN_RETRY_MS);
        return;
      }

      if (token === lastTokenRef.current && Date.now() - (lastAuthAtRef.current ?? 0) < 10_000) {
        console.log('[AUTH] Mesmo token já aplicado recentemente. Pulando setAuth.');
        return;
      }

      console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
      try {
        await client.realtime.setAuth(token);
        lastTokenRef.current = token;
        lastAuthAtRef.current = Date.now();
        console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');
      } catch (e) {
        console.error('[AUTH] setAuth falhou:', e);
        await forceRecreateChannel(client);
      }
    } catch (e) {
      console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getValidToken, forceRecreateChannel]);

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
      if (pendingForceRecreateRef.current) return; // Evita reset durante um reset já em curso
      console.warn(`[LIFECYCLE] 🔄 ${reason}. Acionando reset completo do canal.`);
      forceRecreateChannel(supabaseClient);
    };

    // CÃO DE GUARDA (WATCHDOG)
    const startWatchdog = () => {
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = window.setInterval(() => {
        if (isSignedIn && channel) {
          const isConnected = channel.socket.isConnected();
          console.log(`[WATCHDOG] 🕵️ Verificando saúde. Conectado: ${isConnected}`);
          if (!isConnected) {
            console.warn('[WATCHDOG] 🚨 Cão de Guarda detectou conexão silenciosamente perdida!');
            triggerReset('Watchdog detectou falha de conexão');
          }
        }
      }, WATCHDOG_INTERVAL_MS);
    };

    channel.on('SUBSCRIBED', () => {
      console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
      startWatchdog(); // Inicia o cão de guarda após a conexão ser bem-sucedida
    });

    channel.on('CLOSED', () => triggerReset('Canal fechado pelo servidor'));
    channel.on('CHANNEL_ERROR', (err) => {
      console.error('[LIFECYCLE] CHANNEL_ERROR detectado:', err);
      triggerReset('CHANNEL_ERROR detectado');
    });
    channel.on('error', (error) => {
      console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
      triggerReset('Erro detectado no canal');
    });

    setRealtimeChannel(channel);
    console.log('[LIFECYCLE] --> Disparando autenticação inicial...');
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log(`[LIFECYCLE] 🧹 Limpando e destruindo canal da tentativa #${resetCounter + 1}...`);
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
      try { supabaseClient.removeChannel(channel); } catch (e) {}
      setRealtimeChannel(null);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, resetCounter, forceRecreateChannel]);

  // Effect 3: Wake-Up Call
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
      realtimeAuthCounter: 0,
      requestReconnect: async () => { console.warn("requestReconnect is deprecated"); return false; },
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}