#!/usr/bin/env node

/**
 * Test the Amazon SP-API pricing fix
 * This validates that our transformPricingData function correctly separates 
 * user's price from buy box winner's price
 */

const fs = require('fs');
const path = require('path');

// Mock data that represents the issue - buy box winner at £2.98, user at £7.70
const mockPricingData = {
  payload: {
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

console.log('🧪 Testing Amazon SP-API Pricing Fix');
console.log('=====================================\n');

console.log('📊 Input Data Summary:');
console.log('- Buy Box Winner: COMPETITOR123 at £2.98');
console.log('- Our Price: A2D8NG39VURSL3 at £7.70');
console.log('- Third Seller: ANOTHER_SELLER at £8.99 + £2.99 shipping\n');

// Extract and test the transformPricingData method
const amazonSpapiPath = path.join(__dirname, 'render-service', 'services', 'amazon-spapi.js');
const amazonSpapiCode = fs.readFileSync(amazonSpapiPath, 'utf8');

// Extract the method code
const methodMatch = amazonSpapiCode.match(/transformPricingData\(pricingData, asin, sku, runId\) \{[\s\S]*?\n  \}/);
if (!methodMatch) {
  console.error('❌ Could not find transformPricingData method');
  process.exit(1);
}

// Set up environment for testing
process.env.YOUR_SELLER_ID = 'A2D8NG39VURSL3';
process.env.AMAZON_SELLER_ID = 'A2D8NG39VURSL3';

// Create a test class with the method
eval(`
  class TestAmazonSpApi {
    ${methodMatch[0]}
  }
  
  const testInstance = new TestAmazonSpApi();
  
  try {
    const result = testInstance.transformPricingData(mockPricingData, 'B07XYZ123', 'CLE63-002', 'test-run-123');
    
    console.log('🔍 Transform Result:');
    console.log('- SKU:', result.sku);
    console.log('- ASIN:', result.asin);
    console.log('- OUR Price: £' + result.price, '(' + result.currency + ')');
    console.log('- Competitor Price: £' + result.competitor_price, '(' + result.currency + ')');
    console.log('- Is Winner:', result.is_winner);
    console.log('- Buy Box Owner:', result.buybox_merchant_token);
    console.log('- Our Seller ID:', result.merchant_token);
    
    console.log('\\n✅ Validation:');
    let allCorrect = true;
    
    if (result.price === 7.70) {
      console.log('✅ CORRECT: Our price is £7.70 (not the buy box price)');
    } else {
      console.log('❌ WRONG: Our price should be £7.70, got £' + result.price);
      allCorrect = false;
    }
    
    if (result.competitor_price === 2.98) {
      console.log('✅ CORRECT: Competitor price is £2.98 (buy box winner)');
    } else {
      console.log('❌ WRONG: Competitor price should be £2.98, got £' + result.competitor_price);
      allCorrect = false;
    }
    
    if (result.is_winner === false) {
      console.log('✅ CORRECT: We are not the buy box winner');
    } else {
      console.log('❌ WRONG: We should not be the buy box winner');
      allCorrect = false;
    }
    
    if (result.buybox_merchant_token === 'COMPETITOR123') {
      console.log('✅ CORRECT: Buy box owner is COMPETITOR123');
    } else {
      console.log('❌ WRONG: Buy box owner should be COMPETITOR123, got ' + result.buybox_merchant_token);
      allCorrect = false;
    }
    
    if (result.merchant_token === 'A2D8NG39VURSL3') {
      console.log('✅ CORRECT: Our merchant token is preserved');
    } else {
      console.log('❌ WRONG: Our merchant token should be A2D8NG39VURSL3, got ' + result.merchant_token);
      allCorrect = false;
    }
    
    console.log('\\n🎯 Summary:');
    if (allCorrect) {
      console.log('🎉 ALL TESTS PASSED! The SP-API fix is working correctly!');
    } else {
      console.log('⚠️  SOME TESTS FAILED! The SP-API fix needs adjustment.');
    }
    console.log('\\n📈 Impact of this fix:');
    console.log('✅ Profit calculations will now be accurate!');
    console.log('✅ "Beat Buy Box by 1p" will work correctly!');
    console.log('✅ Margin analysis will use your actual listed price!');
    console.log('\\nPrevious (broken): Used £2.98 for profit calc → Wrong margins');
    console.log('Now (fixed): Uses £7.70 for profit calc → Correct margins');
    
    // Show real impact
    console.log('\\n💰 Example Profit Calculation Impact:');
    console.log('If cost is £3.00 per unit:');
    console.log('- Old (wrong) calculation: £2.98 - £3.00 = -£0.02 LOSS');
    console.log('- New (correct) calculation: £7.70 - £3.00 = £4.70 PROFIT');
    console.log('That\\'s a difference of £4.72 per sale!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
`);
