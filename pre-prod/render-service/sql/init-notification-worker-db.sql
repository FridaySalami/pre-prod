-- Initialize Buybox_notifications Database on Render.com
-- This schema supports a single notification processor worker
-- Run this in your Render.com PostgreSQL database console

-- Drop existing tables if re-initializing (be careful in production!)
-- DROP TABLE IF EXISTS worker_failures CASCADE;
-- DROP TABLE IF EXISTS current_state CASCADE;
-- DROP TABLE IF EXISTS worker_notifications CASCADE;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Core notification storage with idempotency protection
CREATE TABLE IF NOT EXISTS worker_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,          -- SQS messageId for deduplication
  dedupe_hash TEXT NOT NULL,                -- SHA256(body) for AWS re-drive protection
  asin TEXT,                                -- Extracted for indexing
  marketplace TEXT DEFAULT 'A1F83G8C2ARO7P', -- UK marketplace default
  raw_notification JSONB NOT NULL,          -- Full notification payload
  notification_type TEXT,                   -- 'ANY_OFFER_CHANGED', 'PRICING_HEALTH'
  event_time TIMESTAMPTZ,                  -- Amazon's event timestamp
  severity TEXT,                            -- 'critical', 'high', 'warning', 'info', 'success'
  status TEXT DEFAULT 'new',               -- 'new', 'processing', 'completed', 'failed'
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  trace_id TEXT,                           -- For distributed tracing
  worker_id TEXT,                          -- Which worker processed this
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current competitive state per ASIN (UI reads from this table!)
CREATE TABLE IF NOT EXISTS current_state (
  asin TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'A1F83G8C2ARO7P',
  your_price DECIMAL(10,2),
  market_low DECIMAL(10,2),
  prime_low DECIMAL(10,2),
  your_position INTEGER,
  total_offers INTEGER,
  buy_box_winner BOOLEAN DEFAULT FALSE,
  severity TEXT,                           -- Latest severity assessment
  last_notification_id UUID REFERENCES worker_notifications(id),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asin, marketplace)
);

-- Worker failures / Dead Letter Queue
CREATE TABLE IF NOT EXISTS worker_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  raw_message JSONB,
  error_type TEXT NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  failure_count INTEGER DEFAULT 1,
  first_failed_at TIMESTAMPTZ DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_asin 
  ON worker_notifications(asin, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_status 
  ON worker_notifications(status, created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_message_id 
  ON worker_notifications(message_id);

CREATE INDEX IF NOT EXISTS idx_notifications_type 
  ON worker_notifications(notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_current_state_severity 
  ON current_state(severity) 
  WHERE severity IN ('critical', 'high');

CREATE INDEX IF NOT EXISTS idx_current_state_updated 
  ON current_state(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_failures_message_id 
  ON worker_failures(message_id);

CREATE INDEX IF NOT EXISTS idx_failures_error_type 
  ON worker_failures(error_type, last_failed_at DESC);

-- Unique constraint for deduplication (prevents duplicate processing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dedupe_hash 
  ON worker_notifications(dedupe_hash);

-- Table comments for documentation
COMMENT ON TABLE worker_notifications IS 
  'Event log of all SQS notifications received and processed by workers';

COMMENT ON TABLE current_state IS 
  'Latest competitive state per ASIN - optimized for dashboard UI reads';

COMMENT ON TABLE worker_failures IS 
  'Dead letter queue for failed message processing - investigate and replay';

COMMENT ON COLUMN worker_notifications.message_id IS 
  'AWS SQS MessageId - ensures we never process the same message twice';

COMMENT ON COLUMN worker_notifications.dedupe_hash IS 
  'SHA256 hash of message body - protects against AWS message re-drives';

COMMENT ON COLUMN current_state.last_notification_id IS 
  'Reference to the notification that last updated this state';

-- Views for monitoring and debugging

-- Active alerts view (what the dashboard should show)
CREATE OR REPLACE VIEW active_alerts AS
SELECT 
  cs.asin,
  cs.marketplace,
  cs.severity,
  cs.your_price,
  cs.market_low,
  cs.prime_low,
  cs.your_position,
  cs.total_offers,
  cs.buy_box_winner,
  cs.last_updated,
  wn.notification_type,
  wn.event_time
FROM current_state cs
LEFT JOIN worker_notifications wn ON cs.last_notification_id = wn.id
WHERE cs.severity IN ('critical', 'high', 'warning')
ORDER BY 
  CASE cs.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'warning' THEN 3
  END,
  cs.last_updated DESC;

-- Worker health view (monitor worker performance)
CREATE OR REPLACE VIEW worker_health AS
SELECT 
  worker_id,
  COUNT(*) as total_processed,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  MAX(created_at) as last_activity,
  ROUND(AVG(EXTRACT(EPOCH FROM (processed_at - received_at))), 2) as avg_processing_seconds
FROM worker_notifications
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY worker_id
ORDER BY last_activity DESC;

-- Recent failures view (what's going wrong?)
CREATE OR REPLACE VIEW recent_failures AS
SELECT 
  wf.error_type,
  wf.error_message,
  wf.message_id,
  wf.failure_count,
  wf.last_failed_at,
  wf.raw_message->>'notificationType' as notification_type
FROM worker_failures wf
ORDER BY wf.last_failed_at DESC
LIMIT 50;

-- Grant necessary permissions (adjust if using specific roles)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_worker_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_worker_user;

-- Sample query to verify setup
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema initialized successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - worker_notifications (event log)';
  RAISE NOTICE '  - current_state (UI state)';
  RAISE NOTICE '  - worker_failures (DLQ)';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - active_alerts';
  RAISE NOTICE '  - worker_health';
  RAISE NOTICE '  - recent_failures';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Configure worker environment variables';
  RAISE NOTICE '  2. Deploy worker to Render.com';
  RAISE NOTICE '  3. Monitor: SELECT * FROM worker_health;';
END $$;
