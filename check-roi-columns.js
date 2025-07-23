#!/usr/bin/env node
/**
 * Check if ROI margin calculation columns exist in buybox_data table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkROIColumns() {
  console.log('🔍 Checking if ROI margin calculation columns exist...\n');

  try {
    // Try to select the new ROI columns
    const { data, error } = await supabase
      .from('buybox_data')
      .select('current_margin_calculation, buybox_margin_calculation, total_investment_current, total_investment_buybox')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('column')) {
        console.log('❌ ROI margin calculation columns do NOT exist in the database.');
        console.log('\n📋 To add them, run this SQL in your Supabase SQL Editor:');
        console.log('   1. Go to your Supabase Dashboard > SQL Editor');
        console.log('   2. Copy and paste the contents of sql/add-roi-margin-columns.sql');
        console.log('   3. Run the migration');
        console.log('\n📁 Migration file location: sql/add-roi-margin-columns.sql');
        return false;
      } else {
        throw error;
      }
    }

    console.log('✅ ROI margin calculation columns exist in the database!');
    console.log('\n📊 Columns found:');
    console.log('   - current_margin_calculation (TEXT)');
    console.log('   - buybox_margin_calculation (TEXT)');
    console.log('   - total_investment_current (NUMERIC)');
    console.log('   - total_investment_buybox (NUMERIC)');

    // Check if there's any data in these columns
    const { data: dataWithROI, error: dataError } = await supabase
      .from('buybox_data')
      .select('id, sku, current_margin_calculation, buybox_margin_calculation')
      .not('current_margin_calculation', 'is', null)
      .limit(5);

    if (dataError) {
      console.warn('Warning: Could not check for existing ROI data:', dataError.message);
    } else if (dataWithROI && dataWithROI.length > 0) {
      console.log(`\n🎯 Found ${dataWithROI.length} records with ROI calculation data:`);
      dataWithROI.forEach(record => {
        console.log(`   SKU: ${record.sku} - ${record.current_margin_calculation}`);
      });
    } else {
      console.log('\n⚠️  Columns exist but no ROI calculation data found.');
      console.log('   Run a fresh buy box scan to populate the new fields.');
    }

    return true;

  } catch (error) {
    console.error('❌ Error checking ROI columns:', error.message);
    return false;
  }
}

checkROIColumns()
  .then(columnsExist => {
    if (columnsExist) {
      console.log('\n🚀 Ready to display ROI margin calculations on the Buy Box Manager page!');
    } else {
      console.log('\n🔧 Run the database migration first, then restart the render service.');
    }
  })
  .catch(console.error);
