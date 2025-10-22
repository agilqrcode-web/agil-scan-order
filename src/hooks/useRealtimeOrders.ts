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
    const lastNotificationRef = useRef<number>(Date.now());

    const handleNewNotification = useCallback((payload: any) => {
        console.log('[RT-NOTIFICATIONS] ✅ Evento recebido:', payload);
        lastNotificationRef.current = Date.now();

        toast.info("Novo pedido recebido!", {
            description: "Um novo pedido foi registrado e a lista será atualizada.",
            action: {
                label: "Ver",
                onClick: () => { },
            },
        });

        // Invalidar queries em lote para reduzir requests
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

        // Apenas adiciona o listener. A inscrição (subscribe) é feita no Provider.
        realtimeChannel
            .on('postgres_changes', LISTENER_PARAMS, handler);
            
        return () => {
            if (realtimeChannel) {
                console.log('[RT-HOOK] 🧹 Removendo listeners específicos');
                // Remove APENAS o listener, não o canal (unsubscribe)
                realtimeChannel.off('postgres_changes', LISTENER_PARAMS, handler);
            }
        };
    }, [realtimeChannel, handleNewNotification]);

    // ✅ Efeito 2: Polling Otimizado (Lógica inalterada, pois já estava boa)
    useEffect(() => {
        if (!connectionHealthy) {
            console.log('[FALLBACK] 🔄 Ativando polling (2min)');

            // Polling imediato
            queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });

            // ✅ Polling reduzido para 2 minutos
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
            // Conexão saudável - desativar polling
            if (pollingIntervalRef.current) {
                console.log('[FALLBACK] ✅ Realtime recuperado - desativando polling');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = undefined;

                // Forçar atualização ao voltar para realtime
                queryClient.invalidateQueries({ queryKey: ['orders', 'notifications'] });
            }
        }
    }, [connectionHealthy, queryClient]);

    return {
        connectionHealthy,
        isUsingFallback: !!pollingIntervalRef.current
    };
}
