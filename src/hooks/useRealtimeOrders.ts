// src/hooks/useRealtimeOrders.ts

import { useEffect, useState } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Importa a interface Order principal
import { Order } from '@/types/order'; 

// 🚨 DEFINIÇÃO DE TIPO: 
// O Realtime payload (RealtimePostgresChangesPayload) só contém os campos da tabela 'orders',
// não as relações (restaurant_tables, order_items). 
// Por isso, definimos OrderRow extraindo os campos básicos da sua interface Order.

// Usa 'Omit' para remover as relações do tipo que o Realtime Payload realmente contém.
type OrderRow = Omit<Order, 'restaurant_tables' | 'order_items'> & {
    // Corrige a nullable/presença de campos de acordo com a tabela SQL, 
    // mesmo que sua interface Order os tenha como required.
    // O Realtime Payload SEMPRE terá estas chaves.
    table_id: string | null; // Ajustado para ser nullable, pois é uma FK
    customer_name: string | null;
    total_amount: number | null;
    updated_at: string | null; // Adicionando o campo 'updated_at' da sua tabela SQL
};

type OrderPayload = RealtimePostgresChangesPayload<OrderRow>;

export const useRealtimeOrders = () => {
    const { 
        realtimeChannel, 
        realtimeAuthCounter, 
        connectionHealthy,
        realtimeEventLogs,
        downloadLogs 
    } = useSupabase();
    
    // O estado agora usa a tipagem do Payload
    const [lastOrderEvent, setLastOrderEvent] = useState<OrderPayload | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!realtimeChannel || !connectionHealthy) {
            setIsLoading(true);
            return;
        }

        const handleOrderChanges = (payload: OrderPayload) => {
            console.log(`[RT-ORDERS] 🔔 Evento de Pedido Recebido: ${payload.eventType}`);
            
            // O payload.new e payload.old terão o tipo OrderRow (sem as relações)
            console.log("Dados da Nova Linha (New):", payload.new); 
            
            setLastOrderEvent(payload);
        };
        
        console.log(`[RT-HOOK] ⚓️ Adicionando listeners específicos para orders (Auth Counter: ${realtimeAuthCounter})`);
        
        const listener = realtimeChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrderChanges
        );

        setIsLoading(false);

        // --- FUNÇÃO DE LIMPEZA ---
        return () => {
            console.log('[RT-HOOK] 🧹 Removendo listeners específicos para orders');
            
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
    }, [realtimeChannel, connectionHealthy, realtimeAuthCounter]); 

    return { 
        lastOrderEvent,
        isLoading,
        isRealtimeConnected: connectionHealthy,
        authSwapCount: realtimeAuthCounter, 
        capturedLogs: realtimeEventLogs,
        downloadLogs: downloadLogs,
    };
};
