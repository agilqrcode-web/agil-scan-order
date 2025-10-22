// useRealtimeOrders.ts (CÓDIGO CORRIGIDO)

import { useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/contexts/SupabaseContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ✅ CONFIGURAÇÕES OTIMIZADAS
const POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutos

export function useRealtimeOrders() {
    // 1. Dependência CRÍTICA: Incluí realtimeAuthCounter
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
        // Usamos o realtimeAuthCounter para garantir que o efeito re-execute 
        // sempre que o canal for trocado no Provider.
        if (!realtimeChannel) {
            console.log('[RT-HOOK] Canal realtime não disponível');
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

        // 3. Opcional: Adicionar um listener de status para monitoramento
        const statusHandler = (status: string) => {
            console.log(`[RT-HOOK] Status do canal 'orders' no hook: ${status}`);
        };
        listener.on('status', statusHandler);

        return () => {
            // 4. CLEANUP CRÍTICO: Quando o useEffect se re-executa (devido à mudança de canal/contador)
            // ou quando o componente desmonta, removemos explicitamente o canal antigo do cliente.
            // Isso garante que o listener seja limpo do objeto antigo, evitando vazamento.
            // No entanto, como o Provider JÁ está removendo o canal, a alternativa é usar unsubscribe().
            
            // OPTION 1: (Mais limpo, mas só funciona se o canal não for compartilhado)
            // Se este hook é o único lugar que precisa desse listener, podemos usar:
            // realtimeChannel.unsubscribe(handler)
            // Mas o Supabase não suporta remover APENAS um callback.

            // OPTION 2: Confiar no Provider (Recomendado)
            // Confiamos que o Provider fará a limpeza do objeto de canal antigo (client.removeChannel),
            // mas desanexamos o statusHandler que adicionamos aqui.

            console.log(`[RT-HOOK] 🧹 Limpando handlers do canal (Contador: ${realtimeAuthCounter})`);
            // O `listener` é o canal em si. Removemos o listener de status.
            listener.off('status', statusHandler); 
            
            // Se o seu `realtimeChannel` é compartilhado por múltiplos hooks, 
            // confiar no `client.removeChannel` do Provider é a abordagem correta.
        };
    // 5. Dependências corrigidas para garantir re-execução
    }, [realtimeChannel, handleNewNotification, realtimeAuthCounter]);

    // -------------------------------------------------------------------------
    // Efeito 2: Polling Otimizado (Fallback) - MANTIDO
    // -------------------------------------------------------------------------
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
