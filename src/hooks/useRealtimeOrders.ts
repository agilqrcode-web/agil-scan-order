import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/contexts/SupabaseContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types';
import { toast } from 'sonner';

// Tipagem específica para o evento de Pedido
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderEvent = RealtimePostgresChangesPayload<OrderRow>;

/**
 * Hook customizado para escutar eventos de novos pedidos em tempo real.
 * 
 * Este hook implementa o "Princípio Arquitetural #7":
 * 1. Obtém o canal Realtime do contexto.
 * 2. Registra um listener para eventos de INSERT na tabela 'orders'.
 * 3. **Após registrar o listener**, se inscreve no canal com `subscribe()`.
 * 4. A única responsabilidade do listener é invalidar a query de notificações, 
 *    delegando a busca de dados ao React Query (Princípio #6).
 * 5. Na desmontagem, se desinscreve do canal com `unsubscribe()`.
 */
export const useRealtimeOrders = () => {
    const { realtimeChannel } = useSupabase();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!realtimeChannel) {
            console.warn('[RT-HOOK] ⚠️ Canal Realtime ainda não disponível.');
            return;
        }

        console.log(`[RT-HOOK] ⚓️ Preparando para escutar eventos no canal: ${realtimeChannel.topic}`);

        const handleNewOrder = (payload: OrderEvent) => {
            console.log('%c[RT-HOOK] 🔔 Novo Pedido Recebido! Payload:', 'color: #1a9c36; font-weight: bold;', payload);
            
            // Dispara um toast para notificar o usuário visualmente
            toast.success('Novo pedido recebido!', {
                description: `Um novo pedido foi registrado e adicionado à sua lista.`,
                action: {
                    label: 'Ver Pedidos',
                    onClick: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
                },
            });

            // Invalida a query de notificações para forçar um refetch.
            // Esta é a única responsabilidade do hook, conforme o Princípio #6.
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };

        // 1. Registra o listener de eventos ANTES de se inscrever.
        const listener = realtimeChannel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders' },
            handleNewOrder as any
        );

        // 2. Se inscreve no canal APÓS registrar o listener.
        realtimeChannel.subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`%c[RT-HOOK] ✅ Inscrito com sucesso no canal: ${realtimeChannel.topic}`, 'color: #1a9c36; font-weight: bold;');
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`%c[RT-HOOK] ❌ Falha na inscrição do canal: ${realtimeChannel.topic}`, 'color: #e53935; font-weight: bold;', err);
            } else {
                console.log(`[RT-HOOK] ℹ️ Status do canal: ${status}`);
            }
        });

        // 3. Função de Limpeza (Cleanup)
        return () => {
            if (realtimeChannel) {
                console.log(`[RT-HOOK] 🧹 Desinscrevendo do canal: ${realtimeChannel.topic}`);
                realtimeChannel.unsubscribe();
                // Opcional: remover o listener específico se a instância do canal for persistir
                // realtimeChannel.off('postgres_changes', listener);
            }
        };

    // A dependência é apenas o objeto do canal. O hook re-executará se o canal for recriado.
    }, [realtimeChannel, queryClient]);
};
