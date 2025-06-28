// Simple test to make a direct API call to test the service logic
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testWeeklyData() {
  console.log('🧪 Testing Weekly Data Fetch...');

  // Get current year
  const currentYear = new Date().getFullYear();
  console.log('📅 Current year:', currentYear);

  // Fetch data for the past 12 weeks
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - (12 * 7));

  console.log('� Date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

  const { data, error } = await supabase
    .from('daily_metric_review')
    .select('date, total_sales')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  console.log('📊 Raw data count:', data?.length || 0);

  if (data && data.length > 0) {
    // Group by year
    const byYear = {};
    data.forEach(record => {
      const year = new Date(record.date).getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(record);
    });

    console.log('📊 Years in data:', Object.keys(byYear));
    console.log('📊 2024 records:', byYear[2024]?.length || 0);
    console.log('📊 2025 records:', byYear[2025]?.length || 0);

    // Sample of data
    console.log('📊 Sample records:');
    data.slice(0, 5).forEach(record => {
      console.log(`  ${record.date}: ${record.total_sales}`);
    });
  }
}

testWeeklyData();
