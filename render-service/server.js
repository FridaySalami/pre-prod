#!/usr/bin/env node
/**
 * Render Buy Box Monitoring Service
 * 
 * Long-running background service for processing bulk Buy Box scans
 * Designed to handle 3,477+ ASINs over 2+ hours without timeout
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes
const bulkScanRoute = require('./routes/bulk-scan');
const jobStatusRoute = require('./routes/job-status');
const jobFailuresRoute = require('./routes/job-failures');
const jobResultsRoute = require('./routes/job-results');
const healthRoute = require('./routes/health');
const debugRoute = require('./routes/debug');
const { SupabaseService } = require('./services/supabase-client');

// Keep-alive mechanism to prevent Render free tier sleep during active scans
let keepAliveInterval = null;

async function checkForActiveScans() {
  try {
    const { data: runningJobs } = await SupabaseService.client
      .from('buybox_jobs')
      .select('id, status')
      .eq('status', 'running')
      .limit(1);

    return runningJobs && runningJobs.length > 0;
  } catch (error) {
    console.log('⚠️ Keep-alive check failed:', error.message);
    return false;
  }
}

async function startKeepAlive() {
  if (keepAliveInterval) return; // Already running

  console.log('🔄 Starting keep-alive ping during active scan');
  keepAliveInterval = setInterval(async () => {
    const hasActiveScans = await checkForActiveScans();

    if (hasActiveScans) {
      // Self-ping to prevent sleep
      try {
        const fetch = (await import('node-fetch')).default;
        await fetch(`http://localhost:${PORT}/health`, { timeout: 5000 });
        console.log('✅ Keep-alive ping successful');
      } catch (error) {
        console.log('⚠️ Keep-alive ping failed:', error.message);
      }
    } else {
      // No active scans, stop keep-alive
      console.log('⏹️ No active scans, stopping keep-alive');
      stopKeepAlive();
    }
  }, 5 * 60 * 1000); // Every 5 minutes - more frequent than Render's 15-min timeout
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('🛑 Keep-alive stopped');
  }
}

// Export functions for use in routes
global.startKeepAlive = startKeepAlive;
global.stopKeepAlive = stopKeepAlive;

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoute);
app.use('/api/bulk-scan', bulkScanRoute);
app.use('/api/job-status', jobStatusRoute);
app.use('/api/job-failures', jobFailuresRoute);
app.use('/api/job-results', jobResultsRoute);
app.use('/api/debug', debugRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Buy Box Render Service',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health - Health check',
      'POST /api/bulk-scan/start - Start bulk scanning job',
      'GET /api/job-status - List all jobs',
      'GET /api/job-status/:jobId - Get job status',
      'POST /api/job-status/:jobId/cancel - Cancel job',
      'GET /api/job-failures?job_id=:jobId - Get job failures',
      'GET /api/job-results?job_id=:jobId - Get job results'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Buy Box Render Service started on port ${PORT}`);
  console.log(`📊 Ready to process up to 3,477 ASINs`);
  console.log(`⏰ Estimated max processing time: 2-3 hours`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Service info: http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
