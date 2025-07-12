import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTable() {
  console.log('Setting up SKU-ASIN mapping table...');

  try {
    // Create the table and indexes
    const sql = `
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

    -- Enable RLS
    ALTER TABLE sku_asin_mapping ENABLE ROW LEVEL SECURITY;

    -- Create policy for authenticated users
    CREATE POLICY "Allow authenticated users to access sku_asin_mapping" 
    ON sku_asin_mapping FOR ALL 
    TO authenticated 
    USING (true);
    `;

    const { error } = await supabase.rpc('pgSQL', { query: sql });

    if (error) {
      console.error('Error creating SKU-ASIN mapping table:', error);
      process.exit(1);
    }

    console.log('✅ SKU-ASIN mapping table setup completed successfully');

  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

setupTable().catch(console.error);
