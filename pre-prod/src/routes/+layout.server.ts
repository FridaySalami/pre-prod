// src/routes/+layout.server.ts - Server-side authentication for layout
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  // Get session from the hooks.server.ts using the safe method
  const session = await locals.getSession();

  console.log('🔐 Layout server load - session check:', {
    hasSession: !!session,
    sessionUserId: session?.user?.id,
    cookieCount: Object.keys(cookies.getAll()).length
  });

  // Get user with profile if session exists
  const user = session ? await locals.getUserWithProfile() : null;

  console.log('🔐 Layout server load - final data:', {
    hasSession: !!session,
    hasUser: !!user,
    userRole: user?.profile?.role
  });

  return {
    session, // Pass the full session object to avoid type mismatches
    user: user ? {
      id: user.id,
      email: user.email,
      profile: user.profile || null
    } : null
  };
};
