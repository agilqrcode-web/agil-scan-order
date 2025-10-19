// SupabaseContext.ts - atualizado
import { createContext, useContext } from 'react';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface SupabaseContextType {
  supabaseClient: SupabaseClient | null;
  realtimeChannel: RealtimeChannel | null;
  connectionHealthy: boolean;
  realtimeAuthCounter: number;
  requestReconnect: (maxAttempts?: number) => Promise<boolean>;
  setRealtimeAuth: (client: SupabaseClient) => Promise<void>;
  refreshConnection: () => Promise<void>;
}

export const SupabaseContext = createContext<SupabaseContextType | null>(null);

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === null) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
