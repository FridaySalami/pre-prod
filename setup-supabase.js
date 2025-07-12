import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read environment variables from .env file
const envPath = path.join(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('#'))
  .reduce((acc, line) => {
    const [key, value] = line.split('=');
    acc[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    return acc;
  }, {});

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Make sure you have PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_SERVICE_KEY in your .env file.');
  process.exit(1);
}

console.log(`🔑 Using Supabase URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to create tables and buckets
async function setupSupabase() {
  try {
    console.log('🔄 Setting up Supabase database and storage...');

    // 1. Create sku_asin_mapping table if it doesn't exist
    console.log('📋 Creating sku_asin_mapping table...');
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
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
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_seller_sku ON sku_asin_mapping(seller_sku);
        CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_asin1 ON sku_asin_mapping(asin1);
        CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_status ON sku_asin_mapping(status);
      `
    });

    if (tableError) {
      console.error('❌ Error creating sku_asin_mapping table:', tableError);
      console.log('⚠️ Attempting to check if the table already exists...');

      const { data: tableData, error: tableCheckError } = await supabase
        .from('sku_asin_mapping')
        .select('count(*)', { count: 'exact', head: true });

      if (tableCheckError) {
        console.error('❌ Table does not seem to exist:', tableCheckError);
      } else {
        console.log('✅ Table exists, skipping creation');
      }
    } else {
      console.log('✅ Table created or already exists');
    }

    // 2. Create sku_asin_mapping_files table if it doesn't exist
    console.log('📋 Creating sku_asin_mapping_files table...');
    const { error: filesTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sku_asin_mapping_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'active',
          notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_files_filename ON sku_asin_mapping_files(filename);
        CREATE INDEX IF NOT EXISTS idx_sku_asin_mapping_files_upload_date ON sku_asin_mapping_files(upload_date);
      `
    });

    if (filesTableError) {
      console.error('❌ Error creating sku_asin_mapping_files table:', filesTableError);
      console.log('⚠️ Attempting to check if the files table already exists...');

      const { data: filesTableData, error: filesTableCheckError } = await supabase
        .from('sku_asin_mapping_files')
        .select('count(*)', { count: 'exact', head: true });

      if (filesTableCheckError) {
        console.error('❌ Files table does not seem to exist:', filesTableCheckError);
      } else {
        console.log('✅ Files table exists, skipping creation');
      }
    } else {
      console.log('✅ Files table created or already exists');
    }

    // 3. Create storage bucket if it doesn't exist
    console.log('🪣 Creating sku-asin-mapping storage bucket...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === 'sku-asin-mapping');

    if (!bucketExists) {
      const { data, error: bucketError } = await supabase.storage.createBucket('sku-asin-mapping', {
        public: false
      });

      if (bucketError) {
        console.error('❌ Error creating bucket:', bucketError);
      } else {
        console.log('✅ Bucket created successfully');

        // Set bucket policies
        console.log('🔒 Setting bucket policies...');
        const { error: policyError } = await supabase.rpc('exec_sql', {
          sql: `
            BEGIN;
            -- Create policy to allow authenticated users to upload files
            CREATE POLICY "Allow authenticated users to upload files"
            ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'sku-asin-mapping');

            -- Create policy to allow authenticated users to select files
            CREATE POLICY "Allow authenticated users to select files"
            ON storage.objects FOR SELECT TO authenticated
            USING (bucket_id = 'sku-asin-mapping');

            -- Create policy to allow authenticated users to delete files
            CREATE POLICY "Allow authenticated users to delete files"
            ON storage.objects FOR DELETE TO authenticated
            USING (bucket_id = 'sku-asin-mapping');
            COMMIT;
          `
        });

        if (policyError) {
          console.error('❌ Error setting bucket policies:', policyError);
        } else {
          console.log('✅ Bucket policies set successfully');
        }
      }
    } else {
      console.log('✅ Bucket already exists, skipping creation');
    }

    console.log('🎉 Supabase setup completed!');

  } catch (error) {
    console.error('❌ Setup failed with error:', error);
  }
}

setupSupabase();
