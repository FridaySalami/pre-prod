/**
 * Debug script to test column detection logic
 */

const fs = require('fs');

// Read the sample CSV
const content = fs.readFileSync('/Users/jackweston/Projects/pre-prod/sample-sku-asin-mapping.csv', 'utf8');
const lines = content.trim().split('\n');

// Parse header
const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
console.log('📋 CSV headers found:', headers);
console.log('📋 Total headers:', headers.length);

// Test the findColumnIndex function logic
function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => {
      const cleanHeader = h.trim().toLowerCase().replace(/['"]/g, '');
      const cleanName = name.trim().toLowerCase().replace(/['"]/g, '');
      console.log(`Comparing "${cleanHeader}" === "${cleanName}"`);
      return cleanHeader === cleanName;
    });
    if (index !== -1) {
      console.log(`Found ${name} at index ${index}`);
      return index;
    }
  }
  console.log(`Not found for possibleNames: ${possibleNames.join(', ')}`);
  return -1;
}

// Test seller-sku detection
const sellerSkuIndex = findColumnIndex(headers, ['seller-sku', 'seller_sku', 'sku']);
console.log('Final seller-sku index:', sellerSkuIndex);

// Check what we have at that index
if (sellerSkuIndex !== -1) {
  console.log('Header at seller-sku index:', headers[sellerSkuIndex]);
} else {
  console.log('seller-sku not found!');
}

// Debug: Show all headers with their indices
headers.forEach((header, index) => {
  console.log(`Index ${index}: "${header}"`);
});
