// useRealtimeOrders.ts

import { useEffect, useState } from 'react';
import { useSupabase } from './SupabaseContext'; // Ajuste o caminho conforme necessário
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define o tipo para os dados de mudança (adapte conforme sua tabela)
type OrderPayload = RealtimePostgresChangesPayload<{
    [key: string]: any; // Adapte para o tipo de dado de uma linha da tabela 'orders'
}>;

export const useRealtimeOrders = () => {
    const { realtimeChannel, realtimeAuthCounter, connectionHealthy } = useSupabase();
    const [lastOrderEvent, setLastOrderEvent] = useState<OrderPayload | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // Se o canal ou a conexão não estiver saudável, não tentamos adicionar listeners
        if (!realtimeChannel || !connectionHealthy) {
            setIsLoading(true);
            return;
        }

        // --- HANDLER DE EVENTOS ---
        const handleOrderChanges = (payload: OrderPayload) => {
            console.log(`[RT-ORDERS] 🔔 Evento de Pedido Recebido: ${payload.eventType}`);
            setLastOrderEvent(payload);
        };
        
        console.log('[RT-HOOK] ⚓️ Adicionando listeners específicos para orders');
        
        // Adiciona o listener para a tabela orders
        // O SupabaseProvider já inscreveu o canal; aqui só adicionamos o listener.
        realtimeChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrderChanges
        );

        setIsLoading(false);

        // --- FUNÇÃO DE LIMPEZA ---
        return () => {
            console.log('[RT-HOOK] 🧹 Removendo listeners específicos para orders');
            
            // 🛑 CORREÇÃO CRÍTICA PARA 'TypeError: e.off is not a function'
            // O objeto RealtimeChannel precisa estar presente E suportar o método 'off'
            // O 'e.off' falha quando o canal está sendo limpo/remontado de forma abrupta.
            
            if (realtimeChannel && typeof realtimeChannel.off === 'function') {
                try {
                    realtimeChannel.off(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'orders' },
                        handleOrderChanges
                    );
                    console.log('[RT-HOOK] ✅ Listeners de orders removidos com segurança.');
                } catch (error) {
                    // Logamos se houver falha, mas evitamos quebrar o componente
                    console.error('[RT-HOOK-CLEANUP] Falha ao remover listener de orders:', error);
                }
            } else {
                 console.warn('[RT-HOOK-CLEANUP] ⚠️ Não foi possível remover listener: canal ou função .off ausente.');
            }
        };
    // Adicionamos realtimeAuthCounter para re-rodar o hook APÓS um swap de canal bem-sucedido
    }, [realtimeChannel, connectionHealthy, realtimeAuthCounter]); 

    return { 
        lastOrderEvent,
        isLoading,
        realtimeAuthCounter, // Retorna para debug
        connectionHealthy // Retorna o status para o componente
    };
};
