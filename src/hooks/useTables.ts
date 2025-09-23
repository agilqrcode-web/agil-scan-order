
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { z } from "zod";

// Tipos de dados esperados da nossa nova API
export interface Table {
  id: string;
  table_number: number;
  qr_code_identifier: string;
  status: string;
}

export interface TableCounts {
  total_tables: number;
  available_tables: number;
  occupied_tables: number;
  cleaning_tables: number;
}

export interface TablesPageData {
  restaurantId: string;
  restaurantName: string;
  activeMenuId: string | null;
  tableCounts: TableCounts;
  tables: Table[];
  existingTableNumbers: number[];
}

export type AddTableFormValues = {
  table_number: number;
};

// O hook refatorado
export function useTables() {
  const { userId, getToken } = useAuth();
  const queryClient = useQueryClient();

  // Única query para buscar todos os dados da página de uma vez
  const fetchTablesPageData = async (): Promise<TablesPageData> => {
    const token = await getToken();
    const response = await fetch('/api/tables', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch tables page data');
    }
    return response.json();
  };

  const { data, isLoading, isError, error } = useQuery<TablesPageData, Error>({
    queryKey: ['tablesData', userId],
    queryFn: fetchTablesPageData,
    enabled: !!userId,
  });

  // Mutação para adicionar uma mesa
  const addTableMutation = useMutation({
    mutationFn: async (values: AddTableFormValues) => {
      if (!data?.restaurantId) {
        throw new Error("Restaurant ID not found. Cannot add table.");
      }
      const token = await getToken();
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          restaurant_id: data.restaurantId,
          table_number: values.table_number,
          qr_code_identifier: crypto.randomUUID(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add table.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablesData', userId] });
    },
  });

  // Mutação para excluir uma mesa
  const deleteTableMutation = useMutation({
    mutationFn: async (tableId: string) => {
      const token = await getToken();
      const response = await fetch(`/api/tables?table_id=${tableId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete table.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablesData', userId] });
    },
  });

  return {
    data,
    loading: isLoading,
    error: isError ? error.message : null,
    addTable: addTableMutation.mutateAsync,
    deleteTable: deleteTableMutation.mutateAsync,
  };
}
