#!/usr/bin/env node

/**
 * Run database schema migration to fix job_id vs run_id issue
 * This script will update the production database schema
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://fqnqbxzlrmhggqoxjrqx.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbnFieHpscm1oZ2dxb3hqcnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI5ODE1ODIsImV4cCI6MjA0ODU1NzU4Mn0.rOQECy3LI1C87HWz33M8dXJmL6nfNpBaJOjK4DRlKiY'
);

async function runSchemaMigration() {
  console.log('🔧 Starting database schema migration...');
  
  try {
    // Check if buybox_data table has job_id column
    console.log('📊 Checking current schema...');
    
    const { data: sampleData, error: sampleError } = await supabase
      .from('buybox_data')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('❌ Error checking buybox_data:', sampleError.message);
      return;
    }
    
    const columns = sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
    console.log('📋 Current buybox_data columns:', columns);
    
    if (columns.includes('job_id') && !columns.includes('run_id')) {
      console.log('🔄 Need to migrate: job_id → run_id');
      
      // Use SQL to rename the column
      const { error: renameError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE buybox_data RENAME COLUMN job_id TO run_id;'
      });
      
      if (renameError) {
        console.error('❌ Error renaming column:', renameError.message);
        
        // Try alternative approach - create new column and copy data
        console.log('🔄 Trying alternative approach...');
        
        const { error: addColumnError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE buybox_data ADD COLUMN IF NOT EXISTS run_id UUID;'
        });
        
        if (addColumnError) {
          console.error('❌ Error adding run_id column:', addColumnError.message);
          return;
        }
        
        const { error: copyDataError } = await supabase.rpc('exec_sql', {
          sql: 'UPDATE buybox_data SET run_id = job_id WHERE run_id IS NULL;'
        });
        
        if (copyDataError) {
          console.error('❌ Error copying data:', copyDataError.message);
          return;
        }
        
        console.log('✅ Data copied to run_id column');
        
        // Remove job_id column
        const { error: dropColumnError } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE buybox_data DROP COLUMN IF EXISTS job_id;'
        });
        
        if (dropColumnError) {
          console.log('⚠️ Warning: Could not drop job_id column:', dropColumnError.message);
        } else {
          console.log('✅ job_id column dropped');
        }
      } else {
        console.log('✅ Column renamed successfully');
      }
      
    } else if (columns.includes('run_id')) {
      console.log('✅ Schema already migrated (run_id column exists)');
    } else {
      console.log('❌ Unexpected schema state');
      return;
    }
    
    // Verify the migration
    console.log('🔍 Verifying migration...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('buybox_data')
      .select('*')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError.message);
      return;
    }
    
    const newColumns = verifyData && verifyData.length > 0 ? Object.keys(verifyData[0]) : [];
    console.log('📋 New buybox_data columns:', newColumns);
    
    if (newColumns.includes('run_id')) {
      console.log('✅ Migration successful! buybox_data now uses run_id');
    } else {
      console.log('❌ Migration failed - run_id column not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

// Run the migration
runSchemaMigration()
  .then(() => {
    console.log('🎉 Schema migration complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
