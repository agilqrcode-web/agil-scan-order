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
  }, [queryClient]);

  useEffect(() => {
    if (!realtimeChannel) {
      return;
    }

    console.log('[RT-NOTIFICATIONS] useEffect: Channel instance available. Setting up subscription.');

    const notificationHandler = (payload: any) => handleNewNotification(payload);

    // Register handlers for database changes
    realtimeChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, notificationHandler)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, notificationHandler);

    // Subscribe using the standard callback method
    realtimeChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[RT-NOTIFICATIONS] Trophy unlocked: SUBSCRIBED to channel "${realtimeChannel.topic}" successfully!`);
      }
      if (status === 'CHANNEL_ERROR') {
        console.error(`[RT-NOTIFICATIONS] Channel error on topic "${realtimeChannel.topic}":`, err);
      }
      if (status === 'TIMED_OUT') {
        // This timeout is from the SDK itself, which is more reliable
        console.warn(`[RT-NOTIFICATIONS] Subscription timed out on topic "${realtimeChannel.topic}".`);
      }
    });

    // Cleanup function on unmount
    return () => {
      console.log(`[RT-NOTIFICATIONS] Cleanup: Unsubscribing from channel "${realtimeChannel.topic}".`);
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewNotification]);
}
