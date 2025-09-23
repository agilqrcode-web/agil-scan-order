import { withAuth } from '../lib/withAuth.js';

async function handler(request, response, { supabase, user }) {
  switch (request.method) {
    case 'GET':
      {
        const { id } = request.query;

        // Se um ID for fornecido, busca o restaurante específico.
        if (id) {
          try {
            const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
            if (error) throw error;
            if (!data) return response.status(404).json({ error: 'Restaurant not found' });
            
            if (data.owner_user_id !== user.id) {
              return response.status(403).json({ error: 'Forbidden: You do not have access to this restaurant.' });
            }

            return response.status(200).json(data);
          } catch (error) {
            return response.status(500).json({ error: error.message });
          }
        } 
        // Se nenhum ID for fornecido, busca a lista de restaurantes e os dados de resumo.
        else {
          try {
            const { data: restaurantData, error: restaurantError } = await supabase
              .from('restaurant_users')
              .select('restaurants ( id, name, logo_url )')
              .eq('user_id', user.id);

            if (restaurantError) throw restaurantError;
            
            const restaurants = restaurantData.map(item => item.restaurants).filter(Boolean);

            let summary = {
              tableCount: 0,
              dailyOrderCount: 0,
              dailyCustomerCount: 0,
            };

            if (restaurants.length > 0) {
              const mainRestaurantId = restaurants[0].id;
              const [tableCountResult, dailyOrderResult, dailyCustomerResult] = await Promise.all([
                supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: mainRestaurantId }),
                supabase.rpc('get_daily_order_count', { p_restaurant_id: mainRestaurantId }),
                supabase.rpc('get_daily_customer_count', { p_restaurant_id: mainRestaurantId })
              ]);

              if (tableCountResult.error) throw tableCountResult.error;
              if (dailyOrderResult.error) throw dailyOrderResult.error;
              if (dailyCustomerResult.error) throw dailyCustomerResult.error;

              summary.tableCount = tableCountResult.data?.[0]?.total_tables ?? 0;
              summary.dailyOrderCount = dailyOrderResult.data ?? 0;
              summary.dailyCustomerCount = dailyCustomerResult.data ?? 0;
            }
            
            return response.status(200).json({ restaurants, summary });

          } catch (error) {
            return response.status(500).json({ error: error.message });
          }
        }
      }

    case 'PUT':
      {
        const { id, ...updates } = request.body;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID for update' });
        }
        
        try {
            const { data: restaurant, error: fetchError } = await supabase.from('restaurants').select('owner_user_id').eq('id', id).single();
            if (fetchError || !restaurant) return response.status(404).json({ error: 'Restaurant not found.' });
            
            if (restaurant.owner_user_id !== user.id) {
                return response.status(403).json({ error: 'Forbidden: You are not the owner of this restaurant.' });
            }

            const { data, error } = await supabase.from('restaurants').update(updates).eq('id', id).select().single();
            if (error) throw error;
            
            return response.status(200).json(data);
        } catch (error) {
            return response.status(500).json({ error: error.message });
        }
      }

    case 'DELETE':
      {
        const { id } = request.query;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID parameter.' });
        }

        try {
            const { data: restaurant, error: fetchError } = await supabase.from('restaurants').select('owner_user_id').eq('id', id).single();
            if (fetchError || !restaurant) {
                return response.status(404).json({ error: 'Restaurant not found or you do not have access.' });
            }
            
            if (restaurant.owner_user_id !== user.id) {
                return response.status(403).json({ error: 'Forbidden: You are not the owner of this restaurant.' });
            }

            const { error: deleteError } = await supabase.from('restaurants').delete().eq('id', id);
            if (deleteError) throw deleteError;

            return response.status(204).send();
        } catch (error) {
            return response.status(500).json({ error: error.message });
        }
      }

    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}

export default withAuth(handler);
