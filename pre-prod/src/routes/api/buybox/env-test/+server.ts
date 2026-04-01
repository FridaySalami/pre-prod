import { json } from '@sveltejs/kit';

/**
 * Test environment variables
 */
export async function GET() {
  try {
    console.log('🧪 Testing environment variables...');
    
    // Check all environment variables
    const envVars = {
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
      PRIVATE_SUPABASE_SERVICE_KEY: process.env.PRIVATE_SUPABASE_SERVICE_KEY,
      NODE_ENV: process.env.NODE_ENV
    };
    
    console.log('🧪 Environment variables:', {
      hasPublicUrl: !!envVars.PUBLIC_SUPABASE_URL,
      hasPrivateKey: !!envVars.PRIVATE_SUPABASE_SERVICE_KEY,
      nodeEnv: envVars.NODE_ENV,
      publicUrlValue: envVars.PUBLIC_SUPABASE_URL,
      privateKeyPrefix: envVars.PRIVATE_SUPABASE_SERVICE_KEY?.substring(0, 20) + '...'
    });
    
    return json({
      success: true,
      envVars: {
        hasPublicUrl: !!envVars.PUBLIC_SUPABASE_URL,
        hasPrivateKey: !!envVars.PRIVATE_SUPABASE_SERVICE_KEY,
        nodeEnv: envVars.NODE_ENV,
        publicUrlValue: envVars.PUBLIC_SUPABASE_URL,
        privateKeyPrefix: envVars.PRIVATE_SUPABASE_SERVICE_KEY?.substring(0, 20) + '...'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('🧪 Environment test failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}