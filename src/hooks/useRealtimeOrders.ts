import { useCallback, useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { realtimeChannel } = useSupabase();
  const queryClient = useQueryClient();

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] New postgres_changes event received:', payload);
    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {},
      },
    });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  useEffect(() => {
    if (!realtimeChannel) {
      return;
    }

    console.log('[RT-NOTIFICATIONS] Attaching postgres_changes listeners.');

    const handler = (payload: any) => handleNewNotification(payload);

    // Attach listeners. The Provider is responsible for the channel subscription itself.
    realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handler);

    // Cleanup: remove the listener when the component unmounts.
    return () => {
      if (realtimeChannel) {
        console.log('[RT-NOTIFICATIONS] Detaching postgres_changes listeners.');
        realtimeChannel.off('postgres_changes', handler);
      }
    };
  }, [realtimeChannel, handleNewNotification]);
}
