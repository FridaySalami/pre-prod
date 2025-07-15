import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import type { RequestHandler } from './$types';

/**
 * Cancel a running Buy Box monitoring job
 * 
 * This endpoint updates the job status to 'failed' and adds a note
 * that it was manually cancelled.
 */
export const POST: RequestHandler = async ({ params }) => {
  try {
    const jobId = params.jobId;

    if (!jobId) {
      return json({
        success: false,
        error: 'Missing job ID'
      }, { status: 400 });
    }

    // Check if job exists and is running
    const { data: job, error: jobError } = await supabaseAdmin
      .from('buybox_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return json({
        success: false,
        error: 'Job not found'
      }, { status: 404 });
    }

    if (job.status !== 'running') {
      return json({
        success: false,
        error: 'Job is not running and cannot be cancelled'
      }, { status: 400 });
    }

    // Update job status to failed
    const { error: updateError } = await supabaseAdmin
      .from('buybox_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: 'Manually cancelled by user',
        duration_seconds: Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000)
      })
      .eq('id', jobId);

    if (updateError) {
      return json({
        success: false,
        error: 'Failed to cancel job'
      }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling job:', error);
    return json({
      success: false,
      error: (error as Error).message || 'An error occurred while cancelling the job'
    }, { status: 500 });
  }
};
