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

// Load environment variables (Render.com automatically provides env vars)
dotenv.config({ path: path.join(__dirname, '.env') });

// Import routes - all routes must load successfully in production
const bulkScanRoute = require('./routes/bulk-scan');
const singleAsinRoute = require('./routes/single-asin');
const weeklyComparisonRoute = require('./routes/weekly-comparison');
const healthRoute = require('./routes/health');
const jobStatusRoute = require('./routes/job-status');
const jobFailuresRoute = require('./routes/job-failures');
const jobResultsRoute = require('./routes/job-results');
const livePricingRoute = require('./routes/live-pricing');
const batchPriceUpdateRoute = require('./routes/batch-price-update');
const buyboxRecordRoute = require('./routes/buybox-record');
const buyboxStatusRoute = require('./routes/buybox-status');
const debugRoute = require('./routes/debug');
const emergencyRoute = require('./routes/emergency');
const testCompetitivePricingRoute = require('./routes/test-competitive-pricing');
const monitoringJobRoute = require('./routes/monitoring-job-live');
const asinSkuMappingRoute = require('./routes/asin-sku-mapping');
const supabaseClient = require('./services/supabase-client');
const SupabaseService = supabaseClient.SupabaseService;

console.log('✅ All routes and services loaded successfully');

// Create Express app
const app = express();
const PORT = process.env.PORT || 10000; // Render.com uses port 10000 by default

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoute);
app.use('/api/bulk-scan', bulkScanRoute);
app.use('/api/single-asin', singleAsinRoute);
app.use('/api/weekly-comparison', weeklyComparisonRoute);
app.use('/api/job-status', jobStatusRoute);
app.use('/api/job-failures', jobFailuresRoute);
app.use('/api/job-results', jobResultsRoute);
app.use('/api/live-pricing', livePricingRoute);
app.use('/api/batch-price-update', batchPriceUpdateRoute);
app.use('/api', buyboxRecordRoute);
app.use('/api/buybox-status', buyboxStatusRoute);
app.use('/api/debug', debugRoute);
app.use('/api/emergency', emergencyRoute.router);
app.use('/test-competitive-pricing', testCompetitivePricingRoute);
app.use('/api/monitoring-job', monitoringJobRoute);
app.use('/api/asin-sku', asinSkuMappingRoute);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Buy Box Render Service',
    version: '1.0.0',
    status: 'running',
    mode: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 10000,
    endpoints: [
      'GET /health - Health check',
      'POST /api/bulk-scan/start - Start bulk scanning job',
      'POST /api/single-asin/:asin - Scan a single ASIN',
      'POST /api/weekly-comparison/run - Run weekly sales comparison',
      'GET /api/weekly-comparison/report - Download comparison report',
      'GET /api/weekly-comparison/status - Check comparison files status',
      'GET /api/job-status - List all jobs',
      'GET /api/job-status/:jobId - Get job status',
      'POST /api/job-status/:jobId/cancel - Cancel job',
      'GET /api/job-failures?job_id=:jobId - Get job failures',
      'GET /api/job-results?job_id=:jobId - Get job results',
      'POST /api/live-pricing/update - Update live pricing for single SKU',
      'GET /api/live-pricing/status/:recordId - Check update eligibility',
      'GET /api/live-pricing/health - Live pricing service health',
      'GET /test-competitive-pricing/sample - Get sample ASINs for testing',
      'POST /test-competitive-pricing/compare - Test competitive pricing APIs',
      'GET /api/monitoring-job/status - Get monitoring job status',
      'POST /api/monitoring-job/start - Start monitoring job',
      'POST /api/monitoring-job/stop - Stop monitoring job',
      'POST /api/monitoring-job/manual-check - Run manual ASIN check'
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

// Start server - Bind to 0.0.0.0 for Render.com
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Buy Box Render Service started on port ${PORT}`);
  console.log(`📊 Ready to process up to 3,477 ASINs`);
  console.log(`⏰ Estimated max processing time: 2-3 hours`);
  console.log(`🔗 Health check: /health`);
  console.log(`📈 Service info: /`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
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
