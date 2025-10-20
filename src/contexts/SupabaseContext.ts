// SupabaseContext.ts - VERSÃO ATUALIZADA
import { createContext, useContext } from 'react';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface SupabaseContextType {
  supabaseClient: SupabaseClient | null;
  realtimeChannel: RealtimeChannel | null;
  connectionHealthy: boolean; // ✅ NOVO: Status da conexão realtime
  realtimeAuthCounter: number;
  requestReconnect: (maxAttempts?: number) => Promise<boolean>;
  setRealtimeAuth: (client: SupabaseClient) => Promise<void>;
  refreshConnection: () => Promise<void>; // ✅ NOVO: Função para reconexão manual
}

export const SupabaseContext = createContext<SupabaseContextType | null>(null);

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === null) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
