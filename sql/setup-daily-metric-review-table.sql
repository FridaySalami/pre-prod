-- SQL script to set up the daily_metric_review table for Supabase
-- This will drop the existing table and create a new one with the correct schema

-- Drop the existing table if it exists
DROP TABLE IF EXISTS public.daily_metric_review;

-- Create the new daily_metric_review table
CREATE TABLE public.daily_metric_review (
    -- Primary key and unique constraint
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL UNIQUE,
    
    -- Sales metrics (2.0 series) - using numeric for currency values
    total_sales numeric(10,2) DEFAULT 0,
    amazon_sales numeric(10,2) DEFAULT 0,
    ebay_sales numeric(10,2) DEFAULT 0,
    shopify_sales numeric(10,2) DEFAULT 0,
    
    -- Orders metrics (2.1 series) - using integer for order counts
    linnworks_total_orders integer DEFAULT 0,
    linnworks_amazon_orders integer DEFAULT 0,
    linnworks_ebay_orders integer DEFAULT 0,
    linnworks_shopify_orders integer DEFAULT 0,
    
    -- Percentage distribution (2.2 series) - using numeric for percentages
    amazon_orders_percent numeric(5,2) DEFAULT 0,
    ebay_orders_percent numeric(5,2) DEFAULT 0,
    shopify_orders_percent numeric(5,2) DEFAULT 0,
    
    -- Labor metrics (1.x series) - using numeric for hours and efficiency
    actual_hours_worked numeric(5,2) DEFAULT 0,
    labor_efficiency numeric(5,2) DEFAULT 0,
    
    -- Timestamps for audit trail
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index on date for faster queries
CREATE INDEX idx_daily_metric_review_date ON public.daily_metric_review(date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_metric_review ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
-- Policy for SELECT: Allow authenticated users to read all records
CREATE POLICY "Allow authenticated users to select daily metric reviews" 
ON public.daily_metric_review 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy for INSERT: Allow authenticated users to insert records
CREATE POLICY "Allow authenticated users to insert daily metric reviews" 
ON public.daily_metric_review 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy for UPDATE: Allow authenticated users to update records
CREATE POLICY "Allow authenticated users to update daily metric reviews" 
ON public.daily_metric_review 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Policy for DELETE: Allow authenticated users to delete records
CREATE POLICY "Allow authenticated users to delete daily metric reviews" 
ON public.daily_metric_review 
FOR DELETE 
TO authenticated 
USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_daily_metric_review_updated_at 
    BEFORE UPDATE ON public.daily_metric_review 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the table structure
COMMENT ON TABLE public.daily_metric_review IS 'Daily metric review data for dashboard analytics';
COMMENT ON COLUMN public.daily_metric_review.date IS 'Date for the metrics (unique constraint)';
COMMENT ON COLUMN public.daily_metric_review.total_sales IS 'Total sales value for all channels (2.0)';
COMMENT ON COLUMN public.daily_metric_review.amazon_sales IS 'Amazon sales value (2.0.1)';
COMMENT ON COLUMN public.daily_metric_review.ebay_sales IS 'eBay sales value (2.0.2)';
COMMENT ON COLUMN public.daily_metric_review.shopify_sales IS 'Shopify sales value (2.0.3)';
COMMENT ON COLUMN public.daily_metric_review.linnworks_total_orders IS 'Total Linnworks orders (2.1)';
COMMENT ON COLUMN public.daily_metric_review.linnworks_amazon_orders IS 'Linnworks Amazon orders (2.1.1)';
COMMENT ON COLUMN public.daily_metric_review.linnworks_ebay_orders IS 'Linnworks eBay orders (2.1.2)';
COMMENT ON COLUMN public.daily_metric_review.linnworks_shopify_orders IS 'Linnworks Shopify orders (2.1.3)';
COMMENT ON COLUMN public.daily_metric_review.amazon_orders_percent IS 'Amazon orders percentage (2.2.1)';
COMMENT ON COLUMN public.daily_metric_review.ebay_orders_percent IS 'eBay orders percentage (2.2.2)';
COMMENT ON COLUMN public.daily_metric_review.shopify_orders_percent IS 'Shopify orders percentage (2.2.3)';
COMMENT ON COLUMN public.daily_metric_review.actual_hours_worked IS 'Actual hours worked (1.3)';
COMMENT ON COLUMN public.daily_metric_review.labor_efficiency IS 'Labor efficiency - shipments per hour (1.4)';

-- Grant permissions to authenticated users
GRANT ALL ON public.daily_metric_review TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Optional: Insert a test record to verify the schema works
-- You can uncomment this section to test the table structure
/*
INSERT INTO public.daily_metric_review (
    date,
    total_sales,
    amazon_sales,
    ebay_sales,
    shopify_sales,
    linnworks_total_orders,
    linnworks_amazon_orders,
    linnworks_ebay_orders,
    linnworks_shopify_orders,
    amazon_orders_percent,
    ebay_orders_percent,
    shopify_orders_percent,
    actual_hours_worked,
    labor_efficiency
) VALUES (
    '2025-06-10',
    1000.50,
    600.30,
    250.20,
    150.00,
    50,
    30,
    15,
    5,
    60.00,
    30.00,
    10.00,
    8.5,
    5.88
);
*/
