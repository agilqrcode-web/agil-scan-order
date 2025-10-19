// useRealtimeOrders.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RealtimeSubscription } from '@supabase/supabase-js';

const POLLING_INTERVAL = 2 * 60 * 1000;

export function useRealtimeOrders() {
  const { realtimeChannel, connectionHealthy } = useSupabase();
  const queryClient = useQueryClient();
  const localSubRef = useRef<RealtimeSubscription | null>(null);
  const pollingRef = useRef<number | null>(null);
  const lastNotificationRef = useRef<number>(0);

  const handlePayload = useCallback((payload: any) => {
    console.log('[useRealtimeOrders] payload received', payload);
    lastNotificationRef.current = Date.now();

    // Dispatch global custom event for notification UI (sino)
    try {
      window.dispatchEvent(new CustomEvent('order:notification:received', { detail: payload }));
    } catch {}

    // Show toast briefly (if desired)
    try {
      toast.success('Novo pedido recebido');
    } catch {}

    // Invalidate queries so UI updates
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
  }, [queryClient]);

  useEffect(() => {
    // cleanup previous local subscription if exists
    if (localSubRef.current) {
      try { localSubRef.current.unsubscribe(); } catch {}
      localSubRef.current = null;
    }

    if (!realtimeChannel) {
      console.log('[useRealtimeOrders] realtimeChannel not available');
      return;
    }

    // Create a subscription scoped to this hook only
    const sub = realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        handlePayload(payload);
      })
      .subscribe();

    localSubRef.current = sub;

    // If channel later re-joins and our sub isn't active, try to re-subscribe
    const statePoll = window.setInterval(() => {
      try {
        if (!localSubRef.current || localSubRef.current.state !== 'SUBSCRIBED') {
          if (realtimeChannel && realtimeChannel.state === 'joined') {
            try {
              if (localSubRef.current) { localSubRef.current.unsubscribe(); }
            } catch {}
            const newSub = realtimeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => handlePayload(payload)).subscribe();
            localSubRef.current = newSub;
          }
        }
      } catch (e) {
        console.warn('[useRealtimeOrders] statePoll error', e);
      }
    }, 2000);

    return () => {
      if (localSubRef.current) {
        try { localSubRef.current.unsubscribe(); } catch {}
        localSubRef.current = null;
      }
      clearInterval(statePoll);
    };
  }, [realtimeChannel, handlePayload]);

  // Polling fallback if connection not healthy
  useEffect(() => {
    if (!connectionHealthy) {
      queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
      pollingRef.current = window.setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['orders', 'notifications', 'orders-stats'] });
      }, POLLING_INTERVAL) as unknown as number;
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [connectionHealthy, queryClient]);

  return {
    connectionHealthy,
    lastNotificationAt: lastNotificationRef.current,
  };
}
