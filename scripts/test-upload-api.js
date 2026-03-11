/**
 * Test script to upload CSV and debug any import issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FormData } from 'formdata-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUploadAPI() {
  console.log('Testing Sage CSV upload API...');

  const testCsvPath = path.join(__dirname, 'test-sage-import.csv');

  if (!fs.existsSync(testCsvPath)) {
    console.error('Test CSV file not found:', testCsvPath);
    return;
  }

  try {
    // Create FormData and add the CSV file
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(testCsvPath);
    const file = new File([fileBuffer], 'test-sage-import.csv', { type: 'text/csv' });
    formData.append('file', file);

    console.log('Uploading CSV file...');

    // Test upload endpoint
    const uploadResponse = await fetch('http://localhost:3000/api/sage-reports/upload', {
      method: 'POST',
      body: formData
    });

    const uploadResult = await uploadResponse.json();

    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload result:', JSON.stringify(uploadResult, null, 2));

    if (!uploadResult.success) {
      console.error('❌ Upload failed:', uploadResult.error);
      return;
    }

    console.log('✅ Upload successful, testing import...');

    // Test import endpoint
    const importResponse = await fetch('http://localhost:3000/api/sage-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: uploadResult.data })
    });

    const importResult = await importResponse.json();

    console.log('Import response status:', importResponse.status);
    console.log('Import result:', JSON.stringify(importResult, null, 2));

    if (importResult.success) {
      console.log('✅ Import successful!');
      console.log(`Imported: ${importResult.imported}, Updated: ${importResult.updated}`);
      if (importResult.errors && importResult.errors.length > 0) {
        console.log('Errors:', importResult.errors);
      }
    } else {
      console.error('❌ Import failed:', importResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testUploadAPI();
