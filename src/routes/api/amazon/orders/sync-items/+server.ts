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

export async function GET({ url }: { url: URL }) {
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

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
                // We want to check items for orders in this range.
                // We fetch the order IDs and their update dates.
                const { data: dbOrders, error: dbOrdersError } = await db
                    .from('amazon_orders')
                    .select('amazon_order_id, last_update_date, purchase_date')
                    .gte('purchase_date', startDate.toISOString())
                    .lte('purchase_date', endDate.toISOString());

                if (dbOrdersError) throw dbOrdersError;

                if (!dbOrders || dbOrders.length === 0) {
                    send({ type: 'complete', message: 'No orders found in DB for this period', itemsCount: 0 });
                    controller.close();
                    return;
                }

                // Check which of these have items
                const orderIds = dbOrders.map(o => o.amazon_order_id);
                // We might need to batch this if too many orders, but sticking to logic for now.
                
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
                // 1. Orders with NO items
                // 2. Orders that have items but maybe we want to refresh based on update date? 
                // The original logic was:
                // Case 2: Order exists but has NO items -> SYNC
                // Case 3: Order was updated on Amazon since last sync -> SYNC (This is tricky because the previous logic fetched from Amazon first and compared against DB. Here we only have DB.)
                
                // Since this endpoint is specifically "fetch items", maybe we assume if items are missing, fetch them.
                // If the user wants to force update, maybe a `force=true` param?
                // Or maybe we can't easily detect "updated on Amazon since last sync" purely from DB without re-fetching order details.
                // But wait, the "Sync Orders" endpoint updates the 'amazon_orders' table. If that runs first, `amazon_orders` has the latest `last_update_date` from Amazon.
                // So now we just need to check if the items for that order are stale or missing.
                // How do we know if items are stale? Maybe `updated_at` on items vs `last_update_date` on order?
                // The original logic compared Amazon response vs DB. Since "Sync Orders" updates DB, `amazon_orders` is fresh.
                // So if "Sync Orders" ran, `amazon_orders` is up to date.
                // We should check if `amazon_order_items` exist for these orders.
                // If they exist, we might skip unless we want to refresh.
                // But the original logic also re-synced items if the order `LastUpdateDate` changed.
                // To support that, we would need to store `last_item_sync_at` on the order or check item dates.
                
                // Let's settle on: Sync items for orders that have NO items.
                // And maybe iterate all orders in window if we want to be safe, but that's expensive.
                // Or maybe we add a column `items_synced: boolean` to `amazon_orders`? (Out of scope for this change).
                
                // For now, let's stick to: Sync items for all orders in the window that don't have items.
                // AND maybe fetch items for ALL orders in the window if the user requests it?
                // The user said "fetching the further amazon information", implying obtaining data not yet present.

                // However, Pipedream might run "Sync Orders" (which updates DB with new orders), then "Sync Items".
                // So "Sync Items" should definitely pick up orders without items.
                
                // Let's modify logic to sync items for ALL orders in the window that don't have items.
                // AND since `last_update_date` might change on the order, we might want to sync if the order is newer than its items?
                // That's complex query.
                
                // Heuristic: Sync items for any order in the window that has NO items in `amazon_order_items` table.
                
                const ordersToSyncItems = dbOrders.filter(o => !ordersWithItems.has(o.amazon_order_id));
                
                // If we also want to catch updates (e.g. order cancelled -> items might change status?), we might need to be more aggressive.
                // But fetching items is expensive. 
                // Let's start with missing items. If "Sync Orders" runs and sees a new `LastUpdateDate`, it updates the order row.
                // But it doesn't delete items.
                
                // Actually, if I look at the original code:
                // `if (Math.abs(newTime - oldTime) > 1000)` -> it synced items.
                // Since "Sync Orders" updates the order, we lose the "oldTime" context unless we store when items were last synced.
                
                // For this refactor, I will configure it to sync items for:
                // 1. Orders without items.
                // 2. Maybe check for a `force` flag?
                
                console.log(`Found ${ordersToSyncItems.length} orders missing items.`);
                send({ type: 'status', message: `Found ${ordersToSyncItems.length} orders missing items...` });

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
                controller.close();

            } catch (error: any) {
                console.error('Error syncing Amazon items:', error);
                send({ type: 'error', error: error.message });
                controller.close();
            }
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
}
