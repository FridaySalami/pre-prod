// Simple test to check what's happening with buybox_data table
import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';

export async function GET() {
  try {
    // Use the same configuration as the render service
    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://fqnqbxzlrmhggqoxjrqx.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbnFieHpscm1oZ2dxb3hqcnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5ODE1ODIsImV4cCI6MjA0ODU1NzU4Mn0.rOQECy3LI1C87HWz33M8dXJmL6nfNpBaJOjK4DRlKiY'
    );
    
    // Test 1: Check if we can query buybox_data table
    console.log('Testing buybox_data table access...');
    const { data, error } = await supabase
      .from('buybox_data')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ buybox_data error:', error.message);
      return json({ 
        error: 'buybox_data table error', 
        details: error.message,
        code: error.code 
      }, { status: 500 });
    }
    
    // Test 2: Check column structure
    const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
    console.log('✅ buybox_data columns:', columns);
    
    // Test 3: Check if job_id or run_id exists
    const hasJobId = columns.includes('job_id');
    const hasRunId = columns.includes('run_id');
    
    return json({
      success: true,
      tableAccessible: true,
      columns,
      schema: {
        hasJobId,
        hasRunId,
        needsMigration: hasJobId && !hasRunId
      },
      sampleCount: data ? data.length : 0
    });
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    return json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
