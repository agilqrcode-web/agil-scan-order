import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react'; // NEW IMPORT

// Estrutura de dados esperada da nossa API
interface NotificationsData {
  stats: {
    total: number;
    unread: number;
    today: number;
  };
  notifications: any[]; // Você pode criar uma interface mais estrita para Notification aqui
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth(); // NEW: Get getToken from useAuth

  // Função para buscar os dados (agora interna para acessar getToken)
  const fetchNotifications = async (): Promise<NotificationsData> => {
    const token = await getToken(); // NEW: Get token
    const response = await fetch('/api/notifications', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Falha ao buscar notificações');
    }
    return response.json();
  };

  // Query para buscar os dados
  const { data, isLoading, error } = useQuery<NotificationsData>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  // Mutação para atualizar uma notificação (marcar como lida/não lida)
  const updateNotificationMutation = useMutation({
    mutationFn: async ({ notificationId, isRead }: { notificationId: string; isRead: boolean }) => {
      const token = await getToken(); // NEW: Get token
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ notification_id: notificationId, is_read: isRead }),
      });
      if (!response.ok) {
        throw new Error('Falha ao atualizar notificação');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutação para marcar todas como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken(); // NEW: Get token
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
      const token = await getToken(); // NEW: Get token
      const response = await fetch(`/api/notifications?notification_id=${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
    notificationsData: data,
    isLoading,
    error,
    updateNotification: updateNotificationMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
  };
}
