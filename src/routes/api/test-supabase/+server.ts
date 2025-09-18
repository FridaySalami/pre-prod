import { json } from '@sveltejs/kit';

/**
 * Test Supabase connection
 */
export async function GET() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Test environment variables
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
    
    console.log('🧪 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      urlValue: supabaseUrl,
      serviceKeyPrefix: serviceKey?.substring(0, 20) + '...'
    });
    
    if (!supabaseUrl || !serviceKey) {
      return json({
        success: false,
        error: 'Missing Supabase environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasServiceKey: !!serviceKey
        }
      }, { status: 500 });
    }
    
    // Try to create a Supabase client manually
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('🧪 Supabase client created successfully');
    
    // Try a simple query to test connection
    const { data, error } = await supabase
      .from('buybox_data')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('🧪 Supabase query error:', error);
      return json({
        success: false,
        error: 'Supabase query failed',
        details: error
      }, { status: 500 });
    }
    
    console.log('🧪 Supabase query successful, count:', data);
    
    return json({
      success: true,
      message: 'Supabase connection working',
      count: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('🧪 Test failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}