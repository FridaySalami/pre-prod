-- Price Monitoring Configuration Table
-- Allows users to select which ASINs/SKUs to monitor with custom settings

CREATE TABLE IF NOT EXISTS price_monitoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    asin TEXT NOT NULL,
    sku TEXT NOT NULL,
    
    -- Monitoring settings
    monitoring_enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5), -- 1=highest, 5=lowest
    price_change_threshold DECIMAL(5,2) DEFAULT 5.00, -- Alert if price changes by this percentage
    
    -- Alert preferences
    alert_types JSONB DEFAULT '["email", "database"]'::jsonb, -- ["email", "webhook", "database"]
    alert_frequency TEXT DEFAULT 'immediate' CHECK (alert_frequency IN ('immediate', 'hourly', 'daily')),
    
    -- Tracking
    last_checked TIMESTAMPTZ,
    last_price_update TIMESTAMPTZ, -- When user last updated price for this item
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_email, asin, sku)
);

-- Price Monitoring History Table
-- Stores historical price data for comparison and trend analysis

CREATE TABLE IF NOT EXISTS price_monitoring_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_config_id UUID REFERENCES price_monitoring_config(id) ON DELETE CASCADE,
    
    asin TEXT NOT NULL,
    sku TEXT NOT NULL,
    
    -- Price data at time of check
    buy_box_price DECIMAL(10,2),
    your_price DECIMAL(10,2),
    lowest_competitor_price DECIMAL(10,2),
    competitor_count INTEGER DEFAULT 0,
    
    -- Buy box information
    buy_box_owner TEXT, -- Seller ID of buy box winner
    is_buy_box_yours BOOLEAN DEFAULT false,
    
    -- Raw data from SP-API (for detailed analysis)
    raw_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Monitoring Alerts Table
-- Stores all generated alerts for audit trail and user dashboard

CREATE TABLE IF NOT EXISTS price_monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert classification
    type TEXT NOT NULL CHECK (type IN ('buy_box_price_change', 'buy_box_ownership_change', 'competitive_reaction', 'new_competitor', 'price_threshold_breach')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Item information
    asin TEXT NOT NULL,
    sku TEXT NOT NULL,
    user_email TEXT NOT NULL,
    
    -- Alert content
    message TEXT NOT NULL,
    alert_data JSONB, -- Full alert details including prices, changes, etc.
    
    -- Delivery tracking
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    webhook_sent BOOLEAN DEFAULT false,
    webhook_sent_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitoring Statistics Table
-- Track monitoring performance and API usage

CREATE TABLE IF NOT EXISTS price_monitoring_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Monitoring run information
    run_started_at TIMESTAMPTZ NOT NULL,
    run_completed_at TIMESTAMPTZ,
    run_duration_seconds DECIMAL(10,2),
    
    -- Items processed
    items_requested INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    
    -- API usage
    api_requests_made INTEGER DEFAULT 0,
    api_rate_limit_hits INTEGER DEFAULT 0,
    
    -- Alerts generated
    alerts_generated INTEGER DEFAULT 0,
    high_severity_alerts INTEGER DEFAULT 0,
    
    -- Errors and issues
    errors JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Users can only see their own monitoring configurations
ALTER TABLE price_monitoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own monitoring config" ON price_monitoring_config
    FOR ALL USING (user_email = auth.jwt() ->> 'email');

-- Users can only see alerts for their items
ALTER TABLE price_monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alerts" ON price_monitoring_alerts
    FOR SELECT USING (user_email = auth.jwt() ->> 'email');

-- History is viewable by monitoring config owners
ALTER TABLE price_monitoring_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history for their monitored items" ON price_monitoring_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM price_monitoring_config pmc 
            WHERE pmc.id = monitoring_config_id 
            AND pmc.user_email = auth.jwt() ->> 'email'
        )
    );

-- Stats are admin-only (no RLS policy = only service role access)

-- Indexes for better performance

-- Configuration table indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_config_user_enabled 
    ON price_monitoring_config(user_email, monitoring_enabled) 
    WHERE monitoring_enabled = true;

CREATE INDEX IF NOT EXISTS idx_monitoring_config_priority 
    ON price_monitoring_config(priority, last_checked) 
    WHERE monitoring_enabled = true;

-- History table indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_history_asin_sku_created 
    ON price_monitoring_history(asin, sku, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitoring_history_config_created 
    ON price_monitoring_history(monitoring_config_id, created_at DESC);

-- Alerts table indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_created 
    ON price_monitoring_alerts(user_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_asin_created 
    ON price_monitoring_alerts(asin, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_severity_created 
    ON price_monitoring_alerts(severity, created_at DESC);

-- Stats table indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_stats_created 
    ON price_monitoring_stats(created_at DESC);

-- Triggers to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_price_monitoring_config_updated_at 
    BEFORE UPDATE ON price_monitoring_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample configuration data (commented out - uncomment to add test data)
/*
INSERT INTO price_monitoring_config (user_email, asin, sku, priority, price_change_threshold, alert_types) VALUES
('jackweston@gmail.com', 'B07XYZ123', 'CALLEBAUT-2.5KG-PRIME', 1, 3.0, '["email", "webhook", "database"]'),
('jackweston@gmail.com', 'B08ABC456', 'VALRHONA-1KG-STANDARD', 2, 5.0, '["email", "database"]'),
('jackweston@gmail.com', 'B09DEF789', 'FERRERO-500G-PRIME', 1, 2.0, '["email", "webhook", "database"]');
*/