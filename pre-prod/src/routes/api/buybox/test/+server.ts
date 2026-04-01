import { json } from '@sveltejs/kit';

/**
 * Simple test endpoint for buybox API
 */
export async function GET() {
  try {
    console.log('🧪 Testing buybox endpoint...');
    
    return json({
      success: true,
      message: 'Buybox test endpoint working',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('🧪 Test endpoint failed:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}