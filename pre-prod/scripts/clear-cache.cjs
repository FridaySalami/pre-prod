require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function clearCache() {
  const supabase = createClient(
    'https://gvowfbrpmotcfxfzzhxf.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY
  );

  // Update the updated_at timestamp to force recalculation
  const { data, error } = await supabase
    .from('amazon_catalog_cache')
    .update({ updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
    .eq('asin', 'B07N88YRJT')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('✓ Cache invalidated for B07N88YRJT');
  console.log('The page will recalculate health score on next load');
}

clearCache().catch(console.error);
