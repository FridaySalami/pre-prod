import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

export async function GET({ locals }) {
  const session = await locals.getSession();
  if (!session) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role key to access auth.users
  const supabaseAdmin = createClient(
    PUBLIC_SUPABASE_URL,
    env.PRIVATE_SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  // Map to just email and id, sort by email
  const userList = users
    .map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.full_name || u.email?.split('@')[0]
    }))
    .sort((a, b) => (a.email || '').localeCompare(b.email || ''));

  return json({ users: userList });
}
