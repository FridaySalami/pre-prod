const { SupabaseService } = require('./render-service/services/supabase-client');

async function checkTestResults() {
  try {
    console.log('🔍 Checking test results from production runs...\n');

    // Get the two recent test jobs
    const { data: jobs, error: jobsError } = await SupabaseService.client
      .from('buybox_jobs')
      .select('*')
      .in('source', ['production_test_real_api_only', 'debug_competitor_offers'])
      .order('started_at', { ascending: false })
      .limit(2);

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError);
      return;
    }

    console.log('📋 Recent Test Jobs:');
    jobs.forEach(job => {
      console.log(`  • Job ${job.id.substring(0, 8)}... - ${job.source}`);
      console.log(`    Status: ${job.status}, ASINs: ${job.successful_asins}/${job.total_asins}`);
      console.log(`    Started: ${new Date(job.started_at).toLocaleString()}`);
    });

    // Check buybox_data for these jobs
    const jobIds = jobs.map(j => j.id);
    
    const { data: summaryData, error: summaryError } = await SupabaseService.client
      .from('buybox_data')
      .select('run_id, asin, sku, current_price, has_buybox, buybox_seller, competitor_count, created_at')
      .in('run_id', jobIds)
      .order('created_at', { ascending: false });

    if (summaryError) {
      console.error('❌ Error fetching summary data:', summaryError);
      return;
    }

    console.log(`\n📊 buybox_data entries: ${summaryData.length}`);
    summaryData.forEach(entry => {
      console.log(`  • ASIN: ${entry.asin}, SKU: ${entry.sku}`);
      console.log(`    Price: $${entry.current_price}, Buy Box: ${entry.has_buybox ? '✅' : '❌'}`);
      console.log(`    Buy Box Seller: ${entry.buybox_seller || 'N/A'}`);
      console.log(`    Competitors: ${entry.competitor_count || 0}`);
      console.log(`    Job: ${entry.run_id.substring(0, 8)}...`);
      console.log('');
    });

    // Check buybox_offers for these jobs
    const { data: offersData, error: offersError } = await SupabaseService.client
      .from('buybox_offers')
      .select('run_id, asin, sku, seller_id, seller_name, price, shipping_price, total_price, is_prime, is_fba, condition_type, created_at')
      .in('run_id', jobIds)
      .order('asin', { ascending: true })
      .order('total_price', { ascending: true });

    if (offersError) {
      console.error('❌ Error fetching offers data:', offersError);
      return;
    }

    console.log(`\n🏪 buybox_offers entries: ${offersData.length}`);
    if (offersData.length === 0) {
      console.log('  ⚠️  No competitor offers found in database');
      console.log('  This could mean:');
      console.log('    - No competitors found on tested ASINs');
      console.log('    - insertBuyBoxOffers() method not working');
      console.log('    - Amazon SP-API not returning competitor data');
    } else {
      offersData.forEach(offer => {
        console.log(`  • ASIN: ${offer.asin} | Seller: ${offer.seller_name || offer.seller_id}`);
        console.log(`    Price: $${offer.price} + $${offer.shipping_price || 0} shipping = $${offer.total_price}`);
        console.log(`    Prime: ${offer.is_prime ? '✅' : '❌'}, FBA: ${offer.is_fba ? '✅' : '❌'}`);
        console.log(`    Condition: ${offer.condition_type}, Job: ${offer.run_id.substring(0, 8)}...`);
        console.log('');
      });
    }

    // Summary
    console.log('\n📈 Summary:');
    console.log(`  - Jobs run: ${jobs.length}`);
    console.log(`  - buybox_data records: ${summaryData.length}`);
    console.log(`  - buybox_offers records: ${offersData.length}`);
    
    if (offersData.length === 0 && summaryData.length > 0) {
      console.log('\n⚠️  ISSUE DETECTED: Summary data exists but no competitor offers');
      console.log('   Next steps to debug:');
      console.log('   1. Check if Amazon SP-API is returning offers in getBuyBoxData()');
      console.log('   2. Verify insertBuyBoxOffers() method is being called');
      console.log('   3. Check if the tested ASINs actually have competitors');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkTestResults();
