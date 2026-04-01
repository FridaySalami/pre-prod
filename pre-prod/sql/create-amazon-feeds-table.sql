-- Amazon Feed Tracking Table
-- Created: August 5, 2025
-- Purpose: Track Amazon Feeds API submissions for price updates

CREATE TABLE IF NOT EXISTS amazon_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id TEXT NOT NULL UNIQUE, -- Amazon's feed ID
  feed_type TEXT NOT NULL DEFAULT 'PRICING', -- Type of feed submitted
  asin TEXT NOT NULL, -- ASIN being updated
  sku TEXT, -- SKU if available
  
  -- Price change details
  old_price NUMERIC(10,2), -- Previous price
  new_price NUMERIC(10,2) NOT NULL, -- New price being set
  currency TEXT DEFAULT 'GBP',
  
  -- Feed submission details
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by UUID REFERENCES auth.users(id), -- User who triggered the update
  submission_method TEXT DEFAULT 'listings_api', -- Method used for submission
  
  -- Feed processing status
  feed_status TEXT DEFAULT 'SUBMITTED' CHECK (feed_status IN ('SUBMITTED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'FATAL')),
  processing_start_time TIMESTAMP WITH TIME ZONE,
  processing_end_time TIMESTAMP WITH TIME ZONE,
  processing_summary JSONB, -- Amazon's processing summary
  
  -- Results tracking
  result_count_submitted INTEGER DEFAULT 0,
  result_count_accepted INTEGER DEFAULT 0,
  result_count_invalid INTEGER DEFAULT 0,
  result_count_warnings INTEGER DEFAULT 0,
  
  -- Error tracking
  errors JSONB, -- Array of errors if any
  issues JSONB, -- Array of issues/warnings
  
  -- API response data
  raw_submission_response JSONB, -- Full response from feed submission
  raw_result_response JSONB, -- Full response from feed result check
  
  -- Metadata
  notes TEXT,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_feed_id ON amazon_feeds(feed_id);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_asin ON amazon_feeds(asin);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_sku ON amazon_feeds(sku);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_status ON amazon_feeds(feed_status);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_submitted_at ON amazon_feeds(submitted_at);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_submitted_by ON amazon_feeds(submitted_by);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_asin_status ON amazon_feeds(asin, feed_status);
CREATE INDEX IF NOT EXISTS idx_amazon_feeds_status_submitted ON amazon_feeds(feed_status, submitted_at);

-- Comments for documentation
COMMENT ON TABLE amazon_feeds IS 'Tracks Amazon Feeds API submissions for price updates and other listing changes';
COMMENT ON COLUMN amazon_feeds.feed_id IS 'Amazon-assigned feed ID for tracking';
COMMENT ON COLUMN amazon_feeds.feed_status IS 'Current processing status from Amazon: SUBMITTED, IN_PROGRESS, DONE, CANCELLED, or FATAL';
COMMENT ON COLUMN amazon_feeds.processing_summary IS 'Amazon''s processing summary with counts and details';
COMMENT ON COLUMN amazon_feeds.raw_submission_response IS 'Full JSON response from Amazon when feed was submitted';
COMMENT ON COLUMN amazon_feeds.raw_result_response IS 'Full JSON response from Amazon feed result endpoint';

-- Enable RLS
ALTER TABLE amazon_feeds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own feed submissions" ON amazon_feeds
    FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "Users can insert their own feed submissions" ON amazon_feeds
    FOR INSERT WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can update their own feed submissions" ON amazon_feeds
    FOR UPDATE USING (submitted_by = auth.uid());

-- Admins can see all feeds
CREATE POLICY "Admins can view all feeds" ON amazon_feeds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );
