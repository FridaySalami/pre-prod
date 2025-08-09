-- Create table to store competitor offers per scan, without changing buybox_data
CREATE TABLE IF NOT EXISTS buybox_offers (
  id BIGSERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL,
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
  raw_offer JSONB
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_buybox_offers_run ON buybox_offers (run_id);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_asin_sku ON buybox_offers (asin, sku);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_run_asin_sku ON buybox_offers (run_id, asin, sku);
CREATE INDEX IF NOT EXISTS idx_buybox_offers_buybox ON buybox_offers (is_buybox_winner);
