
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkHolidaysColumns() {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data.length > 0) {
    console.log("Holidays Columns:", Object.keys(data[0]));
  } else {
    console.log("Holidays table empty, cannot check columns dynamically easily without inspection schema.");
  }
}

checkHolidaysColumns();
