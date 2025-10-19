// SupabaseProvider.tsx - Versão corrigida e completa
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient, SupabaseClient, RealtimeChannel, RealtimeSubscription } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react';
import { SupabaseContext } from "@/contexts/SupabaseContext";
import { Spinner } from '@/components/ui/spinner';
import type { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Business hours config (mantive seu objeto)
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

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // **MARGEM AUMENTADA**: 5 minutos
const MAX_RECONNECT_ATTEMPTS = 6;
const INITIAL_RECONNECT_DELAY = 1000;
const TOKEN_MIN_SAFE_MS = 2 * 60 * 1000; // se faltar <2min, forçar imediato

// helpers (mantive suas funções para horário)
const formatTime = (decimalHours: number): string => {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};
const isBusinessHours = (): boolean => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour + (currentMinutes / 60);
  const todayConfig = BUSINESS_HOURS_CONFIG.days[currentDay];
  if (!todayConfig || !todayConfig.enabled) return false;
  return currentTime >= todayConfig.open && currentTime < todayConfig.close;
};
const getBusinessHoursStatus = () => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = currentHour + (currentMinutes / 60);
  const todayConfig = BUSINESS_HOURS_CONFIG.days[currentDay];
  if (!todayConfig || !todayConfig.enabled) {
    return { isOpen: false, message: `🔒 ${todayConfig?.name || 'Hoje'} - FECHADO` };
  }
  const isOpen = currentTime >= todayConfig.open && currentTime < todayConfig.close;
  if (isOpen) {
    return { isOpen: true, message: `🟢 ${todayConfig.name} - ABERTO (${formatTime(todayConfig.open)}h - ${formatTime(todayConfig.close)}h)` };
  } else {
    if (currentTime < todayConfig.open) {
      return { isOpen: false, message: `🔴 ${todayConfig.name} - FECHADO (abre às ${formatTime(todayConfig.open)}h)` };
    } else {
      let nextDay = (currentDay + 1) % 7;
      while (BUSINESS_HOURS_CONFIG.days[nextDay] && !BUSINESS_HOURS_CONFIG.days[nextDay].enabled) {
        nextDay = (nextDay + 1) % 7;
      }
      const nextDayConfig = BUSINESS_HOURS_CONFIG.days[nextDay];
      return { isOpen: false, message: `🔴 ${todayConfig.name} - FECHADO (abre ${nextDayConfig.name} às ${formatTime(nextDayConfig.open)}h)` };
    }
  }
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
  const currentTokenExpRef = useRef<number | null>(null);
  const lastAppliedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const businessStatus = getBusinessHoursStatus();
    console.log(`🏪 ${businessStatus.message}`);
  }, []);

  // Obtém token e calcula exp
  const getTokenWithValidation = useCallback(async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) {
        console.warn('[AUTH] Token não disponível');
        return null;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expMs = payload.exp * 1000;
        const remainingMs = expMs - Date.now();
        const remainingMinutes = Math.round(remainingMs / 1000 / 60);
        console.log(`[AUTH] Token expira em: ${remainingMinutes} minutos (exp ${new Date(expMs).toISOString()})`);
        currentTokenExpRef.current = expMs;
        return token;
      } catch (parseError) {
        console.error('[AUTH] Erro ao parsear token:', parseError);
        return token; // fallback: retorna token mesmo sem parse OK
      }
    } catch (error) {
      console.error('[AUTH] Erro ao obter token:', error);
      return null;
    }
  }, [getToken]);

  // Aplica autenticação no realtime com garantia de re-subscribe
  const setRealtimeAuthSafe = useCallback(async (client: SupabaseClient) => {
    if (isRefreshingRef.current) {
      console.log('[AUTH] ⏳ Autenticação já em progresso - skip');
      return;
    }
    isRefreshingRef.current = true;
    try {
      if (!client || !isSignedIn) {
        try { await client?.realtime.setAuth(null); } catch {}
        setConnectionHealthy(false);
        return;
      }

      const token = await getTokenWithValidation();
      if (!token) {
        console.warn('[AUTH] Token inválido ao tentar setAuth');
        await client.realtime.setAuth(null);
        setConnectionHealthy(false);
        return;
      }

      // Se token atual é o mesmo do último aplicado e ainda válido, nada a fazer
      if (lastAppliedTokenRef.current === token) {
        const remainingMs = (currentTokenExpRef.current || 0) - Date.now();
        if (remainingMs > TOKEN_MIN_SAFE_MS) {
          console.log('[AUTH] Token já aplicado e ainda válido - skip');
          setConnectionHealthy(true);
          return;
        }
      }

      // Certificar-se de que o channel irá "pegar" o novo token: unsubscribe -> setAuth -> subscribe
      // Isso evita race conditions onde o socket mantém a sessão antiga.
      try {
        // unsubscribe se houver canais ativos
        if (client && client.getSubscriptions) {
          const subs = (client as any).getSubscriptions?.() || [];
          subs.forEach((s: RealtimeSubscription) => {
            try { s.unsubscribe(); } catch {}
          });
        }
      } catch (e) {
        // ignore
      }

      // aplicar token
      await client.realtime.setAuth(token);
      lastAppliedTokenRef.current = token;
      setRealtimeAuthCounter((p) => p + 1);
      setConnectionHealthy(true);
      console.log('[AUTH] ✅ Token aplicado com sucesso no realtime');

      // re-subscribe em seu channel específico (se existir)
      if (realtimeChannel) {
        // pequeno delay para garantir handshake
        await new Promise((r) => setTimeout(r, 200));
        try {
          realtimeChannel.subscribe();
          console.log('[AUTH] ✅ Re-subscribed channel após setAuth');
        } catch (err) {
          console.warn('[AUTH] Falha ao re-subscribe channel:', err);
        }
      }
    } catch (error) {
      console.error('[AUTH] ‼️ Erro na autenticação realtime:', error);
      setConnectionHealthy(false);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [getTokenWithValidation, isSignedIn, realtimeChannel]);

  // Backoff/Reconexão inteligente
  const handleReconnect = useCallback(async (channel?: RealtimeChannel) => {
    if (!isActiveRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[RECONNECT] 🛑 Máximo de tentativas atingido');
      return;
    }
    const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    console.log(`[RECONNECT] 🔄 Tentativa ${reconnectAttemptsRef.current} em ${delay}ms`);
    setTimeout(async () => {
      if (!isActiveRef.current || !supabaseClient) return;
      try {
        await setRealtimeAuthSafe(supabaseClient);
        if (channel) channel.subscribe();
      } catch (e) {
        console.error('[RECONNECT] erro ao tentar reconnect:', e);
      }
    }, delay);
  }, [supabaseClient, setRealtimeAuthSafe]);

  // Effect: criar cliente
  useEffect(() => {
    if (isLoaded && !supabaseClient) {
      console.log('[PROVIDER-INIT] Criando cliente Supabase');
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

  // Effect: montar canal realtime
  useEffect(() => {
    if (!supabaseClient || !isLoaded) return;
    isActiveRef.current = true;
    reconnectAttemptsRef.current = 0;
    console.log('[LIFECYCLE] Iniciando canal realtime');

    const channel = supabaseClient.channel('public:orders');

    const handleRealtimeEvent = (payload: any) => {
      if (!isActiveRef.current) return;
      console.log('[REALTIME-EVENT] Evento recebido');
      lastEventTimeRef.current = Date.now();
      setConnectionHealthy(true);

      // Se recebemos um evento, verificar token (se estiver próximo de expirar, agendar refresh)
      const expMs = currentTokenExpRef.current;
      if (expMs && expMs - Date.now() < TOKEN_REFRESH_MARGIN) {
        console.log('[REALTIME-EVENT] Token próximo do fim - agendando refresh imediato');
        setRealtimeAuthSafe(supabaseClient);
      }
    };

    channel.on('SUBSCRIBED', () => {
      if (!isActiveRef.current) return;
      console.log('[LIFECYCLE] Canal inscrito com sucesso');
      setConnectionHealthy(true);
      lastEventTimeRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
    });

    channel.on('CLOSED', () => {
      if (!isActiveRef.current) return;
      console.warn('[LIFECYCLE] Canal fechado');
      setConnectionHealthy(false);
      handleReconnect(channel);
    });

    // Captura erros; força reconnect se for token expirado
    channel.on('ERROR', (err: any) => {
      if (!isActiveRef.current) return;
      console.error('[LIFECYCLE] Erro no canal:', err);
      setConnectionHealthy(false);
      // Se receber mensagem clara de token expirado, forçar refresh imediato
      const msg = err?.message || JSON.stringify(err);
      if (typeof msg === 'string' && msg.toLowerCase().includes('token has expired')) {
        console.warn('[LIFECYCLE] Detected token expiration from server - forcing immediate refresh');
        // limpar lastAppliedToken para forçar reaplicação
        lastAppliedTokenRef.current = null;
        setRealtimeAuthSafe(supabaseClient);
      } else {
        handleReconnect(channel);
      }
    });

    // Listener postgres_changes (mantive)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      handleRealtimeEvent
    );

    // Health check interval (mantive lógica de business hours)
    const healthCheckInterval = setInterval(() => {
      if (!isActiveRef.current) return;
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      const isChannelSubscribed = channel.state === 'joined';
      const businessStatus = getBusinessHoursStatus();

      if (isChannelSubscribed && timeSinceLastEvent > 5 * 60 * 1000) {
        if (businessStatus.isOpen) {
          console.warn('[HEALTH-CHECK] Sem eventos há 5+ minutos durante horário comercial');
          setConnectionHealthy(false);
          // Forçar cycle completo: unsubscribe -> setAuth -> subscribe
          (async () => {
            try {
              await channel.unsubscribe();
            } catch {}
            await setRealtimeAuthSafe(supabaseClient);
            setTimeout(() => { if (isActiveRef.current) channel.subscribe(); }, 500);
          })();
        } else {
          console.log('[HEALTH-CHECK] Fora do horário comercial - comportamento normal');
        }
      }

      // Token expiration proactive check
      const expMs = currentTokenExpRef.current;
      if (expMs && expMs - Date.now() < TOKEN_REFRESH_MARGIN) {
        console.log('[HEALTH-CHECK] Token prestes a expirar - acionando refresh proativo');
        setRealtimeAuthSafe(supabaseClient);
      }
    }, HEALTH_CHECK_INTERVAL);

    // Token refresh interval - usa margem maior
    const tokenRefreshInterval = setInterval(() => {
      if (!isActiveRef.current || !isSignedIn || !supabaseClient) return;
      console.log('[TOKEN-REFRESH] Refresh proativo agendado');
      setRealtimeAuthSafe(supabaseClient);
    }, TOKEN_REFRESH_MARGIN);

    setRealtimeChannel(channel);

    // Aplicar autenticação segura inicial
    setRealtimeAuthSafe(supabaseClient);

    return () => {
      console.log('[LIFECYCLE] Limpando recursos');
      isActiveRef.current = false;
      clearInterval(healthCheckInterval);
      clearInterval(tokenRefreshInterval);
      try { channel.unsubscribe(); } catch {}
      setRealtimeChannel(null);
      setConnectionHealthy(false);
    };
  }, [supabaseClient, isLoaded, isSignedIn, setRealtimeAuthSafe, handleReconnect]);

  // Visibility wake up
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && supabaseClient && isSignedIn) {
        console.log('👁️ Aba visível - verificando conexão');
        setRealtimeAuthSafe(supabaseClient);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabaseClient, isSignedIn, setRealtimeAuthSafe]);

  const refreshConnection = useCallback(async () => {
    console.log('[RECONNECT] Reconexão manual solicitada');
    if (realtimeChannel) {
      try { await realtimeChannel.unsubscribe(); } catch {}
    }
    if (supabaseClient) {
      await setRealtimeAuthSafe(supabaseClient);
      // re-subscribe do canal se existir
      if (realtimeChannel) {
        setTimeout(() => realtimeChannel.subscribe(), 300);
      }
    }
  }, [supabaseClient, realtimeChannel, setRealtimeAuthSafe]);

  const requestReconnect = useCallback(async (maxAttempts?: number) => {
    console.log('[RECONNECT] requestReconnect chamado');
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
      setRealtimeAuth: () => supabaseClient && setRealtimeAuthSafe(supabaseClient),
      refreshConnection,
    }}>
      {children}

      <div className={`fixed bottom-4 right-4 w-3 h-3 rounded-full ${
        connectionHealthy ? 'bg-green-500' : 'bg-red-500'
      } z-50 border border-white shadow-lg`} 
      title={`${connectionHealthy ? 'Conexão saudável' : 'Conexão com problemas'} | ${getBusinessHoursStatus().message}`} />
    </SupabaseContext.Provider>
  );
}
