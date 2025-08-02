// src/lib/routeGuard.ts - Client-side route protection
import { goto } from '$app/navigation';
import { userSession } from '$lib/sessionStore';
import { get } from 'svelte/store';

// Same route protection configuration as server-side
const ROUTE_PROTECTION = {
  public: [
    '/login',
    '/signup',
    '/set-password',
    '/api/health',
    '/api/auth/logout',
    '/api/amazon/oauth/callback',
    '/api/invites/validate'
  ],

  authenticated: [
    '/',
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
    '/buy-box-manager'  // Moved from admin to authenticated
  ],

  manager: [
    // Empty - no manager-only routes currently
  ],

  admin: [
    // Empty - no admin-only routes currently
  ]
};

/**
 * Determine what type of protection a route needs
 */
function getRouteType(pathname: string): 'public' | 'authenticated' | 'manager' | 'admin' {
  // Check public routes first
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
  const roleHierarchy = {
    'admin': ['admin', 'manager', 'user'],
    'manager': ['manager', 'user'],
    'user': ['user']
  };

  if (!userRole) return false;
  return roleHierarchy[userRole as keyof typeof roleHierarchy]?.includes(requiredLevel) || false;
}

/**
 * Client-side route guard - call this on navigation
 */
export function checkRouteAccess(pathname: string, userData?: any): boolean {
  const routeType = getRouteType(pathname);

  console.log('🛡️ Client-side route guard:', { pathname, routeType });

  // Public routes are always accessible
  if (routeType === 'public') {
    return true;
  }

  // Get current session for protected routes
  const session = get(userSession);

  // Check if user is authenticated for any protected route
  if (!session) {
    console.log('🛡️ No session found, redirecting to login');
    goto(`/login?redirectTo=${encodeURIComponent(pathname)}`);
    return false;
  }

  // For role-based routes, check permissions
  if (routeType === 'admin' || routeType === 'manager') {
    const userRole = userData?.profile?.role || session?.user?.user_metadata?.role;

    if (!hasRequiredPermissions(userRole, routeType)) {
      console.log('🛡️ Insufficient permissions, redirecting to dashboard');
      goto('/dashboard?error=insufficient_permissions');
      return false;
    }
  }

  return true;
}/**
 * Initialize route guard for the entire app
 */
export function initializeRouteGuard() {
  // This can be called in the main layout to set up global route protection
  console.log('🛡️ Client-side route guard initialized');
}
