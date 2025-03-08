// src/routes/api/auth/set-cookie/+server.ts
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const { access_token } = body;
  console.log("Received access_token:", access_token);
  if (!access_token) {
    console.error("Missing access_token in request body");
    return new Response(JSON.stringify({ error: 'Missing access_token' }), { status: 400 });
  }
  cookies.set('sb:token', access_token, {
    path: '/',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
  console.log("Cookie 'sb:token' set");
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
};