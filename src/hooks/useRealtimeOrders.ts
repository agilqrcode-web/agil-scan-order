import { useEffect, useState, useCallback } from 'react';
import { Order } from '@/types/order';
import { useSupabase } from '@/contexts/SupabaseContext';

export interface OrderNotification extends Order {
  isRead: boolean;
}

export function useRealtimeOrders() {
  const [newOrderNotifications, setNewOrderNotifications] = useState<OrderNotification[]>([]);
  const supabase = useSupabase(); // Obtém a instância do Supabase do contexto

  const markAsRead = useCallback((notificationId: string) => {
    setNewOrderNotifications((prev) =>
      prev.map((notif) =>
        notif.id === notificationId ? { ...notif, isRead: true } : notif
      )
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNewOrderNotifications([]);
  }, []);

  useEffect(() => {
    // Log when the effect runs and if supabase is available
    console.log('[RT-DEBUG] useEffect triggered. Supabase client available:', !!supabase);

    if (!supabase) {
      console.log('[RT-DEBUG] Supabase client not available. Bailing out.');
      return;
    }

    console.log('[RT-DEBUG] Attempting to subscribe to channel: public:orders');
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('[RT-DEBUG] Payload received:', payload);
          const newOrder = payload.new as Order;
          setNewOrderNotifications((prev) => [
            { ...newOrder, isRead: false },
            ...prev,
          ]);
        }
      )
      .subscribe((status, err) => {
        // Log subscription status changes
        console.log(`[RT-DEBUG] Subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('[RT-DEBUG] Successfully subscribed to channel!');
        }
        if (status === 'CLOSED') {
          console.warn('[RT-DEBUG] Channel closed.');
        }
        if (err) {
          console.error('[RT-DEBUG] Subscription error:', err);
        }
      });

    // Cleanup function
    return () => {
      console.warn('[RT-DEBUG] Cleanup: Unsubscribing from channel.');
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const unreadCount = newOrderNotifications.filter((notif) => !notif.isRead).length;

  return { newOrderNotifications, unreadCount, markAsRead, clearAllNotifications };
}
