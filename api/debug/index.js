import { createClient } from '@supabase/supabase-js';

// Estas variáveis de ambiente precisam estar configuradas no seu projeto Vercel
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  try {
    // Pega o token de autorização do cabeçalho da requisição
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Nenhum cabeçalho de autorização' });
    }
    const token = authHeader.split(' ')[1]; // Bearer <token>

    // Cria um cliente Supabase autenticado com o token do usuário
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Chama a função de depuração que criamos
    const { data, error } = await supabase.rpc('debug_user_status');

    if (error) {
      console.error('Erro ao chamar RPC:', error);
      return res.status(500).json({ error: error.message });
    }

    // Retorna o resultado
    return res.status(200).json(data);

  } catch (e) {
    console.error('Erro inesperado no endpoint de debug:', e);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
}
