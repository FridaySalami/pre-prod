-- Create table for storing SQS notification configuration
CREATE TABLE IF NOT EXISTS notification_config (
    id VARCHAR PRIMARY KEY,
    queue_url TEXT NOT NULL,
    queue_arn TEXT NOT NULL,
    destination_id TEXT NOT NULL,
    pricing_subscription_id TEXT,
    offers_subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_config_id ON notification_config(id);

-- Add comments for documentation
COMMENT ON TABLE notification_config IS 'Configuration for Amazon SQS notification system';
COMMENT ON COLUMN notification_config.id IS 'Configuration identifier (e.g., sqs-notifications)';
COMMENT ON COLUMN notification_config.queue_url IS 'SQS queue URL for receiving notifications';
COMMENT ON COLUMN notification_config.queue_arn IS 'SQS queue ARN for SP-API destination setup';
COMMENT ON COLUMN notification_config.destination_id IS 'SP-API notification destination ID';
COMMENT ON COLUMN notification_config.pricing_subscription_id IS 'SP-API subscription ID for PRICING_HEALTH notifications';
COMMENT ON COLUMN notification_config.offers_subscription_id IS 'SP-API subscription ID for ANY_OFFER_CHANGED notifications';