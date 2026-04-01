// Test the updated recommendation logic
function testRecommendationLogic(buyBoxPrice, buyboxMarginPercent, profitOpportunity) {
  let recommendedAction;

  console.log('Testing with: buyBoxPrice=' + buyBoxPrice + ', buyboxMarginPercent=' + buyboxMarginPercent + ', profitOpportunity=' + profitOpportunity);

  if (!buyBoxPrice || buyBoxPrice <= 0) {
    recommendedAction = 'investigate';
    console.log('  → No competition case: investigate');
  } else if (buyboxMarginPercent === null || buyboxMarginPercent < 5) {
    recommendedAction = 'not_profitable';
    console.log('  → Low/null margin case: not_profitable');
  } else if (buyboxMarginPercent < 10) {
    recommendedAction = 'investigate';
    console.log('  → Medium margin case: investigate');
  } else if (profitOpportunity > 1) {
    recommendedAction = 'match_buybox';
    console.log('  → Good opportunity case: match_buybox');
  } else {
    recommendedAction = 'hold_price';
    console.log('  → Hold price case: hold_price');
  }

  return recommendedAction;
}

console.log('Testing recommendation logic scenarios:');
console.log('=====================================');

// Test case 1: No competition (your screenshot case) - should be 'investigate' now
console.log('Case 1: No competition (buyBoxPrice = 0)');
testRecommendationLogic(0, null, null);
console.log('Expected: investigate (was incorrectly not_profitable before)\n');

// Test case 2: Low margin at buy box
console.log('Case 2: Low margin at buy box');
testRecommendationLogic(10, 3, 2);
console.log('Expected: not_profitable\n');

// Test case 3: Medium margin
console.log('Case 3: Medium margin');
testRecommendationLogic(10, 8, 1);
console.log('Expected: investigate\n');

// Test case 4: Good margin with opportunity
console.log('Case 4: Good margin with opportunity');
testRecommendationLogic(10, 15, 3);
console.log('Expected: match_buybox\n');

// Test case 5: Good margin, no opportunity
console.log('Case 5: Good margin, no opportunity');
testRecommendationLogic(10, 15, 0.5);
console.log('Expected: hold_price\n');

console.log('✅ The fix should now correctly handle the no-competition case!');
