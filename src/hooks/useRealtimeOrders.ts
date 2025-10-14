import { useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@clerk/clerk-react'; // NEW IMPORT

/**
 * This hook is responsible for listening to real-time order inserts
 * and invalidating the notifications query to trigger a refetch.
 * It does not hold any state itself.
 */
export function useRealtimeOrders() {
  const { supabaseClient, realtimeChannel, isRealtimeReadyForSubscription } = useSupabase();
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth(); // NEW: Get isSignedIn

  useEffect(() => {
    console.log('[RT-DEBUG] useEffect START. Supabase client available:', !!supabaseClient, 'Realtime Channel available:', !!realtimeChannel, 'User Signed In:', isSignedIn, 'Realtime Ready:', isRealtimeReadyForSubscription); // MODIFIED LOG
    if (!isSignedIn || !supabaseClient || !realtimeChannel || !isRealtimeReadyForSubscription) { // MODIFIED GUARD
      console.log('[RT-DEBUG] Bailing out: User not signed in, Supabase client or Realtime Channel not ready.'); // MODIFIED LOG
      return;
    }

    console.log('[RT-DEBUG] Registering listener for channel: public:notifications');

    // Define the listener function
    const handlePostgresChanges = (payload: any) => {
      console.log('[RT-DEBUG] New order payload received, invalidating notifications query.', payload);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    // Register the listener on the existing channel
    realtimeChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      handlePostgresChanges
    );

    // NEW: Subscribe to the channel after registering the listener
    console.log('[RT-DEBUG] Attempting to subscribe to channel: public:notifications (from useRealtimeOrders)');
    realtimeChannel.subscribe((status, err) => {
      console.log(`[RT-DEBUG] useRealtimeOrders Channel status: ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log('[RT-DEBUG] useRealtimeOrders Successfully subscribed to real-time orders channel!');
      } else if (status === 'CLOSED') {
        console.warn('[RT-DEBUG] useRealtimeOrders Real-time orders channel closed.');
      } else if (status === 'TIMED_OUT') {
        console.error('[RT-DEBUG] useRealtimeOrders Real-time subscription TIMED_OUT. This indicates a problem establishing or maintaining the connection.');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[RT-DEBUG] useRealtimeOrders Real-time subscription CHANNEL_ERROR. The channel encountered an error and closed.', err);
      }
      if (err) {
        console.error('[RT-DEBUG] useRealtimeOrders Real-time subscription error details:', err);
      }
    });

    console.log('[RT-DEBUG] useEffect END. Listener registered and subscribe initiated.'); // MODIFIED LOG

    return () => {
      console.warn('[RT-DEBUG] Cleanup: Unsubscribing from real-time orders channel and removing listener.'); // MODIFIED LOG
      realtimeChannel.unsubscribe(); // NEW: Unsubscribe the channel
      realtimeChannel.off('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, handlePostgresChanges);
    };
  }, [supabaseClient, realtimeChannel, queryClient, isSignedIn, isRealtimeReadyForSubscription]); // ADDED isSignedIn, isRealtimeReadyForSubscription to dependencies
}
