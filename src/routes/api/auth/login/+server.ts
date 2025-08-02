import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return error(400, { message: 'Email and password are required' });
    }

    // Create server client for authentication
    const supabase = createServerClient(
      PUBLIC_SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (key) => cookies.get(key),
          set: (key, value, options) => {
            cookies.set(key, value, {
              ...options,
              path: '/',
              httpOnly: false,
              secure: false, // Set to true in production with HTTPS
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7 days
            });
          },
          remove: (key, options) => cookies.delete(key, { ...options, path: '/' }),
        },
      }
    );		// Authenticate user
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      console.error('🔐 Server-side auth error:', authError);
      return error(401, { message: authError.message });
    }

    if (!data.session || !data.user) {
      console.error('🔐 No session or user returned from server-side auth');
      return error(401, { message: 'Login failed - no session created' });
    }

    console.log('🔐 Server-side login successful:', {
      userId: data.user.id,
      email: data.user.email,
      hasSession: !!data.session,
    });

    return json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: data.session,
    });
  } catch (err) {
    console.error('🔐 Login endpoint error:', err);
    return error(500, { message: 'Internal server error' });
  }
};
