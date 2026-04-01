-- Create listing_health_scores table for caching health score calculations
-- TTL Strategy: 24-hour cache (recalculate daily or when listing changes)

CREATE TABLE IF NOT EXISTS listing_health_scores (
  id BIGSERIAL PRIMARY KEY,
  asin VARCHAR(10) NOT NULL,
  marketplace_id VARCHAR(20) NOT NULL DEFAULT 'A1F83G8C2ARO7P', -- UK marketplace
  
  -- Overall Score
  overall_score NUMERIC(3, 1) NOT NULL, -- 0.0 to 10.0
  grade VARCHAR(20) NOT NULL, -- Excellent, Good, Fair, Poor
  
  -- Component Scores
  content_score NUMERIC(3, 1) NOT NULL,
  content_max NUMERIC(3, 1) DEFAULT 3.0,
  content_percentage INTEGER NOT NULL,
  
  image_score NUMERIC(3, 1) NOT NULL,
  image_max NUMERIC(3, 1) DEFAULT 2.5,
  image_percentage INTEGER NOT NULL,
  
  competitive_score NUMERIC(3, 1) NOT NULL,
  competitive_max NUMERIC(3, 1) DEFAULT 2.5,
  competitive_percentage INTEGER NOT NULL,
  
  buybox_score NUMERIC(3, 1) NOT NULL,
  buybox_max NUMERIC(3, 1) DEFAULT 2.0,
  buybox_percentage INTEGER NOT NULL,
  
  -- Detailed Breakdown (JSONB for flexibility)
  breakdown JSONB NOT NULL, -- Full score details from calculator
  
  -- Recommendations
  recommendations JSONB, -- Array of recommendation objects
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_health_asin_marketplace UNIQUE (asin, marketplace_id),
  CONSTRAINT check_overall_score CHECK (overall_score >= 0 AND overall_score <= 10),
  CONSTRAINT check_content_score CHECK (content_score >= 0 AND content_score <= content_max),
  CONSTRAINT check_image_score CHECK (image_score >= 0 AND image_score <= image_max),
  CONSTRAINT check_competitive_score CHECK (competitive_score >= 0 AND competitive_score <= competitive_max),
  CONSTRAINT check_buybox_score CHECK (buybox_score >= 0 AND buybox_score <= buybox_max)
);

-- Indexes for performance
CREATE INDEX idx_health_asin ON listing_health_scores (asin);
CREATE INDEX idx_health_updated_at ON listing_health_scores (updated_at);
CREATE INDEX idx_health_marketplace ON listing_health_scores (marketplace_id);
CREATE INDEX idx_health_overall_score ON listing_health_scores (overall_score DESC);

-- Composite index for TTL queries (check cache freshness)
CREATE INDEX idx_health_asin_updated ON listing_health_scores (asin, updated_at DESC);

-- Index for finding listings by grade
CREATE INDEX idx_health_grade ON listing_health_scores (grade, overall_score DESC);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_health_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on row modification
CREATE TRIGGER trigger_health_scores_timestamp
  BEFORE UPDATE ON listing_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_health_scores_timestamp();

-- Add table comments
COMMENT ON TABLE listing_health_scores IS 'Caches listing health score calculations with 24-hour TTL';
COMMENT ON COLUMN listing_health_scores.asin IS 'Amazon Standard Identification Number (unique product ID)';
COMMENT ON COLUMN listing_health_scores.marketplace_id IS 'Amazon marketplace identifier (e.g., A1F83G8C2ARO7P for UK)';
COMMENT ON COLUMN listing_health_scores.overall_score IS 'Overall health score (0-10) calculated from weighted components';
COMMENT ON COLUMN listing_health_scores.breakdown IS 'Detailed score breakdown with all component details';
COMMENT ON COLUMN listing_health_scores.recommendations IS 'Array of actionable recommendations to improve listing';
COMMENT ON COLUMN listing_health_scores.updated_at IS 'Last cache update timestamp - records older than 24 hours should be refreshed';
