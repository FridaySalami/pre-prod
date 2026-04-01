-- Fix Buy Box Monitoring Database Schema
-- This creates the missing price_monitoring_config table and establishes proper relationships

-- Create price_monitoring_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS price_monitoring_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asin TEXT NOT NULL,
    sku TEXT,
    user_email TEXT NOT NULL,
    monitoring_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,
    check_interval_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique ASIN per user
    UNIQUE(asin, user_email)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_monitoring_config_asin ON price_monitoring_config(asin);
CREATE INDEX IF NOT EXISTS idx_price_monitoring_config_user_email ON price_monitoring_config(user_email);
CREATE INDEX IF NOT EXISTS idx_price_monitoring_config_enabled ON price_monitoring_config(monitoring_enabled);

-- Ensure price_monitoring_alerts table has proper structure
ALTER TABLE price_monitoring_alerts 
ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES price_monitoring_config(id);

-- Add index for the foreign key relationship
CREATE INDEX IF NOT EXISTS idx_price_monitoring_alerts_config_id ON price_monitoring_alerts(config_id);

-- Update existing alerts to link to config records
-- First, insert missing config records for existing alerts
INSERT INTO price_monitoring_config (asin, user_email, sku)
SELECT DISTINCT 
    a.asin, 
    COALESCE(a.user_email, 'system@example.com') as user_email,
    a.sku
FROM price_monitoring_alerts a
LEFT JOIN price_monitoring_config c ON c.asin = a.asin AND c.user_email = COALESCE(a.user_email, 'system@example.com')
WHERE c.id IS NULL
ON CONFLICT (asin, user_email) DO NOTHING;

-- Update alerts to reference their config records
UPDATE price_monitoring_alerts 
SET config_id = (
    SELECT c.id 
    FROM price_monitoring_config c 
    WHERE c.asin = price_monitoring_alerts.asin 
    AND c.user_email = COALESCE(price_monitoring_alerts.user_email, 'system@example.com')
    LIMIT 1
)
WHERE config_id IS NULL;

-- Create a view for easy dashboard queries
CREATE OR REPLACE VIEW buybox_dashboard_view AS
SELECT 
    c.id as config_id,
    c.asin,
    c.sku,
    c.user_email,
    c.monitoring_enabled,
    c.priority,
    c.last_checked as config_last_checked,
    
    -- Latest alert data
    latest_alert.id as latest_alert_id,
    latest_alert.type as latest_alert_type,
    latest_alert.severity as latest_alert_severity,
    latest_alert.message as latest_alert_message,
    latest_alert.alert_data as latest_alert_data,
    latest_alert.created_at as latest_alert_created_at,
    
    -- Alert counts
    COALESCE(alert_stats.total_alerts, 0) as total_alerts,
    COALESCE(alert_stats.alerts_24h, 0) as alerts_24h
    
FROM price_monitoring_config c
LEFT JOIN LATERAL (
    SELECT *
    FROM price_monitoring_alerts a
    WHERE a.config_id = c.id
    ORDER BY a.created_at DESC
    LIMIT 1
) latest_alert ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as alerts_24h
    FROM price_monitoring_alerts a
    WHERE a.config_id = c.id
) alert_stats ON true
WHERE c.monitoring_enabled = true;

-- Enable Row Level Security (RLS) if needed
ALTER TABLE price_monitoring_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user access (optional - adjust based on your auth setup)
DROP POLICY IF EXISTS "Users can access their own monitoring configs" ON price_monitoring_config;
CREATE POLICY "Users can access their own monitoring configs" ON price_monitoring_config
    FOR ALL USING (true); -- Temporarily allow all access, adjust based on your auth

-- Update the updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_price_monitoring_config_updated_at ON price_monitoring_config;
CREATE TRIGGER update_price_monitoring_config_updated_at
    BEFORE UPDATE ON price_monitoring_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON price_monitoring_config TO postgres;
GRANT ALL ON buybox_dashboard_view TO postgres;