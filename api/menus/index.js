import { withAuth } from '../lib/withAuth.js';

async function handler(request, response, { supabase, user }) {
  switch (request.method) {
    case 'POST':
      // Create Menu
      {
        // A lógica de POST não precisa do restaurant_id no body, pois podemos obtê-lo pelo usuário.
        const { name, is_active } = request.body;
        if (!name) {
          return response.status(400).json({ error: 'Missing required field: name' });
        }
        try {
          const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
          if (restaurantIdError || !restaurantId) throw new Error('Could not find a restaurant for the user.');

          const { data, error } = await supabase
            .from('menus')
            .insert([ { restaurant_id: restaurantId, name, is_active: is_active ?? true } ])
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

        // Se um ID for fornecido, busca todos os dados para o editor de cardápio
        if (id) {
          try {
            // 1. Pega o cardápio. A RLS na tabela 'menus' já garante que o usuário só pode acessar menus do seu restaurante.
            const { data: menu, error: menuError } = await supabase.from('menus').select('*').eq('id', id).single();
            if (menuError) throw menuError;
            if (!menu) return response.status(404).json({ error: 'Menu not found or access denied.' });

            // 2. Pega o restaurante associado. A RLS na tabela 'restaurants' será aplicada aqui.
            const { data: restaurant, error: restaurantError } = await supabase.from('restaurants').select('*').eq('id', menu.restaurant_id).single();
            if (restaurantError) throw restaurantError;
            if (!restaurant) return response.status(404).json({ error: 'Restaurant not found or access denied.' });

            // 3. Pega todas as categorias do restaurante
            const { data: categories, error: categoriesError } = await supabase.from('categories').select('*').eq('restaurant_id', menu.restaurant_id).order('position');
            if (categoriesError) throw categoriesError;

            // 4. Pega todos os itens do cardápio
            const { data: items, error: itemsError } = await supabase.from('menu_items').select('*').eq('menu_id', id);
            if (itemsError) throw itemsError;

            // 5. Monta a estrutura de dados aninhada que o frontend espera
            const categoriesWithItems = categories.map(category => ({
              ...category,
              items: items.filter(item => item.category_id === category.id)
            }));

            const payload = {
              menu: { id: menu.id, name: menu.name, banner_url: menu.banner_url, is_active: menu.is_active, restaurant_id: menu.restaurant_id },
              restaurant: restaurant, // Usando a busca explícita
              categories: categoriesWithItems,
            };
            
            return response.status(200).json(payload);

          } catch (error) {
            console.error("[API/Menus] Error fetching menu editor data:", error);
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