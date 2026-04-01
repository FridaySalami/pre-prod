// src/routes/invites/+server.ts

import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

if (!PUBLIC_SUPABASE_URL || !PRIVATE_SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  const { email, expires_at } = await request.json();
  if (!email || !expires_at) {
    return new Response(JSON.stringify({ error: 'Missing email or expiration date' }), { status: 400 });
  }

  // Generate a random token (you can adjust token generation as needed)
  const invite_token = Math.random().toString(36).substring(2, 15);

  const { data, error } = await supabaseAdmin
    .from('invites')
    .insert([{ email, invite_token, expires_at }]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  // Optionally, send an email to the user with the invite link here.
  return new Response(JSON.stringify({ success: true, invite: data }), {
    headers: { 'Content-Type': 'application/json' }
  });
};