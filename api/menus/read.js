import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id } = request.query; // Expecting ID as a query parameter

  if (!id) {
    return response.status(400).json({ error: 'Missing required query parameter: id' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('id', id)
      .single(); // Use .single() to get a single record

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
