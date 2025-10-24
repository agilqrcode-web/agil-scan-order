// src/contexts/SupabaseContext.tsx

import React, { createContext, useContext } from 'react';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/types';

// Tipo para o log RAW (mensagens do WebSocket)
export type RealtimeLog = {
    timestamp: number;
    type: 'SENT' | 'RECEIVED'; // Se a mensagem foi enviada pelo cliente ou recebida do servidor
    payload: any;
};

export type SupabaseContextType = {
    supabaseClient: SupabaseClient<Database>;
    realtimeChannel: RealtimeChannel | null;
    connectionHealthy: boolean;
    realtimeAuthCounter: number;
    
    // Funções de Gerenciamento
    recreateSupabaseClient: (isHardReset?: boolean) => SupabaseClient<Database>;
    
    // Ferramentas de Debug (Logs RAW)
    realtimeEventLogs: RealtimeLog[]; 
    downloadRealtimeLogs: () => void;
};

// Valor padrão do contexto
const defaultValue: SupabaseContextType = {
    supabaseClient: {} as SupabaseClient<Database>, 
    realtimeChannel: null,
    connectionHealthy: false,
    realtimeAuthCounter: 0,
    recreateSupabaseClient: () => ({} as SupabaseClient<Database>),
    realtimeEventLogs: [],
    downloadRealtimeLogs: () => console.warn('SupabaseProvider not mounted yet.'),
};

export const SupabaseContext = createContext<SupabaseContextType>(defaultValue);

export const useSupabase = () => {
    const context = useContext(SupabaseContext);
    if (!context) {
        throw new Error('useSupabase must be used within a SupabaseProvider');
    }
    return context;
};
