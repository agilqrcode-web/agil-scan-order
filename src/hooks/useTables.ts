
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useSupabase } from "@/contexts/SupabaseContext";
import { z } from "zod";

export type AddTableFormValues = {
  table_number: number;
};

export function useTables() {
  const { userId, getToken } = useAuth(); // Obter getToken
  const supabase = useSupabase();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [tableCounts, setTableCounts] = useState({
    total_tables: 0,
    available_tables: 0,
    occupied_tables: 0,
    cleaning_tables: 0,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [existingTableNumbers, setExistingTableNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurantData = useCallback(async () => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: restaurantIdData, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
      if (restaurantIdError) throw restaurantIdError;
      const fetchedRestaurantId = restaurantIdData as string;
      setRestaurantId(fetchedRestaurantId);

      const { data: restaurantNameData, error: restaurantNameError } = await supabase.rpc('get_restaurant_name_by_id', { p_restaurant_id: fetchedRestaurantId });
      if (restaurantNameError) throw restaurantNameError;
      setRestaurantName(restaurantNameData as string);

      const { data: menuData, error: menuError } = await supabase.from('menus').select('id').eq('restaurant_id', fetchedRestaurantId).eq('is_active', true).limit(1).single();
      if (menuError && menuError.code !== 'PGRST116') {
        console.error("Error fetching active menu:", menuError);
      }
      if (menuData) {
        setActiveMenuId(menuData.id);
      }
    } catch (err) {
      console.error("Error fetching restaurant data:", err);
      setError("Failed to load restaurant data.");
    }
  }, [userId, supabase]);

  const fetchTableCounts = useCallback(async () => {
    if (!restaurantId || !supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId });
      if (error) throw error;
      setTableCounts(data && data.length > 0 ? data[0] : { total_tables: 0, available_tables: 0, occupied_tables: 0, cleaning_tables: 0 });
    } catch (err) {
      console.error("Error fetching table counts:", err);
      setError("Failed to load table counts.");
    }
  }, [restaurantId, supabase]);

  const fetchTables = useCallback(async () => {
    if (!restaurantId || !supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_all_restaurant_tables', { p_restaurant_id: restaurantId });
      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      console.error("Error fetching tables:", err);
      setError("Failed to load tables.");
    }
  }, [restaurantId, supabase]);

  const fetchExistingTableNumbers = useCallback(async () => {
    if (!restaurantId || !supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_existing_table_numbers_for_restaurant', { p_restaurant_id: restaurantId });
      if (error) throw error;
      setExistingTableNumbers(data as number[] || []);
    } catch (err) {
      console.error("Error fetching existing table numbers:", err);
    }
  }, [restaurantId, supabase]);

  useEffect(() => {
    fetchRestaurantData();
  }, [fetchRestaurantData]);

  useEffect(() => {
    if (restaurantId) {
      setLoading(true);
      Promise.all([
        fetchTableCounts(),
        fetchTables(),
        fetchExistingTableNumbers()
      ]).finally(() => setLoading(false));
    }
  }, [restaurantId, fetchTableCounts, fetchTables, fetchExistingTableNumbers]);

  const addTable = async (values: AddTableFormValues) => {
    if (!restaurantId || !getToken) {
      throw new Error("Restaurant ID or getToken not found. Cannot add table.");
    }

    const token = await getToken({ template: "agilqrcode" });

    const response = await fetch("/api/tables", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        table_number: values.table_number,
        qr_code_identifier: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to add table.");
    }

    // Refresh data
    await Promise.all([fetchTables(), fetchTableCounts(), fetchExistingTableNumbers()]);
  };

  const deleteTable = async (tableId: string) => {
    if (!getToken) {
      throw new Error("getToken not found. Cannot delete table.");
    }

    const token = await getToken({ template: "agilqrcode" });

    const response = await fetch(`/api/tables?table_id=${tableId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete table.");
    }
    
    // Refresh data
    await Promise.all([fetchTables(), fetchTableCounts(), fetchExistingTableNumbers()]);
  };

  return {
    restaurantId,
    restaurantName,
    activeMenuId,
    tableCounts,
    tables,
    existingTableNumbers,
    loading,
    error,
    addTable,
    deleteTable,
  };
}
