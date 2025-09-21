import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cria um cliente Supabase escopado para o usuário com base no token JWT.
 * @param {string} token - O token JWT do usuário (sem o "Bearer ").
 * @returns O cliente Supabase autenticado.
 */
const createSupabaseClient = (token) => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

/**
 * Middleware de autenticação (Higher-Order Function) para proteger os endpoints da API.
 * @param {Function} handler - A função de handler do endpoint da API a ser protegida.
 * @returns {Function} Uma nova função de handler que primeiro executa a lógica de autenticação.
 */
export function withAuth(handler) {
  return async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Cria um cliente Supabase que age em nome do usuário.
      const supabase = createSupabaseClient(token);
      
      // Extrai o ID do usuário do token para referência futura, se necessário.
      // NOTA: A validação real do token é feita pelo próprio Supabase ao receber a primeira requisição.
      // Esta é uma decodificação simples para obter os dados do payload.
      const decodedPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const user = { id: decodedPayload.sub };

      // Injeta o cliente supabase e o usuário na requisição e chama o handler original.
      return handler(req, res, { supabase, user });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
  };
}
