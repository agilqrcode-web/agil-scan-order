import { withAuth } from '../lib/withAuth.js';

async function handler(request, response, { supabase, user }) {
  switch (request.method) {
    case 'GET':
      {
        const { id } = request.query;
        if (!id) {
          return response.status(400).json({ error: 'Missing restaurant ID' });
        }
        try {
          const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
          if (error) throw error;
          if (!data) return response.status(404).json({ error: 'Restaurant not found' });
          
          // RLS policy should handle ownership, but an explicit check is safer.
          if (data.owner_user_id !== user.id) {
            return response.status(403).json({ error: 'Forbidden: You do not have access to this restaurant.' });
          }

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

