/**
 * Test ASIN-SKU Fix API Directly
 * 
 * This script tests the API endpoints directly to see what's happening
 */

const API_BASE_URL = 'http://localhost:3001';

async function testAsinSkuFix() {
  console.log('🔍 Testing ASIN-SKU Fix API\n');

  try {
    // 1. Test validation endpoint
    console.log('📊 Testing /api/asin-sku/validate...');
    const validateResponse = await fetch(`${API_BASE_URL}/api/asin-sku/validate`);

    if (!validateResponse.ok) {
      console.error('❌ Validation request failed:', validateResponse.status, validateResponse.statusText);
      return;
    }

    const validateData = await validateResponse.json();
    console.log('✅ Validation response:', JSON.stringify(validateData, null, 2));

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. Show detailed breakdown
    console.log('📈 Analysis:');
    console.log(`   • Total configs checked: ${validateData.totalConfigs || 'Unknown'}`);
    console.log(`   • Needs update: ${validateData.summary?.needsUpdate || 0}`);
    console.log(`   • Not found in amazon_listings: ${validateData.summary?.notFound || 0}`);
    console.log(`   • Is valid (no fixes needed): ${validateData.isValid}`);

    if (validateData.mismatches && validateData.mismatches.length > 0) {
      console.log('\n🔍 Sample mismatches:');
      validateData.mismatches.slice(0, 5).forEach((mismatch, i) => {
        console.log(`   ${i + 1}. ASIN: ${mismatch.asin}`);
        console.log(`      Current SKU: ${mismatch.currentSku}`);
        console.log(`      Correct SKU: ${mismatch.correctSku || 'NOT FOUND'}`);
        console.log(`      Not Found: ${mismatch.notFound || false}`);
        console.log('');
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. Recommendations
    console.log('💡 What this means:');
    if (validateData.summary?.notFound > 0) {
      console.log(`   • ${validateData.summary.notFound} ASINs in your monitoring configs don't exist in amazon_listings table`);
      console.log('   • These are likely the AUTO-* SKUs you see in Supabase');
      console.log('   • Solution: Import your current Amazon inventory into amazon_listings table');
    }

    if (validateData.summary?.needsUpdate > 0) {
      console.log(`   • ${validateData.summary.needsUpdate} ASINs have incorrect SKUs that can be fixed`);
      console.log('   • You can run the fix-all endpoint to correct these');
    }

    if (validateData.isValid) {
      console.log('   • All mappings that CAN be validated are correct');
      console.log('   • The issue is missing data in amazon_listings, not wrong mappings');
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 The render-service (port 3001) might not be running.');
      console.log('   Start it with: npm run dev (in render-service directory)');
    }
  }
}

testAsinSkuFix().catch(console.error);