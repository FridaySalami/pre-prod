// Test both Supabase connections
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get credentials from env
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

// Create both clients for testing
const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔍 Testing Supabase connection...');

async function testSupabaseConnection() {
  try {
    console.log('📡 Testing Supabase public (anon) client connection...');

    // Test basic connection with public client
    const { data: publicData, error: publicError } = await supabasePublic
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    if (publicError) {
      console.log('❌ Supabase PUBLIC connection failed:', publicError.message);
    } else {
      console.log('✅ Supabase PUBLIC connection successful!');
      console.log('📋 Found tables (public client):', publicData.map(t => t.table_name));
    }

    // Test service role (admin) connection
    console.log('\n📡 Testing Supabase SERVICE ROLE client connection...');

    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(5);

    if (adminError) {
      console.log('❌ Supabase SERVICE ROLE connection failed:', adminError.message);
      console.log('Error details:', adminError);
    } else {
      console.log('✅ Supabase SERVICE ROLE connection successful!');
      console.log('📋 Found tables (service role client):', adminData.map(t => t.table_name));
    }

    // Test specific tables with both clients
    const tables = ['amazon_listings', 'inventory', 'sku_asin_mapping', 'sku_asin_mapping_files'];

    console.log('\n🔍 Testing specific tables with public client:');
    for (const table of tables) {
      try {
        const { count, error } = await supabasePublic
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ PUBLIC - ${table}: ${error.message}`);
        } else {
          console.log(`✅ PUBLIC - ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.log(`❌ PUBLIC - ${table}: ${err.message}`);
      }
    }

    console.log('\n🔍 Testing specific tables with service role client:');
    for (const table of tables) {
      try {
        const { count, error } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ ADMIN - ${table}: ${error.message}`);
        } else {
          console.log(`✅ ADMIN - ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.log(`❌ ADMIN - ${table}: ${err.message}`);
      }
    }

    console.log('\n🎉 Supabase connection test completed!');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testSupabaseConnection();
