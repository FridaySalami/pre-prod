/**
 * Job Status Route
 * 
 * Provides real-time status and progress tracking for Buy Box jobs
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET /:jobId - Get job status and progress
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get job details from database
    const job = await SupabaseService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: jobId,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate progress percentage
    const progressPercentage = job.total_asins > 0
      ? Math.round(((job.successful_asins + job.failed_asins) / job.total_asins) * 100)
      : 0;

    // Calculate estimated time remaining
    let estimatedTimeRemaining = null;
    if (job.status === 'running' && job.started_at) {
      const startTime = new Date(job.started_at);
      const now = new Date();
      const elapsedMs = now - startTime;
      const processedCount = job.successful_asins + job.failed_asins;

      if (processedCount > 0) {
        const avgTimePerAsin = elapsedMs / processedCount;
        const remainingAsins = job.total_asins - processedCount;
        estimatedTimeRemaining = Math.round((avgTimePerAsin * remainingAsins) / 1000); // seconds
      }
    }

    // Format response
    const response = {
      jobId: job.id,
      status: job.status,
      progress: {
        total: job.total_asins,
        successful: job.successful_asins,
        failed: job.failed_asins,
        processed: job.successful_asins + job.failed_asins,
        percentage: progressPercentage,
        estimatedTimeRemaining: estimatedTimeRemaining
      },
      timestamps: {
        started: job.started_at,
        completed: job.completed_at,
        lastUpdated: job.updated_at || job.created_at
      },
      source: job.source,
      notes: job.notes,
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('Get job status error:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /:jobId/cancel - Cancel a running job
 */
router.post('/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Get current job status
    const job = await SupabaseService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        jobId: jobId,
        timestamp: new Date().toISOString()
      });
    }

    if (job.status !== 'running') {
      return res.status(400).json({
        error: 'Job is not running and cannot be cancelled',
        currentStatus: job.status,
        timestamp: new Date().toISOString()
      });
    }

    // Mark job as cancelled
    const updatedJob = await SupabaseService.failJob(jobId, 'Job cancelled by user request');

    res.json({
      message: 'Job cancelled successfully',
      jobId: jobId,
      previousStatus: job.status,
      newStatus: updatedJob.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /recent - Get recent jobs
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // This would need to be implemented in SupabaseService
    // For now, return a simple response
    res.json({
      message: 'Recent jobs endpoint - implementation pending',
      limit: limit,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get recent jobs error:', error);
    res.status(500).json({
      error: 'Failed to get recent jobs',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
