import { createContext, useContext } from 'react';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types';

// =============================================================================
// ⚙️ TIPOS E INTERFACES
// =============================================================================

export interface RealtimeLog {
    timestamp: number;
    type: 'SENT' | 'RECEIVED' | 'LIFECYCLE';
    payload: any;
}

export interface SupabaseContextType {
    supabaseClient: SupabaseClient<Database>;
    realtimeChannel: RealtimeChannel | null;
    connectionHealthy: boolean;
    /**
     * Contador que incrementa a cada troca/re-autenticação bem-sucedida do canal Realtime.
     * Usado pelos hooks consumidores (ex: useRealtimeOrders) para saber quando se reincrever.
     */
    realtimeAuthCounter: number; 
    /**
     * Função para recriar o cliente Supabase e o WebSocket do zero.
     * @param isHardReset Se true, força o reset total.
     */
    recreateSupabaseClient: (isHardReset?: boolean) => SupabaseClient<Database>;
    realtimeEventLogs: RealtimeLog[];
    downloadRealtimeLogs: () => void;
}

// =============================================================================
// 📦 CONTEXTO
// =============================================================================

export const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function useSupabase(): SupabaseContextType {
    const context = useContext(SupabaseContext);
    if (context === undefined) {
        throw new Error('useSupabase must be used within a SupabaseProvider');
    }
    return context;
}
