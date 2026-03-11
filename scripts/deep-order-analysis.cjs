#!/usr/bin/env node

/**
 * Deep Order Analysis - Shows ALL available data from Amazon SP-API
 * 
 * This script analyzes a single order in complete detail, showing every field
 * available from Amazon including pricing, shipping, fees, taxes, and more.
 * 
 * Usage:
 *   node deep-order-analysis.cjs 202-0897873-2825943
 *   node deep-order-analysis.cjs YOUR_ORDER_ID
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
if (args.length === 0) {
  console.log('❌ Please provide an Order ID');
  console.log('Usage: node deep-order-analysis.cjs 202-0897873-2825943');
  console.log('       node deep-order-analysis.cjs YOUR_ORDER_ID');
  process.exit(1);
}

const orderId = args[0];

function formatCurrency(amount, currencyCode = 'GBP') {
  if (!amount) return 'N/A';
  return `£${parseFloat(amount).toFixed(2)} ${currencyCode}`;
}

function displayNestedObject(obj, prefix = '   ') {
  if (!obj || typeof obj !== 'object') {
    return obj || 'N/A';
  }

  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(`${prefix}${key}:`);
      const nested = displayNestedObject(value, prefix + '  ');
      if (typeof nested === 'string') {
        result.push(nested);
      } else {
        result.push(...nested);
      }
    } else if (Array.isArray(value)) {
      result.push(`${prefix}${key}: [${value.length} items]`);
      value.forEach((item, index) => {
        result.push(`${prefix}  ${index + 1}. ${JSON.stringify(item, null, 2)}`);
      });
    } else {
      result.push(`${prefix}${key}: ${value || 'N/A'}`);
    }
  }
  return result;
}

async function analyzeOrder() {
  try {
    console.log('🔍 DEEP ORDER ANALYSIS');
    console.log('======================');
    console.log(`Order ID: ${orderId}`);
    console.log('');

    // Initialize Amazon SP-API client
    const amazonAPI = new AmazonSPAPI(mockSupabaseClient);

    console.log('📋 Step 1: Getting order details...');

    // First, let's find the order in recent orders
    let orderDetails = null;
    let searchDays = 7;

    while (!orderDetails && searchDays <= 90) {
      console.log(`   Searching in last ${searchDays} days...`);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - searchDays);

      const ordersResponse = await amazonAPI.getOrders(
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0],
        100
      );

      const orders = ordersResponse?.payload?.Orders || [];
      orderDetails = orders.find(order => order.AmazonOrderId === orderId);

      if (!orderDetails) {
        searchDays += 7;
        if (searchDays <= 90) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }
      }
    }

    if (!orderDetails) {
      console.log('❌ Order not found in the last 90 days.');
      console.log('💡 Try with a more recent order ID, or check if the order ID is correct.');
      return;
    }

    console.log('✅ Order found! Analyzing complete data...');
    console.log('');

    // Display complete order details
    console.log('📦 COMPLETE ORDER DETAILS');
    console.log('=========================');
    console.log(`Order ID: ${orderDetails.AmazonOrderId}`);
    console.log(`Purchase Date: ${new Date(orderDetails.PurchaseDate).toLocaleString()}`);
    console.log(`Last Update: ${orderDetails.LastUpdateDate ? new Date(orderDetails.LastUpdateDate).toLocaleString() : 'N/A'}`);
    console.log(`Order Status: ${orderDetails.OrderStatus}`);
    console.log(`Fulfillment Channel: ${orderDetails.FulfillmentChannel || 'MFN'}`);
    console.log(`Sales Channel: ${orderDetails.SalesChannel || 'Amazon'}`);
    console.log(`Order Type: ${orderDetails.OrderType || 'StandardOrder'}`);
    console.log('');

    // Financial breakdown
    console.log('💰 FINANCIAL BREAKDOWN');
    console.log('======================');
    if (orderDetails.OrderTotal) {
      console.log(`Order Total: ${formatCurrency(orderDetails.OrderTotal.Amount, orderDetails.OrderTotal.CurrencyCode)}`);
    }
    console.log(`Number of Items Shipped: ${orderDetails.NumberOfItemsShipped || 0}`);
    console.log(`Number of Items Unshipped: ${orderDetails.NumberOfItemsUnshipped || 0}`);
    console.log(`Payment Execution Detail:`);
    if (orderDetails.PaymentExecutionDetail) {
      orderDetails.PaymentExecutionDetail.forEach((payment, index) => {
        console.log(`   Payment ${index + 1}:`);
        console.log(`      Amount: ${formatCurrency(payment.Payment?.Amount, payment.Payment?.CurrencyCode)}`);
        console.log(`      Method: ${payment.PaymentMethod || 'N/A'}`);
      });
    } else {
      console.log('   No payment execution details available');
    }
    console.log('');

    // Shipping information
    console.log('🚚 SHIPPING INFORMATION');
    console.log('=======================');
    console.log(`Ship Service Level: ${orderDetails.ShipServiceLevel || 'Standard'}`);
    console.log(`Shipped By Amazon TFM: ${orderDetails.IsReplacementOrder ? 'Yes' : 'No'}`);
    console.log(`Is Replacement Order: ${orderDetails.IsReplacementOrder ? 'Yes' : 'No'}`);
    console.log(`Is Premium Order: ${orderDetails.IsPremiumOrder ? 'Yes' : 'No'}`);
    console.log(`Is Prime: ${orderDetails.IsPrime ? 'Yes' : 'No'}`);
    console.log(`Is Business Order: ${orderDetails.IsBusinessOrder ? 'Yes' : 'No'}`);
    console.log(`Is Global Express Enabled: ${orderDetails.IsGlobalExpressEnabled ? 'Yes' : 'No'}`);

    if (orderDetails.ShippingAddress) {
      console.log('');
      console.log('📍 SHIPPING ADDRESS:');
      const addr = orderDetails.ShippingAddress;
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
    }
    console.log('');

    // Get detailed order items
    console.log('📦 Step 2: Getting detailed order items...');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Rate limiting

    const orderItemsResponse = await amazonAPI.getOrderItems(orderId);
    const orderItems = orderItemsResponse?.payload?.OrderItems || [];

    if (orderItems.length === 0) {
      console.log('❌ No order items found.');
      return;
    }

    console.log(`✅ Found ${orderItems.length} item(s) in this order`);
    console.log('');

    // Display detailed item information
    console.log('🛍️  DETAILED ITEM BREAKDOWN');
    console.log('===========================');

    orderItems.forEach((item, index) => {
      console.log(`ITEM ${index + 1}:`);
      console.log(`   Order Item ID: ${item.OrderItemId}`);
      console.log(`   ASIN: ${item.ASIN}`);
      console.log(`   Seller SKU: ${item.SellerSKU}`);
      console.log(`   Title: ${item.Title}`);
      console.log(`   Quantity Ordered: ${item.QuantityOrdered}`);
      console.log(`   Quantity Shipped: ${item.QuantityShipped || 0}`);
      console.log(`   Product Info:`);
      console.log(`      Condition: ${item.ConditionId || 'New'} - ${item.ConditionSubtypeId || 'N/A'}`);
      console.log(`      Condition Note: ${item.ConditionNote || 'N/A'}`);
      console.log(`      Gift Message: ${item.GiftMessageText || 'None'}`);
      console.log(`      Gift Wrap: ${item.GiftWrapLevel || 'None'}`);
      console.log('');

      // PRICING BREAKDOWN - This is the detailed part you wanted!
      console.log(`   💰 COMPLETE PRICING BREAKDOWN:`);

      // Item Price
      if (item.ItemPrice) {
        console.log(`      Item Price: ${formatCurrency(item.ItemPrice.Amount, item.ItemPrice.CurrencyCode)}`);
      }

      // Shipping Price
      if (item.ShippingPrice) {
        console.log(`      Shipping Price: ${formatCurrency(item.ShippingPrice.Amount, item.ShippingPrice.CurrencyCode)}`);
      }

      // Gift Wrap Price
      if (item.GiftWrapPrice) {
        console.log(`      Gift Wrap Price: ${formatCurrency(item.GiftWrapPrice.Amount, item.GiftWrapPrice.CurrencyCode)}`);
      }

      // Item Tax
      if (item.ItemTax) {
        console.log(`      Item Tax: ${formatCurrency(item.ItemTax.Amount, item.ItemTax.CurrencyCode)}`);
      }

      // Shipping Tax
      if (item.ShippingTax) {
        console.log(`      Shipping Tax: ${formatCurrency(item.ShippingTax.Amount, item.ShippingTax.CurrencyCode)}`);
      }

      // Gift Wrap Tax
      if (item.GiftWrapTax) {
        console.log(`      Gift Wrap Tax: ${formatCurrency(item.GiftWrapTax.Amount, item.GiftWrapTax.CurrencyCode)}`);
      }

      // Shipping Discount
      if (item.ShippingDiscount) {
        console.log(`      Shipping Discount: ${formatCurrency(item.ShippingDiscount.Amount, item.ShippingDiscount.CurrencyCode)}`);
      }

      // Shipping Discount Tax
      if (item.ShippingDiscountTax) {
        console.log(`      Shipping Discount Tax: ${formatCurrency(item.ShippingDiscountTax.Amount, item.ShippingDiscountTax.CurrencyCode)}`);
      }

      // Promotion Discount
      if (item.PromotionDiscount) {
        console.log(`      Promotion Discount: ${formatCurrency(item.PromotionDiscount.Amount, item.PromotionDiscount.CurrencyCode)}`);
      }

      // Promotion Discount Tax
      if (item.PromotionDiscountTax) {
        console.log(`      Promotion Discount Tax: ${formatCurrency(item.PromotionDiscountTax.Amount, item.PromotionDiscountTax.CurrencyCode)}`);
      }

      // COD Fee (Cash on Delivery)
      if (item.CODFee) {
        console.log(`      COD Fee: ${formatCurrency(item.CODFee.Amount, item.CODFee.CurrencyCode)}`);
      }

      // COD Fee Discount
      if (item.CODFeeDiscount) {
        console.log(`      COD Fee Discount: ${formatCurrency(item.CODFeeDiscount.Amount, item.CODFeeDiscount.CurrencyCode)}`);
      }

      // Points Granted (if any reward points)
      if (item.PointsGranted) {
        console.log(`      Points Granted:`);
        console.log(`         Points Number: ${item.PointsGranted.PointsNumber || 0}`);
        if (item.PointsGranted.PointsMonetaryValue) {
          console.log(`         Points Value: ${formatCurrency(item.PointsGranted.PointsMonetaryValue.Amount, item.PointsGranted.PointsMonetaryValue.CurrencyCode)}`);
        }
      }

      // Calculate totals for this item
      const itemPrice = parseFloat(item.ItemPrice?.Amount || 0);
      const shippingPrice = parseFloat(item.ShippingPrice?.Amount || 0);
      const itemTax = parseFloat(item.ItemTax?.Amount || 0);
      const shippingTax = parseFloat(item.ShippingTax?.Amount || 0);
      const promotionDiscount = parseFloat(item.PromotionDiscount?.Amount || 0);
      const shippingDiscount = parseFloat(item.ShippingDiscount?.Amount || 0);

      const grossTotal = itemPrice + shippingPrice;
      const totalTax = itemTax + shippingTax;
      const totalDiscounts = promotionDiscount + shippingDiscount;
      const netTotal = grossTotal + totalTax - totalDiscounts;

      console.log('');
      console.log(`   📊 CALCULATED TOTALS FOR THIS ITEM:`);
      console.log(`      Gross Total (Item + Shipping): £${grossTotal.toFixed(2)}`);
      console.log(`      Total Tax: £${totalTax.toFixed(2)}`);
      console.log(`      Total Discounts: £${totalDiscounts.toFixed(2)}`);
      console.log(`      Net Total: £${netTotal.toFixed(2)}`);
      console.log(`      Per Unit Price: £${(netTotal / (item.QuantityOrdered || 1)).toFixed(2)}`);

      console.log('');
      console.log(`   🚛 SHIPPING & FULFILLMENT:`);
      console.log(`      Is Gift: ${item.IsGift ? 'Yes' : 'No'}`);
      console.log(`      Is Transparency: ${item.IsTransparency ? 'Yes' : 'No'}`);
      console.log(`      Serial Number Required: ${item.SerialNumberRequired ? 'Yes' : 'No'}`);

      console.log('');
      console.log('   📋 RAW ITEM DATA:');
      console.log('   ==================');
      console.log(JSON.stringify(item, null, 4));
      console.log('');
      console.log('─'.repeat(80));
      console.log('');
    });

    console.log('✅ Deep order analysis completed!');
    console.log('');
    console.log('📝 SUMMARY OF AVAILABLE DATA:');
    console.log('============================');
    console.log('✅ Order-level: Status, dates, shipping address, payment info');
    console.log('✅ Item-level: SKU, ASIN, title, condition, quantities');
    console.log('✅ Pricing: Item price, shipping, taxes, discounts, promotions');
    console.log('✅ Shipping: Service level, address, fulfillment channel');
    console.log('✅ Additional: Gift info, COD fees, reward points');
    console.log('');
    console.log('💡 This is ALL the data available from Amazon SP-API Orders endpoint!');

  } catch (error) {
    console.error('❌ Analysis failed:', error);

    if (error.message === 'ACCESS_DENIED') {
      console.log('');
      console.log('💡 Make sure your SP-API application has "Orders" permission.');
    } else if (error.message.includes('RATE_LIMITED')) {
      console.log('');
      console.log('💡 Rate limited. Wait a few minutes and try again.');
    } else {
      console.log('');
      console.log('💡 Check your .env file has all required Amazon SP-API credentials.');
    }

    process.exit(1);
  }
}

// Run the analysis
analyzeOrder();
