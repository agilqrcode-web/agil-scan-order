import { useEffect, useState, useCallback } from 'react';
import { createSupabaseClient } from '@/integrations/supabase/client';
import { Order } from '@/types/order';

export interface OrderNotification extends Order {
  isRead: boolean;
}

export function useRealtimeOrders() {
  const [newOrderNotifications, setNewOrderNotifications] = useState<OrderNotification[]>([]);
  const supabase = createSupabaseClient();

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
    const channel = supabase
      .channel('orders_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('New order received!', payload);
          const newOrder = payload.new as Order;
          setNewOrderNotifications((prev) => [
            { ...newOrder, isRead: false },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const unreadCount = newOrderNotifications.filter((notif) => !notif.isRead).length;

  return { newOrderNotifications, unreadCount, markAsRead, clearAllNotifications };
}
