#!/usr/bin/env node

/**
 * Real-time Rate Limiting Monitor
 * 
 * Monitors the current bulk scan job and provides live rate limiting analytics
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env file if present
require('dotenv').config();

// Configuration
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL || 'https://buy-box-render-service.onrender.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getCurrentJob() {
  try {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data[0] || null;
  } catch (error) {
    console.error('Failed to get current job:', error);
    return null;
  }
}

async function getJobFailures(jobId) {
  try {
    const { data, error } = await supabase
      .from('buybox_failures')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to get job failures:', error);
    return [];
  }
}

async function analyzeRateLimiting(jobId) {
  const failures = await getJobFailures(jobId);

  const rateLimitFailures = failures.filter(f =>
    f.error_type === 'RATE_LIMITED' ||
    f.error_message.includes('QuotaExceeded') ||
    f.error_message.includes('RATE_LIMITED')
  );

  const recentFailures = failures.filter(f => {
    const failureTime = new Date(f.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return failureTime > fiveMinutesAgo;
  });

  const recentRateLimits = recentFailures.filter(f =>
    f.error_type === 'RATE_LIMITED' ||
    f.error_message.includes('QuotaExceeded')
  );

  return {
    totalFailures: failures.length,
    rateLimitFailures: rateLimitFailures.length,
    recentFailures: recentFailures.length,
    recentRateLimits: recentRateLimits.length,
    rateLimitRate: failures.length > 0 ? (rateLimitFailures.length / failures.length * 100).toFixed(1) : 0,
    recentRateLimitRate: recentFailures.length > 0 ? (recentRateLimits.length / recentFailures.length * 100).toFixed(1) : 0
  };
}

async function getJobProgress(jobId) {
  try {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to get job progress:', error);
    return null;
  }
}

async function calculateEstimatedCompletion(job, analytics) {
  const processed = job.processed_asins;
  const total = job.total_asins;
  const remaining = total - processed;

  if (processed === 0) return 'N/A';

  const elapsed = Date.now() - new Date(job.started_at).getTime();
  const processingRate = processed / (elapsed / 1000); // ASINs per second

  // Account for rate limiting
  const adjustedRate = processingRate * (1 - analytics.recentRateLimitRate / 100);
  const estimatedSecondsRemaining = remaining / Math.max(adjustedRate, 0.1);

  const hours = Math.floor(estimatedSecondsRemaining / 3600);
  const minutes = Math.floor((estimatedSecondsRemaining % 3600) / 60);

  return `${hours}h ${minutes}m`;
}

async function printMonitoringReport() {
  console.clear();
  console.log('🔍 REAL-TIME RATE LIMITING MONITOR');
  console.log('='.repeat(50));
  console.log(`📅 ${new Date().toLocaleString()}\n`);

  const currentJob = await getCurrentJob();

  if (!currentJob) {
    console.log('❌ No active jobs found');
    return;
  }

  const job = await getJobProgress(currentJob.id);
  const analytics = await analyzeRateLimiting(job.id);
  const estimatedCompletion = await calculateEstimatedCompletion(job, analytics);

  console.log('📊 JOB STATUS');
  console.log('-'.repeat(30));
  console.log(`Job ID: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`Progress: ${job.processed_asins}/${job.total_asins} (${((job.processed_asins / job.total_asins) * 100).toFixed(1)}%)`);
  console.log(`Success: ${job.successful_asins}`);
  console.log(`Failed: ${job.failed_asins}`);
  console.log(`Started: ${new Date(job.started_at).toLocaleString()}`);
  console.log(`Estimated Completion: ${estimatedCompletion}`);

  console.log('\n🚫 RATE LIMITING ANALYSIS');
  console.log('-'.repeat(30));
  console.log(`Total Failures: ${analytics.totalFailures}`);
  console.log(`Rate Limited: ${analytics.rateLimitFailures} (${analytics.rateLimitRate}%)`);
  console.log(`Recent Failures (5m): ${analytics.recentFailures}`);
  console.log(`Recent Rate Limits: ${analytics.recentRateLimits} (${analytics.recentRateLimitRate}%)`);

  const successRate = job.processed_asins > 0 ? ((job.successful_asins / job.processed_asins) * 100).toFixed(1) : 0;
  console.log(`Overall Success Rate: ${successRate}%`);

  // Performance recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(30));

  if (analytics.recentRateLimitRate > 20) {
    console.log('🔴 HIGH rate limiting detected!');
    console.log('   → Consider increasing delays to 5-6 seconds');
    console.log('   → Pause job and restart with conservative settings');
  } else if (analytics.recentRateLimitRate > 10) {
    console.log('🟡 MODERATE rate limiting detected');
    console.log('   → Current 4-second delays may need adjustment');
    console.log('   → Monitor for improvement');
  } else if (analytics.recentRateLimitRate > 0) {
    console.log('🟢 LOW rate limiting - adaptive backoff working');
    console.log('   → Current settings appear acceptable');
  } else {
    console.log('✅ NO recent rate limiting');
    console.log('   → Consider gradual speed increase if processing slowly');
  }

  console.log('\n⏰ NEXT UPDATE IN 30 SECONDS...\n');
}

async function monitorRateLimiting() {
  console.log('🚀 Starting rate limiting monitor...\n');

  // Initial report
  await printMonitoringReport();

  // Update every 30 seconds
  setInterval(printMonitoringReport, 30000);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Rate limiting monitor stopped');
  process.exit(0);
});

// Start monitoring
monitorRateLimiting().catch(error => {
  console.error('Monitor failed:', error);
  process.exit(1);
});
