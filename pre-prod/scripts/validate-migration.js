// Data validation script for Supabase migration
import { db } from './src/lib/supabaseServer.js';

console.log('🔍 Validating Supabase migration...');

async function validateMigration() {
  try {
    // Test database connection
    console.log('📡 Testing database connection...');

    // Check each table
    const tables = [
      'amazon_listings',
      'inventory',
      'sage_reports',
      'linnworks_composition',
      'import_records'
    ];

    for (const table of tables) {
      try {
        const { data, error, count } = await db
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`❌ ${table}: Error - ${error.message}`);
        } else {
          console.log(`✅ ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.log(`❌ ${table}: Connection failed - ${err.message}`);
      }
    }

    console.log('✅ Migration validation completed');

  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
}

validateMigration();
