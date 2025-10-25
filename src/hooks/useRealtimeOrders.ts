// src/hooks/useRealtimeOrders.ts
import { useEffect, useState } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import type { Database } from '../integrations/supabase/types';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderEvent = RealtimePostgresChangesPayload<{
    table: 'orders';
    schema: 'public';
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    old: Partial<OrderRow>;
    new: Partial<OrderRow>;
}>;

const processOrderEvent = (event: OrderEvent) => {
    switch (event.eventType) {
        case 'INSERT':
            console.log(`[RT-ORDERS] 🔔 Novo Pedido Recebido: ${event.new?.id}`);
            break;
        case 'UPDATE':
            console.log(`[RT-ORDERS] 🔁 Pedido Atualizado: ${event.new?.id} - Status: ${event.new?.status}`);
            break;
        case 'DELETE':
            console.log(`[RT-ORDERS] 🗑️ Pedido Deletado: ${event.old?.id}`);
            break;
        default:
            console.warn('[RT-ORDERS] ❓ Evento desconhecido:', event.eventType);
    }
};

export const useRealtimeOrders = () => {
    const { realtimeChannel, realtimeAuthCounter } = useSupabase();
    const [orders, setOrders] = useState<OrderRow[]>([]);

    useEffect(() => {
        if (!realtimeChannel) {
            console.warn('[RT-HOOK] ⚠️ Canal Realtime não está pronto para inscrição.');
            return;
        }

        const handler = (payload: OrderEvent) => {
            console.log('[RT-ORDERS] Evento recebido:', payload.eventType);
            processOrderEvent(payload);
            // Atualizações locais podem ser aplicadas aqui se desejar:
            // setOrders(prev => ...);
        };

        const params = { event: '*', schema: 'public', table: 'orders' } as const;

        // Adiciona listener
        realtimeChannel.on('postgres_changes', params, handler as any);

        // Cleanup garante remoção do listener específico
        return () => {
            try {
                realtimeChannel.off('postgres_changes', params, handler as any);
                console.log('[RT-HOOK] 🧹 Listener de orders removido com sucesso.');
            } catch (e) {
                console.warn('[RT-HOOK] ⚠️ Falha ao remover listener (ignorado):', e);
            }
        };
    }, [realtimeChannel, realtimeAuthCounter]);

    return { orders };
};
