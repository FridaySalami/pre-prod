import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Initialize dotenv
dotenv.config();

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    // Get distinct fulfillment_channel values
    const { data: channelData, error: channelError } = await supabase
      .from('sku_asin_mapping')
      .select('fulfillment_channel')
      .limit(100);

    if (channelError) {
      console.error('Error fetching fulfillment_channel:', channelError);
    } else {
      const channels = new Set(channelData.map(item => item.fulfillment_channel).filter(Boolean));
      console.log('Unique fulfillment_channel values:', Array.from(channels));
    }

    // Get distinct status values
    const { data: statusData, error: statusError } = await supabase
      .from('sku_asin_mapping')
      .select('status')
      .limit(100);

    if (statusError) {
      console.error('Error fetching status:', statusError);
    } else {
      const statuses = new Set(statusData.map(item => item.status).filter(Boolean));
      console.log('Unique status values:', Array.from(statuses));
    }

    // Get sample data with both fields
    const { data: sampleData, error: sampleError } = await supabase
      .from('sku_asin_mapping')
      .select('seller_sku, status, fulfillment_channel')
      .limit(10);

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
    } else {
      console.log('Sample data:');
      console.table(sampleData);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkData();
