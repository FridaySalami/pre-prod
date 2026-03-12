import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('Cleaning up obsolete unmapped order packaging...');
  // Just delete all unmapped ones. The sync script will recalculate them or put them back if they STILL are unmapped!
  const { data, error } = await supabase
    .from('amazon_order_packaging')
    .delete()
    .is('box_supply_id', null);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully cleared old unmapped packaging rows. They will be recalculated by the sync worker.');
  }
}
run();
