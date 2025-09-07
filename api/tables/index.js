import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (request.method) {
    case 'POST':
      // Add Table
      {
        const { restaurant_id, table_number, qr_code_identifier } = request.body;
        if (!restaurant_id || !table_number || !qr_code_identifier) {
          return response.status(400).json({ error: 'Missing required fields' });
        }
        try {
          const { data, error } = await supabase
            .from('restaurant_tables')
            .insert([
              { restaurant_id, table_number, qr_code_identifier }
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
    case 'DELETE':
      // Delete Table
      {
        const { table_id } = request.query;
        if (!table_id) {
          return response.status(400).json({ error: 'Missing table_id' });
        }
        try {
          const { error } = await supabase
            .from('restaurant_tables')
            .delete()
            .eq('id', table_id);
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
