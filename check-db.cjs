require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDB() {
  const supabase = createClient(
    'https://gvowfbrpmotcfxfzzhxf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('amazon_catalog_cache')
    .select('asin, title, description, bullet_points')
    .eq('asin', 'B07N88YRJT')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('❌ Product B07N88YRJT not found in cache');
    return;
  }

  console.log('\n=== Cached Product ===');
  console.log('ASIN:', data.asin);
  console.log('Title:', data.title?.substring(0, 80) + '...');
  console.log('\nDescription:');
  console.log('  Length:', data.description?.length || 0);
  console.log('  Value:', data.description || '(null)');
  console.log('\nBullet Points:', data.bullet_points?.length || 0);
  if (data.bullet_points) {
    data.bullet_points.forEach((bp, i) => {
      console.log(`  ${i+1}. ${bp.substring(0, 60)}... (${bp.length} chars)`);
    });
  }
}

checkDB().catch(console.error);
