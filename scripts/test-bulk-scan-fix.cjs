// Test the bulk scan endpoint to verify the fix
const fetch = require('node-fetch');

async function testBulkScanFix() {
  try {
    console.log('Testing bulk scan with our fix...');

    // First, let's check the test endpoint
    const testResponse = await fetch('http://localhost:3000/bulk-scan/test?limit=1');
    const testData = await testResponse.json();

    console.log('Test endpoint response:');
    console.log(JSON.stringify(testData, null, 2));

  } catch (error) {
    console.error('Error testing bulk scan:', error.message);
    console.log('Note: Make sure the render service is running on localhost:3000');
  }
}

testBulkScanFix();
