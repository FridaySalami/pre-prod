import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabase/supabaseServer';
import { json } from '@sveltejs/kit';
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
  [key: string]: any;
}

interface AmazonOrderItemV2026 {
  orderItemId: string;
  orderId: string;
  asin: string;
  sellerSku?: string;
  title?: string;
  quantityOrdered: number;
  quantityShipped?: number;
  numberItemsShipped?: number;
  itemPrice?: {
    amount: string;
    currencyCode: string;
  };
  itemTax?: {
    amount: string;
    currencyCode: string;
  };
  shippingPrice?: {
    amount: string;
    currencyCode: string;
  };
  promotionDiscount?: {
    amount: string;
    currencyCode: string;
  };
  isGift?: boolean;
  conditionId?: string;
  conditionSubtypeId?: string;
  [key: string]: any;
}

// Helpers
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


export async function GET({ url }) {
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    return json({ error: 'Missing orderId parameter' }, { status: 400 });
  }

  try {
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

    // 1. Fetch Order Details
    console.log(`Fetching order details for ${orderId}...`);
    // Need includedData to get financial and buyer info
    const queryParams: Record<string, string> = {
      marketplaceIds: 'A1F83G8C2ARO7P',
      includedData: 'FULFILLMENT,PROCEEDS,PACKAGES,BUYER,RECIPIENT'
    };

    const orderResponse = await spApiClient.request(
      'GET',
      `/orders/2026-01-01/orders/${orderId}`,
      { queryParams }
    );

    const order: AmazonOrderV2026 = orderResponse.data;
    if (!order || !order.orderId) {
      return json({ error: 'Order not found in Amazon SP-API' }, { status: 404 });
    }

    // Upsert Order to Supabase
    const orderToUpsert = {
      amazon_order_id: order.orderId,
      seller_order_id: order.orderAliases?.find((a: any) => a.aliasType === 'SELLER_ORDER_ID')?.alias,
      purchase_date: order.createdTime,
      last_update_date: order.lastUpdatedTime,
      order_status: mapStatus(order.fulfillment?.fulfillmentStatus),
      fulfillment_channel: mapFulfillmentChannel(order.fulfillment?.fulfilledBy),
      sales_channel: order.salesChannel?.marketplaceName,
      order_total: order.proceeds?.grandTotal ? parseFloat(order.proceeds.grandTotal.amount) : null,
      currency_code: order.proceeds?.grandTotal?.currencyCode,
      number_of_items_shipped: null,
      number_of_items_unshipped: null,
      payment_method: null,
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
      is_global_express_enabled: false,
      is_replacement_order: order.associatedOrders?.some((o: any) => o.associationType === 'REPLACEMENT_ORIGINAL_ID'),
      is_sold_by_ab: false,
      automated_carrier: order.packages?.[0]?.carrier,
      automated_ship_method: order.packages?.[0]?.shippingService,
      raw_data: order,
      updated_at: new Date().toISOString()
    };

    const { error: orderError } = await db
      .from('amazon_orders')
      .upsert(orderToUpsert, { onConflict: 'amazon_order_id' });

    if (orderError) {
      console.error('Error upserting order to Supabase:', orderError);
      return json({ error: 'Failed to save order to database' }, { status: 500 });
    }

    // 2. Fetch Order Items
    console.log(`Fetching items for order ${orderId}...`);
    const itemsResponse = await spApiClient.request(
      'GET',
      `/orders/2026-01-01/orders/${orderId}/orderItems`
    );

    const items: AmazonOrderItemV2026[] = itemsResponse.data?.orderItems || [];

    let itemsSynced = 0;
    if (items.length > 0) {
      const itemsToUpsert = items.map(item => ({
        amazon_order_item_id: item.orderItemId,
        amazon_order_id: order.orderId,
        asin: item.asin,
        seller_sku: item.sellerSku,
        title: item.title,
        quantity_ordered: item.quantityOrdered,
        quantity_shipped: item.quantityShipped ?? item.numberItemsShipped ?? 0,
        item_price_amount: item.itemPrice ? parseFloat(item.itemPrice.amount) : null,
        item_price_currency: item.itemPrice?.currencyCode,
        item_tax_amount: item.itemTax ? parseFloat(item.itemTax.amount) : null,
        item_tax_currency: item.itemTax?.currencyCode,
        shipping_price_amount: item.shippingPrice ? parseFloat(item.shippingPrice.amount) : null,
        shipping_price_currency: item.shippingPrice?.currencyCode,
        promotion_discount_amount: item.promotionDiscount ? parseFloat(item.promotionDiscount.amount) : null,
        promotion_discount_currency: item.promotionDiscount?.currencyCode,
        is_gift: item.isGift === true || String(item.isGift) === 'true',
        condition_id: item.conditionId,
        condition_subtype_id: item.conditionSubtypeId,
        raw_data: item,
        updated_at: new Date().toISOString()
      }));

      const { error: itemsError } = await db
        .from('amazon_order_items')
        .upsert(itemsToUpsert, { onConflict: 'amazon_order_item_id' });

      if (itemsError) {
        console.error(`Error upserting items for order ${orderId}:`, itemsError);
        return json({ error: 'Failed to save order items to database' }, { status: 500 });
      } else {
        itemsSynced = items.length;
      }
    }

    return json({
      success: true,
      message: `Successfully synced order ${orderId} with ${itemsSynced} items`,
      itemsCount: itemsSynced
    });

  } catch (error: any) {
    console.error(`Error syncing order ${orderId}:`, error);
    return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
