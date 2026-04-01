const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHolidays() {
  console.log('Fetching holidays for Dalia S around Feb 2026...');

  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .ilike('employee_name', '%Dalia S%')
    .gt('from_date', '2026-02-01')
    .lt('from_date', '2026-03-01');

  if (error) {
    console.error('Error fetching holidays:', error);
    return;
  }

  console.log(`Found ${data.length} holidays:`);
  data.forEach(h => {
    console.log(`- ${h.employee_name} (${h.from_date.split('T')[0]}): Status="${h.status}"`);
  });

  // Also check if Dalia S is a tracked employee
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name, tracked')
    .ilike('name', '%Dalia S%');

  if (empError) {
    console.error('Error fetching employees:', empError);
  } else {
    console.log('Employee details:');
    employees.forEach(e => {
      console.log(e);
    });
  }
}

checkHolidays();
