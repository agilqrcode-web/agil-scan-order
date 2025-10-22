// useRealtimeOrders.ts (CÓDIGO FINAL CORRIGIDO)

import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ✅ CONFIGURAÇÕES OTIMIZADAS
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useRealtimeOrders() {
    // 1. Dependência CRÍTICA: realtimeAuthCounter
    const { realtimeChannel, connectionHealthy, realtimeAuthCounter } = useSupabase();
    const queryClient = useQueryClient();
    const pollingIntervalRef = useRef<number>();

    const handleNewNotification = useCallback((payload: any) => {
        console.log('[RT-NOTIFICATIONS] ✅ Evento recebido:', payload);
        
        toast.info("Novo pedido recebido!", {
            description: "Um novo pedido foi registrado e a lista será atualizada.",
            action: { label: "Ver", onClick: () => {}, },
        });

        // Invalidações de queries
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
    }, [queryClient]);

    // -------------------------------------------------------------------------
    // Efeito 1: Configurar listeners do realtime (CORRIGIDO)
    // -------------------------------------------------------------------------
    useEffect(() => {
        // Este useEffect será re-executado sempre que o canal for trocado no Provider.
        // O `realtimeAuthCounter` é a chave da re-sincronização.
        if (!realtimeChannel) {
            // Este log é esperado na primeira renderização antes do canal estar pronto
            console.log('[RT-HOOK] Canal realtime não disponível ou em inicialização');
            return;
        }

        console.log(`[RT-HOOK] ⚓️ Configurando listeners realtime (Contador: ${realtimeAuthCounter})`);

        const handler = (payload: any) => handleNewNotification(payload);

        // 2. Anexa o listener de pedidos ao CANAL ATUAL
        const listener = realtimeChannel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, handler);

        // 3. Adicionar um listener de status (Opcional, mas útil para debug)
        const statusHandler = (status: string) => {
            console.log(`[RT-HOOK] Status do canal 'orders' no hook: ${status}`);
        };
        listener.on('status', statusHandler);

        return () => {
            // 4. CLEANUP CRÍTICO: Remove o statusHandler que adicionamos
            console.log(`[RT-HOOK] 🧹 Limpando status handler do canal (Contador: ${realtimeAuthCounter})`);
            
            // O `client.removeChannel(oldChannel)` no Provider cuidará de remover o canal antigo
            // e todos os seus `postgres_changes` listeners (incluindo o nosso `handler`).
            // Apenas removemos o nosso statusHandler extra para evitar vazamento.
            listener.off('status', statusHandler); 
        };
    // 5. Dependências CRÍTICAS para garantir re-execução
    }, [realtimeChannel, handleNewNotification, realtimeAuthCounter]);

    // -------------------------------------------------------------------------
    // Efeito 2: Polling Otimizado (Fallback) - MANTIDO
    // -------------------------------------------------------------------------
    useEffect(() => {
        // ... (Seu código para Fallback Polling é mantido e está correto) ...
        if (!connectionHealthy) {
            if (!pollingIntervalRef.current) {
                console.log('[FALLBACK] 🔄 Ativando polling (2min)');
                
                queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
                
                pollingIntervalRef.current = window.setInterval(() => {
                    console.log('[FALLBACK] 📡 Polling para atualizações (2min)');
                    queryClient.invalidateQueries({ queryKey: ['orders', 'notifications', 'orders-stats'] });
                }, POLLING_INTERVAL);
            }
        } else {
            if (pollingIntervalRef.current) {
                console.log('[FALLBACK] ✅ Realtime recuperado - desativando polling');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = undefined;
                
                queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
            }
        }
        
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = undefined;
            }
        };
    }, [connectionHealthy, queryClient]);


    return {
        connectionHealthy,
        isUsingFallback: !!pollingIntervalRef.current
    };
}
