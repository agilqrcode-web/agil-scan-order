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
const MIN_VALIDITY_MS = 2 * 60 * 1000; // 2 minutos mínimos de validade ao enviar setAuth
const SHORT_TOKEN_RETRY_MS = 30 * 1000; // se token muito curto, re-tentar em 30s

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database> | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const isRefreshingRef = useRef<boolean>(false);
  const lastTokenRef = useRef<string | null>(null);
  const lastAuthAtRef = useRef<number | null>(null);
  const pendingForceRecreateRef = useRef<boolean>(false);

  // util: decodifica exp do JWT (em segundos)
  const decodeExp = (token: string): number | null => {
    try {
      const b64 = token.split('.')[1];
      const json = JSON.parse(atob(b64));
      return typeof json.exp === 'number' ? json.exp : null;
    } catch (e) {
      return null;
    }
  };

  // tenta obter token e garante validade mínima. Se token curto, tenta uma vez mais com skipCache.
  const getValidToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) return null;
      const exp = decodeExp(token);
      if (!exp) return token; // sem exp explícito, devolve

      const remainingMs = (exp * 1000) - Date.now();
      console.log('[AUTH] token exp (s):', exp, 'remainingMs:', remainingMs);
      if (remainingMs >= MIN_VALIDITY_MS) return token;

      console.warn('[AUTH] Token recebido com validade curta (< MIN_VALIDITY_MS). Tentando obter token fresco skipCache.');
      const fresh = await getToken({ template: 'supabase', skipCache: true });
      if (!fresh) return token; // fallback para o anterior se fresh nulo

      const freshExp = decodeExp(fresh);
      const freshRemaining = freshExp ? (freshExp * 1000) - Date.now() : Number.POSITIVE_INFINITY;
      console.log('[AUTH] fresh token remainingMs:', freshRemaining);
      if (freshRemaining >= MIN_VALIDITY_MS) return fresh;

      // ambos curtos: devolve null para que chamador trate (ou agende retry)
      return null;
    } catch (e) {
      console.error('[AUTH] erro ao obter token válido', e);
      return null;
    }
  }, [getToken]);

  const forceRecreateChannel = useCallback(async (client: SupabaseClient<Database>) => {
    // evita recreates concorrentes
    if (pendingForceRecreateRef.current) return;
    pendingForceRecreateRef.current = true;

    try {
      if (!client) return;
      console.log('[LIFECYCLE] Forçando remoção e recriação do canal (forceRecreateChannel)...');
      if (realtimeChannel) {
        try { client.removeChannel(realtimeChannel); } catch {}
        setRealtimeChannel(null);
      }
      // Incrementa o contador para disparar o useEffect que cria o canal
      setResetCounter(c => c + 1);
    } finally {
      pendingForceRecreateRef.current = false;
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
        console.warn('[AUTH] Token válido não obtido (curto ou nulo). Agendando nova tentativa em', SHORT_TOKEN_RETRY_MS, 'ms');
        // schedule retry curto
        setTimeout(() => setRealtimeAuth(client), SHORT_TOKEN_RETRY_MS);
        return;
      }

      // Evita re-envio do mesmo token se já aplicado recentemente
      if (token === lastTokenRef.current) {
        const lastAt = lastAuthAtRef.current ?? 0;
        // se aplicamos há menos de 10s, pulamos
        if (Date.now() - lastAt < 10_000) {
          console.log('[AUTH] Mesmo token já aplicado recentemente. Pulando setAuth.');
          return;
        }
      }

      console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
      try {
        await client.realtime.setAuth(token);
        lastTokenRef.current = token;
        lastAuthAtRef.current = Date.now();
        console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');
      } catch (e) {
        console.error('[AUTH] setAuth falhou:', e);
        // Em caso de falha, force recreate: possivelmente sessão inválida no servidor
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
      console.warn(`[LIFECYCLE] 🔄 ${reason}. Acionando reset completo do canal.`);
      setResetCounter(c => c + 1);
    };

    channel.on('SUBSCRIBED', () => {
      console.log(`[LIFECYCLE] ✅ SUCESSO! Inscrição no canal '${channel.topic}' confirmada.`);
    });

    channel.on('CLOSED', () => triggerReset('Canal fechado pelo servidor'));

    // Novo: trate CHANNEL_ERROR explicitamente
    channel.on('CHANNEL_ERROR', (err) => {
      console.error('[LIFECYCLE] CHANNEL_ERROR detectado:', err);
      // Força reauth + recreate. Não chamar direto setRealtimeAuth aqui (pode haver competição)
      forceRecreateChannel(supabaseClient);
    });

    // SDK event name differences: tenta também 'error' para compatibilidade
    channel.on('error', (error) => {
      console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
      triggerReset('Erro detectado no canal');
    });

    setRealtimeChannel(channel);

    console.log('[LIFECYCLE] --> Disparando autenticação inicial...');
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log(`[LIFECYCLE] 🧹 Limpando e destruindo canal da tentativa #${resetCounter + 1}...`);
      try { supabaseClient.removeChannel(channel); } catch (e) {}
      setRealtimeChannel(null);
    };
    // Intencional: resetCounter reinicia o efeito
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