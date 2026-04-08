// src/routes/+layout.server.ts - Server-side authentication for layout
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  // Get session from the hooks.server.ts using the safe method
  // Use a promise for the session to avoid blocking the layout load
  const sessionPromise = locals.getSession();

  // We await it here only if we need it for the initial layout state,
  // but we can also pass it as a promise if we want to be truly non-blocking.
  // For now, let's keep getSession() awaited as it's usually fast (cookie-based),
  // but make the profile fetch lazy.
  const session = await sessionPromise;

  console.log('🔐 Layout server load - session check:', {
    hasSession: !!session,
    sessionUserId: session?.user?.id,
    cookieCount: Object.keys(cookies.getAll()).length
  });

  // LAZY LOAD PROFILE: Pass the profile as a promise instead of awaiting it here.
  // This prevents the slow database call for the user profile from blocking the initial page render.
  const userPromise = session ? locals.getUserWithProfile() : Promise.resolve(null);

  return {
    session,
    // Stream the user data to the client
    lazy: {
      user: userPromise
    }
  };
};
