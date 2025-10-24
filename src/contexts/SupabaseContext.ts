// src/contexts/SupabaseContext.ts
import React, { createContext, useContext } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types'; // Verifique se o caminho está correto

// =================================================================
// DEFINIÇÃO DE TIPOS
// =================================================================

/**
 * TIPO: Estrutura para capturar QUALQUER mensagem do socket (Enviada ou Recebida).
 * Isso inclui eventos de protocolo (phx_join, phx_reply, heartbeat) e postgres_changes.
 */
export type RealtimeLog = {
    timestamp: number; // Quando a mensagem foi recebida/enviada pelo cliente
    type: 'SENT' | 'RECEIVED'; // Se a mensagem foi enviada pelo cliente ou recebida do servidor
    payload: {
        topic: string;
        event: string;
        ref: string;
        join_ref?: string;
        payload: any;
        status?: string;
    } | any; // 'any' para cobrir o payload bruto do socket
}

/**
 * INTERFACE: Define a estrutura de dados e funções expostas pelo Provedor.
 */
export interface SupabaseContextType {
    supabaseClient: SupabaseClient<Database> | null; 
    realtimeChannel: RealtimeChannel | null;
    connectionHealthy: boolean;
    realtimeAuthCounter: number;
    
    // Função principal de controle de conexão/autenticação
    recreateSupabaseClient: (isHardReset?: boolean) => SupabaseClient<Database>;

    // Logs RAW do Socket e função de download
    realtimeEventLogs: RealtimeLog[];
    downloadRealtimeLogs: () => void;
}

// =================================================================
// CRIAÇÃO DO CONTEXTO
// =================================================================

// Valor padrão inicial
const defaultContextValue: SupabaseContextType = {
    supabaseClient: null,
    realtimeChannel: null,
    connectionHealthy: false,
    realtimeAuthCounter: 0,
    recreateSupabaseClient: () => { throw new Error('SupabaseClient not initialized'); },
    realtimeEventLogs: [],
    downloadRealtimeLogs: () => { console.warn('downloadRealtimeLogs called before context initialization'); },
};

// Criação e Exportação do Contexto
export const SupabaseContext = createContext<SupabaseContextType>(defaultContextValue);

// Hook de conveniência
export const useSupabase = (): SupabaseContextType => {
    const ctx = useContext(SupabaseContext);
    if (!ctx) throw new Error('useSupabase must be used within a SupabaseProvider');
    return ctx;
};
