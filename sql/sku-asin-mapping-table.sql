-- SKU to ASIN Mapping Table
-- This table stores the mapping between seller SKUs and Amazon ASINs
-- along with additional product information from Amazon listings

CREATE TABLE IF NOT EXISTS sku_asin_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_sku TEXT UNIQUE NOT NULL,
  item_name TEXT,
  item_description TEXT,
  listing_id TEXT,
  price DECIMAL(10,2),
  quantity INTEGER,
  open_date DATE,
  image_url TEXT,
  item_is_marketplace BOOLEAN DEFAULT false,
  product_id_type TEXT,
  zshop_shipping_fee DECIMAL(10,2),
  item_note TEXT,
  item_condition TEXT,
  zshop_category1 TEXT,
  zshop_browse_path TEXT,
  zshop_storefront_feature TEXT,
  asin1 TEXT,
  asin2 TEXT,
  asin3 TEXT,
  will_ship_internationally BOOLEAN DEFAULT false,
  expedited_shipping BOOLEAN DEFAULT false,
  zshop_boldface BOOLEAN DEFAULT false,
  product_id TEXT,
  bid_for_featured_placement BOOLEAN DEFAULT false,
  add_delete TEXT,
  pending_quantity INTEGER,
  fulfillment_channel TEXT,
  merchant_shipping_group TEXT,
  status TEXT,
  minimum_order_quantity INTEGER,
  sell_remainder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_seller_sku ON sku_asin_mapping(seller_sku);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin1 ON sku_asin_mapping(asin1);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin2 ON sku_asin_mapping(asin2);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin3 ON sku_asin_mapping(asin3);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_status ON sku_asin_mapping(status);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_fulfillment_channel ON sku_asin_mapping(fulfillment_channel);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_merchant_shipping_group ON sku_asin_mapping(merchant_shipping_group);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_price ON sku_asin_mapping(price);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_created_at ON sku_asin_mapping(created_at);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sku_asin_mapping_updated_at
    BEFORE UPDATE ON sku_asin_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE sku_asin_mapping IS 'SKU to ASIN mapping data with comprehensive Amazon listing information';
COMMENT ON COLUMN sku_asin_mapping.seller_sku IS 'Unique seller SKU identifier';
COMMENT ON COLUMN sku_asin_mapping.asin1 IS 'Primary ASIN for the product';
COMMENT ON COLUMN sku_asin_mapping.asin2 IS 'Secondary ASIN for the product';
COMMENT ON COLUMN sku_asin_mapping.asin3 IS 'Tertiary ASIN for the product';
COMMENT ON COLUMN sku_asin_mapping.fulfillment_channel IS 'Amazon fulfillment channel (FBA, FBM, etc.)';
COMMENT ON COLUMN sku_asin_mapping.merchant_shipping_group IS 'Merchant shipping group configuration';
