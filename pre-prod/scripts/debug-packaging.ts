
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking amazon_order_packaging box codes...');
  
  // 1. Check raw box codes
  const { data: rawData, error: rawError } = await db
    .from('amazon_order_packaging')
    .select('box_code')
    .not('box_code', 'is', null)
    .limit(100);
    
  if (rawError) {
    console.error('Error fetching raw:', rawError);
    return;
  }
  
  const counts: Record<string, number> = {};
  rawData.forEach((d: any) => {
    const code = d.box_code || 'null';
    counts[code] = (counts[code] || 0) + 1;
  });
  console.log('Top 100 sample counts:', counts);

  // 2. Check "0x0x0" specifically
  const { count, error: countError } = await db
  .from('amazon_order_packaging')
  .select('*', { count: 'exact', head: true })
  .eq('box_code', '0x0x0');
  
  if (countError) console.error('Error checking 0x0x0:', countError);
  console.log('Total 0x0x0 count in DB:', count);

  // 3. Check for orphans and orders count
  console.log('Checking for orphaned packaging records...');
  
  const { data: packagingIds } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id')
    .limit(1000); 
    
  if (packagingIds && packagingIds.length > 0) {
    const ids = packagingIds.map(p => p.amazon_order_id);
    const { data: globalOrders } = await db
      .from('amazon_orders')
      .select('amazon_order_id')
      .in('amazon_order_id', ids);
      
    const foundIds = new Set(globalOrders?.map(o => o.amazon_order_id));
    const orphans = ids.filter(id => !foundIds.has(id));
    console.log(`Found ${orphans.length} orphans in sample of ${ids.length}`);
    if (orphans.length > 0) console.log('Sample orphans:', orphans.slice(0, 5));
  } else {
    console.log('No packaging records found to check orphans.');
  }

  // 5. Check 0x0x0 specifically for orphans
  console.log('Checking 0x0x0 for orphans...');
  const { data: ownBoxData } = await db
    .from('amazon_order_packaging')
    .select('amazon_order_id')
    .eq('box_code', '0x0x0')
    .limit(100);

  if (ownBoxData && ownBoxData.length > 0) {
    const ids = ownBoxData.map(p => p.amazon_order_id);
    const { data: globalOrders } = await db
      .from('amazon_orders')
      .select('amazon_order_id, purchase_date')
      .in('amazon_order_id', ids);

    const foundMap = new Map(globalOrders?.map(o => [o.amazon_order_id, o.purchase_date]));
    const orphans = ids.filter(id => !foundMap.has(id));
    const found = ids.filter(id => foundMap.has(id));
    
    console.log(`0x0x0 Sample: ${ids.length} records.`);
    console.log(`Orphans: ${orphans.length}`);
    console.log(`Found: ${found.length}`);
    if (found.length > 0) console.log('Sample purchase_date:', foundMap.get(found[0]));
  }
}

main();
