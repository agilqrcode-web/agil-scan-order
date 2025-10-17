import { useCallback, useEffect } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useRealtimeOrders() {
  const { realtimeChannel } = useSupabase();
  const queryClient = useQueryClient();

  const handleNewNotification = useCallback((payload: any) => {
    console.log('[RT-NOTIFICATIONS] New postgres_changes event received:', payload);
    toast.info("Novo pedido recebido!", {
      description: "Um novo pedido foi registrado e a lista será atualizada.",
      action: {
        label: "Ver",
        onClick: () => {},
      },
    });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  useEffect(() => {
    if (!realtimeChannel) {
      return;
    }

    console.log('[RT-HOOK] ⚓️ Anexando listeners de postgres_changes e iniciando inscrição.');

    const handler = (payload: any) => handleNewNotification(payload);

    // A inscrição só é chamada AQUI, depois que o listener .on() foi registrado.
    realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handler)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RT-HOOK] ✅ Inscrição para notificações de pedidos confirmada!`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[RT-HOOK] ‼️ Erro no canal de notificações:', err);
        }
      });

    // Cleanup: remove o listener e a inscrição quando o componente desmontar.
    return () => {
      if (realtimeChannel) {
        console.log('[RT-HOOK] 🧹 Limpando... Desinscrevendo e removendo listeners de notificações.');
        // O unsubscribe remove todos os listeners do canal automaticamente
        realtimeChannel.unsubscribe();
      }
    };
  }, [realtimeChannel, handleNewNotification]);
}
