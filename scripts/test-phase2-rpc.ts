import { fetchOrdersData } from '../src/lib/server/data-fetchers';
import { db } from '../src/lib/supabase/supabaseServer';

async function main() {
  const targetOrder = '202-9130326-9171505';
  console.log(`🚀 Forcing fetchOrdersData for ${targetOrder}...`);

  // This will trigger Phase 1 and Phase 2 inside data-fetchers
  await fetchOrdersData(new Date(), new Date(), targetOrder);

  console.log('✅ Fetch complete. Checking Database for results...');

  // 1. Check amazon_order_packaging
  const { data: packaging } = await db
    .from('amazon_order_packaging')
    .select('*')
    .eq('amazon_order_id', targetOrder)
    .single();

  console.log('\n📦 --- amazon_order_packaging ---');
  console.log(packaging);

  // 2. Check packing_inventory_ledger
  const { data: ledger } = await db
    .from('packing_inventory_ledger')
    .select('*')
    .eq('reference_id', targetOrder);

  console.log('\n📖 --- packing_inventory_ledger ---');
  console.log(ledger);

  // 3. Check current stock 
  if (packaging?.box_supply_id) {
    const { data: stock } = await db
      .from('packing_supplies')
      .select('name, code, current_stock')
      .eq('id', packaging.box_supply_id)
      .single();

    console.log('\n📊 --- packing_supplies (Stock) ---');
    console.log(stock);
  }
}

main().catch(console.error);