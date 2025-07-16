#!/usr/bin/env node

/**
 * Single Order Deep Dive - Show ALL available data from Amazon SP-API
 * 
 * This script retrieves and displays every piece of data Amazon provides
 * for a single order, including shipping, fees, promotions, and more.
 * 
 * Usage:
 *   node order-deep-dive.cjs ORDER_ID
 *   node order-deep-dive.cjs 202-4161653-8890739
 *   node order-deep-dive.cjs --recent                (analyze most recent order)
 */

require('dotenv').config();
const { AmazonSPAPI } = require('./render-service/services/amazon-spapi');

// Mock Supabase client for this test
const mockSupabaseClient = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  })
};

// Parse command line arguments
const args = process.argv.slice(2);
const isRecent = args.includes('--recent');

if (args.length === 0 || (!isRecent && args.length === 0)) {
  console.log('❌ Please provide an order ID or use --recent');
  console.log('Usage: node order-deep-dive.cjs ORDER_ID');
  console.log('       node order-deep-dive.cjs 202-4161653-8890739');
  console.log('       node order-deep-dive.cjs --recent');
  console.log('');
  console.log('💡 To find order IDs, run: node smart-orders.cjs --limit 5');
  process.exit(1);
}

const orderId = isRecent ? null : args[0];

function formatCurrency(amount, currency = 'GBP') {
  if (!amount) return 'N/A';
  return `£${parseFloat(amount).toFixed(2)} ${currency}`;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
}

function displayObject(obj, indent = '   ') {
  if (!obj || typeof obj !== 'object') return `${indent}${obj || 'N/A'}`;

  let result = '';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      result += `${indent}${key}:\n${displayObject(value, indent + '   ')}\n`;
    } else {
      result += `${indent}${key}: ${value || 'N/A'}\n`;
    }
  }
  return result;
}

async function analyzeOrder() {
  try {
    console.log('🔍 AMAZON ORDER DEEP DIVE ANALYSIS');
    console.log('===================================');
    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    let targetOrderId = orderId;

    // If --recent flag, get the most recent order
    if (isRecent) {
      console.log('🔍 Finding most recent order...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const ordersResponse = await amazonAPI.getOrders(
        yesterday.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        5
      );

      const orders = ordersResponse?.payload?.Orders || [];
      if (orders.length === 0) {
        console.log('❌ No recent orders found. Try a specific order ID.');
        return;
      }

      targetOrderId = orders[0].AmazonOrderId;
      console.log(`✅ Using most recent order: ${targetOrderId}`);
      console.log('');
    }

    console.log(`📋 ANALYZING ORDER: ${targetOrderId}`);
    console.log('=====================================');
    console.log('');

    // Step 1: Get order details
    console.log('📦 STEP 1: ORDER HEADER INFORMATION');
    console.log('===================================');

    // Use a wider date range to find the order
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const ordersResponse = await amazonAPI.getOrders(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
      100
    );

    const orders = ordersResponse?.payload?.Orders || [];
    const order = orders.find(o => o.AmazonOrderId === targetOrderId);

    if (!order) {
      console.log('❌ Order not found. Please check the order ID.');
      return;
    }

    // Display complete order information
    console.log('🏷️  ORDER BASICS:');
    console.log(`   Order ID: ${order.AmazonOrderId}`);
    console.log(`   Purchase Date: ${formatDate(order.PurchaseDate)}`);
    console.log(`   Last Updated: ${formatDate(order.LastUpdateDate)}`);
    console.log(`   Order Status: ${order.OrderStatus}`);
    console.log(`   Order Type: ${order.OrderType || 'StandardOrder'}`);
    console.log(`   Sales Channel: ${order.SalesChannel || 'Amazon'}`);
    console.log(`   Marketplace: ${order.MarketplaceId}`);
    console.log('');

    console.log('💰 FINANCIAL SUMMARY:');
    console.log(`   Order Total: ${formatCurrency(order.OrderTotal?.Amount, order.OrderTotal?.CurrencyCode)}`);
    console.log(`   Items Shipped: ${order.NumberOfItemsShipped || 0}`);
    console.log(`   Items Unshipped: ${order.NumberOfItemsUnshipped || 0}`);
    console.log('');

    console.log('🚚 SHIPPING INFORMATION:');
    console.log(`   Service Level: ${order.ShipServiceLevel || 'N/A'}`);
    console.log(`   Fulfillment Channel: ${order.FulfillmentChannel || 'MFN'}`);
    console.log(`   Is Business Order: ${order.IsBusinessOrder ? 'Yes' : 'No'}`);
    console.log(`   Is Prime: ${order.IsPrime ? 'Yes' : 'No'}`);
    console.log(`   Is Premium Order: ${order.IsPremiumOrder ? 'Yes' : 'No'}`);
    console.log(`   Is Global Express: ${order.IsGlobalExpressEnabled ? 'Yes' : 'No'}`);
    console.log('');

    if (order.ShippingAddress) {
      console.log('📍 SHIPPING ADDRESS:');
      const addr = order.ShippingAddress;
      console.log(`   Name: ${addr.Name || 'N/A'}`);
      console.log(`   Address Line 1: ${addr.AddressLine1 || 'N/A'}`);
      console.log(`   Address Line 2: ${addr.AddressLine2 || 'N/A'}`);
      console.log(`   Address Line 3: ${addr.AddressLine3 || 'N/A'}`);
      console.log(`   City: ${addr.City || 'N/A'}`);
      console.log(`   County: ${addr.County || 'N/A'}`);
      console.log(`   District: ${addr.District || 'N/A'}`);
      console.log(`   State/Region: ${addr.StateOrRegion || 'N/A'}`);
      console.log(`   Postal Code: ${addr.PostalCode || 'N/A'}`);
      console.log(`   Country: ${addr.CountryCode || 'N/A'}`);
      console.log(`   Phone: ${addr.Phone || 'N/A'}`);
      console.log(`   Address Type: ${addr.AddressType || 'N/A'}`);
      console.log('');
    }

    if (order.PaymentMethodDetails) {
      console.log('💳 PAYMENT INFORMATION:');
      console.log(`   Payment Methods: ${order.PaymentMethodDetails.join(', ')}`);
      console.log('');
    }

    if (order.BuyerInfo) {
      console.log('👤 BUYER INFORMATION:');
      console.log(`   Email: ${order.BuyerInfo.BuyerEmail || 'N/A'}`);
      console.log(`   Name: ${order.BuyerInfo.BuyerName || 'N/A'}`);
      console.log(`   County: ${order.BuyerInfo.BuyerCounty || 'N/A'}`);
      console.log(`   Tax Info: ${order.BuyerInfo.BuyerTaxInfo || 'N/A'}`);
      console.log('');
    }

    // Step 2: Get detailed order items
    console.log('📦 STEP 2: DETAILED ITEM BREAKDOWN');
    console.log('==================================');

    console.log('⏱️  Fetching detailed item information...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting delay

    const orderItemsResponse = await amazonAPI.getOrderItems(targetOrderId);
    const orderItems = orderItemsResponse?.payload?.OrderItems || [];

    if (orderItems.length === 0) {
      console.log('❌ No items found for this order.');
      return;
    }

    console.log(`✅ Found ${orderItems.length} item(s) in this order`);
    console.log('');

    let totalItemPrice = 0;
    let totalShippingPrice = 0;
    let totalTax = 0;
    let totalShippingTax = 0;
    let totalPromotionDiscount = 0;
    let totalShippingDiscount = 0;

    orderItems.forEach((item, index) => {
      console.log(`🛍️  ITEM ${index + 1}:`);
      console.log(`   ASIN: ${item.ASIN}`);
      console.log(`   Seller SKU: ${item.SellerSKU}`);
      console.log(`   Order Item ID: ${item.OrderItemId}`);
      console.log(`   Title: ${item.Title}`);
      console.log(`   Quantity Ordered: ${item.QuantityOrdered}`);
      console.log(`   Quantity Shipped: ${item.QuantityShipped || 0}`);
      console.log(`   Product Info: ${item.ProductInfo ? displayObject(item.ProductInfo) : 'N/A'}`);
      console.log(`   Condition: ${item.ConditionId || 'New'}`);
      console.log(`   Condition Subtype: ${item.ConditionSubtypeId || 'N/A'}`);
      console.log(`   Condition Note: ${item.ConditionNote || 'N/A'}`);
      console.log('');

      console.log('💰 PRICING BREAKDOWN:');

      // Item Price
      if (item.ItemPrice) {
        const itemPrice = parseFloat(item.ItemPrice.Amount) || 0;
        totalItemPrice += itemPrice;
        console.log(`   Item Price: ${formatCurrency(item.ItemPrice.Amount, item.ItemPrice.CurrencyCode)}`);
      }

      // Shipping Price
      if (item.ShippingPrice) {
        const shippingPrice = parseFloat(item.ShippingPrice.Amount) || 0;
        totalShippingPrice += shippingPrice;
        console.log(`   Shipping Price: ${formatCurrency(item.ShippingPrice.Amount, item.ShippingPrice.CurrencyCode)}`);
      }

      // Item Tax
      if (item.ItemTax) {
        const itemTax = parseFloat(item.ItemTax.Amount) || 0;
        totalTax += itemTax;
        console.log(`   Item Tax: ${formatCurrency(item.ItemTax.Amount, item.ItemTax.CurrencyCode)}`);
      }

      // Shipping Tax
      if (item.ShippingTax) {
        const shippingTax = parseFloat(item.ShippingTax.Amount) || 0;
        totalShippingTax += shippingTax;
        console.log(`   Shipping Tax: ${formatCurrency(item.ShippingTax.Amount, item.ShippingTax.CurrencyCode)}`);
      }

      // Gift Wrap Price
      if (item.GiftWrapPrice) {
        console.log(`   Gift Wrap Price: ${formatCurrency(item.GiftWrapPrice.Amount, item.GiftWrapPrice.CurrencyCode)}`);
      }

      // Gift Wrap Tax
      if (item.GiftWrapTax) {
        console.log(`   Gift Wrap Tax: ${formatCurrency(item.GiftWrapTax.Amount, item.GiftWrapTax.CurrencyCode)}`);
      }

      console.log('');

      // Promotions and Discounts
      if (item.PromotionDiscount) {
        const promotionDiscount = parseFloat(item.PromotionDiscount.Amount) || 0;
        totalPromotionDiscount += promotionDiscount;
        console.log('🎁 PROMOTIONS & DISCOUNTS:');
        console.log(`   Promotion Discount: ${formatCurrency(item.PromotionDiscount.Amount, item.PromotionDiscount.CurrencyCode)}`);
      }

      if (item.PromotionDiscountTax) {
        console.log(`   Promotion Discount Tax: ${formatCurrency(item.PromotionDiscountTax.Amount, item.PromotionDiscountTax.CurrencyCode)}`);
      }

      if (item.ShippingDiscount) {
        const shippingDiscount = parseFloat(item.ShippingDiscount.Amount) || 0;
        totalShippingDiscount += shippingDiscount;
        console.log(`   Shipping Discount: ${formatCurrency(item.ShippingDiscount.Amount, item.ShippingDiscount.CurrencyCode)}`);
      }

      if (item.ShippingDiscountTax) {
        console.log(`   Shipping Discount Tax: ${formatCurrency(item.ShippingDiscountTax.Amount, item.ShippingDiscountTax.CurrencyCode)}`);
      }

      // Points and Codes
      if (item.PromotionIds && item.PromotionIds.length > 0) {
        console.log(`   Promotion IDs: ${item.PromotionIds.join(', ')}`);
      }

      if (item.CODFee) {
        console.log(`   COD Fee: ${formatCurrency(item.CODFee.Amount, item.CODFee.CurrencyCode)}`);
      }

      if (item.CODFeeDiscount) {
        console.log(`   COD Fee Discount: ${formatCurrency(item.CODFeeDiscount.Amount, item.CODFeeDiscount.CurrencyCode)}`);
      }

      // Additional fields
      console.log('');
      console.log('📋 ADDITIONAL DETAILS:');
      console.log(`   Is Gift: ${item.IsGift ? 'Yes' : 'No'}`);
      console.log(`   Gift Message: ${item.GiftMessageText || 'N/A'}`);
      console.log(`   Gift Wrap Level: ${item.GiftWrapLevel || 'N/A'}`);
      console.log(`   Invoice URL: ${item.InvoiceData?.InvoiceRequirement || 'N/A'}`);
      console.log(`   Serial Numbers: ${item.SerialNumbers ? item.SerialNumbers.join(', ') : 'N/A'}`);

      // Points granted
      if (item.PointsGranted) {
        console.log(`   Points Granted: ${item.PointsGranted.PointsNumber || 0} (${formatCurrency(item.PointsGranted.PointsMonetaryValue?.Amount, item.PointsGranted.PointsMonetaryValue?.CurrencyCode)})`);
      }

      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('');
    });

    // Financial Summary
    console.log('💰 COMPLETE FINANCIAL BREAKDOWN');
    console.log('===============================');
    console.log(`Items Subtotal: ${formatCurrency(totalItemPrice)}`);
    console.log(`Shipping Charges: ${formatCurrency(totalShippingPrice)}`);
    console.log(`Item Tax: ${formatCurrency(totalTax)}`);
    console.log(`Shipping Tax: ${formatCurrency(totalShippingTax)}`);
    console.log(`Promotion Discounts: -${formatCurrency(totalPromotionDiscount)}`);
    console.log(`Shipping Discounts: -${formatCurrency(totalShippingDiscount)}`);
    console.log('───────────────────────────────');

    const calculatedTotal = totalItemPrice + totalShippingPrice + totalTax + totalShippingTax - totalPromotionDiscount - totalShippingDiscount;
    console.log(`Calculated Total: ${formatCurrency(calculatedTotal)}`);
    console.log(`Amazon Order Total: ${formatCurrency(order.OrderTotal?.Amount, order.OrderTotal?.CurrencyCode)}`);

    if (Math.abs(calculatedTotal - parseFloat(order.OrderTotal?.Amount || 0)) > 0.01) {
      console.log('⚠️  Note: Calculated total may differ due to additional fees not shown in item breakdown');
    }

    console.log('');
    console.log('✅ Complete order analysis finished!');
    console.log('');
    console.log('💡 DATA INSIGHTS:');
    console.log(`   • This shows ALL data available from Amazon SP-API`);
    console.log(`   • Shipping and fees are broken down per item`);
    console.log(`   • Promotions, discounts, and taxes are detailed`);
    console.log(`   • Customer information (when available)`);
    console.log(`   • Try this with different order types to see variations`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 Make sure your SP-API application has "Orders" permission.');
    } else if (error.message.includes('RATE_LIMITED')) {
      console.log('');
      console.log('💡 Rate limited. Wait a minute and try again.');
    } else {
      console.log('');
      console.log('💡 Check your order ID and .env credentials.');
    }

    process.exit(1);
  }
}

// Run the analysis
analyzeOrder();
