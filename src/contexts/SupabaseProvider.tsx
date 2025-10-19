// SupabaseProvider.tsx - VERSÃO CORRIGIDA
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Health check interval (2 minutes)
const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000;
// Token refresh margin (10 minutes before expiry)
const TOKEN_REFRESH_MARGIN = 10 * 60 * 1000;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
  
  const isRefreshingRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const healthCheckIntervalRef = useRef<number | null>(null);
  const tokenRefreshIntervalRef = useRef<number | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  const setRealtimeAuth = useCallback(async (client: SupabaseClient) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Autenticação já em progresso. Pulando.');
      return;
    }
    isRefreshingRef.current = true;
    console.log('[AUTH] 3. Processo de autenticação do canal iniciado.');

    try {
      if (!client || !isSignedIn) {
        try { 
          await client?.realtime.setAuth(null); 
          setConnectionHealthy(false);
        } catch {}
        return;
      }

      console.log('[AUTH] --> Pedindo novo token ao Clerk...');
      const token = await getToken({ template: 'supabase' });

      if (!token) {
        console.warn('[AUTH] --> Token nulo recebido do Clerk. Limpando autenticação.');
        await client.realtime.setAuth(null);
        setConnectionHealthy(false);
        return;
      }
      
      console.log('[AUTH] --> Token novo recebido. Enviando para o Supabase...');
      await client.realtime.setAuth(token);
      console.log('[AUTH] ----> Supabase aceitou o novo token. (SUCESSO)');
      setConnectionHealthy(true);
      setRealtimeAuthCounter(prev => prev + 1);
    } catch (e) {
      console.error('[AUTH] ‼️ Erro durante o fluxo de autenticação:', e);
      setConnectionHealthy(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getToken]);

  // Effect 1: Create Client
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[PROVIDER-INIT] ⚙️ 1. Clerk carregado. Criando cliente Supabase.');
      const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

    // ✅ NOVO: Handler para eventos reais - ATUALIZA lastEventTimeRef
    const handleRealtimeEvent = (payload: any) => {
      console.log('[REALTIME-EVENT] ✅ Evento recebido no Provider:', payload);
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true); // Confirma que a conexão está funcionando
    };

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
      setConnectionHealthy(true);
      lastEventTimeRef.current = Date.now(); // Reset do timer
    });

    channel.on('CLOSED', () => {
      console.warn(`[LIFECYCLE] ❌ ATENÇÃO: Canal fechado. Acionando lógica de recuperação automática.`);
      setConnectionHealthy(false);
      handleRecovery();
    });

    channel.on('error', (error) => {
      console.error('[LIFECYCLE] 💥 OCORREU UM ERRO NO CANAL:', error);
      console.log('[LIFECYCLE] --> Acionando lógica de recuperação devido a erro.');
      setConnectionHealthy(false);
      handleRecovery();
    });

    // ✅ NOVO: Listener para eventos de banco de dados - CRÍTICO
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      handleRealtimeEvent
    );

    // ✅ CORREÇÃO: Health Check baseado em eventos reais
    healthCheckIntervalRef.current = window.setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      const isChannelSubscribed = channel.state === 'joined';
      
      if (isChannelSubscribed && timeSinceLastEvent > 120000) {
        // Canal está inscrito mas não recebe eventos há 2 minutos
        console.warn('[HEALTH-CHECK] ⚠️ Canal conectado mas sem eventos há 2 minutos. Possível problema.');
        setConnectionHealthy(false);
        
        // Tentar recuperação proativa
        console.log('[HEALTH-CHECK] 🔄 Tentando recuperação proativa...');
        channel.unsubscribe().then(() => {
          setTimeout(() => channel.subscribe(), 2000);
        });
      } else if (isChannelSubscribed && timeSinceLastEvent <= 120000) {
        // Tudo normal - canal conectado e recebendo eventos
        setConnectionHealthy(true);
      } else {
        // Canal não está conectado
        setConnectionHealthy(false);
      }
    }, HEALTH_CHECK_INTERVAL);

    // ✅ NOVO: Refresh Proativo de Token
    tokenRefreshIntervalRef.current = window.setInterval(async () => {
      if (isSignedIn && supabaseClient) {
        console.log('[TOKEN-REFRESH] 🔄 Refresh proativo do token');
        try {
          const newToken = await getToken({ template: 'supabase' });
          if (newToken) {
            await supabaseClient.realtime.setAuth(newToken);
            console.log('[TOKEN-REFRESH] ✅ Token atualizado com sucesso');
          }
        } catch (error) {
          console.error('[TOKEN-REFRESH] ❌ Erro ao atualizar token:', error);
        }
      }
    }, TOKEN_REFRESH_MARGIN);

    setRealtimeChannel(channel);

    console.log('[LIFECYCLE] --> Disparando autenticação inicial (inscrição será feita pelos hooks).');
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log('[LIFECYCLE] 🧹 Limpando... Removendo canal e timers.');
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
      if (tokenRefreshIntervalRef.current) clearInterval(tokenRefreshIntervalRef.current);
      supabaseClient.removeChannel(channel);
      setRealtimeChannel(null);
      setConnectionHealthy(false);
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

  // ✅ NOVO: Função para reconexão manual
  const refreshConnection = useCallback(async () => {
    console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      setRealtimeChannel(null);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (supabaseClient) {
      await setRealtimeAuth(supabaseClient);
    }
  }, [supabaseClient, realtimeChannel, setRealtimeAuth]);

  const requestReconnect = useCallback(async (maxAttempts?: number) => {
    console.warn("requestReconnect is deprecated - use refreshConnection");
    await refreshConnection();
    return false;
  }, [refreshConnection]);

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
      connectionHealthy, // ✅ Status real da conexão
      realtimeAuthCounter,
      requestReconnect,
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
      refreshConnection, // ✅ Nova função
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}
