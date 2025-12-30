import { SPAPIClient } from '$lib/amazon/sp-api-client';
import { db } from '$lib/supabaseServer';
import { json } from '@sveltejs/kit';
import {
  AMAZON_CLIENT_ID,
  AMAZON_CLIENT_SECRET,
  AMAZON_REFRESH_TOKEN,
  AMAZON_AWS_ACCESS_KEY_ID,
  AMAZON_AWS_SECRET_ACCESS_KEY,
  AMAZON_SELLER_ID,
  AMAZON_ROLE_ARN
} from '$env/static/private';

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

export async function GET({ url }) {
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    return json({ error: 'Missing orderId parameter' }, { status: 400 });
  }

  try {
    const spApiClient = new SPAPIClient({
      clientId: AMAZON_CLIENT_ID,
      clientSecret: AMAZON_CLIENT_SECRET,
      refreshToken: AMAZON_REFRESH_TOKEN,
      awsAccessKeyId: AMAZON_AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: AMAZON_AWS_SECRET_ACCESS_KEY,
      awsRegion: 'eu-west-1',
      marketplaceId: 'A1F83G8C2ARO7P',
      sellerId: AMAZON_SELLER_ID,
      roleArn: AMAZON_ROLE_ARN
    });

    // 1. Fetch Order Details
    console.log(`Fetching order details for ${orderId}...`);
    const orderResponse = await spApiClient.request(
      'GET',
      `/orders/v0/orders/${orderId}`
    );

    const order = orderResponse.data?.payload;
    if (!order) {
      return json({ error: 'Order not found in Amazon SP-API' }, { status: 404 });
    }

    // Upsert Order to Supabase
    const orderToUpsert = {
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
      `/orders/v0/orders/${orderId}/orderItems`
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
        console.error(`Error upserting items for order ${orderId}:`, itemsError);
        return json({ error: 'Failed to save order items to database' }, { status: 500 });
      }
    }

    return json({
      success: true,
      message: `Successfully synced order ${orderId} with ${items.length} items`,
      itemsCount: items.length
    });

  } catch (error: any) {
    console.error(`Error syncing order ${orderId}:`, error);
    return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
