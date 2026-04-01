// src/routes/api/auth/logout/+server.ts - Server-side logout endpoint for enhanced authentication
import { json, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  console.log('🔐 Server-side logout initiated');

  try {
    // Get the current session for logging
    const session = await locals.getSession();
    const userId = session?.user?.id;

    // Log security event if we have a user
    if (userId && locals.supabase) {
      try {
        await locals.supabase
          .from('security_audit_log')
          .insert({
            user_id: userId,
            event_type: 'USER_LOGOUT',
            ip_address: '127.0.0.1', // You can get real IP from event if needed
            user_agent: 'Server logout',
            event_details: {
              logoutMethod: 'server-endpoint',
              timestamp: new Date().toISOString()
            }
          });
      } catch (auditError) {
        console.warn('🔐 Could not log logout event:', auditError);
      }
    }

    // Clear the Supabase session server-side with proper scope
    const { error: signOutError } = await locals.supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      console.warn('🔐 SignOut error (continuing anyway):', signOutError.message);
    }
    console.log('🔐 Server-side Supabase session cleared');

    // Clear all Supabase-related cookies (more comprehensive list)
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'supabase-auth-token',
      'sb-provider-token',
      'sb-provider-refresh-token'
    ];

    // Add project-specific cookie if possible
    try {
      const projectRef = PUBLIC_SUPABASE_URL.split('//')[1]?.split('.')[0];
      if (projectRef) {
        cookieNames.push(`sb-${projectRef}-auth-token`);
      }
    } catch (envError) {
      console.warn('🔐 Could not get project ref for cookie cleanup, continuing with basic cleanup');
    }

    cookieNames.forEach(name => {
      cookies.delete(name, { path: '/' });
      cookies.delete(name, { path: '/', domain: undefined });
      cookies.delete(name, { path: '/', secure: true, httpOnly: true });
    });

    // Clear any potential session cookies
    cookies.delete('session', { path: '/' });

    // Clear browser storage directive (optional - for client to handle)
    console.log('🔐 Server-side logout completed successfully'); return json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔐 Server-side logout error:', error);

    // Even if there's an error, try to clear cookies
    const cookieNames = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token', 'session'];
    cookieNames.forEach(name => {
      try {
        cookies.delete(name, { path: '/' });
      } catch (cookieError) {
        console.warn(`🔐 Could not clear cookie ${name}:`, cookieError);
      }
    });

    return json({
      success: false,
      error: 'Logout error occurred',
      message: 'Session cleared despite error'
    }, { status: 500 });
  }
};

// GET handler for logout via URL (useful for redirects)
export const GET: RequestHandler = async ({ locals, cookies }) => {
  console.log('🔐 GET logout initiated');

  try {
    // Clear session
    await locals.supabase.auth.signOut();

    // Clear cookies
    const cookieNames = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token', 'session'];
    cookieNames.forEach(name => {
      cookies.delete(name, { path: '/' });
    });

    console.log('🔐 GET logout completed, redirecting to login');

  } catch (error) {
    console.error('🔐 GET logout error:', error);
  }

  // Always redirect to login regardless of errors
  throw redirect(303, '/login?message=logged-out');
};
