/**
 * Emergency job killer - Force stops all background processing
 */

const express = require('express');
const router = express.Router();

// Global job tracking
let activeJobs = new Map();
let jobAbortControllers = new Map();

// Emergency stop all jobs
router.post('/emergency-stop', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY STOP: Killing all background jobs...');
    
    // Abort all active jobs
    for (let [jobId, controller] of jobAbortControllers) {
      console.log(`🛑 Aborting job: ${jobId}`);
      controller.abort();
    }
    
    // Clear all job trackers
    activeJobs.clear();
    jobAbortControllers.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ All background jobs terminated');
    
    res.json({
      success: true,
      message: 'All background jobs terminated',
      terminatedJobs: jobAbortControllers.size,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during emergency stop:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Check if any jobs are still running in memory
router.get('/memory-status', (req, res) => {
  res.json({
    activeJobs: activeJobs.size,
    abortControllers: jobAbortControllers.size,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

module.exports = { router, activeJobs, jobAbortControllers };