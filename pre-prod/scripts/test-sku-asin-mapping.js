#!/usr/bin/env node

/**
 * Test script for SKU-ASIN mapping functionality
 * Tests CSV upload, data processing, and API endpoints
 */

const fs = require('fs');
const path = require('path');

// Configuration
const baseUrl = 'http://localhost:3000'; // Adjust based on your dev server
const testCsvPath = path.join(__dirname, 'test-sku-asin-mapping.csv');

// Create test CSV data
const testCsvData = `item-name\titem-description\tlisting-id\tseller-sku\tprice\tquantity\topen-date\timage-url\titem-is-marketplace\tproduct-id-type\tzshop-shipping-fee\titem-note\titem-condition\tzshop-category1\tzshop-browse-path\tzshop-storefront-feature\tasin1\tasin2\tasin3\twill-ship-internationally\texpedited-shipping\tzshop-boldface\tproduct-id\tbid-for-featured-placement\tadd-delete\tpending-quantity\tfulfillment-channel\tmerchant-shipping-group\tstatus\tMinimum order quantity\tSell remainder
Test Product 1\tA great test product\tLIST001\tSKU001\t19.99\t10\t2024-01-01\thttp://example.com/image1.jpg\tfalse\tASIN\t2.50\tTest note\tNew\tElectronics\tElectronics > Gadgets\tFeatured\tB01234567\tB01234568\tB01234569\tfalse\ttrue\tfalse\tASIN123\tfalse\tPartial\t5\tFBA\tNationwide Prime\tactive\t1\tfalse
Test Product 2\tAnother test product\tLIST002\tSKU002\t29.99\t25\t2024-01-02\thttp://example.com/image2.jpg\ttrue\tASIN\t3.00\tAnother note\tNew\tBooks\tBooks > Fiction\tNormal\tB09876543\t\t\ttrue\tfalse\ttrue\tASIN456\ttrue\tPartial\t2\tFBM\tUK Shipping\tactive\t2\ttrue
Test Product 3\tProduct without ASIN\tLIST003\tSKU003\t9.99\t50\t2024-01-03\thttp://example.com/image3.jpg\tfalse\tUPC\t1.50\tNo ASIN product\tUsed\tHome\tHome > Garden\tNormal\t\t\t\tfalse\tfalse\tfalse\tUPC789\tfalse\tPartial\t1\tFBM\tMigrated Template\tinactive\t1\tfalse`;

async function createTestCSV() {
  console.log('📝 Creating test CSV file...');
  fs.writeFileSync(testCsvPath, testCsvData);
  console.log('✅ Test CSV file created:', testCsvPath);
}

async function testUpload() {
  console.log('\n🚀 Testing SKU-ASIN mapping CSV upload...');

  try {
    // Create FormData for file upload
    const { FormData } = await import('undici');
    const formData = new FormData();

    const fileBuffer = fs.readFileSync(testCsvPath);
    const blob = new Blob([fileBuffer], { type: 'text/csv' });
    formData.append('file', blob, 'test-sku-asin-mapping.csv');

    // Upload the file
    const uploadResponse = await fetch(`${baseUrl}/api/sku-asin-mapping/upload`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed! Status: ${uploadResponse.status}, Error: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload successful!');
    console.log('📊 Upload result:', JSON.stringify(uploadResult, null, 2));

    if (uploadResult.success) {
      console.log(`📥 Imported ${uploadResult.imported} mapping records`);
      console.log(`⚡ Duration: ${uploadResult.duration}ms`);
      if (uploadResult.errors.length > 0) {
        console.log('⚠️  Errors:', uploadResult.errors);
      }
    } else {
      console.error('❌ Upload failed:', uploadResult.errors);
    }

    return uploadResult.success;

  } catch (error) {
    console.error('❌ Error during upload:', error);
    return false;
  }
}

async function testAPI() {
  console.log('\n🧪 Testing API endpoints...');

  try {
    // Test stats endpoint
    console.log('📊 Testing stats endpoint...');
    const statsResponse = await fetch(`${baseUrl}/api/sku-asin-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'stats' })
    });

    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Stats endpoint working:', stats);
    } else {
      console.error('❌ Stats endpoint failed:', await statsResponse.text());
    }

    // Test data retrieval endpoint
    console.log('📋 Testing data retrieval endpoint...');
    const dataResponse = await fetch(`${baseUrl}/api/sku-asin-mapping?page=1&limit=10`);

    if (dataResponse.ok) {
      const data = await dataResponse.json();
      console.log('✅ Data retrieval working:');
      console.log(`   📊 Total: ${data.total}`);
      console.log(`   📄 Page: ${data.page}`);
      console.log(`   📝 Records: ${data.data.length}`);

      if (data.data.length > 0) {
        console.log('   📋 Sample record:');
        const sample = data.data[0];
        console.log(`     SKU: ${sample.seller_sku}`);
        console.log(`     Name: ${sample.item_name}`);
        console.log(`     ASIN1: ${sample.asin1 || 'N/A'}`);
        console.log(`     Price: ${sample.price || 'N/A'}`);
        console.log(`     Status: ${sample.status}`);
      }
    } else {
      console.error('❌ Data retrieval failed:', await dataResponse.text());
    }

    // Test search functionality
    console.log('🔍 Testing search functionality...');
    const searchResponse = await fetch(`${baseUrl}/api/sku-asin-mapping?search=SKU001`);

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ Search working:');
      console.log(`   📊 Results: ${searchData.data.length}`);
      if (searchData.data.length > 0) {
        console.log(`   📋 Found: ${searchData.data[0].seller_sku}`);
      }
    } else {
      console.error('❌ Search failed:', await searchResponse.text());
    }

    // Test filtering
    console.log('🎯 Testing filtering...');
    const filterResponse = await fetch(`${baseUrl}/api/sku-asin-mapping?hasAsin=true`);

    if (filterResponse.ok) {
      const filterData = await filterResponse.json();
      console.log('✅ Filtering working:');
      console.log(`   📊 Records with ASIN: ${filterData.data.length}`);
    } else {
      console.error('❌ Filtering failed:', await filterResponse.text());
    }

  } catch (error) {
    console.error('❌ Error during API testing:', error);
  }
}

async function testClearData() {
  console.log('\n🗑️  Testing data clearing...');

  try {
    const clearResponse = await fetch(`${baseUrl}/api/sku-asin-mapping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'clear' })
    });

    if (clearResponse.ok) {
      const clearResult = await clearResponse.json();
      console.log('✅ Clear data working:', clearResult);
    } else {
      console.error('❌ Clear data failed:', await clearResponse.text());
    }

  } catch (error) {
    console.error('❌ Error during clear test:', error);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test files...');

  try {
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
      console.log('✅ Test CSV file removed');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function main() {
  console.log('🧪 SKU-ASIN Mapping Test Suite');
  console.log('================================\n');

  try {
    // Create test data
    await createTestCSV();

    // Test upload
    const uploadSuccess = await testUpload();

    if (uploadSuccess) {
      // Test API endpoints
      await testAPI();

      // Test clearing data
      await testClearData();
    }

    console.log('\n🎉 Test suite completed!');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    // Clean up
    await cleanup();
  }
}

// Run the test suite
if (require.main === module) {
  main();
}

module.exports = { main };
