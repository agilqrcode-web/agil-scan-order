// src/hooks/useRealtimeOrders.ts

import { useEffect, useState } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// **NOTA:** Adapte este tipo conforme sua tabela 'orders'
type OrderRow = { id: number; customer_name: string; status: string; /* ... outros campos */ }; 

// Define o tipo para os dados de mudança (payload do Realtime)
type OrderPayload = RealtimePostgresChangesPayload<OrderRow>;

export const useRealtimeOrders = () => {
    // Importa todos os dados do contexto, incluindo os logs para debug
    const { 
        realtimeChannel, 
        realtimeAuthCounter, 
        connectionHealthy,
        realtimeEventLogs,
        downloadRealtimeLogs 
    } = useSupabase();
    
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
        
        console.log(`[RT-HOOK] ⚓️ Adicionando listeners específicos para orders (Auth Counter: ${realtimeAuthCounter})`);
        
        // Adiciona o listener para a tabela orders
        const listener = realtimeChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrderChanges
        );

        setIsLoading(false);

        // --- FUNÇÃO DE LIMPEZA ---
        return () => {
            console.log('[RT-HOOK] 🧹 Removendo listeners específicos para orders');
            
            // Verificação de segurança (listener é uma referência ao próprio canal/objeto)
            if (listener && typeof listener.off === 'function') {
                try {
                    listener.off(
                        'postgres_changes',
                        { event: '*', schema: 'public', table: 'orders' },
                        handleOrderChanges
                    );
                    console.log('[RT-HOOK] ✅ Listeners de orders removidos com segurança.');
                } catch (error) {
                    console.error('[RT-HOOK-CLEANUP] Falha ao remover listener de orders:', error);
                }
            } else {
                 console.warn('[RT-HOOK-CLEANUP] ⚠️ Não foi possível remover listener: canal ou função .off ausente.');
            }
        };
    // Dependências: Garante que o hook re-roda após um swap de canal bem-sucedido
    }, [realtimeChannel, connectionHealthy, realtimeAuthCounter]); 

    return { 
        lastOrderEvent,
        isLoading,
        isRealtimeConnected: connectionHealthy,
        authSwapCount: realtimeAuthCounter, 
        // Retorna as ferramentas de Debug do contexto
        capturedLogs: realtimeEventLogs,
        downloadLogs: downloadRealtimeLogs,
    };
};
