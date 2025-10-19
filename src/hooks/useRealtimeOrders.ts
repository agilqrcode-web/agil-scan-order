// useRealtimeOrders.ts - VERSÃO COMPLETA COM FALLBACK
import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { realtimeChannel, connectionHealthy } = useSupabase();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<number>();
  const lastNotificationRef = useRef<number>(Date.now());

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] New postgres_changes event received:', payload);
    lastNotificationRef.current = Date.now();
    
    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {},
      },
    });

    // Invalidar queries relevantes
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
  }, [queryClient]);

  // Efeito 1: Configurar listeners do realtime
  useEffect(() => {
    if (!realtimeChannel) {
      console.log('[RT-HOOK] Canal realtime não disponível');
      return;
    }

    console.log('[RT-HOOK] ⚓️ Anexando listeners de postgres_changes e iniciando inscrição.');

    const handler = (payload: any) => handleNewNotification(payload);

    // A inscrição só é chamada AQUI, depois que o listener .on() foi registrado.
    realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handler)
      .subscribe();

    // Cleanup: remove o listener e a inscrição quando o componente desmontar.
    return () => {
      if (realtimeChannel) {
        console.log('[RT-HOOK] 🧹 Limpando... Desinscrevendo e removendo listeners de notificações.');
        // O unsubscribe remove todos os listeners do canal automaticamente
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewNotification]);

  // Efeito 2: Fallback com polling quando realtime não está saudável
  useEffect(() => {
    if (!connectionHealthy) {
      console.log('[FALLBACK] 🔄 Conexão realtime não saudável - ativando polling como fallback');
      
      // Polling imediato primeiro
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Configurar polling periódico
      pollingIntervalRef.current = window.setInterval(() => {
        console.log('[FALLBACK] 📡 Polling para atualizações de pedidos');
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
      }, 30000); // 30 segundos

      return () => {
        if (pollingIntervalRef.current) {
          console.log('[FALLBACK] 🧹 Desativando polling');
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = undefined;
        }
      };
    } else {
      // Conexão saudável - desativar polling se estiver ativo
      if (pollingIntervalRef.current) {
        console.log('[FALLBACK] ✅ Realtime recuperado - desativando polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = undefined;
        
        // Forçar uma atualização imediata ao voltar para realtime
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    }
  }, [connectionHealthy, queryClient]);

  // Efeito 3: Health check adicional - verifica se estamos recebendo notificações
  useEffect(() => {
    const healthCheckInterval = window.setInterval(() => {
      const timeSinceLastNotification = Date.now() - lastNotificationRef.current;
      
      // Se não recebemos notificações por mais de 2 minutos e a conexão está "saudável"
      // pode indicar um falso positivo na saúde da conexão
      if (connectionHealthy && timeSinceLastNotification > 120000) {
        console.warn('[HEALTH-CHECK] ⚠️  Conexão marcada como saudável mas sem notificações há 2 minutos');
        // Poderia forçar uma revalidação aqui se necessário
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    }, 60000); // Verificar a cada 1 minuto

    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [connectionHealthy, queryClient]);

  return {
    connectionHealthy,
    isUsingFallback: !!pollingIntervalRef.current
  };
}
