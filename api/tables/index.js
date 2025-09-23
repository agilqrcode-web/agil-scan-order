import { createClient } from '@supabase/supabase-js';
import { withAuth } from '../lib/withAuth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Handler para requisições autenticadas (POST, DELETE, e o novo GET)
async function authenticatedHandler(request, response, { supabase, user }) {
  switch (request.method) {
    case 'GET':
      // Lógica para buscar todos os dados da página de mesas para o usuário logado
      try {
        const { data: restaurantIdData, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
        if (restaurantIdError) throw restaurantIdError;
        const restaurantId = restaurantIdData as string;

        if (!restaurantId) {
          return response.status(404).json({ error: 'Restaurant not found for this user.' });
        }

        const [
          nameResult,
          countsResult,
          tablesResult,
          existingNumbersResult,
          menuResult
        ] = await Promise.all([
          supabase.rpc('get_restaurant_name_by_id', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_table_counts_for_restaurant', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_all_restaurant_tables', { p_restaurant_id: restaurantId }),
          supabase.rpc('get_existing_table_numbers_for_restaurant', { p_restaurant_id: restaurantId }),
          supabase.from('menus').select('id').eq('restaurant_id', restaurantId).eq('is_active', true).limit(1).single()
        ]);

        if (nameResult.error) throw nameResult.error;
        if (countsResult.error) throw countsResult.error;
        if (tablesResult.error) throw tablesResult.error;
        if (existingNumbersResult.error) throw existingNumbersResult.error;
        if (menuResult.error && menuResult.error.code !== 'PGRST116') throw menuResult.error;

        const responsePayload = {
          restaurantId,
          restaurantName: nameResult.data,
          activeMenuId: menuResult.data?.id || null,
          tableCounts: countsResult.data?.[0] ?? { total_tables: 0, available_tables: 0, occupied_tables: 0, cleaning_tables: 0 },
          tables: tablesResult.data || [],
          existingTableNumbers: existingNumbersResult.data || [],
        };

        return response.status(200).json(responsePayload);

      } catch (error) {
        console.error("[API/Tables] Server error during authenticated GET:", error);
        return response.status(500).json({ error: error.message });
      }

    case 'POST':
      {
        const { restaurant_id, table_number, qr_code_identifier } = request.body;
        if (!restaurant_id || !table_number || !qr_code_identifier) {
          return response.status(400).json({ error: 'Missing required fields' });
        }
        try {
          const { data, error } = await supabase.from('restaurant_tables').insert([{ restaurant_id, table_number, qr_code_identifier }]).select();
          if (error) throw error;
          return response.status(201).json(data[0]);
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      {
        const { table_id } = request.query;
        if (!table_id) {
          return response.status(400).json({ error: 'Missing table_id' });
        }
        try {
          const { error } = await supabase.from('restaurant_tables').delete().eq('id', table_id);
          if (error) throw error;
          return response.status(204).send();
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed for authenticated route' });
  }
}

// Handler público para requisições GET com qr_identifier
async function publicGetHandler(request, response) {
    const { qr_identifier } = request.query;
    if (!qr_identifier) {
      return response.status(400).json({ error: 'Missing qr_identifier parameter' });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data, error } = await supabase.from('restaurant_tables').select('id, table_number').eq('qr_code_identifier', qr_identifier).single();
      if (error) {
        if (error.code === 'PGRST116') { 
          return response.status(404).json({ error: 'Table not found' });
        }
        throw error;
      }
      return response.status(200).json(data);
    } catch (error) {
      return response.status(500).json({ error: error.message });
    }
}

// Roteador principal que decide entre a rota pública e a autenticada
export default async function handler(request, response) {
  if (request.method === 'GET') {
    // Se for um GET público para escanear QR code, usa o handler público
    if (request.query.qr_identifier) {
        return publicGetHandler(request, response);
    }
    // Se for um GET para o dashboard, usa o handler autenticado
    else {
        return withAuth(authenticatedHandler)(request, response);
    }
  } else {
    // Para todos os outros métodos (POST, DELETE), usa o middleware de autenticação
    return withAuth(authenticatedHandler)(request, response);
  }
}
