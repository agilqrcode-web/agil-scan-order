import { useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';

/**
 * This hook is responsible for listening to real-time order inserts
 * and invalidating the notifications query to trigger a refetch.
 * It does not hold any state itself.
 */
export function useRealtimeOrders() {
  const { supabaseClient, realtimeAuthCounter } = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[RT-DEBUG] useEffect triggered. Supabase client available:', !!supabaseClient, 'Auth Counter:', realtimeAuthCounter);
    if (!supabaseClient || realtimeAuthCounter === 0) {
      console.log('[RT-DEBUG] Bailing out: Supabase client not ready or Realtime not authenticated.');
      return;
    }

    console.log('[RT-DEBUG] Attempting to subscribe to channel: public:orders');
    const channel = supabaseClient
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[RT-DEBUG] New order payload received, invalidating notifications query.', payload);
          // Invalidate the notifications query to trigger a refetch
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe((status, err) => {
        console.log(`[RT-DEBUG] Subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('[RT-DEBUG] Successfully subscribed to real-time orders channel!');
        }
        if (status === 'CLOSED') {
          console.warn('[RT-DEBUG] Real-time orders channel closed.');
        }
        if (err) {
          console.error('[RT-DEBUG] Real-time subscription error:', err);
        }
      });

    return () => {
      console.warn('[RT-DEBUG] Cleanup: Unsubscribing from real-time orders channel.');
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, realtimeAuthCounter, queryClient]);

  // This hook no longer returns anything as it only manages a side effect.
}
