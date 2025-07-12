-- Buy Box Monitoring System - Database Tables
-- This script creates the necessary tables for the Buy Box monitoring system

-- Table for tracking scan jobs
CREATE TABLE IF NOT EXISTS buybox_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_asins INTEGER NOT NULL DEFAULT 0,
    successful_asins INTEGER NOT NULL DEFAULT 0,
    failed_asins INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    source VARCHAR(50) NOT NULL DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table for storing scan results
CREATE TABLE IF NOT EXISTS buybox_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES buybox_jobs(id), -- Changed from job_id to run_id to match API
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(50),
    price DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'GBP', -- Added to match API
    is_winner BOOLEAN NOT NULL,
    merchant_token VARCHAR(50), -- Added to match API
    buybox_merchant_token VARCHAR(50), -- Added to match API
    competitor_id VARCHAR(50), -- Added to match API
    competitor_name VARCHAR(255), -- Added to match API
    competitor_price DECIMAL(10, 2), -- Added to match API
    opportunity_flag BOOLEAN NOT NULL DEFAULT false,
    min_profitable_price DECIMAL(10, 2), -- Added to match API
    margin_at_buybox DECIMAL(10, 2),
    margin_percent_at_buybox DECIMAL(5, 2),
    total_offers INTEGER, -- Added to match API
    fulfillment_channel VARCHAR(50), -- Added to match API
    merchant_shipping_group VARCHAR(50), -- Added to match API
    source VARCHAR(20) DEFAULT 'batch', -- Added to match API
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table for tracking scan failures
CREATE TABLE IF NOT EXISTS buybox_failures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES buybox_jobs(id),
    asin VARCHAR(20) NOT NULL,
    sku VARCHAR(50),
    reason TEXT NOT NULL,
    error_code VARCHAR(50),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_buybox_data_run_id ON buybox_data(run_id); -- Changed from job_id to run_id
CREATE INDEX IF NOT EXISTS idx_buybox_data_asin ON buybox_data(asin);
CREATE INDEX IF NOT EXISTS idx_buybox_data_sku ON buybox_data(sku);
CREATE INDEX IF NOT EXISTS idx_buybox_data_is_winner ON buybox_data(is_winner);
CREATE INDEX IF NOT EXISTS idx_buybox_data_opportunity_flag ON buybox_data(opportunity_flag);

CREATE INDEX IF NOT EXISTS idx_buybox_failures_job_id ON buybox_failures(job_id);
CREATE INDEX IF NOT EXISTS idx_buybox_failures_asin ON buybox_failures(asin);

-- Add index on jobs status for quick filtering of active jobs
CREATE INDEX IF NOT EXISTS idx_buybox_jobs_status ON buybox_jobs(status);
