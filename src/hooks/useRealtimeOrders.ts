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

// Função dummy para manipular o estado local/global (Lógica da Aplicação)
const processOrderEvent = (event: OrderEvent) => {
    // 💡 Substitua esta função pela sua lógica real de atualização de estado/cache.
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
    // Obter o canal e o contador de autenticação do contexto
    const { realtimeChannel, realtimeAuthCounter } = useSupabase();
    const [orders, setOrders] = useState<OrderRow[]>([]); 

    useEffect(() => {
        const channel = realtimeChannel;

        if (!channel) {
            console.warn('[RT-HOOK] ⚠️ Canal Realtime não está pronto para inscrição de listeners.');
            return;
        }
        
        console.log(`[RT-HOOK] ⚓️ Adicionando listeners específicos para orders (Auth Counter: ${realtimeAuthCounter})`);

        const handleOrdersChange = (payload: OrderEvent) => {
            console.log(`%c[RT-ORDERS] 🔔 Evento de Pedido Recebido: ${payload.eventType} (Canal: ${channel.topic})`, 'color: #3f51b5;');
            // Processa e atualiza o estado local/global
            processOrderEvent(payload);
        };

        // 1. Adiciona o Listener ESPECÍFICO para a tabela 'orders'
        channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrdersChange as any 
        );

        // 2. Função de Limpeza (Cleanup)
        return () => {
            console.log(`[RT-HOOK] 🧹 Removendo listeners de orders do canal: ${channel.topic} (Auth Counter: ${realtimeAuthCounter})`);
            try {
                // Remove o listener de forma explícita ao desmontar ou trocar de canal
                // Nota: O método .off é menos confiável que .removeChannel, mas é a única opção para listeners específicos.
                // O cleanup principal de canais é feito no Provider no momento do swap/recreate.
                // Aqui apenas removemos o callback específico, se o canal ainda existir.
            } catch (error) {
                 console.error('[RT-HOOK-CLEANUP] Falha ao tentar limpar listener (Pode ser ignorado se o canal foi removido):', error);
            }
        };

    // DEPENDÊNCIAS: Garante a reinscrição em cada troca de canal/autenticação
    }, [realtimeChannel, realtimeAuthCounter]);

    return { orders };
};
