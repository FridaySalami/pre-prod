-- =============================================================================
-- COMPLETE MATCH BUY BOX FEATURE SETUP FOR SUPABASE
-- =============================================================================
-- This script sets up all necessary tables and security for the Match Buy Box feature
-- Run this in your Supabase SQL Editor

-- =============================================================================
-- 1. SECURITY TABLES (User management and audit logging)
-- =============================================================================

-- User profiles with role-based access control
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  permissions JSONB DEFAULT '{}',
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security audit log for all sensitive operations
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_details JSONB NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- API credentials management (for Amazon SP-API)
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  credential_type TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User session tracking for enhanced security
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2. BUYBOX DATA TABLE MODIFICATIONS
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
-- 3. PRICE TRACKING AND HISTORY TABLES
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

-- Price modification audit trail (enhanced version)
CREATE TABLE IF NOT EXISTS price_modification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  sku TEXT NOT NULL,
  asin TEXT,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  price_source TEXT NOT NULL,
  modification_type TEXT NOT NULL,
  validation_status TEXT,
  business_justification TEXT,
  margin_impact DECIMAL(5,2),
  approval_required BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  api_response JSONB, -- Store Amazon API response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
-- 4. PERFORMANCE INDEXES
-- =============================================================================

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Security audit log indexes
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_timestamp ON security_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity ON security_audit_log(severity);

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_price_history_sku ON price_history(sku);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON price_history(updated_by);
CREATE INDEX IF NOT EXISTS idx_price_history_record_id ON price_history(record_id);

-- Price modification log indexes
CREATE INDEX IF NOT EXISTS idx_price_modification_log_user_id ON price_modification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_price_modification_log_sku ON price_modification_log(sku);
CREATE INDEX IF NOT EXISTS idx_price_modification_log_created_at ON price_modification_log(created_at);

-- API usage tracking indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_user_id ON api_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_endpoint ON api_usage_tracking(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(last_reset_date);

-- Buybox data new column indexes
CREATE INDEX IF NOT EXISTS idx_buybox_data_pricing_status ON buybox_data(pricing_status);
CREATE INDEX IF NOT EXISTS idx_buybox_data_update_source ON buybox_data(update_source);
CREATE INDEX IF NOT EXISTS idx_buybox_data_last_update ON buybox_data(last_price_update);

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_modification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_rollback_points ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. SECURITY POLICIES
-- =============================================================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "System can insert audit logs" ON security_audit_log;
DROP POLICY IF EXISTS "Users can view their own price modifications" ON price_modification_log;
DROP POLICY IF EXISTS "Admins can view all price modifications" ON price_modification_log;
DROP POLICY IF EXISTS "Users can view price history for their modifications" ON price_history;
DROP POLICY IF EXISTS "Admins can view all price history" ON price_history;
DROP POLICY IF EXISTS "Users can view their own API usage" ON api_usage_tracking;
DROP POLICY IF EXISTS "System can track API usage" ON api_usage_tracking;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Security audit log policies
CREATE POLICY "Admins can view audit logs" ON security_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "System can insert audit logs" ON security_audit_log
  FOR INSERT WITH CHECK (true);

-- Price modification log policies
CREATE POLICY "Users can view their own price modifications" ON price_modification_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all price modifications" ON price_modification_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Price history policies
CREATE POLICY "Users can view price history for their modifications" ON price_history
  FOR SELECT USING (auth.uid() = updated_by);

CREATE POLICY "Admins can view all price history" ON price_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- API usage tracking policies
CREATE POLICY "Users can view their own API usage" ON api_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can track API usage" ON api_usage_tracking
  FOR ALL WITH CHECK (true);

-- =============================================================================
-- 7. USEFUL FUNCTIONS FOR PRICE MATCHING
-- =============================================================================

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_event_details JSONB DEFAULT '{}',
  p_severity TEXT DEFAULT 'info'
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_audit_log (
    event_type,
    event_details,
    user_id,
    severity,
    timestamp
  ) VALUES (
    p_event_type,
    p_event_details,
    auth.uid(),
    p_severity,
    NOW()
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    request_count,
    success_count,
    error_count,
    daily_requests,
    last_reset_date
  ) VALUES (
    auth.uid(),
    p_endpoint,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    1,
    CURRENT_DATE
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

-- =============================================================================
-- 8. INITIAL DATA SETUP
-- =============================================================================

-- Create default admin user profile (you'll need to update the user_id)
-- Replace 'YOUR_USER_ID_HERE' with your actual Supabase auth user ID
-- You can find this in Authentication > Users in your Supabase dashboard

INSERT INTO user_profiles (user_id, role, department)
VALUES (
  auth.uid(), -- This will use the current authenticated user
  'admin',
  'Operations'
) ON CONFLICT (user_id) DO NOTHING;

-- Log the setup completion
SELECT log_security_event(
  'SYSTEM_SETUP',
  '{"action": "match_buybox_schema_created", "tables": ["user_profiles", "security_audit_log", "price_history", "api_usage_tracking"], "version": "1.0"}'::jsonb,
  'info'
);

-- =============================================================================
-- SETUP COMPLETE
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

COMMENT ON VIEW recent_price_changes IS 'Shows all price changes in the last 7 days with user details';
COMMENT ON VIEW api_usage_summary IS 'Shows API usage statistics for the last 30 days';

-- Show setup completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Match Buy Box database setup completed successfully!';
  RAISE NOTICE '📊 Tables created: user_profiles, security_audit_log, price_history, api_usage_tracking';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '📈 Views created: recent_price_changes, api_usage_summary';
  RAISE NOTICE '⚡ Ready to proceed with Phase 0.5 implementation!';
END $$;
