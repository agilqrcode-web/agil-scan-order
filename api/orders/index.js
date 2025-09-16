import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Função auxiliar para criar um cliente Supabase autenticado em nome do usuário
const createSupabaseClientForUser = (token) => {
  const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
};

// Função para criar um cliente Supabase com privilégios de administrador
const createSupabaseAdminClient = () => {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(request, response) {

  switch (request.method) {
    case 'POST':
      {
        // Para criar um pedido, usamos o cliente admin, pois é uma ação pública
        const supabaseAdmin = createSupabaseAdminClient();
        const { table_id, customer_name, observations, items } = request.body;

        if (!table_id || !customer_name || !items || !Array.isArray(items) || items.length === 0) {
          return response.status(400).json({ error: 'Missing required fields or invalid items array.' });
        }

        try {
          const { data: orderId, error } = await supabaseAdmin.rpc('create_order_with_items', {
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
        // Para ler pedidos, exigimos autenticação e agimos em nome do usuário
        const token = request.headers.authorization;
        if (!token) {
            return response.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        const supabaseForUser = createSupabaseClientForUser(token);
        const { orderId } = request.query;

        try {
          if (orderId) {
            const { data, error } = await supabaseForUser
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

          const { data: restaurantId, error: restaurantIdError } = await supabaseForUser.rpc('get_user_restaurant_id');
          if (restaurantIdError) throw restaurantIdError;

          if (!restaurantId) {
            return response.status(404).json({ error: 'No restaurant associated with this user.' });
          }

          const { data: orders, error: ordersError } = await supabaseForUser.rpc('get_orders_for_restaurant', { p_restaurant_id: restaurantId });
          if (ordersError) throw ordersError;

          console.log(`[API/Orders] SUCCESS: Fetched ${orders ? orders.length : 0} orders for restaurant ${restaurantId}.`);
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