import { json } from '@sveltejs/kit';
import { db } from '../../../lib/supabaseServer.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    console.log('🔍 Testing Supabase connection...');

    // First, let's test the basic connection
    const supabase = db;

    // Try to get table schema first
    console.log('📊 Checking table structure...');
    const { data: schemaData, error: schemaError } = await supabase
      .from('sales_june')
      .select('*')
      .limit(1);

    if (schemaError) {
      console.error('❌ Schema error:', schemaError);
      return json({
        error: 'Schema error',
        details: schemaError,
        step: 'checking table structure'
      }, { status: 500 });
    }

    console.log('✅ Schema check successful, sample row:', schemaData?.[0]);

    // Try to get a few records without any filters
    console.log('📋 Fetching basic data...');
    const { data: basicData, error: basicError } = await supabase
      .from('sales_june')
      .select('*')
      .limit(5);

    if (basicError) {
      console.error('❌ Basic fetch error:', basicError);
      return json({
        error: 'Basic fetch error',
        details: basicError,
        step: 'basic data fetch'
      }, { status: 500 });
    }

    console.log('✅ Basic fetch successful, got', basicData?.length, 'rows');

    // Try ordering (this might be the issue)
    console.log('🔄 Testing ordering...');
    const { data: orderedData, error: orderError } = await supabase
      .from('sales_june')
      .select('*')
      .order('Units ordered', { ascending: false })
      .limit(3);

    if (orderError) {
      console.error('❌ Order error:', orderError);
      return json({
        error: 'Order error',
        details: orderError,
        step: 'ordering test',
        suggestion: 'Column "Units ordered" might not exist or have different name'
      }, { status: 500 });
    }

    console.log('✅ Ordering successful');

    // Check available columns
    if (basicData && basicData.length > 0) {
      const columns = Object.keys(basicData[0]);
      console.log('📋 Available columns:', columns);

      return json({
        success: true,
        message: 'All tests passed!',
        sampleData: basicData[0],
        availableColumns: columns,
        totalRecords: basicData.length
      });
    }

    return json({
      success: true,
      message: 'Connection successful but no data found',
      availableColumns: []
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'general execution'
    }, { status: 500 });
  }
};
