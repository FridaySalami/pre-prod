-- buybox_jobs table: Tracks the execution of Buy Box scan jobs
CREATE TABLE IF NOT EXISTS buybox_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_asins INTEGER DEFAULT 0, -- Total ASINs attempted
    successful_asins INTEGER DEFAULT 0, -- Successfully processed
    failed_asins INTEGER DEFAULT 0, -- Failed to process
    notes TEXT, -- Optional metadata or description
    
    -- Additional useful metrics
    duration_seconds INTEGER, -- Duration of the job in seconds
    source TEXT DEFAULT 'scheduled', -- 'scheduled', 'manual', etc.
    triggered_by TEXT, -- User ID or system that triggered the job
    
    -- Track rate limiting settings used
    rate_limit_per_second INTEGER DEFAULT 1,
    jitter_ms INTEGER DEFAULT 400,
    max_retries INTEGER DEFAULT 3
);

-- Create index on job status and date for filtering
CREATE INDEX IF NOT EXISTS buybox_jobs_status_idx ON buybox_jobs(status);
CREATE INDEX IF NOT EXISTS buybox_jobs_started_at_idx ON buybox_jobs(started_at);

-- Comment on table and columns for documentation
COMMENT ON TABLE buybox_jobs IS 'Tracks execution of Buy Box scan jobs';
COMMENT ON COLUMN buybox_jobs.status IS 'Current status of the job: running, completed, or failed';
COMMENT ON COLUMN buybox_jobs.total_asins IS 'Total number of ASINs that were attempted to be processed';
COMMENT ON COLUMN buybox_jobs.successful_asins IS 'Number of ASINs successfully processed';
COMMENT ON COLUMN buybox_jobs.failed_asins IS 'Number of ASINs that failed to process';
COMMENT ON COLUMN buybox_jobs.duration_seconds IS 'Total runtime of the job in seconds';
