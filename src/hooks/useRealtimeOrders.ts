import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ✅ CONFIGURAÇÕES OTIMIZADAS
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

// Parâmetros do listener que devem ser removidos na limpeza
const LISTENER_PARAMS = {
    event: '*',
    schema: 'public',
    table: 'orders'
} as const;

export function useRealtimeOrders() {
    const { realtimeChannel, connectionHealthy } = useSupabase();
    const queryClient = useQueryClient();
    const pollingIntervalRef = useRef<number>();

    const handleNewNotification = useCallback((payload: any) => {
        console.log('[RT-NOTIFICATIONS] ✅ Evento recebido:', payload);

        toast.info("Novo pedido recebido!", {
            description: "Um novo pedido foi registrado e a lista será atualizada.",
            action: {
                label: "Ver",
                onClick: () => { },
            },
        });

        // Invalidar queries em lote
        queryClient.invalidateQueries({
            queryKey: ['notifications']
        });
        queryClient.invalidateQueries({
            queryKey: ['orders']
        });
        queryClient.invalidateQueries({
            queryKey: ['orders-stats']
        });
    }, [queryClient]);

    // Efeito 1: Configurar listeners do realtime
    useEffect(() => {
        if (!realtimeChannel) {
            console.log('[RT-HOOK] Canal realtime não disponível ou em inicialização');
            return;
        }

        console.log('[RT-HOOK] ⚓️ Adicionando listeners realtime');

        const handler = (payload: any) => handleNewNotification(payload);

        // Apenas adiciona o listener. O Provider faz o subscribe.
        realtimeChannel
            .on('postgres_changes', LISTENER_PARAMS, handler);
            
        return () => {
            if (realtimeChannel) {
                console.log('[RT-HOOK] 🧹 Removendo listeners específicos');
                
                // Mantenha a sintaxe padrão. A nova lógica do Provider impede que o canal
                // seja desalocado prematuramente, o que era a causa do TypeError.
                try {
                    realtimeChannel.off('postgres_changes', LISTENER_PARAMS, handler);
                } catch(e) {
                    console.error('[RT-HOOK-CLEANUP] Falha ao remover listener (pode ser minificação):', e);
                }
            }
        };
    }, [realtimeChannel, handleNewNotification]);

    // Efeito 2: Polling Otimizado
    useEffect(() => {
        if (!connectionHealthy) {
            console.log('[FALLBACK] 🔄 Ativando polling (2min)');

            queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });

            pollingIntervalRef.current = window.setInterval(() => {
                console.log('[FALLBACK] 📡 Polling para atualizações (2min)');
                queryClient.invalidateQueries({ queryKey: ['orders', 'notifications', 'orders-stats'] });
            }, POLLING_INTERVAL);

            return () => {
                if (pollingIntervalRef.current) {
                    console.log('[FALLBACK] 🧹 Desativando polling');
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = undefined;
                }
            };
        } else {
            if (pollingIntervalRef.current) {
                console.log('[FALLBACK] ✅ Realtime recuperado - desativando polling');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = undefined;

                queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
            }
        }
    }, [connectionHealthy, queryClient]);

    return {
        connectionHealthy,
        isUsingFallback: !!pollingIntervalRef.current
    };
}
