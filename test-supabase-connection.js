// Test Supabase connection directly
import { createClient } from '@supabase/supabase-js';

// Use your Supabase credentials directly
const supabaseUrl = 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2b3dmYnJwbW90Y2Z4Znp6aHhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzMTc0NjksImV4cCI6MjA1NTg5MzQ2OX0.CceIKEQr3NYuEZ76mjuFVYRCG_X5lTP8MEQ-4paIoTs';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Testing Supabase connection...');

async function testSupabaseConnection() {
  try {
    console.log('📡 Testing direct Supabase client connection...');

    // Test basic connection by trying to select from a system table
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
    } else {
      console.log('✅ Supabase connection successful!');
      console.log('📋 Found tables:', data.map(t => t.table_name));
    }

    // Test our specific tables
    const tables = ['amazon_listings', 'inventory', 'sage_reports', 'linnworks_composition'];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }

    console.log('\n🎉 Supabase connection test completed!');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testSupabaseConnection();
