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
        console.log(`[API/Tables] Received POST request to add table for restaurant_id: ${restaurant_id}, table_number: ${table_number}`);
        if (!restaurant_id || !table_number || !qr_code_identifier) {
          console.error("[API/Tables] Missing required fields for POST request.");
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
            console.error("[API/Tables] Supabase insert error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Tables] Successfully added table with ID: ${data[0].id}`);
          return response.status(201).json(data[0]);
        } catch (error) {
          console.error("[API/Tables] Server error during POST request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      // Delete Table
      {
        const { table_id } = request.query;
        console.log(`[API/Tables] Received DELETE request for table_id: ${table_id}`);
        if (!table_id) {
          console.error("[API/Tables] Missing table_id for DELETE request.");
          return response.status(400).json({ error: 'Missing table_id' });
        }
        try {
          const { error } = await supabase
            .from('restaurant_tables')
            .delete()
            .eq('id', table_id);
          if (error) {
            console.error("[API/Tables] Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Tables] Successfully deleted table with ID: ${table_id}`);
          return response.status(204).send();
        } catch (error) {
          console.error("[API/Tables] Server error during DELETE request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      // Get table by QR identifier
      {
        const { qr_identifier } = request.query;
        if (!qr_identifier) {
          return response.status(400).json({ error: 'Missing qr_identifier parameter' });
        }
        try {
          const { data, error } = await supabase
            .from('restaurant_tables')
            .select('table_number')
            .eq('qr_code_identifier', qr_identifier)
            .single();

          if (error) {
            if (error.code === 'PGRST116') { // Code for 'exact one row not found'
              return response.status(404).json({ error: 'Table not found' });
            }
            throw error;
          }
          return response.status(200).json(data);
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
