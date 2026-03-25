import { RateLimiters } from '$lib/amazon/rate-limiter';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabase/supabaseServer';
import { env } from '$env/dynamic/private';

// Helper to extract amounts from the proceeds breakdown structure based on user mapping rules
const extractMoney = (item: any, type: string, subtype?: string) => {
  if (!item.proceeds?.breakdowns || !Array.isArray(item.proceeds.breakdowns)) return null;

  if (!subtype) {
    const breakdown = item.proceeds.breakdowns.find((b: any) => b.type === type);
    if (breakdown?.subtotal) {
      return {
        amount: parseFloat(breakdown.subtotal.amount),
        currency: breakdown.subtotal.currencyCode
      };
    }
    return null;
  }

  for (const breakdown of item.proceeds.breakdowns) {
    if (breakdown.detailedBreakdowns && Array.isArray(breakdown.detailedBreakdowns)) {
      const detailed = breakdown.detailedBreakdowns.find((d: any) => d.type === type && d.subtype === subtype);
      if (detailed?.value) {
        return {
          amount: parseFloat(detailed.value.amount),
          currency: detailed.value.currencyCode
        };
      }
    }
  }

  return null;
};

// Simple pool for concurrent requests
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

// Global instance 
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
  const session = await locals.getSession();
  const authHeader = request.headers.get('Authorization');
  const cronSecret = env.CRON_SECRET;
  const isCronAuth = authHeader === `Bearer ${cronSecret}`;

  if (!session && !isCronAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const shouldStream = url.searchParams.get('stream') !== 'false' && request.headers.get('accept') !== 'application/json';

  const runSync = async (send: (data: any) => void) => {
    try {
      const spApiClient = getSpApiClient();

      // Determine date range for finding missing items
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

      // Fetch orders in range
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

      // Identify orders missing items
      const orderIds = dbOrders.map(o => o.amazon_order_id);
      const { data: existingItemsData, error: existingItemsError } = await db
        .from('amazon_order_items')
        .select('amazon_order_id')
        .in('amazon_order_id', orderIds);

      if (existingItemsError) throw existingItemsError;

      const ordersWithItems = new Set<string>();
      if (existingItemsData) {
        existingItemsData.forEach(i => ordersWithItems.add(i.amazon_order_id));
      }

      let ordersToSyncItems = dbOrders.filter(o => !ordersWithItems.has(o.amazon_order_id));

      // Limit concurrent processing
      const MAX_ITEMS_PER_RUN = 10;
      const totalPending = ordersToSyncItems.length;
      if (ordersToSyncItems.length > MAX_ITEMS_PER_RUN) {
        console.log(`Limiting sync to ${MAX_ITEMS_PER_RUN} items (out of ${totalPending} pending).`);
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

      const processOrder = async (order: { amazon_order_id: string }, idx: number) => {
        const maxRetries = 3;
        let attempt = 0;
        let success = false;

        // Rate limit: GetOrder is 0.5 RPS (2s per request ideally, but burst allows faster).
        // With pool of 3, we might hit limits. Spacing out initial requests helps.
        await new Promise(r => setTimeout(r, idx * 500));

        while (attempt < maxRetries && !success) {
          try {
            // Use GetOrder v2026 to get items inside order object
            const response = await spApiClient.request(
              'GET',
              `/orders/2026-01-01/orders/${order.amazon_order_id}`,
              {
                queryParams: {
                  includedData: 'FULFILLMENT,PROCEEDS,PACKAGES,BUYER,RECIPIENT,PROMOTION'
                },
                rateLimiter: RateLimiters.default // Should be fine for GetOrder
              }
            );

            // The response IS the order object (unlike ListOrders)
            const orderData = response.data;
            const items = orderData?.orderItems || [];

            if (items.length > 0) {
              const itemsToUpsert = items.map((item: any) => {
                const itemPrice = extractMoney(item, 'ITEM');
                const shippingPrice = extractMoney(item, 'SHIPPING');
                const promotionDiscount = extractMoney(item, 'DISCOUNT');
                const itemTax = extractMoney(item, 'TAX', 'ITEM');

                return {
                  amazon_order_item_id: item.orderItemId,
                  amazon_order_id: order.amazon_order_id,
                  asin: item.product?.asin,
                  seller_sku: item.product?.sellerSku,
                  title: item.product?.title,
                  quantity_ordered: item.quantityOrdered,
                  quantity_shipped: item.fulfillment?.quantityFulfilled ?? 0,

                  item_price_amount: itemPrice?.amount ?? null,
                  item_price_currency: itemPrice?.currency ?? null,

                  item_tax_amount: itemTax?.amount ?? null,
                  item_tax_currency: itemTax?.currency ?? null,

                  shipping_price_amount: shippingPrice?.amount ?? null,
                  shipping_price_currency: shippingPrice?.currency ?? null,

                  promotion_discount_amount: promotionDiscount?.amount ?? null,
                  promotion_discount_currency: promotionDiscount?.currency ?? null,

                  is_gift: item?.fulfillment?.packing?.giftOption ?? false,
                  condition_id: item.product?.condition?.conditionType,
                  condition_subtype_id: item.product?.condition?.conditionSubtype,

                  raw_data: item,
                  updated_at: new Date().toISOString()
                };
              });

              const { error: itemsError } = await db
                .from('amazon_order_items')
                .upsert(itemsToUpsert, { onConflict: 'amazon_order_item_id' });

              if (itemsError) {
                console.error(`Error upserting items for order ${order.amazon_order_id}:`, itemsError);
              } else {
                itemsSynced += items.length;
              }
            } else {
              console.log(`No items found in response for order ${order.amazon_order_id}`);
            }
            success = true;
          } catch (err: any) {
            if (err?.response?.status === 429 || err?.message?.includes('Throttled')) {
              attempt++;
              const delay = Math.min(10000, Math.pow(2, attempt) * 1000);
              console.log(`Throttled for order ${order.amazon_order_id}, retrying in ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
            } else if (err?.response?.status === 404) {
              console.error(`Order not found: ${order.amazon_order_id}`);
              success = true;
            } else {
              console.error(`Failed to fetch items for order ${order.amazon_order_id}:`, err?.message || err);
              attempt++;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
        ordersProcessed++;
        send({ type: 'progress', ordersProcessed, totalOrders: ordersToSyncItems.length, itemsSynced });
      };

      if (ordersToSyncItems.length > 0) {
        await runPool(ordersToSyncItems, processOrder, 2); // Concurrency 2 to be safe with 0.5 RPS limit
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
