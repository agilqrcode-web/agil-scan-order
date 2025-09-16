import { createClient } from '@supabase/supabase-js';
import { clerkClient, getAuth } from '@clerk/nextjs/server';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;

// Função auxiliar para criar um cliente Supabase autenticado em nome do usuário
const createSupabaseClient = (token) => {
  return createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

export default async function handler(request, response) {
  const auth = getAuth(request);
  const { getToken } = auth;

  if (!auth.userId) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  // Obter o token usando o template customizado do Supabase
  const supabaseToken = await getToken({ template: 'agilqrcode' });
  if (!supabaseToken) {
      return response.status(401).json({ error: 'Could not get Supabase token.' });
  }

  // Criar um cliente Supabase que age em nome do usuário
  const supabase = createSupabaseClient(supabaseToken);

  switch (request.method) {
    case 'POST':
      {
        const { table_id, customer_name, observations, items } = request.body;

        if (!table_id || !customer_name || !items || !Array.isArray(items) || items.length === 0) {
          return response.status(400).json({ error: 'Missing required fields or invalid items array.' });
        }

        try {
          const { data: orderId, error } = await supabase.rpc('create_order_with_items', {
            p_table_id: table_id,
            p_customer_name: customer_name,
            p_observations: observations,
            p_items: items
          });

          if (error) {
            console.error('[API/Orders] Supabase RPC error during creation:', error);
            return response.status(500).json({ error: error.message });
          }

          console.log(`[API/Orders] SUCCESS: Order ${orderId} created successfully.`);
          return response.status(201).json({ orderId });

        } catch (error) {
          console.error('[API/Orders] Server error during POST request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      {
        const { orderId } = request.query;

        try {
          if (orderId) {
            const { data, error } = await supabase
              .from('orders')
              .select(`*,
                restaurant_tables ( table_number, restaurant_id ),
                order_items ( * , menu_items ( name, price ) )
              `)
              .eq('id', orderId)
              .single();

            if (error) {
              if (error.code === 'PGRST116') {
                return response.status(404).json({ error: 'Order not found' });
              }
              throw error;
            }
            
            console.log(`[API/Orders] SUCCESS: Fetched single order ${orderId}.`);
            return response.status(200).json(data ? [data] : []);
          }

          const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
          if (restaurantIdError) throw restaurantIdError;

          if (!restaurantId) {
            console.error('[API/Orders] Could not find a restaurant ID for the authenticated user.');
            return response.status(404).json({ error: 'No restaurant associated with this user.' });
          }

          const { data: orders, error: ordersError } = await supabase.rpc('get_orders_for_restaurant', { p_restaurant_id: restaurantId });
          if (ordersError) throw ordersError;

          console.log(`[API/Orders] SUCCESS: Fetched ${orders.length} orders for restaurant ${restaurantId}.`);
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