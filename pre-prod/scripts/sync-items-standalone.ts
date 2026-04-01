
import { createClient } from '@supabase/supabase-js';
import { SPAPIClient } from '../src/lib/amazon/sp-api-client';
import { RateLimiters } from '../src/lib/amazon/rate-limiter';

// Helper for concurrency
async function runPool<T>(
  items: T[],
  worker: (item: T, idx: number) => Promise<void>,
  concurrency: number
) {
  let i = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log('Starting Amazon Order Items Sync (Standalone Script)...');

  // 1. Setup Supabase
  const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials (PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY)');
    process.exit(1);
  }
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 2. Setup SP-API Client
  const spApiClient = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID || '',
    clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
    refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
    awsAccessKeyId: (process.env.AMAZON_AWS_ACCESS_KEY_ID || '').trim(),
    awsSecretAccessKey: (process.env.AMAZON_AWS_SECRET_ACCESS_KEY || '').trim(),
    awsRegion: (process.env.AMAZON_REGION || 'eu-west-1').trim(),
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
    sellerId: process.env.AMAZON_SELLER_ID,
    roleArn: process.env.AMAZON_ROLE_ARN
  });

  // 3. Determine Date Range (Yesterday by default)
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() - 1); // Yesterday

  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);

  console.log(`Searching DB for orders needing item sync between ${startDate.toISOString()} and ${endDate.toISOString()}`);

  // 4. Fetch eligible orders from DB
  const { data: dbOrders, error: dbOrdersError } = await db
    .from('amazon_orders')
    .select('amazon_order_id, last_update_date, purchase_date')
    .gte('purchase_date', startDate.toISOString())
    .lte('purchase_date', endDate.toISOString());

  if (dbOrdersError) {
    console.error('Error fetching orders from DB:', dbOrdersError);
    process.exit(1);
  }

  if (!dbOrders || dbOrders.length === 0) {
    console.log('No orders found in DB for this period.');
    return;
  }

  // 5. Filter for orders missing items
  const orderIds = dbOrders.map(o => o.amazon_order_id);
  const { data: existingItemsData, error: existingItemsError } = await db
    .from('amazon_order_items')
    .select('amazon_order_id')
    .in('amazon_order_id', orderIds);

  if (existingItemsError) {
    console.error('Error fetching existing items:', existingItemsError);
    process.exit(1);
  }

  const ordersWithItems = new Set<string>();
  if (existingItemsData) {
    existingItemsData.forEach(i => ordersWithItems.add(i.amazon_order_id));
  }

  const ordersToSyncItems = dbOrders.filter(o => !ordersWithItems.has(o.amazon_order_id));

  // No arbitrary limit here - GitHub Actions can run for hours
  const totalPending = ordersToSyncItems.length;
  console.log(`Found ${totalPending} orders missing items. Processing all...`);

  if (totalPending === 0) {
    console.log('All orders have items. Exiting.');
    return;
  }

  // 6. Process orders
  let itemsSynced = 0;
  let ordersProcessed = 0;
  let successCount = 0;
  let failCount = 0;

  const processOrder = async (order: { amazon_order_id: string }, idx: number) => {
    const maxRetries = 5;
    let attempt = 0;
    let success = false;

    // Small delay between requests to be nice to API limits (though RateLimiter handles main logic)
    // logging only every 10 items to reduce noise
    if (idx % 10 === 0) console.log(`Processing order ${idx + 1}/${totalPending}...`);

    try {
      while (attempt < maxRetries && !success) {
        try {
          const response = await spApiClient.request(
            'GET',
            `/orders/v0/orders/${order.amazon_order_id}/orderItems`,
            { rateLimiter: RateLimiters.default }
          );
          const items: any[] = response.data?.payload?.OrderItems || [];

          if (items.length > 0) {
            const itemsToUpsert = items.map(item => ({
              amazon_order_item_id: item.OrderItemId,
              amazon_order_id: order.amazon_order_id,
              asin: item.ASIN,
              seller_sku: item.SellerSKU,
              title: item.Title,
              quantity_ordered: item.QuantityOrdered,
              quantity_shipped: item.QuantityShipped,
              item_price_amount: item.ItemPrice ? parseFloat(item.ItemPrice.Amount) : null,
              item_price_currency: item.ItemPrice?.CurrencyCode,
              item_tax_amount: item.ItemTax ? parseFloat(item.ItemTax.Amount) : null,
              item_tax_currency: item.ItemTax?.CurrencyCode,
              shipping_price_amount: item.ShippingPrice ? parseFloat(item.ShippingPrice.Amount) : null,
              shipping_price_currency: item.ShippingPrice?.CurrencyCode,
              promotion_discount_amount: item.PromotionDiscount ? parseFloat(item.PromotionDiscount.Amount) : null,
              promotion_discount_currency: item.PromotionDiscount?.CurrencyCode,
              is_gift: item.IsGift === true || String(item.IsGift) === 'true',
              condition_id: item.ConditionId,
              condition_subtype_id: item.ConditionSubtypeId,
              raw_data: item,
              updated_at: new Date().toISOString()
            }));

            const { error: itemsError } = await db
              .from('amazon_order_items')
              .upsert(itemsToUpsert, { onConflict: 'amazon_order_item_id' });

            if (itemsError) {
              console.error(`Error upserting items for order ${order.amazon_order_id}:`, itemsError);
              failCount++;
            } else {
              itemsSynced += items.length;
              successCount++;
            }
          } else {
            // Order has no items? Mark success anyway to avoid retrying forever if that's a valid state
            successCount++;
          }
          success = true;
        } catch (err: any) {
          if (err?.response?.status === 429 || err?.message?.includes('Throttled') || err?.message?.includes('TooManyRequests')) {
            attempt++;
            const delay = Math.min(15000, Math.pow(2, attempt) * 500 + Math.random() * 500);
            console.log(`Throttled for order ${order.amazon_order_id}, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            console.error(`Failed to fetch items for order ${order.amazon_order_id}:`, err?.message || err);
            failCount++;
            break;
          }
        }
      }
    } finally {
      ordersProcessed++;
    }
  };

  // Run with concurrency of 2 to be safe with rate limits (0.5 req/sec is typical for OrderItems)
  // But our rate limiter handles the pacing, so we can go slightly higher if the limiter works.
  // Using 1 ensures sequential processing to be maximally safe against hitting limits hard.
  await runPool(ordersToSyncItems, processOrder, 1);

  console.log('Sync Complete.');
  console.log(`Processed: ${ordersProcessed}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Items Synced: ${itemsSynced}`);
}

main().catch(console.error);
