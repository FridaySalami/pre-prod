import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('sb:token', { path: '/' });
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
};