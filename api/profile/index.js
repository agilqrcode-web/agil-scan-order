import { createClient } from '@supabase/supabase-js';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { Webhook } from 'svix';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// Inicializa o cliente Supabase com a chave de serviço para acesso de admin
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`); // Construct full URL to parse query params
  const action = url.searchParams.get('action');

  // --- Lógica do webhook.js ---
  // Webhook will always be POST and identified by Svix headers
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (req.method === 'POST' && svix_id && svix_timestamp && svix_signature) {
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const rawBody = Buffer.concat(buffers).toString();

      const wh = new Webhook(CLERK_WEBHOOK_SECRET);

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
          const { data: existingProfile, error: selectError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', clerkUserId)
            .single();

          if (selectError && selectError.code !== 'PGRST116') {
            throw selectError;
          }

          if (!existingProfile) {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert([{ id: clerkUserId, onboarding_completed: false }]);
            
            if (insertError) {
              throw insertError;
            }
            console.log(`Created initial profile for user: ${clerkUserId}`);
          } else {
            console.log(`Profile for user ${clerkUserId} already exists. Skipping creation.`);
          }
          break;

        case 'user.updated':
          const { first_name, last_name, email_addresses } = event.data;
          const primaryEmail = email_addresses.find(e => e.id === event.data.primary_email_address_id)?.email_address;
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              first_name: first_name,
              last_name: last_name,
              email: primaryEmail
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

      return res.status(200).send('Webhook processed.');
    } catch (error) {
      console.error(error);
      return res.status(500).send('Error processing webhook.');
    }
  }

  // Handle actions based on query parameter
  if (req.method === 'POST') {
    switch (action) {
      case 'check-profile':
        // --- Lógica do check-profile.js ---
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header.' });
          }
          const token = await clerkClient.verifyToken(authHeader.split(' ')[1]);
          const clerkUserId = token.sub;

          if (!clerkUserId) {
            return res.status(401).json({ error: 'Invalid token or user ID not found.' });
          }

          const { data: profile, error } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', clerkUserId)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('check-profile: Error querying profile:', error);
            throw error;
          }

          const profileComplete = profile?.onboarding_completed || false;
          return res.status(200).json({ profileComplete });

        } catch (error) {
          console.error('check-profile: Internal server error:', error);
          if (error.message?.includes('Token is expired') || error.message?.includes('invalid_token')) {
            return res.status(401).json({ error: 'Invalid or expired token.' });
          }
          return res.status(500).json({ error: 'Internal server error.' });
        }

      case 'onboard-user':
        // --- Lógica do onboard-user.js ---
        try {
          const { firstName, lastName, restaurantName } = req.body;
          if (!firstName || !lastName || !restaurantName) {
            return res.status(400).json({ error: 'Missing required fields.' });
          }

          const authHeader = req.headers.authorization;
          if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header.' });
          }
          const token = await clerkClient.verifyToken(authHeader.split(' ')[1]);
          const clerkUserId = token.sub;

          if (!clerkUserId) {
            return res.status(401).json({ error: 'Invalid token or user ID not found.' });
          }

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

          return res.status(200).json({ message: 'Onboarding completed successfully.' });

        } catch (error) {
          console.error('onboard-user: Internal server error:', error);
          if (error.message?.includes('Token is expired') || error.message?.includes('invalid_token')) {
            return res.status(401).json({ error: 'Invalid or expired token.' });
          }
          return res.status(500).json({ error: 'Internal server error.' });
        }

      default:
        return res.status(405).json({ error: 'Method Not Allowed or Invalid Action' });
    }
  }

  // If none of the above matched, return Method Not Allowed
  return res.status(405).json({ error: 'Method Not Allowed' });
}