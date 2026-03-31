-- 1. monitored_top_100_skus (Target List)
CREATE TABLE IF NOT EXISTS monitored_top_100_skus (
  sku TEXT PRIMARY KEY,
  asin TEXT NOT NULL,
  product_name TEXT,
  rank INTEGER,
  units_30d INTEGER,
  revenue_30d NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. top_100_buy_box_current (Live Dashboard)
CREATE TABLE IF NOT EXISTS top_100_buy_box_current (
  sku TEXT PRIMARY KEY REFERENCES monitored_top_100_skus(sku),
  asin TEXT NOT NULL,
  product_name TEXT,
  buy_box_price NUMERIC, -- Landed price
  buy_box_currency TEXT,
  our_price NUMERIC,
  our_shipping_price NUMERIC,
  buy_box_shipping_price NUMERIC,
  is_winner BOOLEAN,
  buy_box_seller_id TEXT,
  buy_box_seller_name TEXT,
  competitor_price NUMERIC,
  competitor_seller_id TEXT,
  competitor_seller_name TEXT,
  offer_count INTEGER,
  status TEXT, -- WINNING, LOSING, SUPPRESSED, OUT_OF_STOCK, NO_FEATURED_OFFER, ERROR
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_at TIMESTAMPTZ,
  suppressed_reason TEXT,
  marketplace_id TEXT DEFAULT 'A1F83G8C2ARO7P'
);

-- 3. top_100_buy_box_history (Trend Analysis)
CREATE TABLE IF NOT EXISTS top_100_buy_box_history (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  asin TEXT NOT NULL,
  product_name TEXT,
  buy_box_price NUMERIC,
  buy_box_currency TEXT,
  our_price NUMERIC,
  our_shipping_price NUMERIC,
  buy_box_shipping_price NUMERIC,
  is_winner BOOLEAN,
  buy_box_seller_id TEXT,
  buy_box_seller_name TEXT,
  competitor_price NUMERIC,
  competitor_seller_id TEXT,
  competitor_seller_name TEXT,
  offer_count INTEGER,
  status TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_detected BOOLEAN DEFAULT FALSE,
  marketplace_id TEXT DEFAULT 'A1F83G8C2ARO7P'
);

-- 4. job_locks (Concurrency Control)
CREATE TABLE IF NOT EXISTS job_locks (
  job_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ,
  lock_owner TEXT
);

-- 5. buy_box_monitor_runs (Job Health)
CREATE TABLE IF NOT EXISTS buy_box_monitor_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- SUCCESS, PARTIAL_FAILURE, FATAL_ERROR
  total_skus INTEGER,
  success_count INTEGER,
  error_count INTEGER,
  notes TEXT
);

-- Create history index for performance
CREATE INDEX IF NOT EXISTS idx_bb_history_sku ON top_100_buy_box_history(sku);
CREATE INDEX IF NOT EXISTS idx_bb_history_checked_at ON top_100_buy_box_history(checked_at);
