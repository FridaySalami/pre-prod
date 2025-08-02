// Test API endpoint to check authentication
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  console.log('🧪 Test endpoint called');

  const session = await locals.getSession();
  const user = session ? await locals.getUserWithProfile() : null;

  return json({
    authenticated: !!session,
    sessionExists: !!session,
    userId: session?.user?.id || null,
    userEmail: session?.user?.email || null,
    userRole: user?.profile?.role || null,
    timestamp: new Date().toISOString()
  });
};
