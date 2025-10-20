// SupabaseContext.ts
import React, { createContext, useContext } from 'react';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

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

export const useSupabase = (): SupabaseContextType => {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error('useSupabase must be used within a SupabaseProvider');
  return ctx;
};
