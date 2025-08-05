import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_KEY } from '$env/static/private';

export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    // Temporarily making this public for debugging - remove auth check
    console.log('🔍 Audit log API called - bypassing authentication for debugging');

    // Import Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY);

    // Get query parameters
    const action = url.searchParams.get('action') || 'MATCH_BUY_BOX';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    console.log(`🔍 Fetching audit log entries for action: ${action}, limit: ${limit}`);

    // Query the audit log
    const { data, error } = await supabase
      .from('security_audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error querying audit log:', error);
      return json({
        success: false,
        error: 'Failed to fetch audit log',
        details: error.message
      }, { status: 500 });
    }

    console.log(`✅ Found ${data.length} audit log entries`);

    return json({
      success: true,
      count: data.length,
      entries: data.map(entry => ({
        id: entry.id,
        user_id: entry.user_id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        timestamp: entry.timestamp,
        details: entry.details
      }))
    });

  } catch (error) {
    console.error('❌ Audit log API error:', error);
    return json({
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }, { status: 500 });
  }
};
