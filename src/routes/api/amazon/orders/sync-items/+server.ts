import { RateLimiters } from '$lib/amazon/rate-limiter';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabaseServer';
import { env } from '$env/dynamic/private';

interface AmazonOrder {
  amazon_order_id: string;
  last_update_date: string;
  // Add other fields if needed for processing
}

interface AmazonOrderItem {
  // ... define fields we insert
  amazon_order_item_id: string;
  amazon_order_id: string;
  asin: string;
  seller_sku?: string;
  title?: string;
  quantity_ordered: number;
  // ... complete this from existing code
}

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

// Global instance to reuse between requests
let spApiClientInstance: SPAPIClient | null = null;
function getSpApiClient() {
  if (!spApiClientInstance) {
    spApiClientInstance = new SPAPIClient({
      clientId: env.AMAZON_CLIENT_ID,
      clientSecret: env.AMAZON_CLIENT_SECRET,
      refreshToken: env.AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: env.AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: env.AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: 'eu-west-1',
      marketplaceId: 'A1F83G8C2ARO7P',
      sellerId: env.AMAZON_SELLER_ID,
      roleArn: env.AMAZON_ROLE_ARN
    });
  }
  return spApiClientInstance;
}

export async function GET({ url, request, locals }: { url: URL; request: Request; locals: App.Locals }) {
  // Check authentication: either logged in user session OR cron secret
  const session = await locals.getSession();
  const authHeader = request.headers.get('Authorization');
  const cronSecret = env.CRON_SECRET;
  const isCronAuth = authHeader === `Bearer ${cronSecret}`;

  if (!session && !isCronAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Determine if we should stream or wait for completion
  const shouldStream = url.searchParams.get('stream') !== 'false' && request.headers.get('accept') !== 'application/json';

  const runSync = async (send: (data: any) => void) => {
    try {
      const spApiClient = getSpApiClient();

      // Calculate date range from params or defaults
      const dateParam = url.searchParams.get('date');
      const viewParam = url.searchParams.get('view') || 'daily';
      let targetDate: Date;
      if (dateParam) {
        targetDate = new Date(dateParam);
      } else {
        const now = new Date();
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() - 1);
      }
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(endDate);
      if (viewParam === 'weekly') {
        startDate.setDate(startDate.getDate() - 6);
      } else {
        startDate.setDate(targetDate.getDate());
      }
      startDate.setHours(0, 0, 0, 0);

      console.log(`Searching DB for orders needing item sync between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      send({ type: 'status', message: 'Checking database for orders...' });

      // Fetch recent orders from DB
      const { data: dbOrders, error: dbOrdersError } = await db
        .from('amazon_orders')
        .select('amazon_order_id, last_update_date, purchase_date')
        .gte('purchase_date', startDate.toISOString())
        .lte('purchase_date', endDate.toISOString());

      if (dbOrdersError) throw dbOrdersError;

      if (!dbOrders || dbOrders.length === 0) {
        send({ type: 'complete', message: 'No orders found in DB for this period', itemsCount: 0 });
        return;
      }

      // Check which of these have items
      const orderIds = dbOrders.map(o => o.amazon_order_id);

      // Fetch existing items to see which orders already have them
      const { data: existingItemsData, error: existingItemsError } = await db
        .from('amazon_order_items')
        .select('amazon_order_id')
        .in('amazon_order_id', orderIds);

      if (existingItemsError) throw existingItemsError;

      const ordersWithItems = new Set<string>();
      if (existingItemsData) {
        existingItemsData.forEach(i => ordersWithItems.add(i.amazon_order_id));
      }

      // Filter orders that need item sync
      let ordersToSyncItems = dbOrders.filter(o => !ordersWithItems.has(o.amazon_order_id));

      // Limit to prevent timeouts on Netlify/Pipedream (avoid >30s execution)
      const MAX_ITEMS_PER_RUN = 5;
      const totalPending = ordersToSyncItems.length;
      if (ordersToSyncItems.length > MAX_ITEMS_PER_RUN) {
        console.log(`Limiting sync to ${MAX_ITEMS_PER_RUN} items (out of ${totalPending} pending) to prevent timeout.`);
        ordersToSyncItems = ordersToSyncItems.slice(0, MAX_ITEMS_PER_RUN);
      }

      console.log(`Found ${totalPending} orders missing items. Processing ${ordersToSyncItems.length}...`);
      send({
        type: 'status',
        message: `Found ${totalPending} orders missing items. Processing batch of ${ordersToSyncItems.length}...`,
        pendingCount: totalPending,
        processedCount: ordersToSyncItems.length
      });

      let itemsSynced = 0;
      let ordersProcessed = 0;

      const processOrder = async (order: { amazon_order_id: string }) => {
        const maxRetries = 5;
        let attempt = 0;
        let success = false;

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
                } else {
                  itemsSynced += items.length;
                }
              }
              success = true;
            } catch (err: any) {
              if (err?.response?.status === 429 || err?.message?.includes('Throttled') || err?.message?.includes('TooManyRequests')) {
                attempt++;
                const delay = Math.min(15000, Math.pow(2, attempt) * 500 + Math.random() * 500);
                console.log(`Throttled for order ${order.amazon_order_id}, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
              } else {
                console.error(`Failed to fetch items for order ${order.amazon_order_id}:`, err);
                break;
              }
            }
          }
        } finally {
          ordersProcessed++;
          send({ type: 'progress', ordersProcessed, totalOrders: ordersToSyncItems.length, itemsSynced });
        }
      };

      // Processing pool
      if (ordersToSyncItems.length > 0) {
        await runPool(ordersToSyncItems, processOrder, 5); // Conservative concurrency
      }

      send({
        type: 'complete',
        message: `Successfully synced items for ${ordersToSyncItems.length} orders (${itemsSynced} items updated)`,
        count: ordersToSyncItems.length,
        itemsCount: itemsSynced
      });

    } catch (error: any) {
      console.error('Error syncing Amazon items:', error);
      send({ type: 'error', error: error.message });
    }
  };

  if (shouldStream) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        await runSync(send);
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } else {
    const events: any[] = [];
    const send = (data: any) => events.push(data);
    await runSync(send);
    return new Response(JSON.stringify({ events }), { headers: { 'Content-Type': 'application/json' } });
  }
}
