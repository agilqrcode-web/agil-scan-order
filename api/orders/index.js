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
    case 'PUT':
      {
        const { orderId, newStatus } = request.body;

        if (!orderId || !newStatus) {
          return response.status(400).json({ error: 'Missing orderId or newStatus.' });
        }

        // Autenticação: Apenas usuários logados podem atualizar o status
        const token = request.headers.authorization;
        if (!token) {
            return response.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        const supabaseForUser = createSupabaseClientForUser(token);

        try {
          // Verificar se o usuário tem permissão para atualizar este pedido
          const { data: restaurantId, error: restaurantIdError } = await supabaseForUser.rpc('get_user_restaurant_id');
          if (restaurantIdError) throw restaurantIdError;

          if (!restaurantId) {
            return response.status(404).json({ error: 'No restaurant associated with this user.' });
          }

          // Verificar se o pedido existe e pertence ao restaurante do usuário
          const { data: order, error: orderError } = await supabaseForUser
            .from('orders')
            .select('id, restaurant_tables(restaurant_id)')
            .eq('id', orderId)
            .single();

          if (orderError || !order) {
            return response.status(404).json({ error: 'Order not found or not accessible.' });
          }

          if (order.restaurant_tables.restaurant_id !== restaurantId) {
            return response.status(403).json({ error: 'Forbidden: Order does not belong to your restaurant.' });
          }

          // Chamar a função RPC para atualizar o status
          const { error: rpcError } = await supabaseForUser.rpc('update_order_status', {
            p_order_id: orderId,
            p_new_status: newStatus
          });

          if (rpcError) {
            console.error('[API/Orders] Supabase RPC error during status update:', rpcError);
            return response.status(500).json({ error: rpcError.message });
          }

          console.log(`[API/Orders] SUCCESS: Order ${orderId} status updated to ${newStatus}.`);
          return response.status(200).json({ message: 'Order status updated successfully.' });

        } catch (error) {
          console.error('[API/Orders] Server error during PUT request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      {
        const { orderId } = request.query;

        if (!orderId) {
          return response.status(400).json({ error: 'Missing orderId parameter.' });
        }

        const token = request.headers.authorization;
        if (!token) {
            return response.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        const supabaseForUser = createSupabaseClientForUser(token);

        try {
          const { data: restaurantId, error: restaurantIdError } = await supabaseForUser.rpc('get_user_restaurant_id');
          if (restaurantIdError) throw restaurantIdError;

          if (!restaurantId) {
            return response.status(404).json({ error: 'No restaurant associated with this user.' });
          }

          const { data: order, error: orderError } = await supabaseForUser
            .from('orders')
            .select('id, restaurant_tables(restaurant_id)')
            .eq('id', orderId)
            .single();

          if (orderError || !order) {
            return response.status(404).json({ error: 'Order not found or not accessible.' });
          }

          if (order.restaurant_tables.restaurant_id !== restaurantId) {
            return response.status(403).json({ error: 'Forbidden: Order does not belong to your restaurant.' });
          }

          const { error: deleteError } = await supabaseForUser.from('orders').delete().eq('id', orderId);

          if (deleteError) {
            console.error('[API/Orders] Supabase error during deletion:', deleteError);
            return response.status(500).json({ error: deleteError.message });
          }

          console.log(`[API/Orders] SUCCESS: Order ${orderId} deleted successfully.`);
          return response.status(200).json({ message: 'Order deleted successfully.' });

        } catch (error) {
          console.error('[API/Orders] Server error during DELETE request:', error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'GET':
      {
        const { orderId, tableId } = request.query;

        if (orderId) {
            const supabaseAdmin = createSupabaseAdminClient();
            try {
                const { data, error } = await supabaseAdmin
                    .from('orders')
                    .select(`*,
                        restaurant_tables ( table_number, restaurant_id ),
                        order_items ( * , menu_items ( name, price ) )
                    `)
                    .eq('id', orderId)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') { return response.status(404).json({ error: 'Order not found' }); }
                    throw error;
                }
                
                console.log(`[API/Orders] SUCCESS: Publicly fetched single order ${orderId}.`);
                return response.status(200).json(data ? [data] : []);
            } catch (error) {
                console.error('[API/Orders] Server error during public GET request for single order:', error);
                return response.status(500).json({ error: error.message });
            }
        }

        if (tableId) {
            const supabaseAdmin = createSupabaseAdminClient();
            try {
                const { data, error } = await supabaseAdmin
                    .from('orders')
                    .select(`*,
                        restaurant_tables ( table_number, restaurant_id ),
                        order_items ( * , menu_items ( name, price ) )
                    `)
                    .eq('table_id', tableId)
                    .order('created_at', { ascending: true });

                if (error) { throw error; }

                console.log(`[API/Orders] SUCCESS: Publicly fetched ${data.length} orders for table ${tableId}.`);
                return response.status(200).json(data);
            } catch (error) {
                console.error('[API/Orders] Server error during public GET request for table orders:', error);
                return response.status(500).json({ error: error.message });
            }
        }

        const token = request.headers.authorization;
        if (!token) {
            return response.status(401).json({ error: 'Unauthorized: No token provided' });
        }
        const supabaseForUser = createSupabaseClientForUser(token);

        try {
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
            console.error('[API/Orders] Server error during private GET request:', error);
            return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
