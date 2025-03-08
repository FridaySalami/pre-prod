import type { RequestHandler } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';
import { createServerClient } from '@supabase/ssr';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const { access_token } = body;
  if (!access_token) {
    return new Response(JSON.stringify({ error: 'Missing access_token' }), { status: 400 });
  }
  // Use SvelteKit's cookies API to set the session token in a secure HTTP‑only cookie.
  cookies.set('sb:token', access_token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
};