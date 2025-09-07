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
        if (!restaurant_id || !name) {
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
            console.error("Supabase insert error:", error);
            return response.status(500).json({ error: error.message });
          }
          return response.status(201).json(data[0]);
        } catch (error) {
          console.error("Server error:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      // Read Menu
      {
        const { id } = request.query;
        if (!id) {
          return response.status(400).json({ error: 'Missing required query parameter: id' });
        }
        try {
          const { data, error } = await supabase
            .from('menus')
            .select('*')
            .eq('id', id)
            .single();
          if (error) {
            console.error("Supabase fetch error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data) {
            return response.status(404).json({ error: 'Menu not found' });
          }
          return response.status(200).json(data);
        } catch (error) {
          console.error("Server error:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'PUT':
      // Update Menu
      {
        const { id, name, is_active } = request.body;
        if (!id || !name) {
          return response.status(400).json({ error: 'Missing required fields: id, name' });
        }
        try {
          const { data, error } = await supabase
            .from('menus')
            .update({ name, is_active })
            .eq('id', id)
            .select();
          if (error) {
            console.error("Supabase update error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data || data.length === 0) {
            return response.status(404).json({ error: 'Menu not found or no changes made' });
          }
          return response.status(200).json(data[0]);
        } catch (error) {
          console.error("Server error:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      // Delete Menu
      {
        const { menu_id } = request.body;
        if (!menu_id) {
          return response.status(400).json({ error: 'Missing required field: menu_id' });
        }
        try {
          const { error } = await supabase
            .from('menus')
            .delete()
            .eq('id', menu_id);
          if (error) {
            console.error("Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          return response.status(204).send();
        } catch (error) {
          console.error("Server error:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
