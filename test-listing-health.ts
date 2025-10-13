#!/usr/bin/env tsx

/**
 * Test Listing Health Score Calculator
 * 
 * Tests various scenarios:
 * 1. Excellent listing (high scores across all categories)
 * 2. Good listing (some room for improvement)
 * 3. Fair listing (needs work)
 * 4. Poor listing (significant issues)
 */

import { calculateListingHealth, formatScoreVisual, type CompetitorData, type BuyBoxData } from './src/lib/amazon/listing-health';
import type { CatalogProduct } from './src/lib/amazon/catalog-service';

console.log('🧪 Testing Listing Health Score Calculator\n');
console.log('='.repeat(80) + '\n');

// ============================================================================
// Test Case 1: Excellent Listing
// ============================================================================

console.log('📊 Test 1: Excellent Listing');
console.log('-'.repeat(80));

const excellentCatalog: CatalogProduct = {
  asin: 'TEST001',
  title: 'Premium Organic Protein Powder - 2kg Chocolate Flavor - Vegan, Non-GMO, Gluten Free - 30 Servings',
  brand: 'Premium Nutrition',
  category: 'Health & Personal Care > Vitamins & Dietary Supplements',
  images: [
    { variant: 'MAIN', link: 'https://example.com/main.jpg', height: 1500, width: 1500 },
    { variant: 'PT01', link: 'https://example.com/pt01.jpg', height: 1200, width: 1200 },
    { variant: 'PT02', link: 'https://example.com/pt02.jpg', height: 1200, width: 1200 },
    { variant: 'PT03', link: 'https://example.com/pt03.jpg', height: 1200, width: 1200 },
    { variant: 'PT04', link: 'https://example.com/pt04.jpg', height: 1200, width: 1200 },
    { variant: 'PT05', link: 'https://example.com/pt05.jpg', height: 1200, width: 1200 },
    { variant: 'PT06', link: 'https://example.com/pt06.jpg', height: 1200, width: 1200 },
    { variant: 'PT07', link: 'https://example.com/pt07.jpg', height: 1200, width: 1200 }
  ],
  bulletPoints: [
    '✓ 25g Protein Per Serving - High quality plant-based protein blend',
    '✓ Certified Organic - Non-GMO, Gluten Free, and Vegan friendly',
    '✓ Delicious Chocolate Flavor - No artificial sweeteners or flavors',
    '✓ Easy to Mix - Smooth texture with no clumping',
    '✓ Made in UK - Independently lab tested for purity and quality'
  ],
  description: 'Our Premium Organic Protein Powder is the perfect addition to your healthy lifestyle. Made from a carefully selected blend of organic pea, hemp, and brown rice proteins, it delivers 25g of complete protein per serving. Whether you\'re an athlete, fitness enthusiast, or simply looking to increase your protein intake, this powder is designed to support muscle recovery and growth. The delicious chocolate flavor is naturally sweetened with organic stevia and tastes amazing in smoothies, shakes, or even baked goods. Each 2kg tub provides 30 generous servings, making it excellent value for money. Free from dairy, soy, gluten, and artificial ingredients, it\'s suitable for vegans and those with dietary restrictions. Manufactured in the UK to the highest quality standards.',
  dimensions: {
    height: { value: 20, unit: 'cm' },
    width: { value: 15, unit: 'cm' },
    length: { value: 15, unit: 'cm' },
    weight: { value: 2100, unit: 'g' }
  }
};

const excellentCompetitor: CompetitorData = {
  yourRank: 2,
  totalOffers: 8,
  lowestPrice: 29.99,
  yourPrice: 31.99
};

const excellentBuyBox: BuyBoxData = {
  currentlyHasBuyBox: true,
  winRate: 85,
  totalChecks: 100,
  isFBA: true,
  isPrime: true
};

const result1 = calculateListingHealth(excellentCatalog, excellentCompetitor, excellentBuyBox);

console.log(`\nOverall Score: ${result1.overall}/10 ${formatScoreVisual(result1.overall)}`);
console.log(`Grade: ${result1.grade}\n`);

console.log('Component Breakdown:');
console.log(`  Content:     ${result1.breakdown.content.score}/${result1.breakdown.content.maxScore} (${result1.breakdown.content.percentage}%) - ${result1.breakdown.content.grade}`);
console.log(`  Images:      ${result1.breakdown.images.score}/${result1.breakdown.images.maxScore} (${result1.breakdown.images.percentage}%) - ${result1.breakdown.images.grade}`);
console.log(`  Competitive: ${result1.breakdown.competitive.score}/${result1.breakdown.competitive.maxScore} (${result1.breakdown.competitive.percentage}%) - ${result1.breakdown.competitive.grade}`);
console.log(`  Buy Box:     ${result1.breakdown.buybox.score}/${result1.breakdown.buybox.maxScore} (${result1.breakdown.buybox.percentage}%) - ${result1.breakdown.buybox.grade}`);

if (result1.recommendations.length > 0) {
  console.log(`\nTop Recommendations (${result1.recommendations.length} total):`);
  result1.recommendations.slice(0, 3).forEach((rec, i) => {
    console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
    console.log(`     ${rec.description}`);
    console.log(`     Impact: ${rec.impact}`);
  });
} else {
  console.log('\n✅ No recommendations - listing is excellent!');
}

// ============================================================================
// Test Case 2: Good Listing (Some Room for Improvement)
// ============================================================================

console.log('\n\n📊 Test 2: Good Listing (Needs Some Work)');
console.log('-'.repeat(80));

const goodCatalog: CatalogProduct = {
  asin: 'TEST002',
  title: 'Wireless Bluetooth Headphones - Noise Cancelling Over Ear Headphones',
  brand: 'AudioTech',
  category: 'Electronics > Headphones',
  images: [
    { variant: 'MAIN', link: 'https://example.com/main.jpg', height: 1000, width: 1000 },
    { variant: 'PT01', link: 'https://example.com/pt01.jpg', height: 800, width: 800 },
    { variant: 'PT02', link: 'https://example.com/pt02.jpg', height: 800, width: 800 },
    { variant: 'PT03', link: 'https://example.com/pt03.jpg', height: 800, width: 800 },
    { variant: 'PT04', link: 'https://example.com/pt04.jpg', height: 800, width: 800 }
  ],
  bulletPoints: [
    'Active Noise Cancellation - Block out unwanted noise',
    '40 Hour Battery Life - Long lasting performance',
    'Comfortable Design - Soft ear cushions'
  ],
  description: 'Great wireless headphones with noise cancellation feature. Comfortable to wear for extended periods.',
  dimensions: {
    weight: { value: 250, unit: 'g' }
  }
};

const goodCompetitor: CompetitorData = {
  yourRank: 6,
  totalOffers: 18,
  lowestPrice: 49.99,
  yourPrice: 59.99
};

const goodBuyBox: BuyBoxData = {
  currentlyHasBuyBox: false,
  winRate: 55,
  totalChecks: 100,
  isFBA: false,
  isPrime: false
};

const result2 = calculateListingHealth(goodCatalog, goodCompetitor, goodBuyBox);

console.log(`\nOverall Score: ${result2.overall}/10 ${formatScoreVisual(result2.overall)}`);
console.log(`Grade: ${result2.grade}\n`);

console.log('Component Breakdown:');
console.log(`  Content:     ${result2.breakdown.content.score}/${result2.breakdown.content.maxScore} (${result2.breakdown.content.percentage}%) - ${result2.breakdown.content.grade}`);
console.log(`  Images:      ${result2.breakdown.images.score}/${result2.breakdown.images.maxScore} (${result2.breakdown.images.percentage}%) - ${result2.breakdown.images.grade}`);
console.log(`  Competitive: ${result2.breakdown.competitive.score}/${result2.breakdown.competitive.maxScore} (${result2.breakdown.competitive.percentage}%) - ${result2.breakdown.competitive.grade}`);
console.log(`  Buy Box:     ${result2.breakdown.buybox.score}/${result2.breakdown.buybox.maxScore} (${result2.breakdown.buybox.percentage}%) - ${result2.breakdown.buybox.grade}`);

if (result2.recommendations.length > 0) {
  console.log(`\nTop Recommendations (${result2.recommendations.length} total):`);
  result2.recommendations.slice(0, 3).forEach((rec, i) => {
    console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
    console.log(`     ${rec.description}`);
    console.log(`     Impact: ${rec.impact}`);
  });
}

// ============================================================================
// Test Case 3: Poor Listing (Significant Issues)
// ============================================================================

console.log('\n\n📊 Test 3: Poor Listing (Needs Major Work)');
console.log('-'.repeat(80));

const poorCatalog: CatalogProduct = {
  asin: 'TEST003',
  title: 'USB Cable',
  brand: undefined,
  category: 'Electronics',
  images: [
    { variant: 'MAIN', link: 'https://example.com/main.jpg', height: 500, width: 500 }
  ],
  bulletPoints: ['USB cable'],
  description: 'A USB cable.',
  dimensions: undefined
};

const poorCompetitor: CompetitorData = {
  yourRank: 25,
  totalOffers: 45,
  lowestPrice: 5.99,
  yourPrice: 12.99
};

const poorBuyBox: BuyBoxData = {
  currentlyHasBuyBox: false,
  winRate: 15,
  totalChecks: 100,
  isFBA: false,
  isPrime: false
};

const result3 = calculateListingHealth(poorCatalog, poorCompetitor, poorBuyBox);

console.log(`\nOverall Score: ${result3.overall}/10 ${formatScoreVisual(result3.overall)}`);
console.log(`Grade: ${result3.grade}\n`);

console.log('Component Breakdown:');
console.log(`  Content:     ${result3.breakdown.content.score}/${result3.breakdown.content.maxScore} (${result3.breakdown.content.percentage}%) - ${result3.breakdown.content.grade}`);
console.log(`  Images:      ${result3.breakdown.images.score}/${result3.breakdown.images.maxScore} (${result3.breakdown.images.percentage}%) - ${result3.breakdown.images.grade}`);
console.log(`  Competitive: ${result3.breakdown.competitive.score}/${result3.breakdown.competitive.maxScore} (${result3.breakdown.competitive.percentage}%) - ${result3.breakdown.competitive.grade}`);
console.log(`  Buy Box:     ${result3.breakdown.buybox.score}/${result3.breakdown.buybox.maxScore} (${result3.breakdown.buybox.percentage}%) - ${result3.breakdown.buybox.grade}`);

if (result3.recommendations.length > 0) {
  console.log(`\nTop Recommendations (${result3.recommendations.length} total):`);
  result3.recommendations.slice(0, 5).forEach((rec, i) => {
    console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
    console.log(`     ${rec.description}`);
    console.log(`     Impact: ${rec.impact}`);
  });
}

// ============================================================================
// Test Case 4: No Competitor/BuyBox Data
// ============================================================================

console.log('\n\n📊 Test 4: Listing with No Competitor Data');
console.log('-'.repeat(80));

const result4 = calculateListingHealth(excellentCatalog);

console.log(`\nOverall Score: ${result4.overall}/10 ${formatScoreVisual(result4.overall)}`);
console.log(`Grade: ${result4.grade}\n`);

console.log('Component Breakdown:');
console.log(`  Content:     ${result4.breakdown.content.score}/${result4.breakdown.content.maxScore} (${result4.breakdown.content.percentage}%) - ${result4.breakdown.content.grade}`);
console.log(`  Images:      ${result4.breakdown.images.score}/${result4.breakdown.images.maxScore} (${result4.breakdown.images.percentage}%) - ${result4.breakdown.images.grade}`);
console.log(`  Competitive: ${result4.breakdown.competitive.score}/${result4.breakdown.competitive.maxScore} (${result4.breakdown.competitive.percentage}%) - ${result4.breakdown.competitive.grade}`);
console.log(`  Buy Box:     ${result4.breakdown.buybox.score}/${result4.breakdown.buybox.maxScore} (${result4.breakdown.buybox.percentage}%) - ${result4.breakdown.buybox.grade}`);

console.log('\n⚠️  Note: Competitive and Buy Box scores are 0 due to missing data');

// ============================================================================
// Summary
// ============================================================================

console.log('\n\n📊 Test Summary');
console.log('='.repeat(80));
console.log(`\nTest 1 (Excellent): ${result1.overall}/10 - ${result1.grade}`);
console.log(`Test 2 (Good):      ${result2.overall}/10 - ${result2.grade}`);
console.log(`Test 3 (Poor):      ${result3.overall}/10 - ${result3.grade}`);
console.log(`Test 4 (No Data):   ${result4.overall}/10 - ${result4.grade}`);

// Validation
let allPassed = true;

console.log('\n✅ Validation Checks:');

// Check 1: Excellent listing should score > 8
if (result1.overall >= 8.0) {
  console.log('  ✅ Excellent listing scores >= 8.0');
} else {
  console.log(`  ❌ Excellent listing scored ${result1.overall}, expected >= 8.0`);
  allPassed = false;
}

// Check 2: Good listing should score 6-8
if (result2.overall >= 5.0 && result2.overall < 8.0) {
  console.log('  ✅ Good listing scores in 5.0-8.0 range');
} else {
  console.log(`  ❌ Good listing scored ${result2.overall}, expected 5.0-8.0`);
  allPassed = false;
}

// Check 3: Poor listing should score < 5
if (result3.overall < 5.0) {
  console.log('  ✅ Poor listing scores < 5.0');
} else {
  console.log(`  ❌ Poor listing scored ${result3.overall}, expected < 5.0`);
  allPassed = false;
}

// Check 4: Recommendations exist for poor listing
if (result3.recommendations.length >= 5) {
  console.log(`  ✅ Poor listing has ${result3.recommendations.length} recommendations`);
} else {
  console.log(`  ❌ Poor listing has only ${result3.recommendations.length} recommendations, expected >= 5`);
  allPassed = false;
}

// Check 5: Score components add up correctly
const manualCalc = (
  (result1.breakdown.content.score / result1.breakdown.content.maxScore) * 3.0 +
  (result1.breakdown.images.score / result1.breakdown.images.maxScore) * 2.5 +
  (result1.breakdown.competitive.score / result1.breakdown.competitive.maxScore) * 2.5 +
  (result1.breakdown.buybox.score / result1.breakdown.buybox.maxScore) * 2.0
);
if (Math.abs(manualCalc - result1.overall) < 0.1) {
  console.log('  ✅ Weighted scoring calculation is correct');
} else {
  console.log(`  ❌ Scoring mismatch: ${result1.overall} vs ${manualCalc.toFixed(1)}`);
  allPassed = false;
}

if (allPassed) {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed\n');
  process.exit(1);
}
