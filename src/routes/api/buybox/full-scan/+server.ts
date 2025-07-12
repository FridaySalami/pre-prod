import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { TransformedBuyBoxData, OfferDetails } from '$lib/types/buybox';

/**
 * Buy Box full scan endpoint for Buy Box Monitor
 * This endpoint will scan all SKUs with monitoring_enabled=true
 * Features:
 * - Rate limiting with jitter to avoid triggering Amazon's anti-scraping measures
 * - Retry logic (max 3 attempts) for failed requests
 * - Job tracking in buybox_jobs table
 * - Error logging in buybox_failures table
 * - Results stored in buybox_data table
 */
export async function POST({ request }) {
  try {
    const requestBody = await request.json();
    const {
      rateLimit = 1,   // Default to 1 request per second
      jitter = 400,    // Default jitter of 400ms
      maxRetries = 3,  // Default max retries
      source = 'scheduled' // Source of the scan request
    } = requestBody;    // Create a new job record
    // Ensure rate limit is at least 0.1 to avoid division by zero issues
    const safeRateLimit = Math.max(0.1, rateLimit);

    console.log(`Creating job with rate: ${safeRateLimit}/sec, jitter: ${jitter}ms, retries: ${maxRetries}`);

    const { data: job, error: jobError } = await supabaseAdmin
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        source: source,
        rate_limit_per_second: Math.max(1, Math.floor(safeRateLimit * 10)), // Store as requests per 10 seconds (minimum 1)
        jitter_ms: jitter,
        max_retries: maxRetries
      })
      .select('*')
      .single();

    if (jobError || !job) {
      console.error('Failed to create job record:', jobError);
      return json({
        success: false,
        error: 'Failed to create job record'
      }, { status: 500 });
    }

    // Queue up the job to run asynchronously
    processBuyBoxScan(job.id, rateLimit, jitter, maxRetries)
      .catch(error => {
        console.error('Error in Buy Box scan job:', error);
        // Update job status to failed if the job crashes
        supabaseAdmin
          .from('buybox_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            notes: `Job crashed: ${error.message}`
          })
          .eq('id', job.id)
          .then(() => {
            console.log(`Job ${job.id} marked as failed due to crash`);
          });
      });

    // Return immediately with the job ID
    return json({
      success: true,
      jobId: job.id,
      message: 'Buy Box scan job started'
    });

  } catch (error) {
    console.error('Buy Box full scan error:', error);
    return json({
      success: false,
      error: (error as Error).message || 'Failed to start Buy Box scan'
    }, { status: 500 });
  }
}

/**
 * Process the Buy Box scan job asynchronously
 */
async function processBuyBoxScan(
  jobId: string,
  rateLimit: number,
  jitter: number,
  maxRetries: number
): Promise<void> {
  let totalAsins = 0;
  let successfulAsins = 0;
  let failedAsins = 0;
  const startTime = Date.now();

  try {
    // Get all active SKUs from the database
    const { data: skus, error: skusError } = await supabaseAdmin
      .from('sku_asin_mapping')
      .select('seller_sku, asin1')
      .eq('status', 'Active')
      .not('asin1', 'is', null)
      .order('seller_sku');

    if (skusError) {
      throw new Error(`Failed to fetch SKUs: ${skusError.message}`);
    }

    if (!skus || skus.length === 0) {
      await updateJobStatus(
        jobId,
        'completed',
        0,
        0,
        0,
        'No active SKUs found'
      );
      return;
    }

    totalAsins = skus.length;

    // Update job with total count
    await supabaseAdmin
      .from('buybox_jobs')
      .update({ total_asins: totalAsins })
      .eq('id', jobId);

    // Randomize the order of SKUs to avoid patterns
    const randomizedSkus = [...skus].sort(() => Math.random() - 0.5);

    // Process each SKU with rate limiting and jitter
    for (const sku of randomizedSkus) {
      try {
        // Process the SKU with retry logic
        const result = await processSkuWithRetry(sku.asin1, sku.seller_sku, jobId, maxRetries);

        if (result.success) {
          successfulAsins++;
        } else {
          failedAsins++;
        }

        // Update job with current progress
        if ((successfulAsins + failedAsins) % 10 === 0 || (successfulAsins + failedAsins) === totalAsins) {
          await supabaseAdmin
            .from('buybox_jobs')
            .update({
              successful_asins: successfulAsins,
              failed_asins: failedAsins
            })
            .eq('id', jobId);
        }

        // Apply more conservative rate limiting with jitter
        // Adjust rate limiting based on whether we had recent failures
        // Ensure rate limit is at least 0.1 to avoid division by zero or extremely long delays
        const safeRateLimit = Math.max(0.1, rateLimit);
        const hadRecentFailure = result.success === false;
        const baseDelay = hadRecentFailure
          ? 2000 / safeRateLimit  // Slower if we just had a failure
          : 1000 / safeRateLimit; // Base delay in ms

        // Add more jitter when we're experiencing failures
        const maxJitter = hadRecentFailure ? jitter * 2 : jitter;
        const jitterMs = Math.floor(Math.random() * maxJitter); // Random jitter

        const delay = baseDelay + jitterMs;

        console.log(`Rate limiting delay for next request: ${delay}ms ${hadRecentFailure ? '(increased due to recent failure)' : ''}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`Error processing SKU ${sku.seller_sku}:`, error);
        failedAsins++;

        // Log the failure
        await supabaseAdmin
          .from('buybox_failures')
          .insert({
            job_id: jobId,
            asin: sku.asin1,
            sku: sku.seller_sku,
            reason: `Unhandled error: ${(error as Error).message}`,
            error_code: 'INTERNAL_ERROR',
            attempt_number: maxRetries
          });
      }
    }
  } catch (error) {
    // Update job as failed if there's an error in the main process
    await updateJobStatus(
      jobId,
      'failed',
      totalAsins,
      successfulAsins,
      failedAsins,
      `Error in scan process: ${(error as Error).message}`
    );
    throw error;
  }

  // Calculate duration
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

  // Update job as completed
  await updateJobStatus(
    jobId,
    'completed',
    totalAsins,
    successfulAsins,
    failedAsins,
    null,
    durationSeconds
  );
}

/**
 * Process a single SKU with retry logic
 */
async function processSkuWithRetry(
  asin: string,
  sku: string,
  jobId: string,
  maxRetries: number
): Promise<{ success: boolean }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Log the attempt number
      console.log(`Processing ASIN ${asin} (SKU: ${sku}): Attempt ${attempt} of ${maxRetries}`);

      // Get Buy Box data for this ASIN
      const buyBoxData = await checkBuyBox(asin);

      // Additional validation to ensure we got valid data
      if (!buyBoxData) {
        throw new Error('No Buy Box data returned from API');
      }

      // Check for error indicator in the API response
      if (buyBoxData.error === true) {
        // Special handling for rate limit errors - add longer backoff
        if (buyBoxData.errorType === 'RATE_LIMIT') {
          // If this isn't the last attempt, use a longer backoff for rate limits
          if (attempt < maxRetries) {
            const rateLimitBackoff = Math.pow(2, attempt + 1) * 1000; // Longer backoff for rate limits
            console.log(`Rate limited on ASIN ${asin}. Backing off for ${rateLimitBackoff}ms before retry.`);
            await new Promise(resolve => setTimeout(resolve, rateLimitBackoff));
          }
        }
        throw new Error(buyBoxData.errorMessage || 'Buy Box API returned an error');
      }

      const transformedData = transformBuyBoxData(buyBoxData, asin);

      // Get product info from sku_asin_mapping
      const { data: productData } = await supabaseAdmin
        .from('sku_asin_mapping')
        .select('*')
        .eq('asin1', asin)
        .single();

      // Calculate profitability
      const profitCalculation = await calculateProfitability(
        asin,
        sku,
        transformedData.buyBoxPrice || 0,
        productData?.price || 0
      );        // Store the result in buybox_data table
      // Add debug logging to help troubleshoot
      console.log(`Processing ${asin} (${sku}): Buy Box Price: ${transformedData.buyBoxPrice}, Is Winner: ${transformedData.hasBuyBox}`);

      // Get merchant token information for accurate Buy Box determination
      const yourSellerId = process.env.YOUR_SELLER_ID || 'A2D8NG39VURSL3';
      const buyBoxMerchantToken = transformedData.hasBuyBox ? yourSellerId : transformedData.buyBoxOwner;

      const { data: insertResult, error: insertError } = await supabaseAdmin
        .from('buybox_data')
        .insert({
          run_id: jobId,
          asin: asin,
          sku: sku,
          price: transformedData.buyBoxPrice, // Should now be properly extracted
          currency: transformedData.buyBoxCurrency || 'GBP',
          is_winner: transformedData.hasBuyBox, // Should now be properly detected
          merchant_token: yourSellerId, // Add merchant token for your store
          buybox_merchant_token: buyBoxMerchantToken, // Add Buy Box owner merchant token
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
          source: 'batch'
        });

      if (insertError) {
        console.error(`Failed to insert Buy Box data for ${asin}:`, insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      console.log(`✅ Successfully saved Buy Box data for ${asin} (${sku})`);
      return { success: true };
    } catch (error) {
      lastError = error as Error;

      // Determine error type for better debugging
      const errorCode = lastError.message.includes('Rate limit') || lastError.message.includes('429')
        ? 'RATE_LIMIT_ERROR'
        : lastError.message.includes('parse') || lastError.message.includes('JSON')
          ? 'PARSE_ERROR'
          : 'API_ERROR';

      console.warn(`Attempt ${attempt} failed for ASIN ${asin}: ${errorCode} - ${lastError.message}`);

      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        // Exponential backoff with different timing based on error type
        let backoffMs = Math.pow(2, attempt) * 500;

        // Add extra backoff for rate limit errors
        if (errorCode === 'RATE_LIMIT_ERROR') {
          backoffMs = Math.pow(2, attempt + 1) * 1000; // Much longer backoff for rate limits
          console.log(`Rate limited on ASIN ${asin}. Using extended backoff: ${backoffMs}ms`);
        }

        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        // Log the failure after all retries have failed
        await supabaseAdmin
          .from('buybox_failures')
          .insert({
            job_id: jobId,
            asin: asin,
            sku: sku,
            reason: `Failed after ${maxRetries} attempts: ${lastError.message}`,
            error_code: errorCode,
            attempt_number: attempt,
            raw_error: lastError ? JSON.stringify(lastError) : null
          });

        console.error(`Final failure for ASIN ${asin} (SKU: ${sku}): ${errorCode} - ${lastError.message}`);
      }
    }
  }

  return { success: false };
}

/**
 * Update job status in the database
 */
async function updateJobStatus(
  jobId: string,
  status: 'running' | 'completed' | 'failed',
  totalAsins: number,
  successfulAsins: number,
  failedAsins: number,
  notes: string | null = null,
  durationSeconds: number | null = null
): Promise<void> {
  const updateData: any = {
    status,
    total_asins: totalAsins,
    successful_asins: successfulAsins,
    failed_asins: failedAsins
  };

  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  if (notes) {
    updateData.notes = notes;
  }

  if (durationSeconds !== null) {
    updateData.duration_seconds = durationSeconds;
  }

  await supabaseAdmin
    .from('buybox_jobs')
    .update(updateData)
    .eq('id', jobId);
}

/**
 * Check Buy Box status using my-buy-box-monitor.cjs
 * This reuses the same function from the check endpoint
 */
async function checkBuyBox(asin: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const buyBoxScript = path.join(process.cwd(), 'my-buy-box-monitor.cjs');

    // Check if script exists
    if (!fs.existsSync(buyBoxScript)) {
      // Fall back to simplified mock response for development
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
    buyBoxOwner: hasBuyBox ? 'Your Store' : 'Competitor Store',
    hasBuyBox: hasBuyBox,
    buyBoxPrice: (15.99 + Math.random() * 10).toFixed(2),
    lastChecked: new Date().toISOString(),
    competitorInfo: [
      {
        sellerName: 'Your Store',
        price: 19.99,
        condition: 'New',
        fulfillmentType: 'FBA',
        hasBuyBox: hasBuyBox
      },
      {
        sellerName: 'Competitor Store',
        price: 18.49,
        condition: 'New',
        fulfillmentType: 'FBA',
        hasBuyBox: !hasBuyBox
      },
      {
        sellerName: 'Another Seller',
        price: 22.99,
        condition: 'New',
        fulfillmentType: 'Merchant',
        hasBuyBox: false
      }
    ]
  };
}

/**
 * Transform raw buy box data into a standardized format
 */
function transformBuyBoxData(buyBoxData: any, asin: string): TransformedBuyBoxData {
  console.log(`Transforming Buy Box data for ${asin}:`, JSON.stringify(buyBoxData).substring(0, 200) + '...');

  // Define default response structure
  const defaultResponse: TransformedBuyBoxData = {
    buyBoxOwner: 'Unknown',
    hasBuyBox: false,
    buyBoxPrice: null,
    lastChecked: new Date().toISOString(),
    competitorInfo: [],
    yourOffers: []
  };

  // Handle mock or empty data
  if (!buyBoxData) {
    console.warn(`No Buy Box data provided for ASIN ${asin}`);
    return defaultResponse;
  }

  try {
    // Get buy box winner details - fixed to use the correct field names from my-buy-box-monitor.cjs output
    const buyBoxWinner = buyBoxData.buyBoxWinner || null;

    // Check if you own the Buy Box using the correct field
    const hasBuyBox = buyBoxData.youOwnBuyBox === true;

    // Parse competitor and your offers using the correct field names
    const competitorInfo = Array.isArray(buyBoxData.competitorOffers) ? buyBoxData.competitorOffers : [];
    const yourOffers = Array.isArray(buyBoxData.yourOffers) ? buyBoxData.yourOffers : [];

    // Added safeguards for price extraction
    let buyBoxPrice = null;
    if (buyBoxWinner && typeof buyBoxWinner.price !== 'undefined') {
      buyBoxPrice = buyBoxWinner.price;
    } else if (buyBoxData.buyBoxPrice) {
      buyBoxPrice = buyBoxData.buyBoxPrice;
    }

    // Log the transformation details for debugging
    console.log(`ASIN ${asin}: Buy Box Owner: ${hasBuyBox ? 'Your Store' : (buyBoxWinner?.sellerId || 'Unknown')}, Price: ${buyBoxPrice}, Has Buy Box: ${hasBuyBox}`);

    return {
      buyBoxOwner: hasBuyBox ? 'Your Store' : (buyBoxWinner?.sellerId || 'Unknown'),
      buyBoxSellerName: buyBoxWinner?.sellerName || 'Unknown',
      hasBuyBox: hasBuyBox, // Fixed to use youOwnBuyBox
      buyBoxPrice: buyBoxPrice, // Using our more robust price detection
      buyBoxCurrency: buyBoxWinner?.currency || 'GBP',
      lastChecked: new Date().toISOString(),
      competitorInfo: competitorInfo,
      yourOffers: yourOffers,
      recommendations: Array.isArray(buyBoxData.recommendations) ? buyBoxData.recommendations : []
    };
  } catch (error) {
    console.error(`Error transforming Buy Box data for ASIN ${asin}:`, error);
    console.error('Raw data:', JSON.stringify(buyBoxData).substring(0, 300) + '...');
    return defaultResponse;
  }
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
    // An opportunity exists if:
    // 1. The Buy Box price allows us to make a profit
    // 2. Our margin would be at least 10%
    // 3. The Buy Box price is above our minimum acceptable price
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
