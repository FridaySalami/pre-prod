#!/usr/bin/env node

/**
 * Test script to verify inventory CSV upload functionality
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baseUrl = 'http://localhost:3000';

async function testCsvUpload() {
  console.log('Testing inventory CSV upload...');

  try {
    // Read the sample CSV file
    const csvPath = join(__dirname, 'sample-inventory.csv');
    const csvContent = readFileSync(csvPath, 'utf8');
    console.log('Sample CSV content preview:');
    console.log(csvContent.substring(0, 200) + '...');

    // Create FormData for file upload
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'sample-inventory.csv');

    // Test CSV upload endpoint
    const uploadResponse = await fetch(`${baseUrl}/api/inventory/upload`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed! status: ${uploadResponse.status}, error: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('CSV upload successful!');
    console.log('Upload result:', uploadResult);

    if (uploadResult.success) {
      console.log(`Parsed ${uploadResult.data.length} items from CSV`);

      // Test importing the parsed data
      const importResponse = await fetch(`${baseUrl}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: uploadResult.data })
      });

      if (!importResponse.ok) {
        throw new Error(`Import failed! status: ${importResponse.status}`);
      }

      const importResult = await importResponse.json();
      console.log('Import result:', importResult);

      if (importResult.success) {
        console.log(`Successfully imported ${importResult.imported} items`);
        console.log(`Updated ${importResult.updated} existing items`);
        console.log(`Found ${importResult.duplicates} duplicates`);
      }
    }

  } catch (error) {
    console.error('Error testing CSV upload:', error);
  }
}

// Run the test
testCsvUpload().catch(console.error);
