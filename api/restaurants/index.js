import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (request.method) {
    case 'GET':
      // Fetch a single restaurant by ID
      {
        const { id } = request.query;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID' });
        }
        try {
          const { data, error } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', id)
            .single();

          if (error) {
            console.error("[API/Restaurants] Supabase fetch error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data) {
            return response.status(404).json({ error: 'Restaurant not found' });
          }
          return response.status(200).json(data);
        } catch (error) {
          console.error("[API/Restaurants] Server error during GET request:", error);
          return response.status(500).json({ error: error.message });
        }
      }

    case 'PUT':
      // Update restaurant data
      {
        const { id, ...updates } = request.body;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID for update' });
        }
        try {
          const { data, error } = await supabase
            .from('restaurants')
            .update(updates)
            .eq('id', id)
            .select(); // Return the updated row

          if (error) {
            console.error("[API/Restaurants] Supabase update error:", error);
            return response.status(500).json({ error: error.message });
          }
          if (!data || data.length === 0) {
            return response.status(404).json({ error: 'Restaurant not found or no changes made' });
          }
          return response.status(200).json(data[0]);
        } catch (error) {
          console.error("[API/Restaurants] Server error during PUT request:", error);
          return response.status(500).json({ error: error.message });
        }
      }

    case 'DELETE':
      // Delete a restaurant
      {
        const { id } = request.body;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID for delete' });
        }
        try {
          const { error } = await supabase
            .from('restaurants')
            .delete()
            .eq('id', id);

          if (error) {
            console.error("[API/Restaurants] Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          return response.status(204).send(); // No content on successful delete
        } catch (error) {
          console.error("[API/Restaurants] Server error during DELETE request:", error);
          return response.status(500).json({ error: error.message });
        }
      }

    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
