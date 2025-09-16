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
        const { orderId, restaurantId: queryRestaurantId } = request.query; // Get orderId and potentially restaurantId from query

        try {
          let query = supabase.from('orders').select(`
            *,
            restaurant_tables ( table_number, restaurant_id ),
            order_items (
              *,
              menu_items ( name, price )
            )
          `);

          if (orderId) {
            // If orderId is provided, fetch a single order
            query = query.eq('id', orderId).single(); // Use .single() for a single result
          } else {
            // If no orderId, fetch all orders for the restaurant
            // Get restaurantId from JWT (as before)
            const { data: authRestaurantId, error: authRestaurantIdError } = await supabase.rpc('get_user_restaurant_id');
            if (authRestaurantIdError) {
              console.error('[API/Orders] Error getting restaurant ID from JWT:', authRestaurantIdError);
              return response.status(401).json({ error: 'Unauthorized or no restaurant associated.' });
            }
            query = query.eq('restaurant_tables.restaurant_id', authRestaurantId).order('created_at', { ascending: false });
          }

          const { data, error } = await query;

          if (error) {
            if (error.code === 'PGRST116' && orderId) { // 'exact one row not found' for single order
              return response.status(404).json({ error: 'Order not found' });
            }
            console.error('[API/Orders] Supabase fetch orders error:', error);
            return response.status(500).json({ error: error.message });
          }

          // If fetching a single order, data is an object. If fetching multiple, it's an array.
          // Ensure consistent return type for single order fetch (array with one element)
          if (orderId && data) {
            return response.status(200).json([data]); // Wrap single object in array for consistency with frontend expectation
          } else if (orderId && !data) {
            return response.status(404).json({ error: 'Order not found' });
          }

          return response.status(200).json(data);

        } catch (error) {
          console.error('[API/Orders] Server error during GET request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
