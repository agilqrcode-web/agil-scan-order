import React, { createContext, useContext, ReactNode } from 'react';
import { useRealtimeOrders, OrderNotification } from '@/hooks/useRealtimeOrders';

interface NotificationsContextType {
  newOrderNotifications: OrderNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { newOrderNotifications, unreadCount, markAsRead, clearAllNotifications } = useRealtimeOrders();

  return (
    <NotificationsContext.Provider value={{ newOrderNotifications, unreadCount, markAsRead, clearAllNotifications }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
