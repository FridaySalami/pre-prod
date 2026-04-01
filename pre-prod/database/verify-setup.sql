-- Quick verification queries for Match Buy Box setup
-- Run these in Supabase SQL Editor to confirm everything is working

-- 1. Check your admin profile was created
SELECT 
  id,
  user_id,
  role,
  department,
  created_at
FROM user_profiles 
WHERE user_id = auth.uid();

-- 2. Test the API tracking function
SELECT track_api_usage('setup-verification', true);

-- 3. Check the audit log entry was created
SELECT 
  event_type,
  event_details,
  severity,
  timestamp
FROM security_audit_log 
ORDER BY timestamp DESC 
LIMIT 3;

-- 4. Verify all core tables exist
SELECT 
  table_name,
  'Created' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'user_profiles', 
    'security_audit_log', 
    'price_history', 
    'api_usage_tracking',
    'price_rollback_points',
    'price_modification_log'
  )
ORDER BY table_name;

-- 5. Check if buybox_data table exists and has new columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'buybox_data' 
  AND column_name IN (
    'last_price_update',
    'update_source', 
    'pricing_status',
    'buybox_price',
    'price_gap',
    'profit_opportunity'
  )
ORDER BY column_name;

-- 6. Test price rollback function
SELECT create_rollback_point(
  'TEST-SKU',
  'B001TEST123',
  10.99,
  'Setup verification test'
);

-- 7. Check the monitoring views work
SELECT COUNT(*) as total_price_changes FROM recent_price_changes;
SELECT COUNT(*) as total_api_usage FROM api_usage_summary;
SELECT COUNT(*) as active_rollbacks FROM active_rollback_points;
