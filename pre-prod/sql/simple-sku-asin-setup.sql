-- Create the SKU-ASIN mapping table
CREATE TABLE IF NOT EXISTS sku_asin_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_sku TEXT UNIQUE NOT NULL,
  item_name TEXT,
  asin1 TEXT,
  asin2 TEXT,
  asin3 TEXT,
  price DECIMAL(10,2),
  quantity INTEGER,
  fulfillment_channel TEXT,
  merchant_shipping_group TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_seller_sku ON sku_asin_mapping(seller_sku);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin1 ON sku_asin_mapping(asin1);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_status ON sku_asin_mapping(status);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_fulfillment_channel ON sku_asin_mapping(fulfillment_channel);
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_created_at ON sku_asin_mapping(created_at);

-- Create import history table
CREATE TABLE IF NOT EXISTS sku_asin_mapping_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  import_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create index for import history
CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_imports_date ON sku_asin_mapping_imports(import_date);

-- Enable RLS
ALTER TABLE sku_asin_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_asin_mapping_imports ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to access sku_asin_mapping" 
ON sku_asin_mapping FOR ALL 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to access sku_asin_mapping_imports" 
ON sku_asin_mapping_imports FOR ALL 
TO authenticated 
USING (true);
