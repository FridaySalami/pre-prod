/**
 * Job Failures Route
 * 
 * Provides access to failures for Buy Box jobs
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET / - Get job failures
 */
router.get('/', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'job_id parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get failures from database
    const failures = await SupabaseService.getJobFailures(jobId);

    res.json({
      success: true,
      failures: failures,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get job failures error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job failures',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
