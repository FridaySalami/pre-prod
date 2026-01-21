const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkEmployeesTable() {
  console.log("Checking for 'employees' table...");
  
  // Try to select from the 'employees' table
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(5);

  if (error) {
    console.error("Error fetching employees:", error);
  } else {
    console.log("Found employees table!");
    console.log("Sample rows:", JSON.stringify(data, null, 2));
    
    if (data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    }
  }
}

checkEmployeesTable();
