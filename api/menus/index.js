import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (request.method) {
    case 'POST':
      // Create Menu
      {
        const { restaurant_id, name, is_active } = request.body;
        console.log(`[API/Menus] Received POST request to create menu for restaurant_id: ${restaurant_id}`);
        if (!restaurant_id || !name) {
          console.error("[API/Menus] Missing required fields for POST request.");
          return response.status(400).json({ error: 'Missing required fields: restaurant_id, name' });
        }
        try {
          const { data, error } = await supabase
            .from('menus')
            .insert([
              { restaurant_id, name, is_active: is_active ?? true }
            ])
            .select();
          if (error) {
            console.error("[API/Menus] Supabase insert error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Menus] Successfully created menu with ID: ${data[0].id}`);
          return response.status(201).json(data[0]);
        } catch (error) {
          console.error("[API/Menus] Server error during POST request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      // Read Menu
      {
        const { id } = request.query;
        console.log(`[API/Menus] Received GET request for menu ID: ${id}`);
        if (!id) {
          console.error("[API/Menus] Missing required query parameter: id for GET request.");
          return response.status(400).json({ error: 'Missing required query parameter: id' });
        }
        try {
          const { data, error } = await supabase
            .from('menus')
            .select('*')
            .eq('id', id)
            .single();
          if (error) {
            console.error("[API/Menus] Supabase fetch error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data) {
            console.log(`[API/Menus] Menu with ID ${id} not found.`);
            return response.status(404).json({ error: 'Menu not found' });
          }
          console.log(`[API/Menus] Successfully fetched menu with ID: ${id}`);
          return response.status(200).json(data);
        } catch (error) {
          console.error("[API/Menus] Server error during GET request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'PUT':
      // Update Menu
      {
        const { id, name, is_active, banner_url } = request.body;
        console.log(`[API/Menus] Received PUT request to update menu ID: ${id}`);
        if (!id) {
          console.error("[API/Menus] Missing required field 'id' for PUT request.");
          return response.status(400).json({ error: "Missing required field: id" });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (is_active !== undefined) updateData.is_active = is_active;
        // Allow banner_url to be explicitly set to null to remove it
        if (banner_url !== undefined) updateData.banner_url = banner_url;
        // Allow banner_url to be explicitly set to null to remove it
        if (banner_url !== undefined) updateData.banner_url = banner_url;


        if (Object.keys(updateData).length === 0) {
          return response.status(400).json({ error: 'No update fields provided.' });
        }

        try {
          const { data, error } = await supabase
            .from('menus')
            .update(updateData)
            .eq('id', id)
            .select();
          if (error) {
            console.error("[API/Menus] Supabase update error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data || data.length === 0) {
            console.log(`[API/Menus] Menu with ID ${id} not found or no changes made.`);
            return response.status(404).json({ error: 'Menu not found or no changes made' });
          }
          console.log(`[API/Menus] Successfully updated menu with ID: ${id}`);
          return response.status(200).json(data[0]);
        } catch (error) {
          console.error("[API/Menus] Server error during PUT request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      // Delete Menu
      {
        const { menu_id } = request.body;
        console.log(`[API/Menus] Received DELETE request for menu ID: ${menu_id}`);
        if (!menu_id) {
          console.error("[API/Menus] Missing required field: menu_id for DELETE request.");
          return response.status(400).json({ error: 'Missing required field: menu_id' });
        }
        try {
          const { error } = await supabase.rpc('delete_menu_and_cleanup_categories', { p_menu_id: menu_id });
          if (error) {
            console.error("[API/Menus] Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Menus] Successfully deleted menu with ID: ${menu_id}`);
          return response.status(204).send();
        } catch (error) {
          console.error("[API/Menus] Server error during DELETE request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
