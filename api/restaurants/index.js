import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Helper to create a user-specific client
const createSupabaseClientForUser = (token) => {
  const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
};

// Helper to get user ID from JWT, useful for ownership checks
const getUserIdFromToken = (token) => {
    try {
        const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        return payload.sub; // 'sub' is standard for subject/user ID in JWT
    } catch (error) {
        console.error("Error decoding JWT:", error);
        return null;
    }
}

export default async function handler(request, response) {
  const token = request.headers.authorization;

  // Most methods require authentication
  if (request.method !== 'GET' && !token) {
    return response.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const supabaseForUser = token ? createSupabaseClientForUser(token) : null;

  switch (request.method) {
    case 'GET':
      {
        // This can remain public or be secured depending on requirements
        // For now, keeping it as is, using service key for simplicity if needed, but should be user-scoped.
        const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { id } = request.query;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID' });
        }
        try {
          const { data, error } = await supabaseAdmin.from('restaurants').select('*').eq('id', id).single();
          if (error) throw error;
          if (!data) return response.status(404).json({ error: 'Restaurant not found' });
          return response.status(200).json(data);
        } catch (error) {
          return response.status(500).json({ error: error.message });
        }
      }

    case 'PUT':
      {
        const { id, ...updates } = request.body;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID for update' });
        }
        
        try {
            // Ownership check
            const { data: restaurant, error: fetchError } = await supabaseForUser.from('restaurants').select('owner_user_id').eq('id', id).single();
            if (fetchError || !restaurant) return response.status(404).json({ error: 'Restaurant not found.' });
            
            const userId = getUserIdFromToken(token);
            if (restaurant.owner_user_id !== userId) {
                return response.status(403).json({ error: 'Forbidden: You are not the owner of this restaurant.' });
            }

            // Proceed with update
            const { data, error } = await supabaseForUser.from('restaurants').update(updates).eq('id', id).select().single();
            if (error) throw error;
            
            return response.status(200).json(data);
        } catch (error) {
            return response.status(500).json({ error: error.message });
        }
      }

    case 'DELETE':
      {
        const { id } = request.query; // Changed from request.body to request.query
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID parameter.' });
        }

        try {
            // Ownership check
            const { data: restaurant, error: fetchError } = await supabaseForUser.from('restaurants').select('owner_user_id').eq('id', id).single();
            if (fetchError) {
                // If RLS prevents fetching, it could be a not-found or forbidden, treat as not found for security.
                return response.status(404).json({ error: 'Restaurant not found or you do not have access.' });
            }
            
            const userId = getUserIdFromToken(token);
            if (restaurant.owner_user_id !== userId) {
                return response.status(403).json({ error: 'Forbidden: You are not the owner of this restaurant.' });
            }

            // Proceed with deletion
            const { error: deleteError } = await supabaseForUser.from('restaurants').delete().eq('id', id);
            if (deleteError) throw deleteError;

            return response.status(204).send(); // Success, no content
        } catch (error) {
            return response.status(500).json({ error: error.message });
        }
      }

    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}
