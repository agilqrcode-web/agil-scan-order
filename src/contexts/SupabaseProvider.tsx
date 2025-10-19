import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// ✅ CONFIGURAÇÕES OTIMIZADAS
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos (aumentado)
const TOKEN_REFRESH_MARGIN = 15 * 60 * 1000; // 15 minutos (aumentado)
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;

// ✅ Função auxiliar para verificar horário comercial
const isBusinessHours = () => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  // Segunda a Sexta, 8h às 18h
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
};

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
  
  const isRefreshingRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastEventTimeRef = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(true);

  // ✅ Função otimizada para obter token com validação
  const getTokenWithValidation = useCallback(async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH] Token não disponível');
        return null;
      }

      // Verificar tempo restante sem logar token completo
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        const remainingMs = exp - Date.now();
        const remainingMinutes = Math.round(remainingMs / 1000 / 60);
        
        console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos`);
        
        if (remainingMs < 2 * 60 * 1000) {
          console.warn('[AUTH] Token prestes a expirar');
        }
        
        return token;
      } catch (parseError) {
        console.error('[AUTH] Erro ao parsear token:', parseError);
        return token; // Retorna mesmo com erro de parse
      }
    } catch (error) {
      console.error('[AUTH] Erro ao obter token:', error);
      return null;
    }
  }, [getToken]);

  const setRealtimeAuth = useCallback(async (client: SupabaseClient) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Autenticação já em progresso');
      return;
    }
    isRefreshingRef.current = true;

    try {
      if (!client || !isSignedIn) {
        try { 
          await client?.realtime.setAuth(null); 
          setConnectionHealthy(false);
        } catch {}
        return;
      }

      const token = await getTokenWithValidation();
      if (!token) {
        await client.realtime.setAuth(null);
        setConnectionHealthy(false);
        return;
      }
      
      await client.realtime.setAuth(token);
      console.log('[AUTH] ✅ Token aplicado com sucesso');
      setConnectionHealthy(true);
      setRealtimeAuthCounter(prev => prev + 1);
    } catch (error) {
      console.error('[AUTH] ‼️ Erro na autenticação:', error);
      setConnectionHealthy(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getTokenWithValidation]);

  // ✅ Backoff exponencial otimizado
  const handleReconnect = useCallback((channel: RealtimeChannel) => {
    if (!isActiveRef.current) return;
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido');
      return;
    }

    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    
    console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);
    
    setTimeout(() => {
      if (isActiveRef.current && supabaseClient && isSignedIn) {
        setRealtimeAuth(supabaseClient).then(() => {
          channel.subscribe();
        });
      }
    }, delay);
  }, [supabaseClient, isSignedIn, setRealtimeAuth]);

  // Effect 1: Create Client
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[PROVIDER-INIT] ⚙️ Criando cliente Supabase');
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

  // Effect 2: Canal RealTime Otimizado
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    isActiveRef.current = true;
    console.log('[LIFECYCLE] 🚀 Iniciando canal realtime');
    const channel = supabaseClient.channel('public:orders');

    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      console.log('[REALTIME-EVENT] ✅ Evento recebido');
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);
      reconnectAttemptsRef.current = 0;
    };

    channel.on('SUBSCRIBED', () => {
      if (!isActiveRef.current) return;
      console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
      setConnectionHealthy(true);
      lastEventTimeRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      if (!isActiveRef.current) return;
      console.warn('[LIFECYCLE] ❌ Canal fechado');
      setConnectionHealthy(false);
      handleReconnect(channel);
    });

    channel.on('error', (error) => {
      if (!isActiveRef.current) return;
      console.error('[LIFECYCLE] 💥 Erro no canal:', error);
      setConnectionHealthy(false);
      handleReconnect(channel);
    });

    // Listener para eventos do banco
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      handleRealtimeEvent
    );

    // ✅ Health Check Inteligente
    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      const isChannelSubscribed = channel.state === 'joined';
      
      // Só considera problema durante horário comercial
      if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000) {
        if (isBusinessHours()) {
          console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 5+ minutos em horário comercial');
          setConnectionHealthy(false);
          // Recuperação suave
          channel.unsubscribe().then(() => {
            setTimeout(() => {
              if (isActiveRef.current) channel.subscribe();
            }, 5000);
          });
        } else {
          console.log('[HEALTH-CHECK] 💤 Sem eventos mas fora do horário comercial');
        }
      }
    }, HEALTH_CHECK_INTERVAL);

    // ✅ Token Refresh Otimizado
    const tokenRefreshInterval = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      
      console.log('[TOKEN-REFRESH] 🔄 Refresh proativo (15min)');
      setRealtimeAuth(supabaseClient);
    }, TOKEN_REFRESH_MARGIN);

    setRealtimeChannel(channel);
    setRealtimeAuth(supabaseClient);

    return () => {
      console.log('[LIFECYCLE] 🧹 Limpando recursos');
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenRefreshInterval);
      channel.unsubscribe();
      setRealtimeChannel(null);
      setConnectionHealthy(false);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, handleReconnect]);

  // Effect 3: Wake-Up Call
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('👁️ Aba visível - verificando conexão');
        setRealtimeAuth(supabaseClient);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseClient, isSignedIn, setRealtimeAuth]);

  // ✅ Funções de reconexão
  const refreshConnection = useCallback(async () => {
    console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
    if (supabaseClient) {
      await setRealtimeAuth(supabaseClient);
    }
  }, [supabaseClient, realtimeChannel, setRealtimeAuth]);

  const requestReconnect = useCallback(async (maxAttempts?: number) => {
    console.log('[RECONNECT] 🔄 Reconexão via requestReconnect');
    await refreshConnection();
    return true;
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
      connectionHealthy,
      realtimeAuthCounter,
      requestReconnect,
      setRealtimeAuth: () => supabaseClient && setRealtimeAuth(supabaseClient),
      refreshConnection,
    }}>
      {children}
      
      {/* Indicador visual opcional */}
      <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
        connectionHealthy ? 'bg-green-500' : 'bg-red-500'
      } z-50 border border-white shadow-lg`} 
      title={connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} />
    </SupabaseContext.Provider>
  );
}
