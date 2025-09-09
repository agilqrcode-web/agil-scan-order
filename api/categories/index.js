import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(request, response) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (request.method) {
    case 'POST':
      // Create Category
      {
        const { restaurant_id, name } = request.body;
        console.log(`[API/Categories] Received POST request to create category for restaurant_id: ${restaurant_id}`);
        if (!restaurant_id || !name) {
          console.error("[API/Categories] Missing required fields for POST request.");
          return response.status(400).json({ error: 'Missing required fields: restaurant_id, name' });
        }
        try {
          const { data, error } = await supabase
            .from('categories')
            .insert([
              { restaurant_id, name }
            ])
            .select();
          if (error) {
            console.error("[API/Categories] Supabase insert error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Categories] Successfully created category with ID: ${data[0].id}`);
          return response.status(201).json(data[0]);
        } catch (error) {
          console.error("[API/Categories] Server error during POST request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    case 'PUT':
      // Update Category or Batch Update Positions
      {
        const { id, name, categories: categoriesToUpdate } = request.body;

        if (categoriesToUpdate && Array.isArray(categoriesToUpdate)) {
          // Batch update for positions
          console.log(`[API/Categories] Received PUT request for batch update of category positions.`);
          try {
            const updatePromises = categoriesToUpdate.map(async (category) => {
              if (!category.id || category.position === undefined) {
                throw new Error('Category ID and position are required for batch update.');
              }
              return supabase
                .from('categories')
                .update({ position: category.position })
                .eq('id', category.id);
            });

            const results = await Promise.all(updatePromises);

            // Check for errors in individual updates
            const hasErrors = results.some(result => result.error);
            if (hasErrors) {
              const errorMessages = results.filter(result => result.error).map(result => result.error.message).join('; ');
              throw new Error(`Errors during batch update: ${errorMessages}`);
            }

            console.log(`[API/Categories] Successfully batch updated ${categoriesToUpdate.length} categories.`);
            return response.status(200).json({ message: 'Category positions updated successfully.' });

          } catch (error) {
            console.error("[API/Categories] Supabase batch update error:", error);
            return response.status(500).json({ error: error.message });
          }
        } else if (id && name) {
          // Original single category update
          console.log(`[API/Categories] Received PUT request to update category ID: ${id}`);
          try {
            const { data, error } = await supabase
              .from('categories')
              .update({ name })
              .eq('id', id)
              .select();
            if (error) {
              console.error("[API/Categories] Supabase update error:", error);
              return response.status(500).json({ error: error.message });
            }
            if (!data || data.length === 0) {
              console.log(`[API/Categories] Category with ID ${id} not found or no changes made.`);
              return response.status(404).json({ error: 'Category not found or no changes made' });
            }
            console.log(`[API/Categories] Successfully updated category with ID: ${id}`);
            return response.status(200).json(data[0]);
          } catch (error) {
            console.error("[API/Categories] Server error during PUT request:", error);
            return response.status(500).json({ error: error.message });
          }
        } else {
          console.error("[API/Categories] Invalid PUT request body.");
          return response.status(400).json({ error: 'Invalid request body for PUT. Expected single category update or batch position update.' });
        }
      }
    case 'DELETE':
      // Delete Category
      {
        const { id } = request.body;
        console.log(`[API/Categories] Received DELETE request for category ID: ${id}`);
        if (!id) {
          console.error("[API/Categories] Missing required field: id for DELETE request.");
          return response.status(400).json({ error: 'Missing required field: id' });
        }
        try {
          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);
          if (error) {
            console.error("[API/Categories] Supabase delete error:", error);
            return response.status(500).json({ error: error.message });
          }
          console.log(`[API/Categories] Successfully deleted category with ID: ${id}`);
          return response.status(204).send();
        } catch (error) {
          console.error("[API/Categories] Server error during DELETE request:", error);
          return response.status(500).json({ error: error.message });
        }
      }
    default:
      return response.status(405).json({ error: 'Method Not Allowed' });
  }
}