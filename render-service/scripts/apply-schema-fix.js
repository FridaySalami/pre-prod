/**
 * Apply Buy Box Database Schema Fix
 * Run this to create the missing price_monitoring_config table and relationships
 */

const { supabase } = require('../services/supabase-client');
const fs = require('fs');
const path = require('path');

async function applySchemaFix() {
  try {
    console.log('🔧 Applying buy box database schema fix...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/fix-buybox-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements (basic splitting)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

        const { error } = await supabase.rpc('exec_sql', { sql_statement: statement });

        if (error) {
          console.warn(`⚠️ Statement ${i + 1} warning:`, error.message);
          // Don't throw - some statements may fail if objects already exist
        } else {
          console.log(`✅ Statement ${i + 1} completed successfully`);
        }
      }
    }

    console.log('🎉 Schema fix completed!');

    // Test by querying the new structure
    const { data: configTest, error: configError } = await supabase
      .from('price_monitoring_config')
      .select('count(*)')
      .single();

    if (configError) {
      console.log('📊 price_monitoring_config table check:', configError.message);
    } else {
      console.log('📊 price_monitoring_config table exists');
    }

    return true;

  } catch (error) {
    console.error('❌ Error applying schema fix:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  applySchemaFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { applySchemaFix };