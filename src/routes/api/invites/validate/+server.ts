import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRole);

export const GET: RequestHandler = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token parameter' }), { status: 400 });
  }

  // Fetch the invite record
  const { data, error } = await supabaseAdmin
    .from('invites')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  
  if (!data) {
    return new Response(JSON.stringify({ error: 'Invalid invite token' }), { status: 404 });
  }

  // Check expiration
  const now = new Date();
  if (new Date(data.expires_at) < now) {
    return new Response(JSON.stringify({ error: 'Invite token expired' }), { status: 400 });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
};