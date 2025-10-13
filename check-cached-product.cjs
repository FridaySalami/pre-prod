const { createClient } = require('@supabase/supabase-js');

async function checkCached() {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('amazon_catalog_cache')
    .select('*')
    .eq('asin', 'B07N88YRJT')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data) {
    console.log('Product not in cache');
    return;
  }

  console.log('\n=== Cached Product Data ===');
  console.log('Title:', data.title);
  console.log('Description length:', data.description?.length || 0);
  console.log('Description:', data.description);
  console.log('\nBullet points:', data.bullet_points?.length || 0);
  console.log('Images:', data.images?.length || 0);
  console.log('Brand:', data.brand);
}

checkCached().catch(console.error);
