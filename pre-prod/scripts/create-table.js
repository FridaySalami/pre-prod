import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2b3dmYnJwbW90Y2Z4Znp6aHhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDMxNzQ2OSwiZXhwIjoyMDU1ODkzNDY5fQ.tzqrQxoPFcwI3BUwcspBrDs9_EJB1GnpElstac70bTk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  try {
    console.log('Testing connection to Supabase...');

    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('sku_asin_mapping_files')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('Error accessing table:', testError);
      console.log('This means the table likely doesn\'t exist yet.');

      // Try to create it via raw SQL
      console.log('Attempting to create table via raw SQL...');
      const { data, error } = await supabase
        .from('sku_asin_mapping_files')
        .select('*')
        .limit(0);

      console.log('Raw SQL result:', { data, error });
    } else {
      console.log('Table already exists and is accessible!');
      console.log('Current records:', testData);
    }

    // Test storage bucket
    console.log('Testing storage bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.error('Error accessing storage:', bucketError);
    } else {
      console.log('Available buckets:', buckets);

      const skuBucket = buckets.find(b => b.name === 'sku-asin-mapping');
      if (skuBucket) {
        console.log('sku-asin-mapping bucket exists!');
      } else {
        console.log('sku-asin-mapping bucket does not exist.');

        // Try to create it
        console.log('Attempting to create storage bucket...');
        const { data: createData, error: createError } = await supabase.storage.createBucket('sku-asin-mapping', {
          public: false
        });

        if (createError) {
          console.error('Error creating bucket:', createError);
        } else {
          console.log('Bucket created successfully!');
        }
      }
    }

  } catch (err) {
    console.error('Script error:', err);
  }
}

createTable();
