-- Report Job Logs Table
-- Tracks cron job execution for Amazon Reports API

CREATE TABLE IF NOT EXISTS report_job_logs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL, -- 'daily_sales_report', 'weekly_inventory_report', etc.
  status VARCHAR(20) NOT NULL, -- 'started', 'processing', 'completed', 'failed'
  
  -- Amazon Report Details
  report_id VARCHAR(100), -- Amazon's report ID
  report_type VARCHAR(100), -- GET_SALES_AND_TRAFFIC_REPORT, etc.
  report_document_id VARCHAR(100),
  
  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Processing Details
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  
  -- Error Handling
  error_message TEXT,
  error_code VARCHAR(50),
  retry_count INTEGER DEFAULT 0,
  
  -- Request Details
  date_range_start DATE,
  date_range_end DATE,
  marketplace_id VARCHAR(20) DEFAULT 'A1F83G8C2ARO7P',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for querying logs
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON report_job_logs(status);
CREATE INDEX IF NOT EXISTS idx_job_logs_job_type ON report_job_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_job_logs_started_at ON report_job_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_report_id ON report_job_logs(report_id) WHERE report_id IS NOT NULL;

-- Comments
COMMENT ON TABLE report_job_logs IS 'Tracks execution of Amazon Reports API cron jobs';
COMMENT ON COLUMN report_job_logs.job_type IS 'Type of report job (e.g., daily_sales_report)';
COMMENT ON COLUMN report_job_logs.status IS 'Job status: started, processing, completed, failed';
COMMENT ON COLUMN report_job_logs.report_id IS 'Amazon Reports API report ID';
COMMENT ON COLUMN report_job_logs.duration_seconds IS 'Total job execution time';
COMMENT ON COLUMN report_job_logs.records_processed IS 'Number of records successfully processed';
