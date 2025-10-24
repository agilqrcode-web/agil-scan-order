// SupabaseContext.ts
import React, { createContext, useContext } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types'; // Certifique-se de que o caminho está correto

// 🆕 TIPO: Estrutura para os logs de evento Realtime
export type RealtimeLog = {
    timestamp: number;
    payload: any; // O payload exato do evento postgres_changes
}

// 🛑 INTERFACE CORRIGIDA: Reflete a estrutura real do Provider
export interface SupabaseContextType {
    // Tipagem com a Database é crucial para o cliente
    supabaseClient: SupabaseClient<Database> | null; 
    realtimeChannel: RealtimeChannel | null;
    connectionHealthy: boolean;
    realtimeAuthCounter: number;
    
    // Funções de controle que o Provider realmente expõe
    recreateSupabaseClient: (isHardReset?: boolean) => SupabaseClient<Database>;

    // 🆕 Novos campos para os logs
    realtimeEventLogs: RealtimeLog[];
    downloadRealtimeLogs: () => void;
}

// Valor padrão inicial para o contexto
const defaultContextValue: SupabaseContextType = {
    supabaseClient: null,
    realtimeChannel: null,
    connectionHealthy: false,
    realtimeAuthCounter: 0,
    // Implementações placeholder para evitar erros
    recreateSupabaseClient: () => { throw new Error('SupabaseClient not initialized'); },
    realtimeEventLogs: [],
    downloadRealtimeLogs: () => { console.warn('downloadRealtimeLogs called before context initialization'); },
};

// Criação e Exportação do Contexto
// O contexto NUNCA deve ser null se o provedor usa um valor padrão
export const SupabaseContext = createContext<SupabaseContextType>(defaultContextValue);

// Hook de conveniência
export const useSupabase = (): SupabaseContextType => {
    const ctx = useContext(SupabaseContext);
    // A verificação de null aqui é tecnicamente desnecessária se o valor padrão for bom,
    // mas é um bom padrão para garantir que o hook seja usado dentro do Provider.
    if (!ctx) throw new Error('useSupabase must be used within a SupabaseProvider');
    return ctx;
};
