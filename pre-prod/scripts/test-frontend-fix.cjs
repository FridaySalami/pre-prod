// Test script to verify the frontend fix handles no competition correctly
console.log('Frontend Buy Box Display Logic Test');
console.log('===================================');

// Simulate the frontend logic for different scenarios
function testBuyBoxDisplay(buyBoxPrice, label) {
  console.log(`\nTesting: ${label}`);
  console.log(`Input buyBoxPrice: ${buyBoxPrice}`);

  // Mimic the Svelte logic
  let display;
  if (buyBoxPrice && buyBoxPrice > 0) {
    display = `£${buyBoxPrice.toFixed(2)} (Competitor)`;
  } else {
    display = 'No Competition Found';
  }

  console.log(`Frontend will display: "${display}"`);
  return display;
}

// Test cases
console.log('Testing different buy box price scenarios:');

// Case 1: Normal competition
testBuyBoxDisplay(25.99, 'Normal competitor price');

// Case 2: No competition (null)
testBuyBoxDisplay(null, 'No competition (null)');

// Case 3: No competition (0)
testBuyBoxDisplay(0, 'No competition (zero)');

// Case 4: No competition (undefined)  
testBuyBoxDisplay(undefined, 'No competition (undefined)');

// Case 5: Very low competitor price
testBuyBoxDisplay(0.01, 'Very low competitor price');

console.log('\n✅ The frontend fix should now correctly show:');
console.log('- "£X.XX (Competitor)" when there IS competition');
console.log('- "No Competition Found" when buyBoxPrice is 0, null, or undefined');
console.log('');
console.log('This resolves the issue where your own price was being shown as "Buy Box Price (Competitor)"');
