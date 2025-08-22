import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';

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
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const rawBody = Buffer.concat(buffers).toString();

    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.error('Missing Svix headers');
      return res.status(400).send('Missing Svix headers');
    }

    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

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

    const { id: clerkUserId } = event.data;

    switch (event.type) {
      case 'user.created':
        // Ação: Criar o perfil inicial na sua tabela de profiles
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: clerkUserId, onboarding_completed: false }])
          .onConflict('id') // Specify the primary key column
          .ignoreDuplicates(); // Ignore the insert if a conflict occurs
        
        if (insertError) {
          // Log the error but don't throw it, as it might be a harmless duplicate
          console.error(`Error inserting profile for user ${clerkUserId}:`, insertError);
        } else {
          console.log(`Processed initial profile for user: ${clerkUserId}`);
        }
        console.log(`Created initial profile for user: ${clerkUserId}`);
        break;

      case 'user.updated':
        // Sugestão de melhoria: Sincronizar dados de perfil do Clerk para o Supabase
        const { first_name, last_name, email_addresses } = event.data;
        const primaryEmail = email_addresses.find(e => e.id === event.data.primary_email_address_id)?.email_address;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: first_name,
            last_name: last_name,
            email: primaryEmail // Adicione esta coluna à sua tabela se precisar sincronizar
          })
          .eq('id', clerkUserId);
        
        if (updateError) {
          throw updateError;
        }
        console.log(`Updated profile for user: ${clerkUserId}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send('Webhook processed.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing webhook.');
  }
};
