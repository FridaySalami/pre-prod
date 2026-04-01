
import { db } from '../src/lib/server/db-script-safe';
import { fetchOrdersData } from '../src/lib/server/data-fetchers';

async function resetAndSync() {
  console.log('🗑️  Clearing packing_inventory_ledger (ALL rows)...');
  // Use id for deletion to catch rows with null reference_id
  const { error: error1, count: count1 } = await db
    .from('packing_inventory_ledger')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); 
  
  if (error1) console.error('Error clearing ledger:', error1);
  else console.log(`   - Cleared ledger entries`);

  console.log('🗑️  Clearing amazon_order_packaging (ALL rows)...');
  const { error: error2 } = await db
    .from('amazon_order_packaging')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error2) console.error('Error clearing packaging assignments:', error2);
  else console.log(`   - Cleared packaging assignments`);

  // Reset stock to a baseline for testing (optional, but helpful to avoid negative numbers immediately)
  console.log('🔄 Resetting packing_supplies stock to 1000...');
  // id is UUID
  const { error: error3 } = await db.from('packing_supplies').update({ current_stock: 1000 }).neq('id', '00000000-0000-0000-0000-000000000000');
  if (error3) console.error('Error resetting stock:', error3);

  console.log('✅ Data cleared. Starting sync for last 14 days (to safely cover 12th March)...');

  // Start the sync
  const endDate = new Date();
  const startDate = new Date(); // Today
  // Look back 14 days to be safe
  startDate.setDate(startDate.getDate() - 14);
  
  console.log(`Fetching orders between ${startDate.toISOString()} and ${endDate.toISOString()}...`);

  // Validation: Check if orders exist in this range
  const { count, error: countError } = await db
    .from('amazon_orders')
    .select('*', { count: 'exact', head: true })
    .gte('purchase_date', startDate.toISOString())
    .lte('purchase_date', endDate.toISOString());
  
  if (countError) {
    console.error('Error checking order count:', countError);
  } else {
    console.log(`Found ${count} orders in the database for this period.`);
  }

  // Make sure to fetch orders by calling with processPackagingOperations=true
  console.log('Calling fetchOrdersData...');
  const result = await fetchOrdersData(startDate, endDate, undefined, true);
  console.log(`fetchOrdersData returned ${result.length} enriched orders.`);

  console.log('🎉 Reset and Sync Complete!');
}

resetAndSync().catch(console.error);
