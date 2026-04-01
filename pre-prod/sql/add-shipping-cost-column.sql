-- Add shipping_cost column to amazon_orders table
ALTER TABLE amazon_orders 
ADD COLUMN IF NOT EXISTS shipping_cost numeric(10, 2);

-- Add comment to explain the column
COMMENT ON COLUMN amazon_orders.shipping_cost IS 'Actual shipping cost from Amazon Shipping CSV or Settlement Reports';
