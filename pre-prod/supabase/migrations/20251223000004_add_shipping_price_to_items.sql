-- Add shipping price columns to amazon_order_items table

ALTER TABLE amazon_order_items 
ADD COLUMN IF NOT EXISTS shipping_price_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS shipping_price_currency TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN amazon_order_items.shipping_price_amount IS 'The shipping price for this item';
