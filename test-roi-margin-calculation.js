#!/usr/bin/env node
/**
 * Test script to verify the new ROI-based margin calculation
 */

function calculateROIMargin(salePrice, productCosts, amazonFeeRate = 0.15) {
  const amazonFees = salePrice * amazonFeeRate;
  const profit = salePrice - amazonFees - productCosts;
  const totalInvestment = productCosts + amazonFees;
  const marginPercent = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;

  return {
    salePrice: salePrice.toFixed(2),
    productCosts: productCosts.toFixed(2),
    amazonFees: amazonFees.toFixed(2),
    profit: profit.toFixed(2),
    totalInvestment: totalInvestment.toFixed(2),
    marginPercent: marginPercent.toFixed(2),
    calculation: `(£${profit.toFixed(2)} profit) ÷ (£${totalInvestment.toFixed(2)} total investment) × 100 = ${marginPercent.toFixed(2)}%`
  };
}

// Test with your example
console.log('🧮 ROI-Based Margin Calculation Test\n');

const testCase = calculateROIMargin(9.89, 7.20);
console.log('Your Example:');
console.log(`Sale Price: £${testCase.salePrice}`);
console.log(`Product Costs: £${testCase.productCosts}`);
console.log(`Amazon Fees (15%): £${testCase.amazonFees}`);
console.log(`Profit: £${testCase.profit}`);
console.log(`Total Investment: £${testCase.totalInvestment}`);
console.log(`ROI Margin: ${testCase.marginPercent}%`);
console.log(`Calculation: ${testCase.calculation}\n`);

// Compare different scenarios
console.log('📊 Comparison Scenarios:\n');

const scenarios = [
  { price: 10.00, cost: 5.00, label: 'High Margin Example' },
  { price: 15.00, cost: 12.00, label: 'Low Margin Example' },
  { price: 20.00, cost: 8.00, label: 'Good Opportunity' },
];

scenarios.forEach(scenario => {
  const result = calculateROIMargin(scenario.price, scenario.cost);
  console.log(`${scenario.label}:`);
  console.log(`  Sale £${result.salePrice} - Costs £${result.productCosts} - Fees £${result.amazonFees} = £${result.profit} profit`);
  console.log(`  ROI Margin: ${result.marginPercent}%\n`);
});

console.log('✅ New calculation method implemented in:');
console.log('  - /src/routes/api/buybox/full-scan/+server.ts');
console.log('  - /src/routes/api/buybox/retry-failed/+server.ts');
console.log('  - /render-service/services/cost-calculator.js');
console.log('  - Buy Box Manager UI with detailed breakdowns');
console.log('\n🔄 To see the new calculations, run a fresh buy box scan or retry failed items.');
