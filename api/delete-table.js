import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for backend operations

export default async function handler(request, response) {
  if (request.method !== 'DELETE') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { table_id } = request.query; // Use request.query for DELETE requests with ID in URL

  if (!table_id) {
    return response.status(400).json({ error: 'Missing table_id' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', table_id);

    if (error) {
      console.error("Supabase delete error:", error);
      return response.status(500).json({ error: error.message });
    }

    return response.status(204).send(); // No Content
  } catch (error) {
    console.error("Server error:", error);
    return response.status(500).json({ error: error.message });
  }
}