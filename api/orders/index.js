import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (request.method) {
    case 'POST':
      {
        const { table_id, customer_name, observations, items } = request.body;

        if (!table_id || !customer_name || !items || !Array.isArray(items) || items.length === 0) {
          return response.status(400).json({ error: 'Missing required fields or invalid items array.' });
        }

        try {
          // Call the RPC function to create the order and its items
          const { data: orderId, error } = await supabase.rpc('create_order_with_items', {
            p_table_id: table_id,
            p_customer_name: customer_name,
            p_observations: observations, // observations can be null/undefined, so pass directly
            p_items: items
          });

          if (error) {
            console.error('[API/Orders] Supabase RPC error:', error);
            return response.status(500).json({ error: error.message });
          }

          return response.status(201).json({ orderId });

        } catch (error) {
          console.error('[API/Orders] Server error during POST request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      {
        // For GET requests, we need the restaurant_id.
        // This typically comes from the user's JWT.
        // For now, we'll assume the user is authenticated and we can get their restaurant_id via RPC.
        // In a real scenario, you'd parse the JWT directly here.
        try {
          const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');

          if (restaurantIdError) {
            console.error('[API/Orders] Error getting restaurant ID:', restaurantIdError);
            return response.status(401).json({ error: 'Unauthorized or no restaurant associated.' });
          }

          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
              *,
              restaurant_tables ( table_number ),
              order_items (
                *,
                menu_items ( name, price )
              )
            `)
            .eq('restaurant_tables.restaurant_id', restaurantId)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.error('[API/Orders] Supabase fetch orders error:', ordersError);
            return response.status(500).json({ error: ordersError.message });
          }

          return response.status(200).json(orders);

        } catch (error) {
          console.error('[API/Orders] Server error during GET request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
