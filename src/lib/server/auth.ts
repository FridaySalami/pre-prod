// src/lib/server/auth.ts - Enhanced Supabase security utilities
import { createServerClient } from '@supabase/ssr';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export class AuthService {
  private supabase: any;

  constructor(event: RequestEvent) {
    this.supabase = event.locals.supabase;
  }

  /**
   * Validate user session with enhanced security checks
   */
  async validateSession(request: Request) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw error(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await this.supabase.auth.getUser(token);

    if (authError || !user) {
      throw error(401, 'Invalid session token');
    }

    // Additional security checks
    await this.performSecurityChecks(user, request);

    return user;
  }

  /**
   * Check if user has admin permissions for price modifications
   */
  async validateAdminPermissions(userId: string) {
    const { data: profile, error: profileError } = await this.supabase
      .from('user_profiles')
      .select('role, permissions')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw error(403, 'Unable to verify user permissions');
    }

    if (profile.role !== 'admin') {
      throw error(403, 'Admin access required for price modifications');
    }

    return profile;
  }

  /**
   * Enhanced security checks
   */
  private async performSecurityChecks(user: any, request: Request) {
    // 1. Check session age
    const sessionAge = Date.now() - new Date(user.last_sign_in_at).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) { // 24 hours
      throw error(401, 'Session expired - please log in again');
    }

    // 2. IP address validation for sensitive operations
    const clientIP = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Store IP for audit logging
    await this.logSecurityEvent('session_validated', {
      userId: user.id,
      ipAddress: clientIP,
      userAgent: request.headers.get('user-agent')
    });

    // 3. Check for suspicious activity
    await this.checkSuspiciousActivity(user.id, clientIP);
  }

  /**
   * Log security events for audit trail
   */
  private async logSecurityEvent(eventType: string, details: any) {
    try {
      await this.supabase
        .from('security_audit_log')
        .insert({
          event_type: eventType,
          event_details: details,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkSuspiciousActivity(userId: string, ipAddress: string) {
    // Check for multiple IP addresses in short time
    const { data: recentActivity } = await this.supabase
      .from('security_audit_log')
      .select('event_details')
      .eq('event_details->>userId', userId)
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .limit(10);

    if (recentActivity && recentActivity.length > 5) {
      const uniqueIPs = new Set(recentActivity.map((log: any) => log.event_details?.ipAddress));

      if (uniqueIPs.size > 3) {
        throw error(429, 'Suspicious activity detected - account temporarily locked');
      }
    }
  }

  /**
   * Rate limiting for sensitive operations
   */
  async checkRateLimit(userId: string, operation: string, maxAttempts: number = 10, windowMinutes: number = 60) {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { data: attempts } = await this.supabase
      .from('security_audit_log')
      .select('id')
      .eq('event_details->>userId', userId)
      .eq('event_details->>operation', operation)
      .gte('timestamp', windowStart.toISOString());

    if (attempts && attempts.length >= maxAttempts) {
      throw error(429, `Rate limit exceeded for ${operation}. Try again later.`);
    }
  }
}

/**
 * CSRF Protection
 */
export function validateCSRFToken(request: Request, expectedToken: string) {
  const csrfToken = request.headers.get('x-csrf-token') ||
    request.headers.get('csrf-token');

  if (!csrfToken || csrfToken !== expectedToken) {
    throw error(403, 'Invalid CSRF token');
  }
}
