// src/contexts/SupabaseContext.ts
import React, { createContext, useContext } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types'; // Verifique se o caminho está correto

// =================================================================
// DEFINIÇÃO DE TIPOS
// =================================================================

/**
 * TIPO: Estrutura para capturar QUALQUER mensagem do socket (Enviada ou Recebida).
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
    } | any; 
}

/**
 * INTERFACE: Define a estrutura de dados e funções expostas pelo Provedor.
 */
export interface SupabaseContextType {
    supabaseClient: SupabaseClient<Database> | null; 
    realtimeChannel: RealtimeChannel | null;
    connectionHealthy: boolean;
    realtimeAuthCounter: number;
    
    recreateSupabaseClient: (isHardReset?: boolean) => SupabaseClient<Database>;

    // Logs RAW do Socket e função de download
    realtimeEventLogs: RealtimeLog[];
    downloadRealtimeLogs: () => void;
}

// =================================================================
// CRIAÇÃO DO CONTEXTO
// =================================================================

const defaultContextValue: SupabaseContextType = {
    supabaseClient: null,
    realtimeChannel: null,
    connectionHealthy: false,
    realtimeAuthCounter: 0,
    recreateSupabaseClient: () => { throw new Error('SupabaseClient not initialized'); },
    realtimeEventLogs: [],
    downloadRealtimeLogs: () => { console.warn('downloadRealtimeLogs called before context initialization'); },
};

export const SupabaseContext = createContext<SupabaseContextType>(defaultContextValue);

export const useSupabase = (): SupabaseContextType => {
    const ctx = useContext(SupabaseContext);
    if (!ctx) throw new Error('useSupabase must be used within a SupabaseProvider');
    return ctx;
};
