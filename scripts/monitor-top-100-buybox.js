const { createClient } = require('@supabase/supabase-js');
const { AmazonSPAPI } = require('./amazon-spapi-helper');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  sellerId: process.env.AMAZON_SELLER_ID || 'A2D8NG39VURSL3',
  marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P',
};

// Initialize Supabase
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

// Initialize Amazon SP-API
const amazonApi = new AmazonSPAPI({
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AMAZON_AWS_REGION || 'eu-west-1',
  marketplaceId: CONFIG.marketplaceId,
  sellerId: CONFIG.sellerId
});

/**
 * Main monitoring function
 */
async function runMonitor() {
  const runId = await startRunLog();
  console.log(`[${new Date().toISOString()}] Starting Listing Batch Buy Box check (Run ID: ${runId})`);

  try {
    // 1. Fetch Top 100 SKUs
    let { data: topSkus, error: skuError } = await supabase
      .from('monitored_top_100_skus')
      .select('*')
      .order('rank', { ascending: true })
      .limit(100);

    if (skuError || !topSkus || topSkus.length === 0) {
      throw new Error(skuError?.message || 'No monitored SKUs found in table.');
    }

    console.log(`Retrieved ${topSkus.length} SKUs to monitor.`);

    let successCount = 0;
    let errorCount = 0;

    // 2. Process in batches of 20 (SP-API Listing Offers Batch limit)
    const batches = [];
    for (let i = 0; i < topSkus.length; i += 20) {
      batches.push(topSkus.slice(i, i + 20));
    }

    for (const batch of batches) {
      try {
        const skus = batch.map(s => s.sku);
        console.log(`Checking batch of ${skus.length} SKUs...`);
        
        // This method matches the working logic in your other scripts
        const response = await amazonApi.getListingOffersBatch(skus);
        
        if (!response.responses || !Array.isArray(response.responses)) {
            throw new Error('Invalid batch response format');
        }

        for (const itemResponse of response.responses) {
            const pricing = amazonApi.extractListingBatchPricing(itemResponse);
            console.log(`Mapping result for SKU: ${pricing.sku} (ASIN: ${pricing.asin}) - Success: ${pricing.success}`);
            
            const skuEntry = batch.find(s => s.sku === pricing.sku);
            
            if (!skuEntry) continue;

            if (!pricing.success) {
                console.error(`Error for SKU ${pricing.sku}: HTTP ${pricing.error}`);
                errorCount++;
                continue;
            }

            // Map Winning Status
            let status = 'LOSING';
            if (pricing.offerCount === 0) {
              status = 'OUT_OF_STOCK';
            } else if (pricing.isWinner) {
              status = 'WINNING';
            } else if (!pricing.buyBoxPrice) {
              status = 'NO_FEATURED_OFFER';
            }
            
            // Get current stored state for change detection
            const { data: currentState } = await supabase
              .from('top_100_buy_box_current')
              .select('*')
              .eq('sku', skuEntry.sku)
              .single();

            const newData = {
              sku: skuEntry.sku,
              asin: pricing.asin || skuEntry.asin,
              product_name: skuEntry.product_name,
              buy_box_price: pricing.buyBoxPrice,
              buy_box_currency: pricing.currency,
              our_price: pricing.ourPrice,
              competitor_price: pricing.nextBestPrice,
              is_winner: pricing.isWinner,
              status: status,
              offer_count: pricing.offerCount,
              checked_at: new Date().toISOString(),
              marketplace_id: CONFIG.marketplaceId
            };

            // Detect changes
            const changeDetected = !currentState || 
                                   currentState.status !== newData.status ||
                                   Math.abs((currentState.buy_box_price || 0) - (newData.buy_box_price || 0)) > 0.01 ||
                                   Math.abs((currentState.our_price || 0) - (newData.our_price || 0)) > 0.01 ||
                                   Math.abs((currentState.competitor_price || 0) - (newData.competitor_price || 0)) > 0.01;

            if (changeDetected) {
              newData.last_changed_at = new Date().toISOString();
            } else if (currentState) {
              newData.last_changed_at = currentState.last_changed_at;
            } else {
              newData.last_changed_at = new Date().toISOString();
            }

            // Upsert Current
            const { error: upsertError } = await supabase
              .from('top_100_buy_box_current')
              .upsert(newData, { onConflict: 'sku' });

            if (upsertError) {
              console.error(`Error upserting SKU ${newData.sku}:`, upsertError.message);
            }

            // Append History (Only if change detected or periodic record)
            // To keep history clean, we only insert if something actually moved
            if (changeDetected) {
              const { error: histError } = await supabase
                .from('top_100_buy_box_history')
                .insert({
                  sku: newData.sku,
                  asin: newData.asin,
                  buy_box_price: newData.buy_box_price,
                  our_price: newData.our_price,
                  competitor_price: newData.competitor_price,
                  is_winner: newData.is_winner,
                  status: newData.status,
                  offer_count: newData.offer_count,
                  checked_at: newData.checked_at,
                  change_detected: true
                });
              if (histError) console.error(`History insert error for ${newData.sku}:`, histError.message);
            }

            successCount++;
        }

        // Throttle batches significantly to avoid 429s (SP-API batch v0 is 0.5 req/sec)
        await new Promise(r => setTimeout(r, 6000));
      } catch (err) {
        console.error(`Batch processing error:`, err.message);
        errorCount += batch.length;
        // Wait longer on error
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    await finishRunLog(runId, 'SUCCESS', topSkus.length, successCount, errorCount);
    console.log(`[${new Date().toISOString()}] Run completed. Success: ${successCount}, Error: ${errorCount}`);

  } catch (err) {
    console.error('Fatal run error:', err.message);
    if (runId) {
      await finishRunLog(runId, 'FATAL_ERROR', 0, 0, 0, err.message);
    }
  }
}

async function startRunLog() {
  const { data, error } = await supabase
    .from('buy_box_monitor_runs')
    .insert({ status: 'RUNNING', started_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) console.error('Error starting run log:', error.message);
  return data?.id;
}

async function finishRunLog(id, status, total, success, errCount, notes = '') {
  const { error } = await supabase
    .from('buy_box_monitor_runs')
    .update({ 
      status, 
      finished_at: new Date().toISOString(),
      total_skus: total,
      success_count: success,
      error_count: errCount,
      notes
    })
    .eq('id', id);
  if (error) console.error('Error finishing run log:', error.message);
}

// Check if run directly
if (require.main === module) {
  runMonitor();
}

module.exports = { runMonitor };
