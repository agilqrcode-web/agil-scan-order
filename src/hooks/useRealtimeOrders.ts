import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types';

// Tipagem específica para o evento de Pedido
type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderEvent = RealtimePostgresChangesPayload<{
    table: 'orders',
    schema: 'public',
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    old: Partial<OrderRow>,
    new: Partial<OrderRow>
}>;

// Função dummy para manipular o estado local/global
const processOrderEvent = (event: OrderEvent) => {
    switch (event.eventType) {
        case 'INSERT':
            console.log(`%c[RT-ORDERS] 🔔 Novo Pedido Recebido: ${event.new.id}`, 'color: #1a9c36;');
            break;
        case 'UPDATE':
            console.log(`%c[RT-ORDERS] 🔁 Pedido Atualizado: ${event.new.id} - Status: ${event.new.status}`, 'color: #9c731a;');
            break;
        case 'DELETE':
            console.log(`%c[RT-ORDERS] 🗑️ Pedido Deletado: ${event.old.id}`, 'color: #c90000;');
            break;
        default:
            console.warn('[RT-ORDERS] ❓ Evento desconhecido:', event.eventType);
    }
};

export const useRealtimeOrders = () => {
    const { supabaseClient, realtimeChannel, realtimeAuthCounter } = useSupabase();
    const [orders, setOrders] = useState<OrderRow[]>([]); 

    useEffect(() => {
        if (!realtimeChannel) {
            console.warn('[RT-HOOK] ⚠️ Canal Realtime não está pronto para inscrição.');
            return;
        }

        const channel = realtimeChannel;
        
        console.log(`[RT-HOOK] ⚓️ Adicionando listeners específicos para orders (Auth Counter: ${realtimeAuthCounter})`);

        const handleOrdersChange = (payload: OrderEvent) => {
            console.log(`%c[RT-ORDERS] 🔔 Evento de Pedido Recebido: ${payload.eventType}`, 'color: #3f51b5;');
            // Processa e atualiza o estado local/global
            processOrderEvent(payload);
        };

        // 1. Adiciona o Listener ESPECÍFICO
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrdersChange as any 
        );

        // 2. Cleanup Function
        return () => {
            console.log('[RT-HOOK] 🧹 Removendo listeners específicos para orders.');
            try {
                // A remoção explícita é a forma mais limpa de garantir que não fiquem listeners órfãos.
                // channel.off('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleOrdersChange as any);
            } catch (error) {
                // ... (Tratamento de erro se off falhar)
            }
        };

    // DEPENDÊNCIAS: Garante a reinscrição em cada troca de canal/autenticação
    }, [supabaseClient, realtimeChannel, realtimeAuthCounter]);

    return { orders };
};
