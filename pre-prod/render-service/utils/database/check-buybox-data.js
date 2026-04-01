/**
 * Database Check Utility
 * 
 * Checks what data was captured in buybox_data and buybox_offers tables
 * Run from render-service directory: node utils/database/check-buybox-data.js
 */

// Load environment variables
require('dotenv').config();

const { SupabaseService } = require('../../services/supabase-client');

async function checkBuyBoxData() {
  try {
    console.log('🔍 Checking BuyBox database tables...\n');

    // Check buybox_data table
    console.log('📊 BUYBOX_DATA Table:');
    const { data: buyboxData, error: buyboxError } = await SupabaseService.client
      .from('buybox_data')
      .select('*')
      .limit(5);

    if (buyboxError) {
      console.error('❌ Error fetching buybox_data:', buyboxError.message);
    } else {
      console.log(`   Total records: ${buyboxData.length}`);
      if (buyboxData.length > 0) {
        console.log('   Latest entries:');
        buyboxData.forEach((record, index) => {
          console.log(`   ${index + 1}. ASIN: ${record.asin}, SKU: ${record.sku}, Job: ${record.run_id}`);
          console.log(`      BuyBox: ${record.is_winner ? 'Winner' : 'Not Winner'}, Price: $${record.price || 'N/A'}`);
          console.log(`      Captured: ${new Date(record.captured_at).toLocaleString()}`);
        });
      }
    }

    console.log('\n📈 BUYBOX_OFFERS Table:');
    const { data: offersData, error: offersError } = await SupabaseService.client
      .from('buybox_offers')
      .select('*')
      .limit(10);

    if (offersError) {
      console.error('❌ Error fetching buybox_offers:', offersError.message);
    } else {
      console.log(`   Total competitor offers: ${offersData.length}`);
      if (offersData.length > 0) {
        console.log('   Latest offers:');
        offersData.forEach((offer, index) => {
          console.log(`   ${index + 1}. ASIN: ${offer.asin}, Seller: ${offer.seller_id || 'Unknown'}`);
          console.log(`      Price: $${offer.price || 'N/A'}, Shipping: $${offer.shipping || 'N/A'}`);
          console.log(`      Prime: ${offer.is_prime ? 'Yes' : 'No'}, FBA: ${offer.is_fba ? 'Yes' : 'No'}`);
          console.log(`      Columns:`, Object.keys(offer).join(', '));
        });
      } else {
        console.log('   ⚠️  No competitor offers found');
        console.log('   This could mean:');
        console.log('   - Amazon SP-API didn\'t return competitor data');
        console.log('   - There are no other sellers for these ASINs');
        console.log('   - The offers data wasn\'t properly extracted');
      }
    }

    // Check latest job info
    console.log('\n🔧 LATEST JOBS:');
    const { data: jobsData, error: jobsError } = await SupabaseService.client
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(3);

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError.message);
    } else {
      jobsData.forEach((job, index) => {
        console.log(`   ${index + 1}. Job ${job.id}: ${job.source}`);
        console.log(`      Status: ${job.status}, Success: ${job.successful_asins}/${job.total_asins}`);
        console.log(`      Started: ${new Date(job.started_at).toLocaleString()}`);
      });
    }

    console.log('\n✅ Database check completed!');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  }
}

// Run the check if this file is executed directly
if (require.main === module) {
  checkBuyBoxData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { checkBuyBoxData };
