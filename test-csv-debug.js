/**
 * Test script to debug CSV import issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to test CSV parsing
function testCSVParsing() {
  console.log('Testing CSV parsing...');

  const testCsvPath = path.join(__dirname, 'test-sage-import.csv');

  if (!fs.existsSync(testCsvPath)) {
    console.error('Test CSV file not found:', testCsvPath);
    return;
  }

  const csvContent = fs.readFileSync(testCsvPath, 'utf8');
  console.log('CSV Content:');
  console.log(csvContent);

  // Parse CSV manually to check structure
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');

  console.log('\nHeaders found:');
  headers.forEach((header, index) => {
    console.log(`${index}: "${header}"`);
  });

  console.log('\nData rows:');
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    console.log(`Row ${i}:`, row);
  }
}

// Test the expected field mapping
function testFieldMapping() {
  console.log('\nTesting field mapping...');

  const testRow = {
    'StockItems.Code': 'TEST001',
    'BinItems.BinName': 'BIN-A1',
    'StockItems.StandardCost': '15.99',
    'StockItems.TaxRate': '0.2',
    'StockItemPrices.Price': '29.99',
    'ProductGroups.Code': 'PG001',
    'StockItems.BOMItemTypeID': 'TYPE1',
    'SYSCompanies.CompanyName': 'Test Company',
    'SYSSuppliers.AccountNumber': 'SUP001'
  };

  // Simulate the field mapping logic
  const stockCodeFields = [
    'StockItems.Code',
    'stockCode',
    'Stock Code',
    'SKU',
    'sku'
  ];

  function getFieldValue(item, fields) {
    for (const field of fields) {
      if (item[field] !== undefined && item[field] !== null && item[field] !== '') {
        return item[field];
      }
    }
    return null;
  }

  const stockCode = getFieldValue(testRow, stockCodeFields);
  console.log('Stock Code found:', stockCode);

  if (!stockCode) {
    console.error('❌ Stock Code not found - this would cause import to fail');
  } else {
    console.log('✅ Stock Code found successfully');
  }
}

// Run tests
testCSVParsing();
testFieldMapping();
