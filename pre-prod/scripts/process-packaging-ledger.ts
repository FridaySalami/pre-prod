import { fetchOrdersData } from '../src/lib/server/data-fetchers';

async function main() {
  console.log(`🚀 Starting background packaging ledger sync...`);
  // Look back at the last 7 days of orders to catch any that moved to Shipped/Unshipped
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  
  // Call it with "true" to process DB operations
  console.log(`Pulling orders from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
  await fetchOrdersData(startDate, endDate, undefined, true);

  console.log('✅ Packaging ledger sync complete.');
}

main().catch(console.error);
