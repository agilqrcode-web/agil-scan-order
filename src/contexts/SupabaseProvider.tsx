// SupabaseProvider.tsx - VERSÃO COM DETECÇÃO ATIVA DE EXPIRAÇÃO
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// =============================================================================
// 🕒 CONFIGURAÇÃO DE HORÁRIOS DE FUNCIONAMENTO
// =============================================================================
const BUSINESS_HOURS_CONFIG = {
  days: {
    1: { name: 'Segunda', open: 8, close: 18, enabled: true },
    2: { name: 'Terça',   open: 8, close: 18, enabled: true },
    3: { name: 'Quarta',  open: 8, close: 18, enabled: true },
    4: { name: 'Quinta',  open: 8, close: 18, enabled: true },
    5: { name: 'Sexta',   open: 8, close: 18, enabled: true },
    6: { name: 'Sábado',  open: 8, close: 13, enabled: true },
    0: { name: 'Domingo', open: 0, close: 0,  enabled: false }
  }
};

const isBusinessHours = (): boolean => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour + (currentMinutes / 60);

  const todayConfig = BUSINESS_HOURS_CONFIG.days[currentDay];
  return !!(todayConfig?.enabled && currentTime >= todayConfig.open && currentTime < todayConfig.close);
};

// =============================================================================
// ⚙️ CONFIGURAÇÕES OTIMIZADAS
// =============================================================================
const HEALTH_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutos (reduzido para detecção mais rápida)
const TOKEN_REFRESH_MARGIN = 10 * 60 * 1000; // 10 minutos (reduzido)
const TOKEN_EXPIRY_CHECK = 30 * 1000; // 30 segundos (NOVO: verificação rápida de expiração)
const MAX_RECONNECT_ATTEMPTS = 3;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);
  const [connectionHealthy, setConnectionHealthy] = useState<boolean>(false);
  const [realtimeAuthCounter, setRealtimeAuthCounter] = useState<number>(0);
  
  const isRefreshingRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastEventTimeRef = useRef<number>(Date.now());
  const lastTokenRefreshRef = useRef<number>(Date.now());
  const isActiveRef = useRef<boolean>(true);
  const currentTokenExpiryRef = useRef<number>(0); // ✅ NOVO: Controla expiração do token

  // ✅ FUNÇÃO CRÍTICA: Verificar se o token está prestes a expirar
  const isTokenExpiredOrClose = useCallback((): boolean => {
    if (currentTokenExpiryRef.current === 0) return false;
    
    const now = Date.now();
    const timeUntilExpiry = currentTokenExpiryRef.current - now;
    const isExpired = timeUntilExpiry <= 0;
    const isCloseToExpiry = timeUntilExpiry < 2 * 60 * 1000; // 2 minutos
    
    if (isExpired) {
      console.warn('[TOKEN-EXPIRY] 🔴 TOKEN EXPIRADO! Deveria ter reconectado');
      return true;
    }
    
    if (isCloseToExpiry) {
      console.log(`[TOKEN-EXPIRY] 🟡 Token expira em ${Math.round(timeUntilExpiry / 1000 / 60)} minutos`);
    }
    
    return isExpired;
  }, []);

  // ✅ NOVA FUNÇÃO: Reconexão forçada por expiração de token
  const forceReconnectForTokenExpiry = useCallback(async () => {
    if (!isActiveRef.current || !supabaseClient || !isSignedIn) return;
    
    console.log('[TOKEN-RECONNECT] 🔄 Reconexão forçada por expiração de token');
    
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
      setRealtimeChannel(null);
    }
    
    // Pequena pausa para garantir cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Recriar canal com novo token
    const newChannel = supabaseClient.channel('public:orders');
    await initializeChannel(newChannel);
    setRealtimeChannel(newChannel);
    
    reconnectAttemptsRef.current = 0;
  }, [supabaseClient, isSignedIn, realtimeChannel]);

  const getTokenWithValidation = useCallback(async (): Promise<{ token: string | null; expiry: number }> => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH] Token não disponível');
        return { token: null, expiry: 0 };
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Converter para milliseconds
        const remainingMs = exp - Date.now();
        
        console.log(`[AUTH] Token expira em: ${Math.round(remainingMs / 1000 / 60)} minutos`);
        
        // ✅ ATUALIZAR referência de expiração
        currentTokenExpiryRef.current = exp;
        
        return { token, expiry: exp };
      } catch (parseError) {
        console.error('[AUTH] Erro ao parsear token:', parseError);
        return { token, expiry: 0 };
      }
    } catch (error) {
      console.error('[AUTH] Erro ao obter token:', error);
      return { token: null, expiry: 0 };
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

      const { token, expiry } = await getTokenWithValidation();
      if (!token) {
        await client.realtime.setAuth(null);
        setConnectionHealthy(false);
        return;
      }
      
      await client.realtime.setAuth(token);
      console.log('[AUTH] ✅ Token aplicado com sucesso');
      setConnectionHealthy(true);
      setRealtimeAuthCounter(prev => prev + 1);
      lastTokenRefreshRef.current = Date.now();
      
    } catch (error) {
      console.error('[AUTH] ‼️ Erro na autenticação:', error);
      setConnectionHealthy(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [isSignedIn, getTokenWithValidation]);

  // ✅ INICIALIZAÇÃO DO CANAL (extraída para reuso)
  const initializeChannel = useCallback(async (channel: RealtimeChannel) => {
    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      console.log('[REALTIME-EVENT] ✅ Evento recebido');
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);
      reconnectAttemptsRef.current = 0;
    };

    return new Promise<void>((resolve) => {
      channel.on('SUBSCRIBED', () => {
        if (!isActiveRef.current) return;
        console.log('[LIFECYCLE] ✅ Canal inscrito com sucesso');
        setConnectionHealthy(true);
        lastEventTimeRef.current = Date.now();
        reconnectAttemptsRef.current = 0;
        resolve();
      });

      channel.on('CLOSED', () => {
        if (!isActiveRef.current) return;
        console.warn('[LIFECYCLE] ❌ Canal fechado');
        setConnectionHealthy(false);
      });

      channel.on('error', (error) => {
        if (!isActiveRef.current) return;
        console.error('[LIFECYCLE] 💥 Erro no canal:', error);
        setConnectionHealthy(false);
      });

      // Listener para eventos do banco
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        handleRealtimeEvent
      );

      channel.subscribe();
    });
  }, []);

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

  // Effect 2: Canal RealTime com Detecção Ativa de Expiração
  useEffect(() => {
    if (!supabaseClient || !isLoaded) {
      return;
    }

    isActiveRef.current = true;
    console.log('[LIFECYCLE] 🚀 Iniciando canal realtime');
    const channel = supabaseClient.channel('public:orders');

    initializeChannel(channel);
    setRealtimeChannel(channel);

    // ✅ HEALTH CHECK INTELIGENTE COM VERIFICAÇÃO DE TOKEN
    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      const isChannelSubscribed = channel.state === 'joined';
      
      // 🎯 VERIFICAÇÃO CRÍTICA: Token expirado?
      if (isTokenExpiredOrClose()) {
        console.warn('[HEALTH-CHECK] 🔴 Token expirado detectado - forçando reconexão');
        forceReconnectForTokenExpiry();
        return;
      }
      
      // Verificação normal de health check
      if (isChannelSubscribed && timeSinceLastEvent > 2 * 60 * 1000) {
        if (isBusinessHours()) {
          console.warn('[HEALTH-CHECK] ⚠️ Sem eventos há 2+ minutos em horário comercial');
          setConnectionHealthy(false);
          channel.unsubscribe().then(() => {
            setTimeout(() => {
              if (isActiveRef.current) channel.subscribe();
            }, 5000);
          });
        } else {
          console.log('[HEALTH-CHECK] 💤 Sem eventos - Comportamento normal (fora do horário comercial)');
        }
      }
    }, HEALTH_CHECK_INTERVAL);

    // ✅ VERIFICAÇÃO RÁPIDA DE EXPIRAÇÃO (NOVO)
    const tokenExpiryCheckInterval = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn) return;
      
      if (isTokenExpiredOrClose()) {
        console.warn('[TOKEN-EXPIRY-CHECK] 🔴 Token expirado - reconectando...');
        forceReconnectForTokenExpiry();
      }
    }, TOKEN_EXPIRY_CHECK);

    // ✅ Token Refresh Otimizado
    const tokenRefreshInterval = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      
      console.log('[TOKEN-REFRESH] 🔄 Refresh proativo (10min)');
      setRealtimeAuth(supabaseClient);
    }, TOKEN_REFRESH_MARGIN);

    return () => {
      console.log('[LIFECYCLE] 🧹 Limpando recursos');
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenExpiryCheckInterval);
      clearInterval(tokenRefreshInterval);
      channel.unsubscribe();
      setRealtimeChannel(null);
      setConnectionHealthy(false);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuth, initializeChannel, isTokenExpiredOrClose, forceReconnectForTokenExpiry]);

  // Effect 3: Wake-Up Call
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('👁️ Aba visível - verificando conexão e token');
        // ✅ Verificar token ao voltar à aba
        if (isTokenExpiredOrClose()) {
          forceReconnectForTokenExpiry();
        } else {
          setRealtimeAuth(supabaseClient);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseClient, isSignedIn, setRealtimeAuth, isTokenExpiredOrClose, forceReconnectForTokenExpiry]);

  // ✅ Funções de reconexão
  const refreshConnection = useCallback(async () => {
    console.log('[RECONNECT] 🔄 Reconexão manual solicitada');
    await forceReconnectForTokenExpiry();
  }, [forceReconnectForTokenExpiry]);

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
      
      {/* Indicador visual com status de token */}
      <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
        connectionHealthy ? 'bg-green-500' : 'bg-red-500'
      } z-50 border border-white shadow-lg`} 
      title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} | Token expira em: ${Math.round((currentTokenExpiryRef.current - Date.now()) / 1000 / 60)}min`} />
    </SupabaseContext.Provider>
  );
}
