-- Create Supabase storage bucket for SKU-ASIN mapping files
INSERT INTO storage.buckets (id, name, public)
VALUES ('sku-asin-mapping', 'sku-asin-mapping', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for authenticated users to upload files
CREATE POLICY "Authenticated users can upload sku-asin-mapping files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sku-asin-mapping');

-- Create policy for authenticated users to view files
CREATE POLICY "Authenticated users can view sku-asin-mapping files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'sku-asin-mapping');

-- Create policy for authenticated users to delete files
CREATE POLICY "Authenticated users can delete sku-asin-mapping files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'sku-asin-mapping');

-- Ensure SKU-ASIN mapping table exists
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

-- Create indexes for SKU-ASIN mapping performance
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_seller_sku ON sku_asin_mapping(seller_sku);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin1 ON sku_asin_mapping(asin1);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_status ON sku_asin_mapping(status);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_fulfillment_channel ON sku_asin_mapping(fulfillment_channel);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_created_at ON sku_asin_mapping(created_at);

-- Simplified SKU-ASIN mapping files table (stores file metadata only)
CREATE TABLE IF NOT EXISTS sku_asin_mapping_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_files_filename ON sku_asin_mapping_files(filename);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_files_upload_date ON sku_asin_mapping_files(upload_date);

-- Enable RLS for both tables
ALTER TABLE sku_asin_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_asin_mapping_files ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to access sku_asin_mapping" 
ON sku_asin_mapping FOR ALL 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to access sku_asin_mapping_files" 
ON sku_asin_mapping_files FOR ALL 
TO authenticated 
USING (true);
