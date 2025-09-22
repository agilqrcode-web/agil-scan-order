import React, { useContext } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface SupabaseContextType extends SupabaseClient {}

export const SupabaseContext = React.createContext<SupabaseContextType>(null as any); // Usar 'as any' para o valor inicial, pois o contexto será preenchido com a instância real

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
};