// src/hooks.server.ts - Enhanced SvelteKit middleware with route-based protection
import { redirect, error, type Handle } from '@sveltejs/kit';
import { createServerClient } from '@supabase/ssr';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

// Validate API key for external services
function isValidApiKey(apiKey: string): boolean {
  // You can define multiple API keys for different services
  const validApiKeys = [
    process.env.MAKE_COM_API_KEY || 'make-key-12345', // Default key for development
    process.env.EXTERNAL_API_KEY || 'external-key-67890'
  ];

  return validApiKeys.includes(apiKey);
}

// Define your protected routes and their requirements
const ROUTE_PROTECTION = {
  // Public routes that don't require authentication
  public: [
    '/login',
    '/forgot-password',
    '/api/auth/callback',
    '/api/auth/complete',
    '/api/supabase-health',
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/amazon/oauth/callback',
    '/api/invites/validate',
    '/api/test-match-buybox',
    '/api/test-amazon-connection',
    '/api/upload-metric-review-working',
    '/api/audit-log', // Temporarily public for debugging
    '/api/feed-status', // Temporarily public for debugging
    '/api/quick-price-check', // Temporarily public for debugging
    '/api/daily-report' // Public for Make.com integration
    // Note: '/' is NOT public - it should redirect to login if not authenticated
  ],

  // Routes that support API key authentication (for external services like Make.com)
  apiKeySupported: [
    '/api/linnworks',
    '/api/upload'
  ],

  // Routes requiring basic authentication
  authenticated: [
    '/', // Root redirects to landing, which requires auth
    '/landing',
    '/dashboard',
    '/analytics',
    '/analytics/monthly',
    '/account-settings',
    '/documentation',
    '/employee-hours',
    '/kaizen-projects',
    '/schedules',
    '/pricer',
    '/inventory',
    '/profile',
    '/linnworks-composition',
    '/amazon-listings',
    '/sage-reports',
    '/inventory-profit-calculator',
    '/buy-box-monitor', // Moved from manager to authenticated
    '/buy-box-manager', // Moved from admin to authenticated
    '/api/live-pricing',
    '/api/match-buybox',
    '/api/match-buy-box'
  ],

  // Routes requiring manager privileges (can read pricing data but not modify)
  manager: [
    '/api/pricing-reports',
    '/api/margin-analysis'
  ],

  // Routes requiring admin privileges
  admin: [
    '/api/admin'
  ]
};

export const handle: Handle = async ({ event, resolve }) => {
  // Create Supabase server client with cookie handling (for user sessions)
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (key) => event.cookies.get(key),
        set: (key, value, options) => {
          event.cookies.set(key, value, {
            ...options,
            path: '/',
            httpOnly: false,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
        },
        remove: (key, options) => event.cookies.delete(key, { ...options, path: '/' }),
      },
    }
  );

  // Create admin client for logging operations (no cookie handling needed)
  const adminClient = createServerClient(
    PUBLIC_SUPABASE_URL,
    PRIVATE_SUPABASE_SERVICE_KEY,
    {
      cookies: {
        get: () => undefined,
        set: () => { },
        remove: () => { },
      },
    }
  );

  // Helper function to get session with enhanced error handling
  event.locals.getSession = async () => {
    try {
      console.log('🔐 Getting session, cookies available:', Object.keys(event.cookies.getAll()));

      const { data: { session }, error } = await event.locals.supabase.auth.getSession();

      console.log('🔐 Session retrieval result:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        error: error?.message
      });

      if (error) {
        console.warn('🔐 Session retrieval error:', error.message);
        return null;
      }

      return session;
    } catch (error) {
      console.error('🔐 Unexpected error getting session:', error);
      return null;
    }
  };

  // Helper function to get user with profile
  event.locals.getUserWithProfile = async () => {
    try {
      const session = await event.locals.getSession();
      if (!session) return null;

      // Use admin client to bypass RLS for profile fetching
      const { data: profile, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.warn('🔐 Profile fetch error:', error.message);
        // Return user without profile if profile fetch fails
        return session.user;
      }

      return {
        ...session.user,
        profile
      };
    } catch (error) {
      console.error('🔐 Error fetching user profile:', error);
      // Try to return just the session user if possible
      try {
        const session = await event.locals.getSession();
        return session?.user || null;
      } catch {
        return null;
      }
    }
  };

  const pathname = event.url.pathname;

  // Check if route needs protection
  const routeType = getRouteType(pathname);

  console.log(`🔐 Route protection check:`, {
    pathname,
    routeType,
    timestamp: new Date().toISOString()
  });

  if (routeType !== 'public') {
    // Check for API key authentication for supported routes
    if (ROUTE_PROTECTION.apiKeySupported.some(route =>
      pathname === route || pathname.startsWith(route + '/')
    )) {
      const apiKey = event.request.headers.get('x-api-key') || event.request.headers.get('authorization')?.replace('Bearer ', '');

      if (apiKey && isValidApiKey(apiKey)) {
        console.log(`🔑 API key authentication successful for: ${pathname}`);

        // Set a system user for API key requests
        event.locals.user = {
          id: 'api-key-user',
          email: 'api@system.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        };
        event.locals.session = {
          access_token: '',
          refresh_token: '',
          expires_in: 3600,
          token_type: 'bearer',
          user: event.locals.user
        };

        // Continue to route handler
        const response = await resolve(event, {
          filterSerializedResponseHeaders(name) {
            return name === 'content-range';
          },
        });
        return response;
      }
    }

    const session = await event.locals.getSession();

    console.log(`🔐 Session check for protected route:`, {
      pathname,
      hasSession: !!session,
      sessionUserId: session?.user?.id
    });

    // Redirect to login if no session
    if (!session) {
      console.log(`🔐 No session found, redirecting to login from: ${pathname}`);

      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } else {
        throw redirect(303, `/login?redirectTo=${encodeURIComponent(pathname)}`);
      }
    }

    // For admin or manager routes, check role permissions
    if (routeType === 'admin' || routeType === 'manager') {
      const userWithProfile = await event.locals.getUserWithProfile();
      const userRole = userWithProfile?.profile?.role;

      if (!hasRequiredPermissions(userRole, routeType)) {
        if (pathname.startsWith('/api/')) {
          // Log security violation
          await logSecurityEvent(adminClient, 'UNAUTHORIZED_ACCESS_ATTEMPT', {
            userId: session.user.id,
            userEmail: session.user.email,
            attemptedPath: pathname,
            userRole: userRole,
            requiredRole: routeType,
            ipAddress: event.getClientAddress(),
            userAgent: event.request.headers.get('user-agent')
          });

          return new Response(
            JSON.stringify({
              error: `${routeType} access required`,
              details: `Current role: ${userRole || 'none'}, Required: ${routeType}`
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        } else {
          throw redirect(303, '/dashboard?error=insufficient_permissions');
        }
      }

      // Log admin/manager access for audit trail
      await logSecurityEvent(adminClient, 'PRIVILEGED_ACCESS', {
        userId: session.user.id,
        userEmail: session.user.email,
        accessedPath: pathname,
        userRole: userRole,
        ipAddress: event.getClientAddress(),
        userAgent: event.request.headers.get('user-agent')
      });
    }

    // Make user available to routes
    event.locals.user = session.user;
    event.locals.session = session;
  }

  // Enhanced security for sensitive API endpoints
  if (pathname.startsWith('/api/match-buy-box') || pathname.startsWith('/api/price-update')) {
    await performEnhancedSecurityChecks(event, adminClient);
  }

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range';
    },
  });

  return response;
};

/**
 * Determine what type of protection a route needs
 */
function getRouteType(pathname: string): 'public' | 'authenticated' | 'manager' | 'admin' {
  // Check public routes first (most specific)
  if (ROUTE_PROTECTION.public.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )) {
    return 'public';
  }

  // Check admin routes
  if (ROUTE_PROTECTION.admin.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )) {
    return 'admin';
  }

  // Check manager routes
  if (ROUTE_PROTECTION.manager.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )) {
    return 'manager';
  }

  // Check authenticated routes
  if (ROUTE_PROTECTION.authenticated.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )) {
    return 'authenticated';
  }

  // Default to authenticated for unlisted routes
  return 'authenticated';
}

/**
 * Check if user role has required permissions
 */
function hasRequiredPermissions(userRole: string | undefined, requiredLevel: string): boolean {
  // Define what roles are allowed for each access level
  const accessLevels = {
    'admin': ['admin'], // Only admin can access admin routes
    'manager': ['admin', 'manager'], // Admin and manager can access manager routes
    'user': ['admin', 'manager', 'user'] // All roles can access user routes
  };

  if (!userRole) return false;

  const allowedRoles = accessLevels[requiredLevel as keyof typeof accessLevels] || [];
  return allowedRoles.includes(userRole);
}

/**
 * Enhanced security checks for sensitive operations
 */
async function performEnhancedSecurityChecks(event: any, adminClient: any) {
  const session = await event.locals.getSession();
  if (!session) {
    console.log('🔐 Enhanced security check: No session found');
    return;
  }

  console.log('🔐 Enhanced security check starting for user:', session.user.email);

  const clientIP = event.getClientAddress();
  const userAgent = event.request.headers.get('user-agent') || 'unknown';

  // Check for rate limiting
  console.log('🔐 Checking rate limit...');
  const rateLimitCheck = await checkRateLimit(
    event.locals.supabase,
    session.user.id,
    'price_modification',
    5, // max 5 attempts
    60 // per 60 minutes
  );

  if (!rateLimitCheck.allowed) {
    console.log('🔐 Rate limit exceeded:', rateLimitCheck);
    await logSecurityEvent(adminClient, 'RATE_LIMIT_EXCEEDED', {
      userId: session.user.id,
      operation: 'price_modification',
      attempts: rateLimitCheck.attempts,
      ipAddress: clientIP,
      userAgent
    });

    throw error(429, 'Rate limit exceeded. Please try again later.');
  }

  // Check for suspicious activity patterns
  console.log('🔐 Checking for suspicious activity...');
  await detectSuspiciousActivity(event.locals.supabase, adminClient, session.user.id, clientIP);

  // Validate session age (require re-authentication for old sessions)
  const sessionAge = Date.now() - new Date(session.user.last_sign_in_at || 0).getTime();
  const maxSessionAge = 24 * 60 * 60 * 1000; // Extended to 24 hours for better UX

  console.log('🔐 Session age check:', {
    userEmail: session.user.email,
    sessionAgeMinutes: Math.floor(sessionAge / 1000 / 60),
    maxSessionAgeMinutes: Math.floor(maxSessionAge / 1000 / 60),
    lastSignInAt: session.user.last_sign_in_at
  });

  if (sessionAge > maxSessionAge) {
    console.log(`🔐 Session too old for ${session.user.email}: ${Math.floor(sessionAge / 1000 / 60)} minutes old`);

    await logSecurityEvent(adminClient, 'SESSION_TOO_OLD', {
      userId: session.user.id,
      sessionAge: Math.floor(sessionAge / 1000 / 60), // minutes
      ipAddress: clientIP
    });

    throw error(401, 'Session expired. Please log in again.');
  }

  console.log('🔐 Enhanced security checks passed for user:', session.user.email);
}/**
 * Check rate limiting for sensitive operations
 */
async function checkRateLimit(
  supabase: any,
  userId: string,
  operation: string,
  maxAttempts: number,
  windowMinutes: number
): Promise<{ allowed: boolean; attempts: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const { data: attempts } = await supabase
    .from('security_audit_log')
    .select('id')
    .eq('event_details->>userId', userId)
    .eq('event_details->>operation', operation)
    .gte('timestamp', windowStart.toISOString());

  const attemptCount = attempts?.length || 0;

  return {
    allowed: attemptCount < maxAttempts,
    attempts: attemptCount
  };
}

/**
 * Detect suspicious activity patterns
 */
async function detectSuspiciousActivity(supabase: any, adminClient: any, userId: string, currentIP: string) {
  // Check for multiple IPs in short timeframe
  const { data: recentActivity } = await supabase
    .from('security_audit_log')
    .select('event_details')
    .eq('event_details->>userId', userId)
    .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .limit(10);

  if (recentActivity && recentActivity.length > 5) {
    const uniqueIPs = new Set(recentActivity.map((log: any) => log.event_details?.ipAddress));

    if (uniqueIPs.size > 3) {
      await logSecurityEvent(adminClient, 'SUSPICIOUS_ACTIVITY_DETECTED', {
        userId,
        uniqueIPCount: uniqueIPs.size,
        currentIP,
        recentIPs: Array.from(uniqueIPs)
      });

      throw error(429, 'Suspicious activity detected. Account temporarily restricted.');
    }
  }
}

/**
 * Log security events for audit trail
 */
async function logSecurityEvent(
  supabase: any,
  eventType: string,
  eventDetails: any
): Promise<void> {
  try {
    await supabase
      .from('security_audit_log')
      .insert({
        event_type: eventType,
        event_details: {
          ...eventDetails,
          timestamp: new Date().toISOString()
        },
        user_id: eventDetails.userId,
        severity: getSeverityLevel(eventType)
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

/**
 * Determine severity level for different event types
 */
function getSeverityLevel(eventType: string): string {
  const severityMap: Record<string, string> = {
    'UNAUTHORIZED_ACCESS_ATTEMPT': 'high',
    'RATE_LIMIT_EXCEEDED': 'medium',
    'SUSPICIOUS_ACTIVITY_DETECTED': 'high',
    'SESSION_TOO_OLD': 'medium',
    'PRIVILEGED_ACCESS': 'info',
    'PRICE_MODIFICATION_ATTEMPTED': 'high',
    'PRICE_MODIFICATION_BLOCKED': 'high'
  };

  return severityMap[eventType] || 'info';
}
