/**
 * Job Results Route
 * 
 * Provides access to results for Buy Box jobs
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET / - Get job results
 */
router.get('/', async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const asin = req.query.asin;
    const sku = req.query.sku;

    // Require either job_id or asin/sku
    if (!jobId && !asin && !sku) {
      return res.status(400).json({
        success: false,
        error: 'Either job_id, asin, or sku parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;

    // Parse filter parameters
    const showOpportunities = req.query.show_opportunities === 'true';
    const showWinners = req.query.show_winners === 'true';
    const includeAllJobs = req.query.include_all_jobs === 'true';

    // Get results from database
    const results = await SupabaseService.getJobResults({
      jobId,
      asin,
      sku,
      page,
      limit,
      offset,
      showOpportunities,
      showWinners,
      includeAllJobs
    });

    res.json({
      success: true,
      results: results.data,
      total: results.total,
      page: page,
      limit: limit,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get job results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job results',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
