/**
 * Supabase Client for Render Service
 * 
 * Handles all database operations for the Buy Box monitoring service
 */

const { createClient } = require('@supabase/supabase-js');

// Verify required environment variables
if (!process.env.PUBLIC_SUPABASE_URL || !process.env.PRIVATE_SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase client with service role key
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

/**
 * Database operations for Buy Box jobs
 */
class SupabaseService {

  /**
   * Create a new Buy Box job
   */
  async createJob(totalAsins, source = 'render-service') {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .insert({
        status: 'running',
        started_at: new Date().toISOString(),
        total_asins: totalAsins,
        successful_asins: 0,
        failed_asins: 0,
        source: source,
        notes: `Bulk scan job for ${totalAsins} ASINs via Render service`
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(jobId, successfulAsins, failedAsins, notes = null) {
    const updateData = {
      successful_asins: successfulAsins,
      failed_asins: failedAsins,
      updated_at: new Date().toISOString()
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('buybox_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update job progress: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId, successfulAsins, failedAsins, notes = null) {
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      successful_asins: successfulAsins,
      failed_asins: failedAsins
    };

    if (notes) {
      updateData.notes = notes;
    }

    const { data, error } = await supabase
      .from('buybox_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId, errorMessage) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: `Job failed: ${errorMessage}`
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job status
   */
  async getJob(jobId) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Failed to get job: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all active ASINs for monitoring
   */
  async getActiveAsins(limit = null, offset = 0) {
    let query = supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name, price')
      .eq('status', 'Active')
      .not('asin1', 'is', null)
      .order('seller_sku');

    if (limit) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get active ASINs: ${error.message}`);
    }

    return data;
  }

  /**
   * Get total count of active ASINs
   */
  async getActiveAsinCount() {
    const { count, error } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Active')
      .not('asin1', 'is', null);

    if (error) {
      throw new Error(`Failed to get active ASIN count: ${error.message}`);
    }

    return count;
  }

  /**
   * Insert Buy Box data result
   */
  async insertBuyBoxData(buyBoxData) {
    const { data, error } = await supabase
      .from('buybox_data')
      .insert(buyBoxData)
      .select();

    if (error) {
      throw new Error(`Failed to insert Buy Box data: ${error.message}`);
    }

    return data;
  }

  /**
   * Log failed ASIN processing (Legacy method - deprecated)
   */
  async logFailure(runId, asin, sku, errorMessage) {
    // Deprecated - use recordFailure instead
    return this.recordFailure(runId, asin, sku, errorMessage, 'PROCESSING_FAILED', 1, {});
  }

  /**
   * Record detailed failure information
   */
  async recordFailure(jobId, asin, sku, reason, errorCode = 'UNKNOWN', attemptNumber = 1, rawError = {}) {
    const { data, error } = await supabase
      .from('buybox_failures')
      .insert({
        job_id: jobId,
        asin: asin,
        sku: sku,
        reason: reason,
        error_code: errorCode,
        attempt_number: attemptNumber,
        raw_error: typeof rawError === 'string' ? rawError : JSON.stringify(rawError),
        captured_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('Failed to record failure:', error);
      // Don't throw here as it's just logging
    }

    return data;
  }

  /**
   * Get all ASINs (including inactive ones)
   */
  async getAllAsins(limit = null, offset = 0) {
    let query = supabase
      .from('sku_asin_mapping')
      .select('seller_sku, asin1, item_name, price, status')
      .not('asin1', 'is', null)
      .order('seller_sku');

    if (limit) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get all ASINs: ${error.message}`);
    }

    return data;
  }

  /**
   * Get total count of ASINs (including inactive ones)
   */
  async getAllAsinCount() {
    const { count, error } = await supabase
      .from('sku_asin_mapping')
      .select('*', { count: 'exact', head: true })
      .not('asin1', 'is', null);

    if (error) {
      throw new Error(`Failed to get ASIN count: ${error.message}`);
    }

    return count;
  }

  /**
   * List jobs with pagination
   */
  async listJobs(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('buybox_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list jobs: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job failures
   */
  async getJobFailures(jobId) {
    const { data, error } = await supabase
      .from('buybox_failures')
      .select('*')
      .eq('job_id', jobId)
      .order('captured_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get job failures: ${error.message}`);
    }

    return data;
  }

  /**
   * Get job results with filters
   */
  async getJobResults(options) {
    const {
      jobId,
      asin,
      sku,
      page = 1,
      limit = 25,
      offset = 0,
      showOpportunities = false,
      showWinners = false,
      includeAllJobs = false
    } = options;

    // Build query
    let query = supabase
      .from('buybox_data')
      .select('*', { count: 'exact' });

    // Apply filters
    if (jobId && !includeAllJobs) {
      query = query.eq('run_id', jobId);
    }

    if (asin) {
      query = query.eq('asin', asin);
    }

    if (sku) {
      query = query.eq('sku', sku);
    }

    if (showOpportunities) {
      query = query.eq('opportunity_flag', true);
    }

    if (showWinners) {
      query = query.eq('is_winner', true);
    }

    // Apply pagination
    query = query
      .order('captured_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get job results: ${error.message}`);
    }

    return {
      data,
      total: count
    };
  }
}

module.exports = {
  supabase,
  SupabaseService: new SupabaseService()
};
