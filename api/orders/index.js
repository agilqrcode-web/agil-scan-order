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
        const { orderId } = request.query;

        try {
          // Se um orderId for fornecido, busca um único pedido (para a página de status do cliente)
          if (orderId) {
            const { data, error } = await supabase
              .from('orders')
              .select(`
                *,
                restaurant_tables ( table_number, restaurant_id ),
                order_items ( * , menu_items ( name, price ) )
              `)
              .eq('id', orderId)
              .single();

            if (error) {
              if (error.code === 'PGRST116') { // 'exact one row not found'
                return response.status(404).json({ error: 'Order not found' });
              }
              throw error;
            }
            // A página de status do pedido espera um array, então envolvemos o objeto único em um array.
            return response.status(200).json(data ? [data] : []);
          }

          // Se nenhum orderId for fornecido, busca todos os pedidos para o restaurante do usuário (para o dashboard)
          const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
          if (restaurantIdError) throw restaurantIdError;

          const { data: orders, error: ordersError } = await supabase.rpc('get_orders_for_restaurant', { p_restaurant_id: restaurantId });
          if (ordersError) throw ordersError;

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