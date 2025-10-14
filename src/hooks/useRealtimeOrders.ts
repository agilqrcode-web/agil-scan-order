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
    console.log('[RT-DEBUG] useEffect START. Supabase client available:', !!supabaseClient, 'Auth Counter:', realtimeAuthCounter);
    if (!supabaseClient || realtimeAuthCounter === 0) {
      console.log('[RT-DEBUG] Bailing out: Supabase client not ready or Realtime not authenticated.');
      return;
    }

    console.log('[RT-DEBUG] Attempting to subscribe to channel: public:orders (Auth Counter:', realtimeAuthCounter, ')');
    const channel = supabaseClient
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[RT-DEBUG] New order payload received, invalidating notifications query.', payload);
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe((status, err) => {
        console.log(`[RT-DEBUG] Subscription status: ${status} (Auth Counter: ${realtimeAuthCounter})`);
        if (status === 'SUBSCRIBED') {
          console.log('[RT-DEBUG] Successfully subscribed to real-time orders channel! (Auth Counter:', realtimeAuthCounter, ')');
        } else if (status === 'CLOSED') {
          console.warn('[RT-DEBUG] Real-time orders channel closed. (Auth Counter:', realtimeAuthCounter, ')');
        } else if (status === 'TIMED_OUT') {
          console.error('[RT-DEBUG] Real-time subscription TIMED_OUT. This indicates a problem establishing or maintaining the connection. (Auth Counter:', realtimeAuthCounter, ')');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RT-DEBUG] Real-time subscription CHANNEL_ERROR. The channel encountered an error and closed. (Auth Counter:', realtimeAuthCounter, ')', err);
        }
        if (err) {
          console.error('[RT-DEBUG] Real-time subscription error details:', err);
        }
      });

    console.log('[RT-DEBUG] useEffect END. Subscription logic initiated. (Auth Counter:', realtimeAuthCounter, ')');

    return () => {
      console.warn('[RT-DEBUG] Cleanup: Unsubscribing from real-time orders channel. (Auth Counter:', realtimeAuthCounter, ')');
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient, realtimeAuthCounter, queryClient]);

  // This hook no longer returns anything as it only manages a side effect.
}
