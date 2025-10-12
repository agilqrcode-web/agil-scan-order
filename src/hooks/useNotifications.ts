import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Estrutura de dados esperada da nossa API
interface NotificationsData {
  stats: {
    total: number;
    unread: number;
    today: number;
  };
  notifications: any[]; // Você pode criar uma interface mais estrita para Notification aqui
}

// Função para buscar os dados
const fetchNotifications = async (): Promise<NotificationsData> => {
  const response = await fetch('/api/notifications');
  if (!response.ok) {
    throw new Error('Falha ao buscar notificações');
  }
  return response.json();
};

export function useNotifications() {
  const queryClient = useQueryClient();

  // Query para buscar os dados
  const { data, isLoading, error } = useQuery<NotificationsData>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  // Mutação para atualizar uma notificação (marcar como lida/não lida)
  const updateNotificationMutation = useMutation({
    mutationFn: async ({ notificationId, isRead }: { notificationId: string; isRead: boolean }) => {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId, is_read: isRead }),
      });
      if (!response.ok) {
        throw new Error('Falha ao atualizar notificação');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalida o cache para forçar a query a buscar os dados novamente
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutação para marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_as_read: true }),
      });
      if (!response.ok) {
        throw new Error('Falha ao marcar todas como lidas');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutação para deletar uma notificação
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications?notification_id=${notificationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Falha ao deletar notificação');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    // Dados da query
    notificationsData: data,
    isLoading,
    error,

    // Funções de mutação para serem chamadas na UI
    updateNotification: updateNotificationMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
  };
}
