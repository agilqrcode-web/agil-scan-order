import { withAuth } from '../lib/withAuth.js';

async function handler(req, res, { supabase, user }) {
  try {
    // Primeiro, obtemos o ID do restaurante do usuário logado.
    const { data: restaurantId, error: restaurantIdError } = await supabase.rpc('get_user_restaurant_id');
    if (restaurantIdError) throw restaurantIdError;
    if (!restaurantId) return res.status(404).json({ error: 'Restaurante não encontrado para este usuário.' });

    // --- Lidar com requisições GET ---
    if (req.method === 'GET') {
      const { data, error } = await supabase.rpc('get_notifications_for_restaurant', { p_restaurant_id: restaurantId });
      if (error) throw error;
      return res.status(200).json(data);
    }

    // --- Lidar com requisições PUT ---
    if (req.method === 'PUT') {
      const { notification_id, is_read, mark_all_as_read } = req.body;

      // Marcar todas como lidas
      if (mark_all_as_read) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
        return res.status(200).json({ message: 'Todas as notificações foram marcadas como lidas.' });
      }

      // Marcar uma única notificação
      if (notification_id) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: is_read })
          .eq('id', notification_id)
          .eq('restaurant_id', restaurantId); // Segurança extra
        if (error) throw error;
        return res.status(200).json({ message: 'Notificação atualizada com sucesso.' });
      }

      return res.status(400).json({ error: 'Ação ou ID da notificação não fornecido.' });
    }

    // --- Lidar com requisições DELETE ---
    if (req.method === 'DELETE') {
      const { notification_id } = req.query;
      if (!notification_id) return res.status(400).json({ error: 'ID da notificação não fornecido.' });

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notification_id)
        .eq('restaurant_id', restaurantId); // Segurança extra

      if (error) throw error;
      return res.status(200).json({ message: 'Notificação deletada com sucesso.' });
    }

    // Se o método não for suportado
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Erro na API de notificações:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withAuth(handler);
