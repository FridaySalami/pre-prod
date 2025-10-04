-- Add job log table for monitoring job status and history
CREATE TABLE IF NOT EXISTS price_monitoring_job_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_log_timestamp ON price_monitoring_job_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_job_log_status ON price_monitoring_job_log(status);

-- Add check_count column to monitoring config if it doesn't exist
ALTER TABLE price_monitoring_config 
ADD COLUMN IF NOT EXISTS check_count INTEGER DEFAULT 0;

-- Add last_checked column to monitoring config if it doesn't exist
ALTER TABLE price_monitoring_config 
ADD COLUMN IF NOT EXISTS last_checked TIMESTAMP WITH TIME ZONE;

-- Add is_active column as alias to monitoring_enabled for consistency
ALTER TABLE price_monitoring_config 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN GENERATED ALWAYS AS (monitoring_enabled) STORED;

-- Add some useful computed columns to stats table
ALTER TABLE price_monitoring_stats 
ADD COLUMN IF NOT EXISTS avg_alerts_per_run DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
        WHEN items_processed > 0 THEN ROUND(alerts_generated::DECIMAL / items_processed, 2)
        ELSE 0 
    END
) STORED;

-- Create a view for job statistics dashboard
CREATE OR REPLACE VIEW job_statistics_summary AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE status = 'cycle_completed') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'cycle_error') as failed_runs,
    COALESCE(SUM((metadata->>'processed')::int), 0) as total_processed,
    COALESCE(SUM((metadata->>'alertsGenerated')::int), 0) as total_alerts_generated,
    COALESCE(AVG((metadata->>'duration')::int), 0) as avg_duration_ms
FROM price_monitoring_job_log 
WHERE status IN ('cycle_completed', 'cycle_error')
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Create a view for monitoring health dashboard
CREATE OR REPLACE VIEW monitoring_health_summary AS
SELECT 
    COUNT(*) as total_configs,
    COUNT(*) FILTER (WHERE monitoring_enabled = true) as active_configs,
    COUNT(*) FILTER (WHERE monitoring_enabled = true AND last_checked > NOW() - INTERVAL '1 hour') as recently_checked,
    COUNT(*) FILTER (WHERE monitoring_enabled = true AND last_checked < NOW() - INTERVAL '24 hours') as stale_configs,
    AVG(check_count) as avg_checks_per_config,
    MAX(last_checked) as last_check_time
FROM price_monitoring_config;

-- Add RLS policies for job log table
ALTER TABLE price_monitoring_job_log ENABLE ROW LEVEL SECURITY;

-- Job logs are read-only for authenticated users (no user-specific access needed for system logs)
CREATE POLICY "Job logs are readable by authenticated users" ON price_monitoring_job_log
    FOR SELECT USING (true);

-- Insert initial job status log
INSERT INTO price_monitoring_job_log (status, metadata) 
VALUES ('system_initialized', '{"message": "Job monitoring system initialized"}')
ON CONFLICT DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE price_monitoring_job_log IS 'System log for buy box monitoring job execution and status';
COMMENT ON COLUMN price_monitoring_job_log.status IS 'Job status: started, stopped, cycle_completed, cycle_error, system_initialized';
COMMENT ON COLUMN price_monitoring_job_log.metadata IS 'Additional job data: duration, processed count, alerts generated, error details';

COMMENT ON VIEW job_statistics_summary IS 'Daily aggregated statistics for monitoring job performance';
COMMENT ON VIEW monitoring_health_summary IS 'Real-time health metrics for monitoring system';