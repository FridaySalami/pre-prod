import type { Handle } from '@sveltejs/kit';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
	throw new Error('Missing Supabase configuration');
}

function createCookieOptions(event: Parameters<Handle>[0]['event']) {
  return {
    getAll: () => event.cookies.getAll(),
    setAll: (cookies: { name: string; value: string }[]) => {
      for (const { name, value } of cookies) {
        event.cookies.set(name, value, { path: '/' });
      }
    },
    get: event.cookies.get,
    set: (name: string, value: string) => event.cookies.set(name, value, { path: '/' }),
    remove: event.cookies.delete
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  // Log all request cookies for debugging.
  const allCookies = event.cookies.getAll();
  console.log('All request cookies:', allCookies);

  const supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    { cookies: createCookieOptions(event) },
    {} // empty options object
  );

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
  }
  console.log('Session from Supabase:', session);
  event.locals.session = session;
  console.log('URL Pathname:', event.url.pathname);

  // Define public routes that don't require a session.
  const publicRoutes = ['/login', '/api/auth/set-cookie'];
  const isPublic = publicRoutes.some(route => event.url.pathname.startsWith(route));
  
  if (!session && !isPublic) {
    console.log('No session found, redirecting to /login');
    return Response.redirect(new URL('/login', event.url).toString(), 302);
  }

  return resolve(event);
};