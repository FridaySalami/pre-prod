import type { Handle } from '@sveltejs/kit';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
	throw new Error('Missing Supabase configuration');
}

// Helper function: map SvelteKit cookies API to what Supabase SSR expects.
function createCookieOptions(event: Parameters<Handle>[0]['event']) {
  return {
    getAll: () => event.cookies.getAll(),
    setAll: (cookies: { name: string; value: string }[]) => {
      for (const { name, value } of cookies) {
        // Provide a proper options object with a path property.
        event.cookies.set(name, value, { path: '/' });
      }
    },
    // Wrap set to supply the options parameter with a default path.
    get: event.cookies.get,
    set: (name: string, value: string) => event.cookies.set(name, value, { path: '/' }),
    remove: event.cookies.delete
  };
}

export const handle: Handle = async ({ event, resolve }) => {
  // Log all cookies for debugging.
  const allCookies = event.cookies.getAll();
  console.log('All request cookies:', allCookies);

  // Create the Supabase server client.
  const supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE,
    { cookies: createCookieOptions(event) }
  );

  // Retrieve the session from the request cookies.
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
  }
  console.log('Session from Supabase:', session);
  event.locals.session = session;
  console.log('URL Pathname:', event.url.pathname);

  // Protect all routes except those starting with '/login'
  const publicRoutes = ['/login'];
  const isPublic = publicRoutes.some(route => event.url.pathname.startsWith(route));
  if (!session && !isPublic) {
    console.log('No session found, redirecting to /login');
    return Response.redirect(new URL('/login', event.url).toString(), 302);
  }

  return resolve(event);
};