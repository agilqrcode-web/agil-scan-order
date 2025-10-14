import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { realtimeChannel } = useSupabase();
  const queryClient = useQueryClient();

  const channelRef = useRef(realtimeChannel);
  channelRef.current = realtimeChannel;

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] New postgres_changes event received:', payload);
    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {},
      },
    });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }, [queryClient]);

  useEffect(() => {
    if (!realtimeChannel) {
      return;
    }

    console.log('[RT-NOTIFICATIONS] useEffect: Channel instance available. Setting up subscription.');

    const notificationHandler = (payload: any) => handleNewNotification(payload);

    realtimeChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders' // The trigger is on the 'orders' table, which sends a notification.
      }, notificationHandler)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, notificationHandler);

    // New polling logic as suggested
    const subscribeAndPoll = async () => {
      console.log(`[RT-NOTIFICATIONS] Calling subscribe. Current state: ${realtimeChannel.state}`);
      realtimeChannel.subscribe();

      const start = Date.now();
      const timeout = 10000; // 10 seconds

      while (Date.now() - start < timeout) {
        if (realtimeChannel.state === 'SUBSCRIBED') {
          console.log(`[RT-NOTIFICATIONS] Trophy unlocked: SUBSCRIBED to channel "public:notifications" successfully!`);
          return true;
        }
        await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
      }

      console.warn(`[RT-NOTIFICATIONS] Subscription timed out after ${timeout / 1000}s. Final state: ${realtimeChannel.state}`);
      return false;
    };

    subscribeAndPoll();

    return () => {
      console.log('[RT-NOTIFICATIONS] Cleanup: Unsubscribing from channel "public:notifications".');
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewNotification]);
}
