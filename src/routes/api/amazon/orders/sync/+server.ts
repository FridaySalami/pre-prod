import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabaseServer';
import { env } from '$env/dynamic/private';

interface AmazonOrder {
  AmazonOrderId: string;
  SellerOrderId?: string;
  PurchaseDate: string;
  LastUpdateDate: string;
  OrderStatus: string;
  FulfillmentChannel?: string;
  SalesChannel?: string;
  OrderTotal?: {
    CurrencyCode: string;
    Amount: string;
  };
  NumberOfItemsShipped?: number;
  NumberOfItemsUnshipped?: number;
  PaymentMethod?: string;
  OrderType?: string;
  MarketplaceId?: string;
  BuyerEmail?: string;
  BuyerInfo?: {
    BuyerEmail?: string;
    BuyerName?: string;
  };
  ShipmentServiceLevelCategory?: string;
  EarliestShipDate?: string;
  LatestShipDate?: string;
  EarliestDeliveryDate?: string;
  LatestDeliveryDate?: string;
  IsBusinessOrder?: boolean;
  IsPrime?: boolean;
  IsPremiumOrder?: boolean;
  IsGlobalExpressEnabled?: boolean;
  IsReplacementOrder?: boolean;
  IsSoldByAB?: boolean;
  AutomatedShippingSettings?: {
    HasAutomatedShippingSettings?: boolean;
    AutomatedCarrier?: string;
    AutomatedShipMethod?: string;
  };
}

interface AmazonOrderItem {
  ASIN: string;
  SellerSKU?: string;
  OrderItemId: string;
  Title?: string;
  QuantityOrdered: number;
  QuantityShipped?: number;
  ItemPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  ItemTax?: {
    CurrencyCode: string;
    Amount: string;
  };
  ShippingPrice?: {
    CurrencyCode: string;
    Amount: string;
  };
  PromotionDiscount?: {
    CurrencyCode: string;
    Amount: string;
  };
  IsGift?: boolean;
  ConditionId?: string;
  ConditionSubtypeId?: string;
}

class TokenBucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
  lastRefill: number;

  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
    if (this.refillRate <= 0) throw new Error("Refill rate must be positive");
  }

  async consume(cost: number = 1) {
    while (true) {
      this.refill();
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      // Wait for enough tokens
      const missing = cost - this.tokens;
      const waitTime = Math.ceil(missing / this.refillRate);
      // Clamp to min 50ms to avoid busy waiting
      await new Promise(resolve => setTimeout(resolve, Math.max(50, waitTime)));
    }
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
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

export async function GET({ url }: { url: URL }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Initialize Amazon SP-API client
        const spApiClient = new SPAPIClient({
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

        // Calculate date range
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

        console.log(`Fetching Amazon orders for ${startDate.toISOString()} to ${endDate.toISOString()}`);
        send({ type: 'status', message: 'Fetching orders...' });

        let allOrders: AmazonOrder[] = [];
        let nextToken: string | undefined;

        // Rate limiter for getOrders: 0.0167 rps (1 per 60s), burst 20
        const getOrdersLimiter = new TokenBucket(20, 0.0167);

        do {
          if (getOrdersLimiter.tokens < 1) {
            send({ type: 'status', message: 'Rate limit reached for getOrders; waiting for refill...' });
          }
          await getOrdersLimiter.consume(1);

          const queryParams: Record<string, string> = nextToken
            ? { NextToken: nextToken }
            : {
              MarketplaceIds: 'A1F83G8C2ARO7P', // UK Marketplace
              CreatedAfter: startDate.toISOString(),
              CreatedBefore: endDate.toISOString(),
              MaxResultsPerPage: '100'
            };

          const response = await spApiClient.request(
            'GET',
            '/orders/v0/orders',
            { queryParams }
          );

          if (response.data?.payload?.Orders) {
            allOrders = allOrders.concat(response.data.payload.Orders);
            send({ type: 'progress', ordersFound: allOrders.length });
          }

          nextToken = response.data?.payload?.NextToken;

        } while (nextToken);

        console.log(`Fetched ${allOrders.length} orders.`);

        if (allOrders.length === 0) {
          send({ type: 'complete', message: 'No orders found for yesterday', count: 0 });
          controller.close();
          return;
        }

        // Transform orders for Supabase
        const ordersToUpsert = allOrders.map(order => ({
          amazon_order_id: order.AmazonOrderId,
          seller_order_id: order.SellerOrderId,
          purchase_date: order.PurchaseDate,
          last_update_date: order.LastUpdateDate,
          order_status: order.OrderStatus,
          fulfillment_channel: order.FulfillmentChannel,
          sales_channel: order.SalesChannel,
          order_total: order.OrderTotal ? parseFloat(order.OrderTotal.Amount) : null,
          currency_code: order.OrderTotal?.CurrencyCode,
          number_of_items_shipped: order.NumberOfItemsShipped,
          number_of_items_unshipped: order.NumberOfItemsUnshipped,
          payment_method: order.PaymentMethod,
          order_type: order.OrderType,
          marketplace_id: order.MarketplaceId,
          buyer_email: order.BuyerInfo?.BuyerEmail || order.BuyerEmail,
          buyer_name: order.BuyerInfo?.BuyerName,
          shipment_service_level_category: order.ShipmentServiceLevelCategory,
          earliest_ship_date: order.EarliestShipDate,
          latest_ship_date: order.LatestShipDate,
          earliest_delivery_date: order.EarliestDeliveryDate,
          latest_delivery_date: order.LatestDeliveryDate,
          is_business_order: order.IsBusinessOrder,
          is_prime: order.IsPrime,
          is_premium_order: order.IsPremiumOrder,
          is_global_express_enabled: order.IsGlobalExpressEnabled,
          is_replacement_order: order.IsReplacementOrder,
          is_sold_by_ab: order.IsSoldByAB,
          automated_carrier: order.AutomatedShippingSettings?.AutomatedCarrier,
          automated_ship_method: order.AutomatedShippingSettings?.AutomatedShipMethod,
          raw_data: order,
          updated_at: new Date().toISOString()
        }));

        // Upsert to Supabase in chunks
        const chunkSize = 500;
        for (let i = 0; i < ordersToUpsert.length; i += chunkSize) {
          const chunk = ordersToUpsert.slice(i, i + chunkSize);
          const { error } = await db
            .from('amazon_orders')
            .upsert(chunk, { onConflict: 'amazon_order_id' });

          if (error) {
            console.error('Error upserting orders to Supabase:', error);
            send({ type: 'error', error: error.message });
            controller.close();
            return;
          }
        }

        // Fetch and sync order items
        console.log(`Fetching items for ${allOrders.length} orders...`);
        send({ type: 'status', message: `Syncing items for ${allOrders.length} orders...` });

        let itemsSynced = 0;
        let ordersProcessed = 0;

        // Rate limiter for getOrderItems: 0.5 rps, burst 30
        const rateLimiter = new TokenBucket(30, 0.5);
        // Process orders concurrently with rate limiting and pool
        const processOrder = async (order: AmazonOrder) => {
          const maxRetries = 5;
          let attempt = 0;
          let success = false;

          try {
            while (attempt < maxRetries && !success) {
              try {
                await rateLimiter.consume(1);

                const itemsResponse = await spApiClient.request(
                  'GET',
                  `/orders/v0/orders/${order.AmazonOrderId}/orderItems`
                );

                const items: AmazonOrderItem[] = itemsResponse.data?.payload?.OrderItems || [];

                if (items.length > 0) {
                  const itemsToUpsert = items.map(item => ({
                    amazon_order_item_id: item.OrderItemId,
                    amazon_order_id: order.AmazonOrderId,
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
                    console.error(`Error upserting items for order ${order.AmazonOrderId}:`, itemsError);
                  } else {
                    itemsSynced += items.length;
                  }
                }
                success = true;
              } catch (err: any) {
                if (err?.response?.status === 429 || err?.message?.includes('Throttled') || err?.message?.includes('TooManyRequests')) {
                  attempt++;
                  // Exponential backoff with jitter: 2^attempt * 500ms + jitter
                  const delay = Math.min(15000, Math.pow(2, attempt) * 500 + Math.random() * 500);
                  console.log(`Throttled for order ${order.AmazonOrderId}, retrying in ${delay.toFixed(0)}ms (attempt ${attempt}/${maxRetries})`);
                  await new Promise(r => setTimeout(r, delay));
                } else {
                  console.error(`Failed to fetch items for order ${order.AmazonOrderId}:`, err);
                  break; // Fatal error, don't retry
                }
              }
            }
          } finally {
            ordersProcessed++;
            send({ type: 'progress', ordersProcessed, totalOrders: allOrders.length, itemsSynced });
          }
        };

        await runPool(allOrders, processOrder, 8);

        send({
          type: 'complete',
          message: `Successfully synced ${allOrders.length} orders and ${itemsSynced} items`,
          count: allOrders.length,
          itemsCount: itemsSynced
        });
        controller.close();

      } catch (error: any) {
        console.error('Error syncing Amazon orders:', error);
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
