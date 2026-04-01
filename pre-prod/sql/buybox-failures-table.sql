-- buybox_failures table: Logs errors for failed Buy Box checks
CREATE TABLE IF NOT EXISTS buybox_failures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL, -- Foreign key to buybox_jobs
    asin TEXT NOT NULL, -- ASIN that failed
    sku TEXT, -- SKU if known
    reason TEXT NOT NULL, -- Error reason or message
    error_code TEXT, -- HTTP status or error code if available
    attempt_number INTEGER DEFAULT 1, -- Which retry attempt this was
    raw_error JSONB, -- Full error details for debugging
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Link to the job that encountered this failure
    CONSTRAINT buybox_failures_job_id_fkey FOREIGN KEY (job_id)
        REFERENCES buybox_jobs (id) ON DELETE CASCADE
);

-- Create indexes for filtering and lookups
CREATE INDEX IF NOT EXISTS buybox_failures_job_id_idx ON buybox_failures(job_id);
CREATE INDEX IF NOT EXISTS buybox_failures_asin_idx ON buybox_failures(asin);
CREATE INDEX IF NOT EXISTS buybox_failures_captured_at_idx ON buybox_failures(captured_at);

-- Comment on table and columns for documentation
COMMENT ON TABLE buybox_failures IS 'Logs errors encountered during Buy Box checks';
COMMENT ON COLUMN buybox_failures.job_id IS 'References the job that encountered this failure';
COMMENT ON COLUMN buybox_failures.reason IS 'Human-readable error message or reason for failure';
COMMENT ON COLUMN buybox_failures.error_code IS 'HTTP status code or error code if available';
COMMENT ON COLUMN buybox_failures.attempt_number IS 'Which retry attempt this failure occurred on';
