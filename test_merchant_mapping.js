#!/usr/bin/env node
/**
 * Test Merchant Token Mapping
 * Tests the merchant token to seller name mapping functionality
 */

// Test the mapping function
function mapMerchantToken(sellerId, sellerName) {
  // Known merchant token mappings
  const merchantMappings = {
    'A3P5ROKL5A1OLE': 'Amazon',
    'ATVPDKIKX0DER': 'Amazon US',
    'A1F83G8C2ARO7P': 'Amazon UK',
    'A13V1IB3VIYZZH': 'Amazon DE',
    'A1PA6795UKMFR9': 'Amazon DE',
    'APJ6JRA9NG5V4': 'Amazon IT',
    'A1RKKUPIHCS9HS': 'Amazon ES',
    'A13BZ9L5JJXF5C': 'Amazon ES',
    'A1C3SOZRARQ6R3': 'Amazon PL'
  };

  // Return mapped name if we have it, otherwise fall back to provided seller name or use ID
  return merchantMappings[sellerId] || sellerName || sellerId;
}

console.log("🧪 Testing Merchant Token Mapping...\n");

// Test cases
const testCases = [
  { sellerId: 'A3P5ROKL5A1OLE', sellerName: undefined, expected: 'Amazon' },
  { sellerId: 'A3P5ROKL5A1OLE', sellerName: 'Some Name', expected: 'Amazon' },
  { sellerId: 'ATVPDKIKX0DER', sellerName: undefined, expected: 'Amazon US' },
  { sellerId: 'UNKNOWN123', sellerName: 'Custom Seller', expected: 'Custom Seller' },
  { sellerId: 'UNKNOWN456', sellerName: undefined, expected: 'UNKNOWN456' },
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = mapMerchantToken(test.sellerId, test.sellerName);
  const success = result === test.expected;

  console.log(`Test ${index + 1}: ${success ? '✅' : '❌'}`);
  console.log(`  Input: sellerId="${test.sellerId}", sellerName="${test.sellerName}"`);
  console.log(`  Expected: "${test.expected}"`);
  console.log(`  Got: "${result}"`);
  console.log();

  if (success) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log("🎉 All tests passed! Merchant token mapping is working correctly.");
} else {
  console.log("❌ Some tests failed. Please check the mapping function.");
}
