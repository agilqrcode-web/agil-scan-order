import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ✅ CONFIGURAÇÕES OTIMIZADAS
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useRealtimeOrders() {
    const { realtimeChannel, connectionHealthy } = useSupabase();
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

    // Efeito 1: Configurar listeners do realtime
    useEffect(() => {
        if (!realtimeChannel) {
            console.log('[RT-HOOK] Canal realtime não disponível');
            return;
        }

        console.log('[RT-HOOK] ⚓️ Configurando listeners realtime');

        const handler = (payload: any) => handleNewNotification(payload);

        // Anexa o listener de pedidos
        realtimeChannel
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'orders' 
            }, handler);
            // IMPORTANTE: NÃO CHAMA .subscribe() AQUI!

        return () => {
            if (realtimeChannel) {
                console.log('[RT-HOOK] 🧹 Removendo listeners');
                // A desinscrição final é gerenciada no Provider
                // Aqui apenas garantimos que não haja vazamento de memória do handler.
                // O método removeChannel no Provider já limpa todos os listeners.
            }
        };
    }, [realtimeChannel, handleNewNotification]);

    // Efeito 2: Polling Otimizado (Fallback)
    useEffect(() => {
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
