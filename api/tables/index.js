import { createClient } from '@supabase/supabase-js';
import { withAuth } from '../lib/withAuth';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Handler principal que será protegido pelo middleware de autenticação
async function authenticatedHandler(request, response, { supabase }) {
  switch (request.method) {
    case 'POST':
      // Add Table
      {
        const { restaurant_id, table_number, qr_code_identifier } = request.body;
        console.log(`[API/Tables] Received POST request to add table for restaurant_id: ${restaurant_id}, table_number: ${table_number}`);
        if (!restaurant_id || !table_number || !qr_code_identifier) {
          console.error("[API/Tables] Missing required fields for POST request.");
          return response.status(400).json({ error: 'Missing required fields' });
        }
        try {
          const { data, error } = await supabase
            .from('restaurant_tables')
            .insert([
              { restaurant_id, table_number, qr_code_identifier }
            ])
            .select();
          if (error) {
            console.error("[API/Tables] Supabase insert error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Tables] Successfully added table with ID: ${data[0].id}`);
          return response.status(201).json(data[0]);
        } catch (error) {
          console.error("[API/Tables] Server error during POST request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'DELETE':
      // Delete Table
      {
        const { table_id } = request.query;
        console.log(`[API/Tables] Received DELETE request for table_id: ${table_id}`);
        if (!table_id) {
          console.error("[API/Tables] Missing table_id for DELETE request.");
          return response.status(400).json({ error: 'Missing table_id' });
        }
        try {
          const { error } = await supabase
            .from('restaurant_tables')
            .delete()
            .eq('id', table_id);
          if (error) {
            console.error("[API/Tables] Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Tables] Successfully deleted table with ID: ${table_id}`);
          return response.status(204).send();
        } catch (error) {
          console.error("[API/Tables] Server error during DELETE request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed for authenticated route' });
  }
}

// Handler público para requisições GET
async function publicGetHandler(request, response) {
    const { qr_identifier } = request.query;
    if (!qr_identifier) {
      return response.status(400).json({ error: 'Missing qr_identifier parameter' });
    }
    
    // Para esta rota pública, usamos a chave de serviço, pois o cliente não está logado.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, table_number')
        .eq('qr_code_identifier', qr_identifier)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Code for 'exact one row not found'
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
    return publicGetHandler(request, response);
  } else {
    // Para todos os outros métodos (POST, DELETE), usa o middleware de autenticação
    return withAuth(authenticatedHandler)(request, response);
  }
}
