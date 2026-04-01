// Debug the exact logic flow that could create the problematic record
console.log('Debugging how buybox_price = 0 could result in margin_percent_at_buybox_price = -100');
console.log('====================================================================================');

// Simulate the exact scenario from mockAmazonApiCall
function simulateScenario() {
  // From the mock function - this could be the issue
  const mockPrice = 100; // Random mock price
  const competitorPrice = 80; // Random competitor price

  const isWinner = false; // Not winning (30% chance in mock)
  const yourSellerId = 'A2D8NG39VURSL3';
  const competitorId = 'ANOTHERSELLERID';

  let yourCurrentPrice, buyBoxPrice;

  if (isWinner) {
    yourCurrentPrice = mockPrice;
    buyBoxPrice = mockPrice;
  } else {
    buyBoxPrice = competitorPrice;
    // 70% chance you're priced higher
    yourCurrentPrice = buyBoxPrice + 5; // Higher than buybox
  }

  console.log('Scenario 1: Normal competition');
  console.log('- mockPrice:', mockPrice);
  console.log('- competitorPrice:', competitorPrice);
  console.log('- yourCurrentPrice:', yourCurrentPrice);
  console.log('- buyBoxPrice:', buyBoxPrice);
  console.log('');

  // Now let's see what could cause buyBoxPrice = 0
  console.log('Scenario 2: What if competitorPrice becomes 0?');
  const zeroBuyBoxPrice = 0;
  console.log('- buyBoxPrice:', zeroBuyBoxPrice);

  // Mock cost data
  const materialTotalCost = 50;
  const shippingCost = 5;

  // This is the problematic calculation that might be happening
  let buyboxMargin, buyboxMarginPercent;

  if (zeroBuyBoxPrice && zeroBuyBoxPrice > 0) {
    console.log('✅ Correct path: Should set to null');
    buyboxMarginPercent = null;
  } else {
    console.log('❌ Potential bug path: If this calculation happens...');
    // What if the code calculates anyway?
    const buyboxAmazonFee = zeroBuyBoxPrice * 0.15; // 0
    buyboxMargin = zeroBuyBoxPrice - buyboxAmazonFee - materialTotalCost - shippingCost;
    buyboxMarginPercent = (buyboxMargin / zeroBuyBoxPrice) * 100; // Division by zero!

    console.log('- buyboxAmazonFee:', buyboxAmazonFee);
    console.log('- buyboxMargin:', buyboxMargin);
    console.log('- buyboxMarginPercent (division by 0):', buyboxMarginPercent);
  }
}

simulateScenario();

console.log('\\nPOSSIBLE CAUSES:');
console.log('================');
console.log('1. Division by zero: (margin / 0) * 100 = NaN or -Infinity');
console.log('2. The -100% might be coming from a different calculation');
console.log('3. Old data in database calculated before the fix');
console.log('4. There might be another code path that calculates margins differently');

// Check what happens with division by zero
console.log('\\nDivision by zero test:');
const testMargin = -55; // Negative margin when costs > 0 price
const testPercent = (testMargin / 0) * 100;
console.log('(', testMargin, '/ 0 ) * 100 =', testPercent);
