import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';

// Inicializa o cliente Supabase com a chave de serviço para acesso de admin
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
    // 1. Extrai e valida o token do Clerk
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

    // 2. Consulta o perfil diretamente usando o clerkUserId como chave primária
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', clerkUserId)
      .single();

    // Se o perfil não for encontrado (erro PGRST116), significa que o webhook ainda não rodou.
    // Neste caso, o onboarding definitivamente não está completo.
    if (error && error.code !== 'PGRST116') {
      console.error('check-profile: Error querying profile:', error);
      throw error;
    }

    // 3. Retorna o status de 'onboarding_completed'
    // Se o perfil não existir (profile é null), profileComplete será false.
    const profileComplete = profile?.onboarding_completed || false;
    
    res.status(200).json({ profileComplete });

  } catch (error) {
    console.error('check-profile: Internal server error:', error);
    // Trata erros comuns de token
    if (error.message?.includes('Token is expired') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};