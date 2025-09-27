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
    if (!supabase) return; // Garante que o cliente Supabase esteja disponível

    console.log('Attempting to subscribe to orders_channel...');
    const channel = supabase
      .channel(`orders_channel_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('New order INSERT event received!', payload);
          const newOrder = payload.new as Order;
          setNewOrderNotifications((prev) => [
            { ...newOrder, isRead: false },
            ...prev,
          ]);
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime channel status:', status);
      });

    return () => {
      console.log('Unsubscribing from orders_channel.');
      supabase.removeChannel(channel);
    };
  }, [supabase]); // Adiciona supabase como dependência

  const unreadCount = newOrderNotifications.filter((notif) => !notif.isRead).length;

  return { newOrderNotifications, unreadCount, markAsRead, clearAllNotifications };
}
