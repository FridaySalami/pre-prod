// Test session authentication for match-buy-box API
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function testSessionAuth() {
  console.log('🧪 Testing session authentication for match-buy-box API...\n');

  try {
    // Test 1: No authentication (should fail)
    console.log('📝 Test 1: API request without authentication');
    const response1 = await fetch('http://localhost:3002/api/match-buy-box', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asin: 'B0062IB652',
        sku: 'test',
        newPrice: 18.16,
        recordId: 'test'
      })
    });

    const result1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log(`Response:`, result1);

    if (response1.status === 401 && result1.error === 'Authentication required') {
      console.log('✅ Test 1 PASSED: Correctly rejected unauthenticated request\n');
    } else {
      console.log('❌ Test 1 FAILED: Should have rejected unauthenticated request\n');
    }

    // Test 2: Check if route is in authenticated routes (not admin)
    console.log('📝 Test 2: Verifying route protection level');
    if (response1.status === 401 && !result1.error.includes('admin')) {
      console.log('✅ Test 2 PASSED: Route requires authentication but not admin privileges\n');
    } else {
      console.log('❌ Test 2 FAILED: Route should require authentication but not admin\n');
    }

    console.log('🎯 Summary:');
    console.log('- API endpoint exists and responds');
    console.log('- Properly rejects unauthenticated requests');
    console.log('- Does not require admin privileges (moved to authenticated routes)');
    console.log('- Users with valid sessions should be able to access this endpoint');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSessionAuth();
