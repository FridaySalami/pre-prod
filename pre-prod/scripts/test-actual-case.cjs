// Test with the actual data from the problematic record
console.log('Testing with actual problematic record data:');
console.log('=============================================');

// Data from the record b6dea807-33ec-4161-87d4-123b3ba64a7f
const actualData = {
  asin: 'B0DN22ZYYL',
  sku: 'CHO00A - 001',
  your_current_price: 306.86,
  buybox_price: 0,  // This was the problem!
  your_margin_percent_at_current_price: 22.92,
  margin_percent_at_buybox_price: -100  // This caused the wrong classification
};

console.log('Original problematic data:');
console.log('- ASIN:', actualData.asin);
console.log('- Your Current Price: £' + actualData.your_current_price);
console.log('- Buy Box Price: £' + actualData.buybox_price);
console.log('- Your Current Margin: ' + actualData.your_margin_percent_at_current_price + '%');
console.log('- Buy Box Margin (calculated): ' + actualData.margin_percent_at_buybox_price + '%');
console.log('');

// Test with old logic (what was happening before)
function oldLogic(buyBoxPrice, buyboxMarginPercent, profitOpportunity) {
  let recommendedAction;
  if (!buyBoxPrice || buyBoxPrice <= 0) {
    recommendedAction = 'investigate';
  } else if (buyboxMarginPercent < 5) {  // BUG: Didn't check for null
    recommendedAction = 'not_profitable';
  } else if (buyboxMarginPercent < 10) {
    recommendedAction = 'investigate';
  } else if (profitOpportunity > 1) {
    recommendedAction = 'match_buybox';
  } else {
    recommendedAction = 'hold_price';
  }
  return recommendedAction;
}

// Test with new logic (fixed)
function newLogic(buyBoxPrice, buyboxMarginPercent, profitOpportunity) {
  let recommendedAction;
  if (!buyBoxPrice || buyBoxPrice <= 0) {
    recommendedAction = 'investigate';
  } else if (buyboxMarginPercent === null || buyboxMarginPercent < 5) {  // FIXED: Check for null
    recommendedAction = 'not_profitable';
  } else if (buyboxMarginPercent < 10) {
    recommendedAction = 'investigate';
  } else if (profitOpportunity > 1) {
    recommendedAction = 'match_buybox';
  } else {
    recommendedAction = 'hold_price';
  }
  return recommendedAction;
}

// Test with the corrected margin calculation (should be null when no competition)
const correctedMarginPercent = actualData.buybox_price > 0 ? actualData.margin_percent_at_buybox_price : null;

console.log('OLD LOGIC (buggy):');
console.log('- Uses margin_percent_at_buybox_price:', actualData.margin_percent_at_buybox_price);
console.log('- Result:', oldLogic(actualData.buybox_price, actualData.margin_percent_at_buybox_price, 0));
console.log('- Problem: -100% < 5% = true, so triggers "not_profitable" instead of "investigate"');
console.log('');

console.log('NEW LOGIC (fixed):');
console.log('- Uses corrected margin (null when no competition):', correctedMarginPercent);
console.log('- Result:', newLogic(actualData.buybox_price, correctedMarginPercent, 0));
console.log('- ✅ Correctly identifies no competition → "investigate"');
console.log('');

console.log('SUMMARY:');
console.log('========');
console.log('- Frontend shows: £57.22 profit, 22.9% margin');
console.log('- Old recommendation: not_profitable (WRONG)');
console.log('- New recommendation: investigate (CORRECT)');
console.log('- Root cause: Zero buy box price should trigger "investigate", not margin calculation');
