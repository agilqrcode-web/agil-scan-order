// useRealtimeOrders.ts - versão atualizada
import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RealtimeSubscription } from '@supabase/supabase-js';

// ✅ CONFIGURAÇÕES OTIMIZADAS
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useRealtimeOrders() {
  const { realtimeChannel, connectionHealthy } = useSupabase();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<number | undefined>();
  const lastNotificationRef = useRef<number>(Date.now());
  const localSubRef = useRef<RealtimeSubscription | null>(null);

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] ✅ Evento recebido:', payload);
    lastNotificationRef.current = Date.now();

    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {},
      },
    });

    // Invalidar queries em lote
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
  }, [queryClient]);

  // Efeito: configurar listener apontando para a subscription local
  useEffect(() => {
    // Cleanup prévio caso o hook seja reexecutado
    if (localSubRef.current) {
      try { localSubRef.current.unsubscribe(); } catch {}
      localSubRef.current = null;
    }

    if (!realtimeChannel) {
      console.log('[RT-HOOK] Canal realtime não disponível');
      return;
    }

    console.log('[RT-HOOK] ⚓️ Configurando listener realtime local');

    // Cria subscription local (apenas para este handler)
    const sub = realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        handleNewNotification(payload);
      })
      .subscribe();

    // Guardar referência para cleanup específico
    localSubRef.current = sub;

    // Caso o provider re-subscribe o channel globalmente, o handler permanece válido
    // mas alguns fluxos podem recriar o channel; por isso monitoramos state changes:
    const stateHandler = () => {
      // Se channel for rejoined e não temos subscription ativa, recriar
      if (realtimeChannel.state === 'joined' && (!localSubRef.current || localSubRef.current.state !== 'SUBSCRIBED')) {
        try {
          if (localSubRef.current) {
            localSubRef.current.unsubscribe();
            localSubRef.current = null;
          }
          const newSub = realtimeChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
              handleNewNotification(payload);
            })
            .subscribe();
          localSubRef.current = newSub;
        } catch (e) {
          console.warn('[RT-HOOK] Falha ao recriar subscription local:', e);
        }
      }
    };

    // Não há API direta para "on state", mas podemos observar channel.state via polling leve
    let statePoll = window.setInterval(stateHandler, 2000);

    return () => {
      console.log('[RT-HOOK] 🧹 Limpando listener local');
      if (localSubRef.current) {
        try { localSubRef.current.unsubscribe(); } catch {}
        localSubRef.current = null;
      }
      clearInterval(statePoll);
    };
  }, [realtimeChannel, handleNewNotification]);

  // Efeito: polling fallback
  useEffect(() => {
    if (!connectionHealthy) {
      console.log('[FALLBACK] 🔄 Ativando polling (2min)');

      queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });

      pollingIntervalRef.current = window.setInterval(() => {
        console.log('[FALLBACK] 📡 Polling para atualizações (2min)');
        queryClient.invalidateQueries({ queryKey: ['orders', 'notifications', 'orders-stats'] });
      }, POLLING_INTERVAL);

      return () => {
        if (pollingIntervalRef.current) {
          console.log('[FALLBACK] 🧹 Desativando polling');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = undefined;
        }
      };
    } else {
      if (pollingIntervalRef.current) {
        console.log('[FALLBACK] ✅ Realtime recuperado - desativando polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = undefined;
        queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
      }
    }
  }, [connectionHealthy, queryClient]);

  return {
    connectionHealthy,
    isUsingFallback: !!pollingIntervalRef.current,
  };
}
