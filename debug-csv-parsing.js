#!/usr/bin/env node

/**
 * Debug script for CSV parsing issues
 */

import fs from 'fs';
import path from 'path';

// Simple CSV parsing test
function parseTabDelimitedLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === '\t' && !inQuotes) {
      // Tab delimiter outside quotes
      values.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  values.push(current);
  return values;
}

function findColumnIndex(headers, possibleNames) {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
}

// Test with the sample CSV
const csvPath = '/Users/jackweston/Projects/pre-prod/sample-sku-asin-mapping.csv';
console.log('🔍 Testing CSV parsing with:', csvPath);

try {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');

  console.log('📊 Total lines:', lines.length);

  // Parse header
  const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
  console.log('📋 Headers:', headers);
  console.log('📋 Header count:', headers.length);

  // Find seller-sku column
  const sellerSkuIndex = findColumnIndex(headers, ['seller-sku', 'seller_sku', 'sku']);
  console.log('🔍 seller-sku column index:', sellerSkuIndex);

  if (sellerSkuIndex === -1) {
    console.error('❌ seller-sku column not found!');
    process.exit(1);
  }

  // Test parsing first few data rows
  console.log('\n📝 Testing data rows:');
  for (let i = 1; i < Math.min(lines.length, 4); i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseTabDelimitedLine(line);
    const sellerSku = values[sellerSkuIndex]?.trim();

    console.log(`Row ${i}:`);
    console.log(`  - Values count: ${values.length}`);
    console.log(`  - seller-sku value: "${sellerSku}"`);
    console.log(`  - Is valid: ${!!sellerSku}`);

    if (values.length !== headers.length) {
      console.log(`  - ⚠️  Column count mismatch! Expected ${headers.length}, got ${values.length}`);
    }
  }

  console.log('\n✅ CSV parsing test completed');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
