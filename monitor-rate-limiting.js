/**
 * monitor-rate-limiting.js
 * 
 * A script to monitor rate limiting metrics in real-time for a running buy box job.
 * This helps diagnose rate limit issues and optimize API call patterns.
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment variables from .env file if present
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    jobId: null,
    interval: 30, // Default monitoring interval in seconds
    outputFile: path.join(os.homedir(), 'rate-limiting-metrics.json'),
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--job-id' && i + 1 < args.length) {
      options.jobId = args[i + 1];
      i++;
    } else if (args[i] === '--interval' && i + 1 < args.length) {
      options.interval = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      options.outputFile = args[i + 1];
      i++;
    } else if (args[i] === '--verbose') {
      options.verbose = true;
    } else if (args[i] === '--help') {
      printUsage();
      process.exit(0);
    }
  }

  if (!options.jobId) {
    console.error('Error: --job-id is required');
    printUsage();
    process.exit(1);
  }

  return options;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node monitor-rate-limiting.js --job-id <job_id> [options]

Options:
  --job-id <job_id>       Job ID to monitor (required)
  --interval <seconds>    Monitoring interval in seconds (default: 30)
  --output <file>         Output file for metrics (default: ~/rate-limiting-metrics.json)
  --verbose               Enable verbose output
  --help                  Display this help message
  `);
}

/**
 * Get job details from Supabase
 */
async function getJobDetails(jobId) {
  const { data, error } = await supabase
    .from('buybox_jobs')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job details: ${error.message}`);
  }

  return data;
}

/**
 * Get rate limiting events for a job
 */
async function getRateLimitEvents(jobId, fromTime = null) {
  let query = supabase
    .from('buybox_failures')
    .select('*')
    .eq('job_id', jobId)
    .filter('error', 'ilike', '%429%')
    .order('created_at', { ascending: true });

  if (fromTime) {
    query = query.gt('created_at', fromTime);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get rate limit events: ${error.message}`);
  }

  return data || [];
}

/**
 * Get job progress from Supabase
 */
async function getJobProgress(jobId) {
  const { data: job, error } = await supabase
    .from('buybox_jobs')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (error) {
    throw new Error(`Failed to get job progress: ${error.message}`);
  }

  // Get success and error counts
  const { count: successCount, error: successError } = await supabase
    .from('buybox_data')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId);

  const { count: errorCount, error: errorError } = await supabase
    .from('buybox_failures')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId);

  if (successError || errorError) {
    throw new Error(`Failed to get counts: ${successError?.message || errorError?.message}`);
  }

  return {
    job,
    processedItems: (successCount || 0) + (errorCount || 0),
    successCount: successCount || 0,
    errorCount: errorCount || 0,
    totalItems: job.total_items || 0
  };
}

/**
 * Calculate rate limiting metrics
 */
function calculateMetrics(rateLimitEvents, timeWindow = 300000) { // 5-minute window by default
  if (!rateLimitEvents || rateLimitEvents.length === 0) {
    return {
      total429Count: 0,
      rate429Per5Min: 0,
      rate429PerHour: 0,
      timeBetween429s: 0,
      hasRateLimitingIssue: false
    };
  }

  const now = new Date();
  const fiveMinutesAgo = new Date(now - timeWindow);
  const oneHourAgo = new Date(now - 3600000);

  // Count 429s in the last 5 minutes
  const recent429s = rateLimitEvents.filter(event =>
    new Date(event.created_at) >= fiveMinutesAgo
  );

  // Count 429s in the last hour
  const hourly429s = rateLimitEvents.filter(event =>
    new Date(event.created_at) >= oneHourAgo
  );

  // Calculate average time between 429s
  let avgTimeBetween429s = 0;
  if (rateLimitEvents.length > 1) {
    let totalTime = 0;
    for (let i = 1; i < rateLimitEvents.length; i++) {
      const current = new Date(rateLimitEvents[i].created_at);
      const previous = new Date(rateLimitEvents[i - 1].created_at);
      totalTime += current - previous;
    }
    avgTimeBetween429s = totalTime / (rateLimitEvents.length - 1);
  }

  // Determine if we have a rate limiting issue
  const hasRateLimitingIssue = recent429s.length > 3; // Arbitrary threshold

  return {
    total429Count: rateLimitEvents.length,
    recent429Count: recent429s.length,
    rate429Per5Min: (recent429s.length / (timeWindow / 60000)).toFixed(2),
    rate429PerHour: (hourly429s.length / (3600000 / 60000)).toFixed(2),
    avgSecondsBetween429s: (avgTimeBetween429s / 1000).toFixed(2),
    hasRateLimitingIssue
  };
}

/**
 * Analyze the job progress and rate
 */
function analyzeJobProgress(job, progress) {
  const startTime = new Date(job.created_at);
  const now = new Date();
  const elapsedMs = now - startTime;
  const elapsedMinutes = elapsedMs / 60000;

  // Calculate current rate
  const currentRate = progress.processedItems / (elapsedMs / 1000);

  // Estimate completion
  const remainingItems = progress.totalItems - progress.processedItems;
  const estimatedSecondsRemaining = currentRate > 0 ? remainingItems / currentRate : Infinity;

  // Calculate estimated completion time
  const estimatedCompletionTime = new Date(now.getTime() + (estimatedSecondsRemaining * 1000));

  return {
    currentRatePerSecond: currentRate.toFixed(3),
    currentRatePerMinute: (currentRate * 60).toFixed(2),
    elapsedMinutes: elapsedMinutes.toFixed(1),
    estimatedMinutesRemaining: (estimatedSecondsRemaining / 60).toFixed(1),
    estimatedCompletionTime: isFinite(estimatedSecondsRemaining)
      ? estimatedCompletionTime.toISOString()
      : 'unknown',
    percentComplete: progress.totalItems > 0
      ? ((progress.processedItems / progress.totalItems) * 100).toFixed(1)
      : 0
  };
}

/**
 * Display job status in console
 */
function displayJobStatus(job, progress, metrics, analysis) {
  console.clear();
  console.log('='.repeat(50));
  console.log(`BUY BOX JOB MONITORING - JOB ID: ${job.job_id}`);
  console.log('='.repeat(50));

  console.log(`\nJOB STATUS: ${job.status.toUpperCase()}`);
  console.log(`Started: ${new Date(job.created_at).toLocaleString()}`);
  console.log(`Rate limit: ${job.rate_limit} req/sec (with ${job.jitter * 100}% jitter)`);
  console.log(`Progress: ${progress.processedItems}/${progress.totalItems} items (${analysis.percentComplete}%)`);

  // Progress bar
  const barLength = 30;
  const completed = Math.round((progress.processedItems / progress.totalItems) * barLength);
  const progressBar = '█'.repeat(completed) + '░'.repeat(barLength - completed);
  console.log(`\n[${progressBar}]`);

  console.log(`\nSuccessful: ${progress.successCount} | Failed: ${progress.errorCount}`);

  console.log('\nPERFORMANCE METRICS:');
  console.log(`Current processing rate: ${analysis.currentRatePerSecond} req/sec (${analysis.currentRatePerMinute}/min)`);
  console.log(`Elapsed time: ${analysis.elapsedMinutes} minutes`);
  console.log(`Estimated time remaining: ${analysis.estimatedMinutesRemaining} minutes`);
  console.log(`Estimated completion: ${analysis.estimatedCompletionTime}`);

  console.log('\nRATE LIMITING METRICS:');
  console.log(`Total 429 errors: ${metrics.total429Count}`);
  console.log(`Recent 429s (last 5 min): ${metrics.recent429Count || 0}`);
  console.log(`429 rate (per 5 min): ${metrics.rate429Per5Min || 0}`);
  console.log(`429 rate (per hour): ${metrics.rate429PerHour || 0}`);
  console.log(`Avg time between 429s: ${metrics.avgSecondsBetween429s || 'N/A'} seconds`);

  // Provide insights based on metrics
  console.log('\nINSIGHTS:');
  if (metrics.hasRateLimitingIssue) {
    console.log('⚠️  ACTIVE RATE LIMITING DETECTED - Amazon is throttling requests');
    if (metrics.avgSecondsBetween429s < 30) {
      console.log('⚠️  Rate limiting is occurring frequently - consider reducing request rate');
    }
  } else {
    console.log('✅ No significant rate limiting detected');
  }

  // Recommendations
  const recommendedRate = job.rate_limit;
  if (metrics.recent429Count > 5) {
    const newRecommendedRate = (recommendedRate * 0.5).toFixed(3);
    console.log(`\nRECOMMENDATION: Decrease rate limit from ${recommendedRate} to ${newRecommendedRate} req/sec`);
  } else if (metrics.total429Count === 0 && analysis.currentRatePerSecond < recommendedRate * 0.8) {
    const newRecommendedRate = (recommendedRate * 1.2).toFixed(3);
    console.log(`\nRECOMMENDATION: Job is running smoothly. Could try increasing rate limit to ${newRecommendedRate} req/sec`);
  }

  console.log('\nPress Ctrl+C to exit monitoring');
}

/**
 * Save metrics to a file
 */
function saveMetricsToFile(options, job, progress, metrics, analysis) {
  const data = {
    timestamp: new Date().toISOString(),
    jobId: job.job_id,
    status: job.status,
    rateLimit: job.rate_limit,
    jitter: job.jitter,
    progress: {
      processed: progress.processedItems,
      total: progress.totalItems,
      successful: progress.successCount,
      failed: progress.errorCount,
      percentComplete: analysis.percentComplete
    },
    performance: {
      currentRatePerSecond: analysis.currentRatePerSecond,
      elapsedMinutes: analysis.elapsedMinutes,
      estimatedMinutesRemaining: analysis.estimatedMinutesRemaining
    },
    rateLimiting: metrics
  };

  // Read existing file if it exists
  let allData = [];
  try {
    if (fs.existsSync(options.outputFile)) {
      const fileContent = fs.readFileSync(options.outputFile, 'utf8');
      allData = JSON.parse(fileContent);
    }
  } catch (err) {
    console.log('Creating new metrics file');
  }

  // Add new data point
  allData.push(data);

  // Write back to file
  fs.writeFileSync(options.outputFile, JSON.stringify(allData, null, 2));

  if (options.verbose) {
    console.log(`Metrics saved to ${options.outputFile}`);
  }
}

/**
 * Main monitoring function
 */
async function monitor(options) {
  console.log(`Starting monitoring for job ${options.jobId}`);
  console.log(`Interval: ${options.interval} seconds`);
  console.log(`Output file: ${options.outputFile}`);
  console.log('\nInitializing...');

  let lastRateLimitEventTime = null;
  let allRateLimitEvents = [];

  try {
    // Get initial job information
    const job = await getJobDetails(options.jobId);
    if (!job) {
      console.error(`Job ${options.jobId} not found`);
      process.exit(1);
    }

    // Initial rate limit events
    allRateLimitEvents = await getRateLimitEvents(options.jobId);

    // Start monitoring loop
    const monitorInterval = setInterval(async () => {
      try {
        // Get updated job information
        const job = await getJobDetails(options.jobId);
        const progress = await getJobProgress(options.jobId);

        // Get new rate limit events
        const newEvents = await getRateLimitEvents(
          options.jobId,
          lastRateLimitEventTime
        );

        if (newEvents.length > 0) {
          allRateLimitEvents = [...allRateLimitEvents, ...newEvents];
          lastRateLimitEventTime = new Date(
            newEvents[newEvents.length - 1].created_at
          ).toISOString();
        }

        // Calculate metrics
        const metrics = calculateMetrics(allRateLimitEvents);

        // Analyze job progress
        const analysis = analyzeJobProgress(job, progress);

        // Display status
        displayJobStatus(job, progress, metrics, analysis);

        // Save metrics to file
        saveMetricsToFile(options, job, progress, metrics, analysis);

        // If job is complete or cancelled, stop monitoring
        if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status)) {
          console.log(`\nJob ${options.jobId} is ${job.status.toLowerCase()}. Stopping monitoring.`);
          clearInterval(monitorInterval);
          process.exit(0);
        }
      } catch (error) {
        console.error('Error during monitoring:', error.message);
        if (options.verbose) {
          console.error(error);
        }
      }
    }, options.interval * 1000);

    // Handle termination signals
    process.on('SIGINT', () => {
      console.log('\nMonitoring stopped by user');
      clearInterval(monitorInterval);
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start monitoring:', error.message);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Parse arguments and start monitoring
const options = parseArgs();
monitor(options).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
