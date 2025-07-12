import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import type { RequestHandler } from './$types';

/**
 * Retry failed ASINs from a previous job
 * 
 * This endpoint creates a new job that only scans the ASINs that failed
 * in a previous job.
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { sourceJobId, rateLimit = 0.3, jitter = 1000, maxRetries = 5 } = await request.json();

    if (!sourceJobId) {
      return json({
        success: false,
        error: 'sourceJobId is required'
      }, { status: 400 });
    }

    // Get the original job to check if it exists
    const { data: sourceJob, error: sourceJobError } = await supabaseAdmin
      .from('buybox_jobs')
      .select('*')
      .eq('id', sourceJobId)
      .single();

    if (sourceJobError || !sourceJob) {
      return json({
        success: false,
        error: 'Source job not found'
      }, { status: 404 });
    }

    // Get failed ASINs from the buybox_failures table
    const { data: failures, error: failuresError } = await supabaseAdmin
      .from('buybox_failures')
      .select('asin, sku')
      .eq('job_id', sourceJobId);

    if (failuresError) {
      return json({
        success: false,
        error: 'Failed to fetch failure data'
      }, { status: 500 });
    }

    if (!failures || failures.length === 0) {
      return json({
        success: false,
        error: 'No failed ASINs found to retry'
      }, { status: 400 });
    }

    // Create a new job
    const { data: newJob, error: newJobError } = await supabaseAdmin
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        source: `retry_${sourceJobId.substring(0, 8)}`,
        total_asins: failures.length,
        successful_asins: 0,
        failed_asins: 0,
        rate_limit_per_second: rateLimit,
        jitter_ms: jitter,
        max_retries: maxRetries,
        notes: `Retry of failed ASINs from job ${sourceJobId}`
      })
      .select('*')
      .single();

    if (newJobError || !newJob) {
      return json({
        success: false,
        error: 'Failed to create new job'
      }, { status: 500 });
    }

    // Start processing ASINs asynchronously
    processFailedAsins(newJob.id, failures, rateLimit, jitter, maxRetries)
      .catch(error => {
        console.error('Error retrying failed ASINs:', error);
        // Update job as failed if there's an error
        supabaseAdmin
          .from('buybox_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            notes: `Job crashed: ${error.message}`
          })
          .eq('id', newJob.id);
      });

    return json({
      success: true,
      jobId: newJob.id,
      message: `Started retry job for ${failures.length} failed ASINs`
    });

  } catch (error) {
    console.error('Error retrying failed ASINs:', error);
    return json({
      success: false,
      error: (error as Error).message || 'An error occurred'
    }, { status: 500 });
  }
};

/**
 * Process failed ASINs asynchronously
 */
async function processFailedAsins(
  jobId: string,
  failures: { asin: string; sku: string | null }[],
  rateLimit: number,
  jitter: number,
  maxRetries: number
): Promise<void> {
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  try {
    // Process each ASIN
    for (const [index, failure] of failures.entries()) {
      const { asin, sku } = failure;

      try {
        // Get Buy Box data for this ASIN
        const buyBoxData = await checkBuyBox(asin);

        if (!buyBoxData) {
          throw new Error('No Buy Box data returned');
        }

        if (buyBoxData.error === true) {
          throw new Error(buyBoxData.errorMessage || 'API returned an error');
        }

        const transformedData = transformBuyBoxData(buyBoxData, asin);

        // Get product info
        const { data: productData } = await supabaseAdmin
          .from('sku_asin_mapping')
          .select('*')
          .eq('asin1', asin)
          .single();

        // Calculate profitability
        const profitCalculation = await calculateProfitability(
          asin,
          sku || '',
          transformedData.buyBoxPrice || 0,
          productData?.price || 0
        );

        // Store the result
        const yourSellerId = process.env.YOUR_SELLER_ID || 'A2D8NG39VURSL3';
        const buyBoxMerchantToken = transformedData.hasBuyBox ? yourSellerId : transformedData.buyBoxOwner;

        await supabaseAdmin
          .from('buybox_data')
          .insert({
            run_id: jobId,
            asin: asin,
            sku: sku,
            price: transformedData.buyBoxPrice,
            currency: transformedData.buyBoxCurrency || 'GBP',
            is_winner: transformedData.hasBuyBox,
            merchant_token: yourSellerId,
            buybox_merchant_token: buyBoxMerchantToken,
            competitor_id: transformedData.hasBuyBox ? null : transformedData.buyBoxOwner,
            competitor_name: transformedData.hasBuyBox ? null : transformedData.buyBoxSellerName,
            competitor_price: transformedData.hasBuyBox ? null : transformedData.buyBoxPrice,
            opportunity_flag: profitCalculation.opportunityFlag,
            min_profitable_price: profitCalculation.minProfitablePrice,
            margin_at_buybox: profitCalculation.marginAtBuyBox,
            margin_percent_at_buybox: profitCalculation.marginPercentAtBuyBox,
            total_offers: transformedData.competitorInfo.length + transformedData.yourOffers.length,
            fulfillment_channel: productData?.fulfillment_channel,
            merchant_shipping_group: productData?.merchant_shipping_group,
            source: 'retry'
          });

        successCount++;
      } catch (error) {
        console.error(`Error processing ASIN ${asin}:`, error);
        failureCount++;

        // Log the failure
        await supabaseAdmin
          .from('buybox_failures')
          .insert({
            job_id: jobId,
            asin: asin,
            sku: sku,
            reason: `Retry failed: ${(error as Error).message}`,
            error_code: 'RETRY_FAILED',
            attempt_number: maxRetries
          });
      }

      // Update job progress
      await supabaseAdmin
        .from('buybox_jobs')
        .update({
          successful_asins: successCount,
          failed_asins: failureCount
        })
        .eq('id', jobId);

      // Apply rate limiting with jitter
      if (index < failures.length - 1) {
        const baseDelay = 1000 / rateLimit;
        const jitterMs = Math.floor(Math.random() * jitter);
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitterMs));
      }
    }

    // Calculate duration
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Update job as completed
    await supabaseAdmin
      .from('buybox_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds
      })
      .eq('id', jobId);

  } catch (error) {
    // Update job as failed if there's an error
    await supabaseAdmin
      .from('buybox_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: `Error in retry process: ${(error as Error).message}`
      })
      .eq('id', jobId);

    throw error;
  }
}

/**
 * Check Buy Box status using my-buy-box-monitor.cjs
 * This reuses the same function from the full-scan endpoint
 */
async function checkBuyBox(asin: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const buyBoxScript = path.join(process.cwd(), 'my-buy-box-monitor.cjs');

    // Check if script exists
    if (!fs.existsSync(buyBoxScript)) {
      console.warn('Buy Box checker script not found, returning mock data');
      return resolve(getMockBuyBoxData(asin));
    }

    const childProcess = spawn('node', [buyBoxScript, asin, '--json']);

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      // Clean stdout to handle any potential non-JSON content before or after the JSON
      const cleanedOutput = stdout.trim();

      if (code !== 0) {
        console.error(`Buy Box checker exited with code ${code}`);
        console.error(`stderr: ${stderr}`);

        // If we have stderr that mentions rate limiting, explicitly mark as rate limit error
        if (stderr.includes("429") || stderr.includes("rate") || stderr.includes("limit") || stderr.includes("throttl")) {
          return reject(new Error('Rate limit exceeded (429)'));
        }

        return reject(new Error(`Buy Box check failed: ${stderr.substring(0, 100)}`));
      }

      try {
        // If output is empty, reject with specific message
        if (!cleanedOutput) {
          return reject(new Error('Buy Box checker returned empty output'));
        }

        // Look for a JSON object in the output
        let jsonStartPos = cleanedOutput.indexOf('{');
        let jsonEndPos = cleanedOutput.lastIndexOf('}');

        if (jsonStartPos === -1 || jsonEndPos === -1) {
          console.error('Failed to find valid JSON in output:', cleanedOutput);
          return reject(new Error('No valid JSON in Buy Box data'));
        }

        const jsonStr = cleanedOutput.substring(jsonStartPos, jsonEndPos + 1);
        const result = JSON.parse(jsonStr);

        // Validate required fields
        if (!result.asin) {
          console.error('Missing required fields in Buy Box data:', result);
          return reject(new Error('Invalid Buy Box data format'));
        }

        resolve(result);
      } catch (error) {
        console.error('Failed to parse Buy Box checker output:', error);
        console.error('Raw output:', stdout.substring(0, 200) + '...');
        reject(new Error('Failed to parse Buy Box data'));
      }
    });
  });
}

/**
 * Provide mock Buy Box data for development/testing
 */
function getMockBuyBoxData(asin: string): any {
  // Randomly determine if we have the Buy Box
  const hasBuyBox = Math.random() > 0.5;

  return {
    asin: asin,
    youOwnBuyBox: hasBuyBox,
    buyBoxWinner: {
      sellerId: hasBuyBox ? 'A2D8NG39VURSL3' : 'OtherSeller',
      sellerName: hasBuyBox ? 'Your Store' : 'Competitor',
      price: (15.99 + Math.random() * 10).toFixed(2),
      currency: 'GBP'
    },
    yourOffers: [
      {
        price: 19.99,
        currency: 'GBP',
        isBuyBox: hasBuyBox
      }
    ],
    competitorOffers: hasBuyBox ? [] : [
      {
        sellerId: 'OtherSeller',
        price: 18.99,
        currency: 'GBP',
        isBuyBox: !hasBuyBox
      }
    ],
    recommendations: ['Test recommendation']
  };
}

/**
 * Transform raw buy box data into a standardized format
 */
function transformBuyBoxData(buyBoxData: any, asin: string): any {
  // Get buy box winner details
  const buyBoxWinner = buyBoxData.buyBoxWinner || null;

  // Check if you own the Buy Box
  const hasBuyBox = buyBoxData.youOwnBuyBox === true;

  // Parse competitor and your offers
  const competitorInfo = Array.isArray(buyBoxData.competitorOffers) ? buyBoxData.competitorOffers : [];
  const yourOffers = Array.isArray(buyBoxData.yourOffers) ? buyBoxData.yourOffers : [];

  // Added safeguards for price extraction
  let buyBoxPrice = null;
  if (buyBoxWinner && typeof buyBoxWinner.price !== 'undefined') {
    buyBoxPrice = buyBoxWinner.price;
  } else if (buyBoxData.buyBoxPrice) {
    buyBoxPrice = buyBoxData.buyBoxPrice;
  }

  return {
    buyBoxOwner: hasBuyBox ? 'Your Store' : (buyBoxWinner?.sellerId || 'Unknown'),
    buyBoxSellerName: buyBoxWinner?.sellerName || 'Unknown',
    hasBuyBox: hasBuyBox,
    buyBoxPrice: buyBoxPrice,
    buyBoxCurrency: buyBoxWinner?.currency || 'GBP',
    lastChecked: new Date().toISOString(),
    competitorInfo: competitorInfo,
    yourOffers: yourOffers,
    recommendations: Array.isArray(buyBoxData.recommendations) ? buyBoxData.recommendations : []
  };
}

/**
 * Calculate profitability metrics for the Buy Box price
 */
async function calculateProfitability(
  asin: string,
  sku: string,
  buyBoxPrice: number,
  ourPrice: number
): Promise<{
  opportunityFlag: boolean;
  minProfitablePrice: number;
  marginAtBuyBox: number;
  marginPercentAtBuyBox: number;
}> {
  try {
    // Get cost data from skus table
    const { data: skuData } = await supabaseAdmin
      .from('skus')
      .select('cost, handling_cost, shipping_cost, min_price')
      .eq('sku', sku)
      .single();

    // Default values if not found
    const cost = skuData?.cost || 0;
    const handlingCost = skuData?.handling_cost || 0;
    const shippingCost = skuData?.shipping_cost || 0;
    const minPrice = skuData?.min_price || 0;

    // Get Amazon fee rate (default 15%)
    const amazonFeeRate = 0.15;

    // Calculate total cost
    const totalCost = cost + handlingCost + shippingCost;

    // Calculate margin at Buy Box price
    const amazonFeeAtBuyBox = buyBoxPrice * amazonFeeRate;
    const marginAtBuyBox = buyBoxPrice - amazonFeeAtBuyBox - totalCost;

    // Calculate margin percent
    const marginPercentAtBuyBox = totalCost > 0 ? (marginAtBuyBox / totalCost) * 100 : 0;

    // Calculate minimum profitable price (with 10% margin)
    const minMarginRequired = 0.10; // 10% margin
    const minProfitablePrice = totalCost * (1 + minMarginRequired) / (1 - amazonFeeRate);

    // Determine if this is an opportunity
    const opportunityFlag =
      marginAtBuyBox > 0 &&
      marginPercentAtBuyBox >= 10 &&
      buyBoxPrice >= minPrice;

    return {
      opportunityFlag,
      minProfitablePrice,
      marginAtBuyBox,
      marginPercentAtBuyBox
    };
  } catch (error) {
    console.error('Error calculating profitability:', error);

    // Return default values if there's an error
    return {
      opportunityFlag: false,
      minProfitablePrice: 0,
      marginAtBuyBox: 0,
      marginPercentAtBuyBox: 0
    };
  }
}
