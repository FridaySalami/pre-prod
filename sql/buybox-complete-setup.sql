-- Buy Box Monitoring System - Complete Database Setup
-- Created: July 12, 2025

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Buy Box Jobs Table
CREATE TABLE IF NOT EXISTS buybox_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_asins INTEGER DEFAULT 0, -- Total ASINs attempted
    successful_asins INTEGER DEFAULT 0, -- Successfully processed
    failed_asins INTEGER DEFAULT 0, -- Failed to process
    notes TEXT, -- Optional metadata or description
    
    -- Additional useful metrics
    duration_seconds INTEGER, -- Duration of the job in seconds
    source TEXT DEFAULT 'scheduled', -- 'scheduled', 'manual', etc.
    triggered_by TEXT, -- User ID or system that triggered the job
    
    -- Track rate limiting settings used
    rate_limit_per_second INTEGER DEFAULT 1,
    jitter_ms INTEGER DEFAULT 400,
    max_retries INTEGER DEFAULT 3
);

-- Create index on job status and date for filtering
CREATE INDEX IF NOT EXISTS buybox_jobs_status_idx ON buybox_jobs(status);
CREATE INDEX IF NOT EXISTS buybox_jobs_started_at_idx ON buybox_jobs(started_at);

-- Add comments
COMMENT ON TABLE buybox_jobs IS 'Tracks execution of Buy Box scan jobs';
COMMENT ON COLUMN buybox_jobs.status IS 'Current status of the job: running, completed, or failed';
COMMENT ON COLUMN buybox_jobs.total_asins IS 'Total number of ASINs that were attempted to be processed';
COMMENT ON COLUMN buybox_jobs.successful_asins IS 'Number of ASINs successfully processed';
COMMENT ON COLUMN buybox_jobs.failed_asins IS 'Number of ASINs that failed to process';
COMMENT ON COLUMN buybox_jobs.duration_seconds IS 'Total runtime of the job in seconds';

-- 2. Buy Box Data Table
CREATE TABLE IF NOT EXISTS buybox_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL, -- links to buybox_jobs
    asin TEXT NOT NULL,
    sku TEXT NOT NULL,
    price NUMERIC(10, 2), -- Buy Box price
    currency TEXT DEFAULT 'GBP', -- Currency code
    is_winner BOOLEAN, -- Whether we won the Buy Box
    competitor_id TEXT, -- Seller ID of the winner (if not us)
    competitor_name TEXT, -- Seller name of the winner (if not us)
    competitor_price NUMERIC(10, 2), -- Price of the winner (if not us)
    marketplace TEXT DEFAULT 'UK', -- Marketplace (UK, DE, etc.)
    opportunity_flag BOOLEAN DEFAULT FALSE, -- Whether we could profitably win the Buy Box
    min_profitable_price NUMERIC(10, 2), -- The minimum price we could set and still be profitable
    margin_at_buybox NUMERIC(10, 2), -- The margin if we matched the Buy Box price
    margin_percent_at_buybox NUMERIC(10, 2), -- The margin percent if we matched the Buy Box price
    total_offers INTEGER, -- Number of total offers for this ASIN
    category TEXT, -- Product category (from metadata)
    brand TEXT, -- Brand (from metadata)
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields not directly in the context but useful based on the API response
    fulfillment_channel TEXT, -- DEFAULT, AFN (FBA), etc.
    merchant_shipping_group TEXT, -- Shipping group from Amazon
    
    -- Optional field to mark the source of the data
    source TEXT DEFAULT 'batch', -- 'batch' or 'live'

    -- Create foreign key constraint
    CONSTRAINT buybox_data_run_id_fkey FOREIGN KEY (run_id)
        REFERENCES buybox_jobs (id) ON DELETE CASCADE
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS buybox_data_asin_idx ON buybox_data(asin);
CREATE INDEX IF NOT EXISTS buybox_data_sku_idx ON buybox_data(sku);
CREATE INDEX IF NOT EXISTS buybox_data_run_id_idx ON buybox_data(run_id);
CREATE INDEX IF NOT EXISTS buybox_data_is_winner_idx ON buybox_data(is_winner);
CREATE INDEX IF NOT EXISTS buybox_data_opportunity_flag_idx ON buybox_data(opportunity_flag);
CREATE INDEX IF NOT EXISTS buybox_data_captured_at_idx ON buybox_data(captured_at);

-- Create a composite index for common filtering scenarios
CREATE INDEX IF NOT EXISTS buybox_data_opportunity_captured_idx ON buybox_data(opportunity_flag, captured_at);

-- Add comments
COMMENT ON TABLE buybox_data IS 'Stores results of Buy Box checks for all monitored ASINs';
COMMENT ON COLUMN buybox_data.run_id IS 'References the job that captured this data';
COMMENT ON COLUMN buybox_data.is_winner IS 'Whether we are the Buy Box winner';
COMMENT ON COLUMN buybox_data.opportunity_flag IS 'Whether we could profitably win the Buy Box by adjusting price';
COMMENT ON COLUMN buybox_data.margin_at_buybox IS 'The margin we would have if we matched the Buy Box price';
COMMENT ON COLUMN buybox_data.min_profitable_price IS 'Minimum price we could set and still be profitable';

-- 3. Buy Box Failures Table
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

-- Add comments
COMMENT ON TABLE buybox_failures IS 'Logs errors encountered during Buy Box checks';
COMMENT ON COLUMN buybox_failures.job_id IS 'References the job that encountered this failure';
COMMENT ON COLUMN buybox_failures.reason IS 'Human-readable error message or reason for failure';
COMMENT ON COLUMN buybox_failures.error_code IS 'HTTP status code or error code if available';
COMMENT ON COLUMN buybox_failures.attempt_number IS 'Which retry attempt this failure occurred on';

-- 4. Update SKUs table (or create if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'skus') THEN
        -- Create skus table if it doesn't exist
        CREATE TABLE skus (
            sku TEXT PRIMARY KEY,
            cost NUMERIC(10, 2), -- Purchase cost
            handling_cost NUMERIC(10, 2), -- Estimated labor cost
            shipping_cost NUMERIC(10, 2), -- Delivery cost
            min_price NUMERIC(10, 2), -- Price floor (never go below this)
            auto_pricing_enabled BOOLEAN DEFAULT FALSE, -- Future feature
            monitoring_enabled BOOLEAN DEFAULT TRUE, -- Optional override flag
            category TEXT, -- Optional category
            brand TEXT, -- Optional brand
            priority_score INTEGER, -- Optional priority score
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        COMMENT ON TABLE skus IS 'Reference table for SKU data related to Buy Box monitoring';
    ELSE
        -- Table exists, so add any missing columns needed for Buy Box monitoring
        
        -- Add min_price if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'min_price' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN min_price NUMERIC(10, 2);
        END IF;
        
        -- Add monitoring_enabled if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'monitoring_enabled' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN monitoring_enabled BOOLEAN DEFAULT TRUE;
        END IF;
        
        -- Add auto_pricing_enabled if it doesn't exist
        IF NOT EXISTS (SELECT FROM pg_attribute 
                       WHERE attrelid = 'skus'::regclass 
                       AND attname = 'auto_pricing_enabled' 
                       AND NOT attisdropped) THEN
            ALTER TABLE skus ADD COLUMN auto_pricing_enabled BOOLEAN DEFAULT FALSE;
        END IF;
    END IF;
END $$;

-- Create or update indexes for SKUs table
CREATE INDEX IF NOT EXISTS skus_monitoring_enabled_idx ON skus(monitoring_enabled) WHERE monitoring_enabled = TRUE;
CREATE INDEX IF NOT EXISTS skus_category_idx ON skus(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS skus_brand_idx ON skus(brand) WHERE brand IS NOT NULL;

-- Add comments to SKUs table
COMMENT ON COLUMN skus.min_price IS 'Minimum price allowed for this SKU (price floor)';
COMMENT ON COLUMN skus.monitoring_enabled IS 'Whether this SKU should be included in Buy Box monitoring';
COMMENT ON COLUMN skus.auto_pricing_enabled IS 'Whether automatic price adjustments are allowed (future feature)';
