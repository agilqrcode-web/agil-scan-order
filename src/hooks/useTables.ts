
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useSupabase } from "@/contexts/SupabaseContext";
import { z } from "zod";

export type AddTableFormValues = {
  table_number: number;
};

export function useTables() {
  const { userId, getToken } = useAuth();
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

  // Effect 1: Fetch only the restaurant ID.
  useEffect(() => {
    const fetchRestaurantId = async () => {
      if (!userId || !supabase) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_user_restaurant_id');
        if (error) throw error;
        setRestaurantId(data as string);
      } catch (err) {
        console.error("Error fetching restaurant ID:", err);
        setError("Failed to load restaurant data.");
        setLoading(false); // Stop loading on error
      }
    };
    fetchRestaurantId();
  }, [userId, supabase]);

  // Effect 2: Fetch all dependent data once we have a valid restaurant ID.
  useEffect(() => {
    if (!restaurantId || !supabase) {
      // If loading hasn't been turned off and we have no restaurantId, it means the user might not have a restaurant.
      if(loading && !restaurantId) setLoading(false);
      return;
    }

    const fetchAllDependentData = async () => {
      setLoading(true);
      try {
        const [
          menuResult,
          nameResult,
          countsResult,
          tablesResult,
          existingNumbersResult
        ] = await Promise.all([
          supabase.from('menus').select('id').eq('restaurant_id', restaurantId).eq('is_active', true).limit(1).single(),
          supabase.rpc('get_restaurant_name_by_id', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_all_restaurant_tables', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_existing_table_numbers_for_restaurant', { p_restaurant_id: restaurantId })
        ]);

        if (menuResult.error && menuResult.error.code !== 'PGRST116') { // PGRST116 = no rows found, which is fine.
          console.error("Error fetching active menu:", menuResult.error);
        } else if (menuResult.data) {
          setActiveMenuId(menuResult.data.id);
        }

        if (nameResult.error) throw nameResult.error;
        setRestaurantName(nameResult.data as string);

        if (countsResult.error) throw countsResult.error;
        setTableCounts(countsResult.data?.[0] ?? { total_tables: 0, available_tables: 0, occupied_tables: 0, cleaning_tables: 0 });

        if (tablesResult.error) throw tablesResult.error;
        setTables(tablesResult.data || []);

        if (existingNumbersResult.error) throw existingNumbersResult.error;
        setExistingTableNumbers(existingNumbersResult.data as number[] || []);

      } catch (err) {
        console.error("Error fetching dependent table data:", err);
        setError("Failed to load table data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllDependentData();
  }, [restaurantId, supabase]);

  const refreshData = async () => {
      if (!restaurantId || !supabase) return;
      setLoading(true);
      try {
        const [
          countsResult,
          tablesResult,
          existingNumbersResult
        ] = await Promise.all([
          supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_all_restaurant_tables', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_existing_table_numbers_for_restaurant', { p_restaurant_id: restaurantId })
        ]);
        if (countsResult.error) throw countsResult.error;
        setTableCounts(countsResult.data?.[0] ?? { total_tables: 0, available_tables: 0, occupied_tables: 0, cleaning_tables: 0 });

        if (tablesResult.error) throw tablesResult.error;
        setTables(tablesResult.data || []);

        if (existingNumbersResult.error) throw existingNumbersResult.error;
        setExistingTableNumbers(existingNumbersResult.data as number[] || []);
      } catch (err) {
          console.error("Error refreshing table data:", err);
          setError("Failed to refresh table data.");
      } finally {
          setLoading(false);
      }
  };

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
    await refreshData();
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
    await refreshData();
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
