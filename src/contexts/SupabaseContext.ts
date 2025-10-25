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
    supabaseClient: SupabaseClient<Database> | null;
    realtimeChannel: RealtimeChannel | null;
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
