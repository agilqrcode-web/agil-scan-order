import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { menuId } = req.query; // Vercel dynamic routes capture this

    if (!menuId) {
      return res.status(400).json({ error: 'Menu ID is required' });
    }

    try {
      const { data, error } = await supabase.rpc('get_public_menu_data', { p_menu_id: menuId });

      if (error) {
        console.error('Error fetching public menu data:', error.message);
        return res.status(500).json({ error: 'Failed to fetch public menu data' });
      }

      if (!data) {
        return res.status(404).json({ error: 'Menu not found' });
      }

      return res.status(200).json(data);
    } catch (error) {
      console.error('Server error fetching public menu data:', error.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
