import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export const POST: RequestHandler = async ({ request }) => {
  const { token, fullName, password } = await request.json();
  if (!token || !fullName || !password) {
    return new Response(JSON.stringify({ error: 'Missing token, fullName or password' }), { status: 400 });
  }

  // Fetch the invite record
  const { data: invite, error: fetchError } = await supabaseAdmin
    .from('invites')
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (fetchError || !invite) {
    return new Response(JSON.stringify({ error: 'Invalid invite token' }), { status: 400 });
  }

  // Check if invite has expired
  if (new Date(invite.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: 'Invite token expired' }), { status: 400 });
  }

  // Create user using Supabase Auth (this requires your backend to use the service role key)
  const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password: password,
    email_confirm: true // Automatically confirm the email if desired
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), { status: 400 });
  }

  // Update the invite to mark it as accepted.
  const { error: updateError } = await supabaseAdmin
    .from('invites')
    .update({ accepted: true })
    .eq('invite_token', token);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
  }

  // Optionally, insert/update a profile record here.
  
  return new Response(JSON.stringify({ success: true, user: userData }), {
    headers: { 'Content-Type': 'application/json' }
  });
};