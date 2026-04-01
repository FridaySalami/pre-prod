import { RateLimiters } from '$lib/amazon/rate-limiter';
import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabase/supabaseServer';
import { env } from '$env/dynamic/private';

// Define loose interface for v2026 response
interface AmazonOrderV2026 {
  orderId: string;
  orderAliases?: { alias: string; aliasType: string }[];
  createdTime: string;
  lastUpdatedTime: string;
  fulfillment?: {
    fulfillmentStatus?: string;
    fulfilledBy?: string;
    fulfillmentServiceLevel?: string;
    shipByWindow?: {
      earliestDateTime?: string;
      latestDateTime?: string;
    };
    deliverByWindow?: {
      earliestDateTime?: string;
      latestDateTime?: string;
    };
    packing?: {
      giftOption?: boolean;
    };
  };
  salesChannel?: {
    marketplaceId?: string;
    marketplaceName?: string;
  };
  proceeds?: {
    grandTotal?: {
      amount: string;
      currencyCode: string;
    };
  };
  buyer?: {
    buyerEmail?: string;
    buyerName?: string;
  };
  programs?: string[];
  packages?: {
    carrier?: string;
    shippingService?: string;
  }[];
  associatedOrders?: { associationType: string }[];
  orderItems?: any[];
  [key: string]: any;
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
      const missing = cost - this.tokens;
      const waitTime = Math.ceil(missing / this.refillRate);
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

const mapStatus = (status: string | undefined): string => {
  if (!status) return 'Unknown';
  switch (status) {
    case 'CANCELLED': return 'Canceled';
    case 'SHIPPED': return 'Shipped';
    case 'UNSHIPPED': return 'Unshipped';
    case 'PARTIALLY_SHIPPED': return 'PartiallyShipped';
    case 'PENDING': return 'Pending';
    case 'UNFULFILLABLE': return 'Unfulfillable';
    case 'INVOICE_UNCONFIRMED': return 'InvoiceUnconfirmed';
    case 'PENDING_AVAILABILITY': return 'PendingAvailability';
    default: return status;
  }
};

const mapFulfillmentChannel = (channel: string | undefined): string | undefined => {
  if (channel === 'MERCHANT') return 'MFN';
  if (channel === 'AMAZON') return 'AFN';
  return channel;
};

// Helper to extract amounts from the proceeds breakdown structure based on user mapping rules
const extractMoney = (item: any, type: string, subtype?: string) => {
  if (!item.proceeds?.breakdowns || !Array.isArray(item.proceeds.breakdowns)) return null;

  // If looking for a main breakdown type (e.g. ITEM price, SHIPPING price, DISCOUNT)
  // Rule: orderItems[].proceeds.breakdowns[].subtotal where type == X
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

  // If looking for a detailed breakdown (e.g. TAX -> ITEM, TAX -> SHIPPING)
  // Rule: orderItems[].proceeds.breakdowns[].detailedBreakdowns[].value where type == TAX AND subtype == ITEM
  // This implies checking ALL breakdown's detailedBreakdowns, or the breakdown that CONTAINS the detailedBreakdown?
  // Usually tax is under the relevant breakdown (e.g. ITEM tax under ITEM breakdown), or under a TAX breakdown?
  // The user rule says: "orderItems[].proceeds.breakdowns[].detailedBreakdowns[].value type == TAX AND subtype == ITEM"
  // This suggests we scan all breakdowns for any detailedBreakdown matching the criteria.

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

      let allOrders: AmazonOrderV2026[] = [];
      let nextToken: string | undefined;

      const getOrdersLimiter = new TokenBucket(20, 0.0167);

      do {
        if (getOrdersLimiter.tokens < 1) {
          send({ type: 'status', message: 'Rate limit reached, waiting...' });
        }
        await getOrdersLimiter.consume(1);

        const queryParams: Record<string, string> = {
          marketplaceIds: 'A1F83G8C2ARO7P',
          createdAfter: startDate.toISOString(),
          createdBefore: endDate.toISOString(),
          maxResultsPerPage: '50',
          fulfillmentStatuses: 'UNSHIPPED,PARTIALLY_SHIPPED,SHIPPED,CANCELLED,PENDING',
          includedData: 'FULFILLMENT,PROCEEDS,PACKAGES,BUYER,RECIPIENT,PROMOTION' // Added PROMOTION per requirements
        };

        if (nextToken) {
          queryParams.paginationToken = nextToken;
        }

        const response = await spApiClient.request(
          'GET',
          '/orders/2026-01-01/orders',
          {
            queryParams,
            rateLimiter: RateLimiters.listings
          }
        );

        if (response.data?.orders) {
          allOrders = allOrders.concat(response.data.orders);
          send({ type: 'progress', ordersFound: allOrders.length });
        }

        nextToken = response.data?.pagination?.nextToken;

      } while (nextToken);

      console.log(`Fetched ${allOrders.length} orders.`);

      if (allOrders.length === 0) {
        send({ type: 'complete', message: 'No orders found', count: 0 });
        return;
      }

      const ordersToUpsert = allOrders.map((order) => {
        // Calculate total shipping price (revenue) from items to use as a proxy for shipping cost (if actual cost is missing)
        // This ensures the "Shipping Cost" field in the dashboard is populated with the amount charged to the customer.
        const totalShippingPrice = order.orderItems?.reduce((sum: number, item: any) => {
          const shipping = extractMoney(item, 'SHIPPING');
          return sum + (shipping?.amount ?? 0);
        }, 0) ?? 0;

        return {
          amazon_order_id: order.orderId,
          seller_order_id: order.orderAliases?.find((a: any) => a.aliasType === 'SELLER_ORDER_ID')?.alias,
          purchase_date: order.createdTime,
          last_update_date: order.lastUpdatedTime,
          order_status: mapStatus(order.fulfillment?.fulfillmentStatus),
          fulfillment_channel: mapFulfillmentChannel(order.fulfillment?.fulfilledBy),
          sales_channel: order.salesChannel?.marketplaceName,
          order_total: order.proceeds?.grandTotal ? parseFloat(order.proceeds.grandTotal.amount) : null,
          currency_code: order.proceeds?.grandTotal?.currencyCode,
          shipping_cost: totalShippingPrice > 0 ? totalShippingPrice : null,
          order_type: order.programs?.includes('PREORDER') ? 'Preorder' : 'StandardOrder',
          marketplace_id: order.salesChannel?.marketplaceId,
          buyer_email: order.buyer?.buyerEmail,
          buyer_name: order.buyer?.buyerName,
          shipment_service_level_category: order.fulfillment?.fulfillmentServiceLevel,
          earliest_ship_date: order.fulfillment?.shipByWindow?.earliestDateTime,
          latest_ship_date: order.fulfillment?.shipByWindow?.latestDateTime,
          earliest_delivery_date: order.fulfillment?.deliverByWindow?.earliestDateTime,
          latest_delivery_date: order.fulfillment?.deliverByWindow?.latestDateTime,
          is_business_order: order.programs?.includes('AMAZON_BUSINESS') || false,
          is_prime: order.programs?.includes('PRIME') || false,
          is_premium_order: order.programs?.includes('PREMIUM') || false,
          is_replacement_order: order.associatedOrders?.some((o: any) => o.associationType === 'REPLACEMENT_ORIGINAL_ID'),
          automated_carrier: order.packages?.[0]?.carrier,
          automated_ship_method: order.packages?.[0]?.shippingService,
          raw_data: order,
          updated_at: new Date().toISOString()
        };
      });

      const chunkSize = 500;
      let totalUpserted = 0;

      for (let i = 0; i < ordersToUpsert.length; i += chunkSize) {
        const chunk = ordersToUpsert.slice(i, i + chunkSize);
        const result = await db
          .from('amazon_orders')
          .upsert(chunk, { onConflict: 'amazon_order_id', count: 'exact' });

        if (result.error) {
          console.error('Error upserting orders:', result.error);
          send({ type: 'error', error: result.error.message });
          return;
        }

        if (result.count !== null) {
          totalUpserted += result.count;
        }
      }

      let allItems: any[] = [];
      let totalItemsUpserted = 0;

      allOrders.forEach(order => {
        if (order.orderItems && Array.isArray(order.orderItems)) {
          order.orderItems.forEach(item => {
            // Apply Mapping logic
            const itemPrice = extractMoney(item, 'ITEM');
            const shippingPrice = extractMoney(item, 'SHIPPING');
            const promotionDiscount = extractMoney(item, 'DISCOUNT');
            const itemTax = extractMoney(item, 'TAX', 'ITEM');

            // Other fields based on user request:
            // IsGift -> Order.orderItems[].fulfillment.packing.giftOption
            // BuyerInfo.GiftMessageText -> Order.orderItems[].fulfillment.packing.giftMessage

            allItems.push({
              amazon_order_item_id: item.orderItemId,
              amazon_order_id: order.orderId,
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

              // Mapped fields
              is_gift: item?.fulfillment?.packing?.giftOption ?? false,
              condition_id: item.product?.condition?.conditionType,
              condition_subtype_id: item.product?.condition?.conditionSubtype,

              // Additional useful fields if schema supports (mapped to raw_data for now unless explicit columns exist)
              raw_data: item,
              updated_at: new Date().toISOString()
            });
          });
        }
      });

      if (allItems.length > 0) {
        for (let i = 0; i < allItems.length; i += chunkSize) {
          const chunk = allItems.slice(i, i + chunkSize);
          const result = await db
            .from('amazon_order_items')
            .upsert(chunk, { onConflict: 'amazon_order_item_id', count: 'exact' });

          if (result.error) {
            console.error('Error upserting order items:', result.error);
          } else if (result.count !== null) {
            totalItemsUpserted += result.count;
          }
        }
        send({ type: 'progress', message: `Synced ${totalItemsUpserted} items.` });
      }

      send({
        type: 'complete',
        message: `Successfully synced ${allOrders.length} orders and ${totalItemsUpserted} items.`,
      });

    } catch (error: any) {
      console.error('Error syncing Amazon orders:', error);
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
    return new Response(JSON.stringify({ events }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
