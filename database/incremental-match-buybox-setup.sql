-- =============================================================================
-- MATCH BUY BOX INCREMENTAL SETUP FOR SUPABASE
-- =============================================================================
-- This script only adds new tables/columns needed for Match Buy Box feature
-- Use this if you already have user_profiles and security tables set up
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- 1. BUYBOX DATA TABLE MODIFICATIONS
-- =============================================================================

-- Add columns needed for price matching functionality to existing buybox_data table
ALTER TABLE buybox_data 
  ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS update_source TEXT,
  ADD COLUMN IF NOT EXISTS pricing_status TEXT,
  ADD COLUMN IF NOT EXISTS update_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS your_current_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS buybox_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_gap NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS profit_opportunity NUMERIC(10,2);

-- Add helpful comments
COMMENT ON COLUMN buybox_data.last_price_update IS 'Timestamp of last price modification via Match Buy Box';
COMMENT ON COLUMN buybox_data.update_source IS 'Source of price update: manual, match_buybox, automated';
COMMENT ON COLUMN buybox_data.pricing_status IS 'Current pricing status: matching_buybox, above_buybox, below_buybox';
COMMENT ON COLUMN buybox_data.update_attempts IS 'Number of price update attempts for this record';

-- =============================================================================
-- 2. PRICE TRACKING AND HISTORY TABLES
-- =============================================================================

-- Price history for rollback capability and trend analysis
CREATE TABLE IF NOT EXISTS price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL,
  asin TEXT,
  record_id UUID REFERENCES buybox_data(id),
  old_price NUMERIC(10,2),
  new_price NUMERIC(10,2),
  change_reason TEXT,
  validation_results JSONB,
  updated_by UUID REFERENCES auth.users(id),
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  amazon_update_id TEXT, -- Amazon's update reference
  margin_before NUMERIC(5,2),
  margin_after NUMERIC(5,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking for rate limiting and quota management
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  api_endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_request TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quota_limit INTEGER,
  quota_remaining INTEGER,
  reset_time TIMESTAMP WITH TIME ZONE,
  daily_requests INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, api_endpoint, last_reset_date)
);

-- Price rollback points for emergency recovery
CREATE TABLE IF NOT EXISTS price_rollback_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL,
  asin TEXT,
  snapshot_price NUMERIC(10,2) NOT NULL,
  snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- 3. PERFORMANCE INDEXES FOR NEW TABLES
-- =============================================================================

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_sku ON price_history(sku);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON price_history(updated_by);
CREATE INDEX IF NOT EXISTS idx_price_history_record_id ON price_history(record_id);

-- API usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_user_id ON api_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_endpoint ON api_usage_tracking(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(last_reset_date);

-- Buybox data new column indexes
CREATE INDEX IF NOT EXISTS idx_buybox_data_pricing_status ON buybox_data(pricing_status);
CREATE INDEX IF NOT EXISTS idx_buybox_data_update_source ON buybox_data(update_source);
CREATE INDEX IF NOT EXISTS idx_buybox_data_last_update ON buybox_data(last_price_update);

-- Rollback points indexes
CREATE INDEX IF NOT EXISTS idx_price_rollback_points_sku ON price_rollback_points(sku);
CREATE INDEX IF NOT EXISTS idx_price_rollback_points_active ON price_rollback_points(is_active);
CREATE INDEX IF NOT EXISTS idx_price_rollback_points_created_by ON price_rollback_points(created_by);

-- =============================================================================
-- 4. ROW LEVEL SECURITY FOR NEW TABLES
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rollback_points ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. SECURITY POLICIES FOR NEW TABLES
-- =============================================================================

-- Price history policies
DROP POLICY IF EXISTS "Users can view price history for their modifications" ON price_history;
DROP POLICY IF EXISTS "Admins can view all price history" ON price_history;
DROP POLICY IF EXISTS "Users can insert price history" ON price_history;

CREATE POLICY "Users can view price history for their modifications" ON price_history
  FOR SELECT USING (auth.uid() = updated_by);

CREATE POLICY "Admins can view all price history" ON price_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can insert price history" ON price_history
  FOR INSERT WITH CHECK (auth.uid() = updated_by);

-- API usage tracking policies
DROP POLICY IF EXISTS "Users can view their own API usage" ON api_usage_tracking;
DROP POLICY IF EXISTS "System can track API usage" ON api_usage_tracking;

CREATE POLICY "Users can view their own API usage" ON api_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can track API usage" ON api_usage_tracking
  FOR ALL WITH CHECK (true);

-- Price rollback points policies
DROP POLICY IF EXISTS "Users can view their own rollback points" ON price_rollback_points;
DROP POLICY IF EXISTS "Admins can view all rollback points" ON price_rollback_points;
DROP POLICY IF EXISTS "Users can create rollback points" ON price_rollback_points;

CREATE POLICY "Users can view their own rollback points" ON price_rollback_points
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all rollback points" ON price_rollback_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create rollback points" ON price_rollback_points
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- =============================================================================
-- 6. USEFUL FUNCTIONS FOR PRICE MATCHING
-- =============================================================================

-- Function to create price rollback point
CREATE OR REPLACE FUNCTION create_rollback_point(
  p_sku TEXT,
  p_asin TEXT,
  p_current_price NUMERIC,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  rollback_id UUID;
BEGIN
  INSERT INTO price_rollback_points (
    sku,
    asin,
    snapshot_price,
    reason,
    created_by
  ) VALUES (
    p_sku,
    p_asin,
    p_current_price,
    p_reason,
    auth.uid()
  ) RETURNING id INTO rollback_id;
  
  RETURN rollback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track API usage
CREATE OR REPLACE FUNCTION track_api_usage(
  p_endpoint TEXT,
  p_success BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO api_usage_tracking (
    user_id,
    api_endpoint,
    success_count,
    error_count,
    daily_requests
  ) VALUES (
    auth.uid(),
    p_endpoint,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    1
  )
  ON CONFLICT (user_id, api_endpoint, last_reset_date)
  DO UPDATE SET
    request_count = api_usage_tracking.request_count + 1,
    success_count = api_usage_tracking.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    error_count = api_usage_tracking.error_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    daily_requests = api_usage_tracking.daily_requests + 1,
    last_request = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log price changes to history
CREATE OR REPLACE FUNCTION log_price_change(
  p_sku TEXT,
  p_asin TEXT,
  p_record_id UUID,
  p_old_price NUMERIC,
  p_new_price NUMERIC,
  p_reason TEXT,
  p_validation_results JSONB DEFAULT '{}'::jsonb,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_amazon_update_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  history_id UUID;
BEGIN
  INSERT INTO price_history (
    sku,
    asin,
    record_id,
    old_price,
    new_price,
    change_reason,
    validation_results,
    updated_by,
    success,
    error_message,
    amazon_update_id
  ) VALUES (
    p_sku,
    p_asin,
    p_record_id,
    p_old_price,
    p_new_price,
    p_reason,
    p_validation_results,
    auth.uid(),
    p_success,
    p_error_message,
    p_amazon_update_id
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. MONITORING VIEWS
-- =============================================================================

-- Create a view for easy monitoring of recent price changes
CREATE OR REPLACE VIEW recent_price_changes AS
SELECT 
  ph.sku,
  ph.asin,
  ph.old_price,
  ph.new_price,
  ph.change_reason,
  ph.success,
  ph.updated_at,
  up.role as user_role,
  au.email as user_email
FROM price_history ph
LEFT JOIN user_profiles up ON ph.updated_by = up.user_id
LEFT JOIN auth.users au ON ph.updated_by = au.id
WHERE ph.updated_at >= NOW() - INTERVAL '7 days'
ORDER BY ph.updated_at DESC;

-- Create a view for API usage monitoring
CREATE OR REPLACE VIEW api_usage_summary AS
SELECT 
  user_id,
  api_endpoint,
  SUM(daily_requests) as total_requests,
  SUM(success_count) as total_success,
  SUM(error_count) as total_errors,
  MAX(last_request) as last_used,
  ROUND(
    (SUM(success_count)::DECIMAL / NULLIF(SUM(request_count), 0)) * 100, 
    2
  ) as success_rate_percent
FROM api_usage_tracking
WHERE last_reset_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, api_endpoint;

-- Create a view for active rollback points
CREATE OR REPLACE VIEW active_rollback_points AS
SELECT 
  prp.sku,
  prp.asin,
  prp.snapshot_price,
  prp.snapshot_time,
  prp.reason,
  au.email as created_by_email,
  prp.created_by
FROM price_rollback_points prp
LEFT JOIN auth.users au ON prp.created_by = au.id
WHERE prp.is_active = true
ORDER BY prp.snapshot_time DESC;

COMMENT ON VIEW recent_price_changes IS 'Shows all price changes in the last 7 days with user details';
COMMENT ON VIEW api_usage_summary IS 'Shows API usage statistics for the last 30 days';
COMMENT ON VIEW active_rollback_points IS 'Shows all active price rollback points';

-- Log the incremental setup completion
SELECT log_security_event(
  'SYSTEM_SETUP_INCREMENTAL',
  '{"action": "match_buybox_incremental_setup", "tables": ["price_history", "api_usage_tracking", "price_rollback_points"], "modifications": ["buybox_data_columns"], "version": "1.1"}'::jsonb,
  'info'
);

-- Show setup completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Match Buy Box incremental setup completed successfully!';
  RAISE NOTICE '📊 New tables: price_history, api_usage_tracking, price_rollback_points';
  RAISE NOTICE '🔧 Modified table: buybox_data (added price tracking columns)';
  RAISE NOTICE '🔒 Row Level Security enabled on new tables';
  RAISE NOTICE '📈 Views created: recent_price_changes, api_usage_summary, active_rollback_points';
  RAISE NOTICE '⚡ Ready to proceed with Match Buy Box implementation!';
END $$;
