#!/usr/bin/env node

/**
 * Test script to verify inventory CSV download functionality
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseUrl = 'http://localhost:3000';

async function testCsvDownload() {
  console.log('Testing inventory CSV download...');

  try {
    // Test CSV download endpoint
    const response = await fetch(`${baseUrl}/api/inventory/download`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvContent = await response.text();
    console.log('CSV download successful!');
    console.log('CSV content preview:');
    console.log(csvContent.substring(0, 300) + '...');

    // Write to file for inspection
    const outputPath = join(__dirname, 'test-download-output.csv');
    writeFileSync(outputPath, csvContent);
    console.log(`CSV saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error testing CSV download:', error);
  }
}

// Run the test
testCsvDownload().catch(console.error);
