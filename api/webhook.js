import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';

// Desabilita o bodyParser padrão do Next.js para processar o raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return res.status(500).send('Internal Server Error');
  }

  // Obter os cabeçalhos de verificação do Svix
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing Svix headers for webhook verification');
    return res.status(400).send('Missing Svix headers');
  }

  // Ler o corpo da requisição
  const buffers = [];
  for await (const chunk of req) {
    buffers.push(chunk);
  }
  const rawBody = Buffer.concat(buffers).toString();

  const wh = new Webhook(WEBHOOK_SECRET);
  let event;

  try {
    event = wh.verify(rawBody, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).send('Webhook verification failed');
  }

  const eventType = event.type;
  const { id, first_name, last_name } = event.data;

  try {
    switch (eventType) {
      case 'user.created':
        console.log(`Received user.created event for Clerk User ID: ${id}`);
        const { error: createError } = await supabase.from('profiles').insert({
          id: id, // Chave primária agora é o Clerk User ID
          first_name: first_name,
          last_name: last_name,
          onboarding_completed: false, // Novo usuário precisa completar o onboarding
        });

        if (createError) {
          console.error('Supabase insert error on user.created:', createError);
          throw createError;
        }
        console.log(`Profile created for Clerk User ID: ${id}`);
        break;

      case 'user.updated':
        console.log(`Received user.updated event for Clerk User ID: ${id}`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: first_name,
            last_name: last_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          console.error('Supabase update error on user.updated:', updateError);
          throw updateError;
        }
        console.log(`Profile updated for Clerk User ID: ${id}`);
        break;

      case 'user.deleted':
        console.log(`Received user.deleted event for Clerk User ID: ${id}`);
        // O ID aqui pode ser de um objeto que não tem todos os dados, então usamos o ID do evento.
        const clerkIdToDelete = event.data.id;
        if (!clerkIdToDelete) {
             console.error('No Clerk User ID found in user.deleted event payload.');
             return res.status(400).send('Invalid payload for user.deleted');
        }

        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', clerkIdToDelete);

        if (deleteError) {
          console.error('Supabase delete error on user.deleted:', deleteError);
          throw deleteError;
        }
        console.log(`Profile deleted for Clerk User ID: ${clerkIdToDelete}`);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    res.status(200).send('Webhook processed successfully.');
  } catch (error) {
    console.error('Error processing webhook event:', error.message);
    res.status(500).send('Error processing webhook.');
  }
};