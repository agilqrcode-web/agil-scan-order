import { useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js'; // NEW IMPORT

/**
 * This hook is responsible for listening to real-time order inserts
 * and invalidating the notifications query to trigger a refetch.
 * It does not hold any state itself.
 */
export function useRealtimeOrders() {
  const { supabaseClient, realtimeChannel } = useSupabase(); // MODIFIED DESTRUCTURING
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[RT-DEBUG] useEffect START. Supabase client available:', !!supabaseClient, 'Realtime Channel available:', !!realtimeChannel); // MODIFIED LOG
    if (!supabaseClient || !realtimeChannel) { // MODIFIED GUARD
      console.log('[RT-DEBUG] Bailing out: Supabase client or Realtime Channel not ready.'); // MODIFIED LOG
      return;
    }

    console.log('[RT-DEBUG] Registering listener for channel: public:orders'); // MODIFIED LOG

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

    console.log('[RT-DEBUG] useEffect END. Listener registered.'); // MODIFIED LOG

    return () => {
      console.warn('[RT-DEBUG] Cleanup: Removing listener from real-time orders channel.'); // MODIFIED LOG
      // Remove only this specific listener, not the entire channel
      realtimeChannel.off('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, handlePostgresChanges);
    };
  }, [supabaseClient, realtimeChannel, queryClient]); // MODIFIED DEPENDENCIES

  // This hook no longer returns anything as it only manages a side effect.
}
