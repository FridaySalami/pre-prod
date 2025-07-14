#!/usr/bin/env node

/**
 * Test the Amazon SP-API pricing fix
 * This validates that our transformPricingData function correctly separates 
 * user's price from buy box winner's price
 */

// Mock data that represents the issue - buy box winner at £2.98, user at £7.70
const mockPricingData = {
  ASIN: 'B07XYZ123',
  status: 'Success',
  Product: {
    Identifiers: {
      MarketplaceASIN: {
        MarketplaceId: 'A1F83G8C2ARO7P',
        ASIN: 'B07XYZ123'
      }
    },
    Offers: [
      {
        SellerId: 'COMPETITOR123',
        SubCondition: 'new',
        SellerFeedbackRating: {
          FeedbackCount: 1000,
          SellerPositiveFeedbackRating: 95
        },
        ShippingTime: {
          MinimumHours: 24,
          MaximumHours: 48
        },
        ListingPrice: {
          CurrencyCode: 'GBP',
          Amount: 2.98
        },
        Shipping: {
          CurrencyCode: 'GBP',
          Amount: 0.00
        },
        IsFulfilledByAmazon: false,
        IsBuyBoxWinner: true
      },
      {
        SellerId: 'A2D8NG39VURSL3', // This is our seller ID
        SubCondition: 'new',
        SellerFeedbackRating: {
          FeedbackCount: 500,
          SellerPositiveFeedbackRating: 98
        },
        ShippingTime: {
          MinimumHours: 24,
          MaximumHours: 48
        },
        ListingPrice: {
          CurrencyCode: 'GBP',
          Amount: 7.70
        },
        Shipping: {
          CurrencyCode: 'GBP',
          Amount: 0.00
        },
        IsFulfilledByAmazon: false,
        IsBuyBoxWinner: false
      },
      {
        SellerId: 'ANOTHER_SELLER',
        SubCondition: 'new',
        SellerFeedbackRating: {
          FeedbackCount: 200,
          SellerPositiveFeedbackRating: 92
        },
        ShippingTime: {
          MinimumHours: 48,
          MaximumHours: 72
        },
        ListingPrice: {
          CurrencyCode: 'GBP',
          Amount: 8.99
        },
        Shipping: {
          CurrencyCode: 'GBP',
          Amount: 2.99
        },
        IsFulfilledByAmazon: false,
        IsBuyBoxWinner: false
      }
    ]
  }
};

// Import the fixed transformPricingData function
const path = require('path');
const amazonSpapiPath = path.join(__dirname, 'render-service', 'services', 'amazon-spapi.js');

// We'll need to extract just the function for testing since it's not exported
const fs = require('fs');
const amazonSpapiCode = fs.readFileSync(amazonSpapiPath, 'utf8');

// Extract the transformPricingData function (this is a bit hacky but works for testing)
const functionMatch = amazonSpapiCode.match(/function transformPricingData\([\s\S]*?\n  }/);
if (!functionMatch) {
  console.error('❌ Could not find transformPricingData function');
  process.exit(1);
}

// Create a local version of the function for testing
const transformPricingDataCode = `
  ${functionMatch[0]}
  
  // Test the function
  const testData = ${JSON.stringify(mockPricingData, null, 2)};
  const yourSellerId = 'A2D8NG39VURSL3';
  const result = transformPricingData(testData, 'CLE63-002', 'B07XYZ123', yourSellerId);
  
  console.log('🧪 Testing Amazon SP-API Pricing Fix');
  console.log('=====================================\\n');
  
  console.log('📊 Input Data Summary:');
  console.log('- Buy Box Winner: COMPETITOR123 at £2.98');
  console.log('- Our Price: A2D8NG39VURSL3 at £7.70');
  console.log('- Third Seller: ANOTHER_SELLER at £8.99 + £2.99 shipping\\n');
  
  console.log('🔍 Transform Result:');
  console.log('- SKU:', result.sku);
  console.log('- ASIN:', result.asin);
  console.log('- OUR Price:', result.price, result.currency);
  console.log('- Competitor Price:', result.competitor_price, result.currency);
  console.log('- Is Winner:', result.is_winner);
  console.log('- Buy Box Owner:', result.buybox_merchant_token);
  console.log('- Our Seller ID:', result.merchant_token);
  
  console.log('\\n✅ Validation:');
  if (result.price === 7.70) {
    console.log('✅ CORRECT: Our price is £7.70 (not the buy box price)');
  } else {
    console.log('❌ WRONG: Our price should be £7.70, got £' + result.price);
  }
  
  if (result.competitor_price === 2.98) {
    console.log('✅ CORRECT: Competitor price is £2.98 (buy box winner)');
  } else {
    console.log('❌ WRONG: Competitor price should be £2.98, got £' + result.competitor_price);
  }
  
  if (result.is_winner === false) {
    console.log('✅ CORRECT: We are not the buy box winner');
  } else {
    console.log('❌ WRONG: We should not be the buy box winner');
  }
  
  if (result.buybox_merchant_token === 'COMPETITOR123') {
    console.log('✅ CORRECT: Buy box owner is COMPETITOR123');
  } else {
    console.log('❌ WRONG: Buy box owner should be COMPETITOR123, got ' + result.buybox_merchant_token);
  }
  
  if (result.merchant_token === 'A2D8NG39VURSL3') {
    console.log('✅ CORRECT: Our merchant token is preserved');
  } else {
    console.log('❌ WRONG: Our merchant token should be A2D8NG39VURSL3, got ' + result.merchant_token);
  }
  
  console.log('\\n🎯 Summary:');
  console.log('This validates that the SP-API fix correctly:');
  console.log('1. Finds our seller offer among all competitors');
  console.log('2. Uses OUR price (£7.70) not the buy box price (£2.98)');
  console.log('3. Sets competitor_price to the buy box winner price');
  console.log('4. Properly tracks buy box ownership');
`;

// Execute the test
try {
  eval(transformPricingDataCode);
} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  console.log('\nThis might indicate an issue with the function syntax.');
}
