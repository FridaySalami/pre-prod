-- Fix buybox_offers table to use UUID run_id to match buybox_jobs.id
-- This will allow proper foreign key relationship

-- Drop the table and recreate with correct data type
DROP TABLE IF EXISTS buybox_offers;

-- Recreate with UUID run_id
CREATE TABLE buybox_offers (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL, -- Changed from INTEGER to UUID
  asin TEXT NOT NULL,
  sku TEXT,
  seller_id TEXT,
  seller_name TEXT,
  listing_price NUMERIC(10,2) DEFAULT 0,
  shipping NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) GENERATED ALWAYS AS (COALESCE(listing_price,0) + COALESCE(shipping,0)) STORED,
  is_buybox_winner BOOLEAN DEFAULT FALSE,
  is_prime BOOLEAN DEFAULT FALSE,
  is_fba BOOLEAN DEFAULT FALSE,
  fulfillment_channel TEXT,
  condition TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  raw_offer JSONB,
  
  -- Foreign key constraint to buybox_jobs
  CONSTRAINT fk_buybox_offers_run_id 
    FOREIGN KEY (run_id) 
    REFERENCES buybox_jobs (id) ON DELETE CASCADE
);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_buybox_offers_run ON buybox_offers (run_id);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_asin_sku ON buybox_offers (asin, sku);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_run_asin_sku ON buybox_offers (run_id, asin, sku);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_buybox ON buybox_offers (is_buybox_winner);

-- Add comments for clarity
COMMENT ON TABLE buybox_offers IS 'Stores individual competitor offers per scan job';
COMMENT ON COLUMN buybox_offers.run_id IS 'Foreign key to buybox_jobs.id (UUID)';
COMMENT ON COLUMN buybox_offers.total IS 'Generated column: listing_price + shipping';
