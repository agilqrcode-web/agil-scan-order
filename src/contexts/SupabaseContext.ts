import React, { useContext } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface SupabaseContextType extends SupabaseClient | null {}

export const SupabaseContext = React.createContext<SupabaseContextType>(null);

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
};