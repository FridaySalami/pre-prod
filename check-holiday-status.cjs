const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkStatus() {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .ilike('employee_name', '%Andrej%')
    .gte('from_date', '2026-01-01')
    .lte('to_date', '2026-02-01');

  if (error) {
    console.error('Error fetching holidays:', error);
    return;
  }

  console.log('Found holidays for Andrej around 11th Jan 2026:');
  if (data.length === 0) {
    console.log('No records found.');
  } else {
    data.forEach(h => {
      console.log(`- Name: ${h.employee_name}`);
      console.log(`  Dates: ${h.from_date} to ${h.to_date}`);
      console.log(`  Excluded Dates: ${JSON.stringify(h.dates_to_exclude)}`);
      console.log(`  Raw Data (dates_to_exclude): ${JSON.stringify(h.raw_data?.dates_to_exclude)}`);
      console.log('---');
    });
  }
}

checkStatus();
