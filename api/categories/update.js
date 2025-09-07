import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  if (request.method !== 'PUT') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, name } = request.body;

  if (!id || !name) {
    return response.status(400).json({ error: 'Missing required fields: id, name' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      return response.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return response.status(404).json({ error: 'Category not found or no changes made' });
    }

    return response.status(200).json(data[0]);
  } catch (error) {
    console.error("Server error:", error);
    return response.status(500).json({ error: error.message });
  }
}
