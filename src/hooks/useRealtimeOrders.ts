import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { realtimeChannel } = useSupabase();
  const queryClient = useQueryClient();

  // Keep a ref to the channel to ensure cleanup uses the correct instance
  const channelRef = useRef(realtimeChannel);
  channelRef.current = realtimeChannel;

  // Stable handler for processing new order notifications
  const handleNewOrder = useCallback((payload: any) => {
    console.log('[RT-ORDERS] New order event received:', payload);
    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {
          // Optional: navigate to orders page
        },
      },
    });
    // Invalidate queries to refetch data from the database as the source of truth
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }, [queryClient]);


  useEffect(() => {
    // Do nothing if the channel is not yet created.
    if (!realtimeChannel) {
      return;
    }

    console.log('[RT-ORDERS] useEffect: Channel instance available. Setting up subscription.');

    // 1. Define the event handlers
    const newOrderHandler = (payload: any) => handleNewOrder(payload);

    // 2. Register handlers
    // The `postgres_changes` event is more reliable for DB changes.
    realtimeChannel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      }, newOrderHandler)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, newOrderHandler);


    // 3. Subscribe to the channel
    realtimeChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[RT-ORDERS] Successfully subscribed to "public:notifications" channel.');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[RT-ORDERS] Channel error:', err);
      }
      if (status === 'TIMED_OUT') {
        console.warn('[RT-ORDERS] Channel subscription timed out.');
      }
    });

    // 4. Cleanup function
    return () => {
      console.log('[RT-ORDERS] Cleanup: Unsubscribing from channel.');
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewOrder]); // Effect depends only on stable channel instance and handler

  // The hook doesn't need to return anything for this simplified usage
}
