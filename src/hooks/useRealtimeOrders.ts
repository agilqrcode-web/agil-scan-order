import { useCallback, useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useSupabase } from '@/contexts/SupabaseContext'; // ajuste conforme seu hook/contexto
// import any state setters or dispatchers you need to update orders in your app
// e.g., import { useOrdersStore } from '@/stores/orders';

// Configuration
const SUBSCRIBE_CONFIRM_DELAY_MS = 400;
const SUBSCRIBE_INITIAL_BACKOFF_MS = 300;
const SUBSCRIBE_MAX_ATTEMPTS = 4;

export function useRealtimeOrders() {
  // Context values provided by SupabaseProvider
  const {
    supabaseClient,
    realtimeChannel,
    realtimeAuthCounter,
    requestReconnect,
  } = useSupabase();

  // Local locks & refs to avoid re-entrancy
  const subscribeLockRef = useRef(false);
  const mountedRef = useRef(true);
  const currentAttemptRef = useRef(0);

  // Keep a ref to the channel so handlers can be removed reliably
  const channelRef = useRef<RealtimeChannel | null>(null);
  channelRef.current = realtimeChannel;

  // Example event handler (adapt to your event payload)
  const handleBroadcast = useCallback((payload: any) => {
    // Process incoming broadcast payload for orders here
    // Example:
    // if (payload.event === 'order_created') { addOrder(payload.data); }
    console.log('[useRealtimeOrders] broadcast received', payload);
  }, []);

  // Subscribe logic with backoff and attempts
  const ensureSubscribed = useCallback(async () => {
    if (!supabaseClient || !channelRef.current) {
      return false;
    }
    if (subscribeLockRef.current) {
      console.log('[useRealtimeOrders] Subscribe already in progress — skipping.');
      return false;
    }

    subscribeLockRef.current = true;
    currentAttemptRef.current = 0;
    let backoff = SUBSCRIBE_INITIAL_BACKOFF_MS;

    try {
      while (currentAttemptRef.current < SUBSCRIBE_MAX_ATTEMPTS && mountedRef.current) {
        currentAttemptRef.current += 1;
        const ch = channelRef.current;
        if (!ch) break;

        // If already subscribed, we're done
        if (ch.state === 'SUBSCRIBED') {
          console.log('[useRealtimeOrders] Channel already SUBSCRIBED.');
          return true;
        }

        // Attempt subscribe
        try {
          console.log(`[useRealtimeOrders] Attempting subscribe (attempt ${currentAttemptRef.current})`);
          // Ensure we remove previous listeners to avoid duplication
          try { ch.unsubscribe(); } catch { /* ignore */ }

          // Recreate or reuse channel instance
          // If the channelRef is the same object from provider, call subscribe() on it.
          ch.subscribe();
          // Attach listeners after subscribe call (safe to reattach; we'll cleanup on unsubscribe)
          ch.on('broadcast', { event: 'order_created' }, (e) => handleBroadcast(e.payload));
          ch.on('broadcast', { event: 'order_updated' }, (e) => handleBroadcast(e.payload));
          ch.on('broadcast', { event: 'order_deleted' }, (e) => handleBroadcast(e.payload));

          // Wait briefly for the state to settle
          await new Promise((res) => setTimeout(res, SUBSCRIBE_CONFIRM_DELAY_MS));

          if (ch.state === 'SUBSCRIBED') {
            console.log('[useRealtimeOrders] Successfully subscribed to realtime channel.');
            return true;
          } else {
            console.warn('[useRealtimeOrders] Channel not SUBSCRIBED after attempt', ch.state);
          }
        } catch (err) {
          console.warn('[useRealtimeOrders] Subscribe attempt error', err);
        }

        // Exponential backoff before retrying
        await new Promise((res) => setTimeout(res, backoff));
        backoff *= 2;
      }

      console.error('[useRealtimeOrders] Failed to subscribe after attempts.');
      return false;
    } finally {
      subscribeLockRef.current = false;
    }
  }, [supabaseClient, handleBroadcast]);

  // Unsubscribe and cleanup listeners
  const cleanupChannel = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      // Remove listeners if any (unsubscribe does remove them)
      ch.unsubscribe();
      // If your client/channel implementation requires explicit off calls:
      // ch.off('broadcast', ...);
    } catch (e) {
      console.warn('[useRealtimeOrders] Error during channel cleanup', e);
    }
  }, []);

  // Primary effect: try to subscribe when client and channel are available.
  // Also re-run when realtimeAuthCounter changes (fallback trigger).
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const run = async () => {
      if (!supabaseClient || !realtimeChannel) {
        // Nothing to do until both exist
        return;
      }

      // If channel already subscribed, ensure listeners are attached (idempotent)
      if (realtimeChannel.state === 'SUBSCRIBED') {
        try {
          // Attach handlers if not already attached — safe to attach redundantly if you ensure cleanup on unsubscribe
          realtimeChannel.on('broadcast', { event: 'order_created' }, (e) => handleBroadcast(e.payload));
          realtimeChannel.on('broadcast', { event: 'order_updated' }, (e) => handleBroadcast(e.payload));
          realtimeChannel.on('broadcast', { event: 'order_deleted' }, (e) => handleBroadcast(e.payload));
          console.log('[useRealtimeOrders] Channel already SUBSCRIBED; handlers attached.');
        } catch (e) {
          console.warn('[useRealtimeOrders] Error attaching handlers to already subscribed channel', e);
        }
        return;
      }

      // Otherwise, attempt controlled subscribe (first-line)
      const ok = await ensureSubscribed();
      if (ok) return;

      // If ensureSubscribed failed, do NOT spam: try requestReconnect (provider-level controlled reconnect)
      try {
        console.log('[useRealtimeOrders] ensureSubscribed failed; requesting provider-level reconnect.');
        const reconnected = await requestReconnect();
        if (reconnected && realtimeChannel?.state === 'SUBSCRIBED') {
          // attach handlers
          realtimeChannel.on('broadcast', { event: 'order_created' }, (e) => handleBroadcast(e.payload));
          realtimeChannel.on('broadcast', { event: 'order_updated' }, (e) => handleBroadcast(e.payload));
          realtimeChannel.on('broadcast', { event: 'order_deleted' }, (e) => handleBroadcast(e.payload));
          console.log('[useRealtimeOrders] Provider-level reconnect succeeded and handlers attached.');
          return;
        }
      } catch (err) {
        console.warn('[useRealtimeOrders] requestReconnect returned error', err);
      }

      // If still failed, the realtimeAuthCounter may be the fallback trigger: log and return
      console.warn('[useRealtimeOrders] Subscriptions could not be established after local/provider attempts. realtimeAuthCounter:', realtimeAuthCounter);
    };

    // Fire-and-forget but keep error visibility
    run().catch((e) => {
      if (!cancelled) console.error('[useRealtimeOrders] subscribe run error', e);
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      // Cleanup handlers and unsubscribe when component unmounts or deps change
      cleanupChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient, realtimeChannel, realtimeAuthCounter]);

  // Optionally return an API for manual control
  return {
    ensureSubscribed,
    cleanupChannel,
  };
}
