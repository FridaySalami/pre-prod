-- Update existing buybox_data table to match API implementation
-- Run this script if you already have the tables created but need to update them

-- First, rename the job_id column to run_id if it exists
DO $$
BEGIN
    -- Check if the column exists before attempting to rename
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'buybox_data' 
              AND column_name = 'job_id') THEN
        
        -- Drop the foreign key constraint first
        EXECUTE 'ALTER TABLE buybox_data DROP CONSTRAINT IF EXISTS buybox_data_job_id_fkey';
        
        -- Rename column
        ALTER TABLE buybox_data RENAME COLUMN job_id TO run_id;
        
        -- Add the foreign key constraint back with the new column name
        ALTER TABLE buybox_data 
        ADD CONSTRAINT buybox_data_run_id_fkey 
        FOREIGN KEY (run_id) REFERENCES buybox_jobs(id);
    END IF;
END $$;

-- Add missing columns to buybox_data table
ALTER TABLE buybox_data
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GBP',
ADD COLUMN IF NOT EXISTS merchant_token VARCHAR(50),
ADD COLUMN IF NOT EXISTS buybox_merchant_token VARCHAR(50),
ADD COLUMN IF NOT EXISTS competitor_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS competitor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS competitor_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS min_profitable_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS total_offers INTEGER,
ADD COLUMN IF NOT EXISTS fulfillment_channel VARCHAR(50),
ADD COLUMN IF NOT EXISTS merchant_shipping_group VARCHAR(50),
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'batch';

-- Update indexes
DROP INDEX IF EXISTS idx_buybox_data_job_id;
CREATE INDEX IF NOT EXISTS idx_buybox_data_run_id ON buybox_data(run_id);

-- Add any other needed indexes
CREATE INDEX IF NOT EXISTS idx_buybox_data_currency ON buybox_data(currency);
CREATE INDEX IF NOT EXISTS idx_buybox_data_competitor_id ON buybox_data(competitor_id);

-- Update the rate limit and jitter columns in buybox_jobs if needed
ALTER TABLE buybox_jobs 
ADD COLUMN IF NOT EXISTS rate_limit_per_second DECIMAL(5, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS jitter_ms INTEGER DEFAULT 400,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

-- Display current schema
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'buybox_data' 
ORDER BY ordinal_position;
