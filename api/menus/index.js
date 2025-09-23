import { withAuth } from '../lib/withAuth.js';

async function handler(request, response, { supabase, user }) {
  switch (request.method) {
    case 'POST':
      // Create Menu
      {
        const { restaurant_id, name, is_active } = request.body;
        if (!restaurant_id || !name) {
          return response.status(400).json({ error: 'Missing required fields: restaurant_id, name' });
        }
        try {
          const { data, error } = await supabase
            .from('menus')
            .insert([ { restaurant_id, name, is_active: is_active ?? true } ])
            .select();
          if (error) throw error;
          return response.status(201).json(data[0]);
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }

    case 'GET':
      {
        const { id } = request.query;

        // Se um ID for fornecido, busca o cardápio e todos os seus dados aninhados para o editor
        if (id) {
          try {
            const { data, error } = await supabase.rpc('get_public_menu_data', { p_menu_id: id });
            if (error) throw error;
            if (!data) return response.status(404).json({ error: 'Menu not found' });
            return response.status(200).json(data);
          } catch (error) {
            return response.status(500).json({ error: error.message });
          }
        }
        // Se nenhum ID for fornecido, busca todos os dados para a página de listagem de cardápios
        else {
          try {
            const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
            if (restaurantIdError) throw restaurantIdError;
            if (!restaurantId) return response.status(404).json({ error: 'Restaurant not found for user' });

            const [menusResult, summaryResult] = await Promise.all([
              supabase.from('menus').select('*').eq('restaurant_id', restaurantId),
              supabase.rpc('get_restaurant_summary_counts', { p_restaurant_id: restaurantId })
            ]);

            if (menusResult.error) throw menusResult.error;
            if (summaryResult.error) throw summaryResult.error;

            const responsePayload = {
              menus: menusResult.data || [],
              summary: summaryResult.data?.[0] ?? { total_categories: 0, total_items: 0 },
            };

            return response.status(200).json(responsePayload);
          } catch (error) {
            return response.status(500).json({ error: error.message });
          }
        }
      }

    case 'PUT':
      // Update Menu
      {
        const { id, name, is_active, banner_url } = request.body;
        if (!id) {
          return response.status(400).json({ error: "Missing required field: id" });
        }
        const updateData = {};
        if (name) updateData.name = name;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (banner_url !== undefined) updateData.banner_url = banner_url;

        if (Object.keys(updateData).length === 0) {
          return response.status(400).json({ error: 'No update fields provided.' });
        }
        try {
          const { data, error } = await supabase.from('menus').update(updateData).eq('id', id).select();
          if (error) throw error;
          if (!data || data.length === 0) {
            return response.status(404).json({ error: 'Menu not found or no changes made' });
          }
          return response.status(200).json(data[0]);
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }

    case 'DELETE':
      // Delete Menu
      {
        const { menu_id } = request.body;
        if (!menu_id) {
          return response.status(400).json({ error: 'Missing required field: menu_id' });
        }
        try {
          const { error } = await supabase.rpc('delete_menu_and_cleanup_categories', { p_menu_id: menu_id });
          if (error) throw error;
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