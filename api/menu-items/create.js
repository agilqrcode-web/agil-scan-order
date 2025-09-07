import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { menu_id, category_id, name, description, price, image_url } = request.body;

  if (!menu_id || !name || !price) {
    return response.status(400).json({ error: 'Missing required fields: menu_id, name, price' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert([
        { menu_id, category_id, name, description, price, image_url }
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
