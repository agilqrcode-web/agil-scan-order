// useRealtimeOrders.ts - VERSÃO CORRIGIDA
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useRealtimeOrders() {
  const { realtimeChannel, connectionHealthy } = useSupabase();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<number>();
  const [hasRealTimeWorked, setHasRealTimeWorked] = useState(false);

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] ✅ Evento recebido:', payload);
    setHasRealTimeWorked(true); // ✅ MARCA que RealTime funcionou
    
    toast.info("Novo pedido recebido!");
    queryClient.invalidateQueries({ queryKey: ['notifications', 'orders', 'orders-stats'] });
  }, [queryClient]);

  // Efeito 1: Configurar listeners do realtime
  useEffect(() => {
    if (!realtimeChannel) {
      console.log('[RT-HOOK] Canal realtime não disponível');
      return;
    }

    console.log('[RT-HOOK] ⚓️ Configurando listeners realtime');

    const handler = (payload: any) => handleNewNotification(payload);

    realtimeChannel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders' 
      }, handler)
      .subscribe();

    return () => {
      if (realtimeChannel) {
        console.log('[RT-HOOK] 🧹 Limpando listeners');
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewNotification]);

  // ✅ Efeito 2: Polling INTELIGENTE - Só ativa se RealTime nunca funcionou
  useEffect(() => {
    // ⚠️ NÃO ativar polling se:
    // - connectionHealthy é true (RealTime está funcionando)  
    // - OU se RealTime já funcionou antes (hasRealTimeWorked)
    if (connectionHealthy || hasRealTimeWorked) {
      if (pollingIntervalRef.current) {
        console.log('[FALLBACK] ✅ RealTime funcionando - desativando polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = undefined;
      }
      return;
    }

    // ✅ Só ativar polling se RealTime NUNCA funcionou
    if (!connectionHealthy && !hasRealTimeWorked) {
      console.log('[FALLBACK] 🔄 RealTime não inicializou - ativando polling temporário');
      
      pollingIntervalRef.current = window.setInterval(() => {
        console.log('[FALLBACK] 📡 Polling (aguardando RealTime)');
        queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
      }, POLLING_INTERVAL);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = undefined;
        }
      };
    }
  }, [connectionHealthy, hasRealTimeWorked, queryClient]);

  return {
    connectionHealthy,
    isUsingFallback: !!pollingIntervalRef.current,
    hasRealTimeWorked
  };
}
