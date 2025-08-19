import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';

// Inicializa o cliente Supabase com a chave de serviço
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Pega os dados do corpo da requisição
    const { firstName, lastName, restaurantName } = req.body;
    if (!firstName || !lastName || !restaurantName) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // 2. Extrai e valida o token do Clerk para obter o ID do usuário
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header.' });
    }
    const token = authHeader.split(' ')[1];
    const claims = await clerkClient.verifyToken(token);
    const clerkUserId = claims.sub;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Invalid token or user ID not found.' });
    }

    // 3. Chama a função RPC 'complete_user_onboarding'
    const { error: rpcError } = await supabase.rpc('complete_user_onboarding', {
      p_user_id: clerkUserId,
      p_first_name: firstName,
      p_last_name: lastName,
      p_restaurant_name: restaurantName,
    });

    if (rpcError) {
      console.error('onboard-user: RPC complete_user_onboarding error:', rpcError);
      throw rpcError;
    }

    res.status(200).json({ message: 'Onboarding completed successfully.' });

  } catch (error) {
    console.error('onboard-user: Internal server error:', error);
    if (error.message?.includes('Token is expired') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};