#!/usr/bin/env node

/**
 * Test ASIN-SKU Mapping Fix
 * 
 * This script demonstrates how to fix the ASIN-SKU mapping issue
 * by using the API endpoints we created
 */

async function testAsinSkuFix() {
  console.log('🧪 Testing ASIN-SKU Mapping Fix');
  console.log('=' + '='.repeat(50));

  const baseUrl = 'http://localhost:3001'; // Adjust if your server runs on different port

  try {
    // 1. Test validation endpoint
    console.log('\n1️⃣ Testing validation endpoint...');
    const validateResponse = await fetch(`${baseUrl}/api/asin-sku/validate`);
    const validateData = await validateResponse.json();

    if (validateResponse.ok) {
      console.log(`✅ Validation response:`, validateData);
    } else {
      console.log(`❌ Validation failed:`, validateData);
    }

    // 2. Test ASIN lookup
    console.log('\n2️⃣ Testing ASIN lookup...');
    // Use one of the ASINs from your screenshot
    const testAsin = 'B07W6WYCT'; // Replace with actual ASIN from your data
    const lookupResponse = await fetch(`${baseUrl}/api/asin-sku/lookup/${testAsin}`);
    const lookupData = await lookupResponse.json();

    if (lookupResponse.ok) {
      console.log(`✅ Lookup response for ${testAsin}:`, lookupData);
    } else {
      console.log(`❌ Lookup failed for ${testAsin}:`, lookupData);
    }

    // 3. Test fix-all endpoint (if mismatches found)
    if (validateData.success && !validateData.isValid) {
      console.log('\n3️⃣ Testing fix-all endpoint...');
      const fixResponse = await fetch(`${baseUrl}/api/asin-sku/fix-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const fixData = await fixResponse.json();

      if (fixResponse.ok) {
        console.log(`✅ Fix response:`, fixData);
      } else {
        console.log(`❌ Fix failed:`, fixData);
      }

      // 4. Validate again after fix
      console.log('\n4️⃣ Re-validating after fix...');
      const revalidateResponse = await fetch(`${baseUrl}/api/asin-sku/validate`);
      const revalidateData = await revalidateResponse.json();

      if (revalidateResponse.ok) {
        console.log(`✅ Re-validation response:`, revalidateData);
        if (revalidateData.isValid) {
          console.log('\n🎉 All ASIN-SKU mappings are now correct!');
        }
      } else {
        console.log(`❌ Re-validation failed:`, revalidateData);
      }
    }

    // 5. Test adding new ASIN with automatic SKU lookup
    console.log('\n5️⃣ Testing new ASIN addition with auto-SKU...');
    const testNewAsin = 'B0CPCVG66'; // Use another ASIN from your screenshot
    const addResponse = await fetch(`${baseUrl}/api/asin-sku/add-asin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asin: testNewAsin,
        userEmail: 'parkersfoodservice@gmail.com', // Use the email from your screenshot
        options: {
          enabled: true,
          priority: 3,
          priceChangeThreshold: 15
        }
      })
    });

    const addData = await addResponse.json();

    if (addResponse.ok) {
      console.log(`✅ Successfully added ${testNewAsin}:`, addData);
    } else {
      console.log(`❌ Failed to add ${testNewAsin}:`, addData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions for manual testing
console.log('📋 ASIN-SKU Mapping Fix Instructions:');
console.log('=' + '='.repeat(50));
console.log('');
console.log('1. Start your render service:');
console.log('   cd render-service && npm start');
console.log('');
console.log('2. Run this test script:');
console.log('   node test-asin-sku-fix.cjs');
console.log('');
console.log('3. Or use curl commands:');
console.log('   # Validate configs');
console.log('   curl http://localhost:3001/api/asin-sku/validate');
console.log('');
console.log('   # Fix all mismatches');
console.log('   curl -X POST http://localhost:3001/api/asin-sku/fix-all');
console.log('');
console.log('   # Lookup SKU for ASIN');
console.log('   curl http://localhost:3001/api/asin-sku/lookup/B07W6WYCT');
console.log('');
console.log('4. Or run the standalone fix script:');
console.log('   node fix-asin-sku-mapping.cjs');

// Uncomment to run the test
// testAsinSkuFix().catch(console.error);