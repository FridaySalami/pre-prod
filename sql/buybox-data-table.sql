-- buybox_data table: Stores the results of all Buy Box checks
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

    -- Create index on common lookup patterns
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

-- Comment on table and columns for documentation
COMMENT ON TABLE buybox_data IS 'Stores results of Buy Box checks for all monitored ASINs';
COMMENT ON COLUMN buybox_data.run_id IS 'References the job that captured this data';
COMMENT ON COLUMN buybox_data.is_winner IS 'Whether we are the Buy Box winner';
COMMENT ON COLUMN buybox_data.opportunity_flag IS 'Whether we could profitably win the Buy Box by adjusting price';
COMMENT ON COLUMN buybox_data.margin_at_buybox IS 'The margin we would have if we matched the Buy Box price';
COMMENT ON COLUMN buybox_data.min_profitable_price IS 'Minimum price we could set and still be profitable';
