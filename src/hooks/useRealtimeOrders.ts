// src/hooks/useRealtimeOrders.ts (Código COMPLETO e FINAL)

import { useEffect, useState } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// **NOTA:** Substitua 'any' pelo tipo real da sua linha da tabela 'orders'
type OrderRow = { id: number; customer_name: string; status: string; /* ... outros campos */ }; 

// Define o tipo para os dados de mudança (adapte conforme sua tabela)
type OrderPayload = RealtimePostgresChangesPayload<OrderRow>;

export const useRealtimeOrders = () => {
    // Inclui todas as informações do contexto para logs/debug
    const { realtimeChannel, realtimeAuthCounter, connectionHealthy, realtimeEventLogs, downloadRealtimeLogs } = useSupabase();
    
    const [lastOrderEvent, setLastOrderEvent] = useState<OrderPayload | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // 1. Condição de Bloqueio: Se o canal não está disponível (Provider ainda está inicializando/quebrando), 
        // apenas define loading e aguarda.
        if (!realtimeChannel) {
            setIsLoading(true);
            return;
        }

        // 2. Condição de Aguardar: Se a conexão está saudável, prosseguimos. Caso contrário, 
        // o Provider fará a reconexão. O hook espera.
        if (!connectionHealthy) {
             setIsLoading(true);
             return;
        }
        
        // --- HANDLER DE EVENTOS ---
        const handleOrderChanges = (payload: OrderPayload) => {
            console.log(`[RT-ORDERS] 🔔 Evento de Pedido Recebido: ${payload.eventType}`);
            setLastOrderEvent(payload);
        };
        
        console.log(`[RT-HOOK] ⚓️ Adicionando listeners específicos para orders (Auth Counter: ${realtimeAuthCounter})`);
        
        // 3. Adiciona o listener
        const listener = realtimeChannel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleOrderChanges
        );

        setIsLoading(false);

        // --- FUNÇÃO DE LIMPEZA ---
        return () => {
            console.log('[RT-HOOK] 🧹 Removendo listeners específicos para orders');
            
            // Usamos a referência 'listener' (que é o próprio canal) e verificamos a função 'off'
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
                 console.warn('[RT-HOOK-CLEANUP] ⚠️ Não foi possível remover listener: função .off ausente no canal.');
            }
        };
    // Re-roda sempre que o canal muda, a saúde muda, ou o contador de Auth muda (após refresh/swap)
    }, [realtimeChannel, connectionHealthy, realtimeAuthCounter]); 

    return { 
        lastOrderEvent,
        isLoading,
        isRealtimeConnected: connectionHealthy,
        authSwapCount: realtimeAuthCounter,
        capturedLogs: realtimeEventLogs, // Incluindo logs para debug no componente
        downloadLogs: downloadRealtimeLogs,
    };
};
