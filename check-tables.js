// Check audit_log table structure without assuming column names
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkAuditLogStructure() {
  try {
    console.log('🔍 Checking audit_log table...\n');

    // Try to select everything without specifying columns
    const { data: recentLogs, error } = await supabase
      .from('audit_log')
      .select('*')
      .limit(3);

    if (error) {
      console.error('❌ Error fetching audit logs:', error);

      // Try buybox_data table instead to see if recent activity is there
      console.log('\n🔍 Checking buybox_data table for recent activity...');
      const { data: buyboxData, error: buyboxError } = await supabase
        .from('buybox_data')
        .select('*')
        .limit(5);

      if (!buyboxError && buyboxData.length > 0) {
        console.log('📋 Recent buybox_data entries:');
        buyboxData.forEach((entry, index) => {
          console.log(`\n${index + 1}. Columns:`, Object.keys(entry));
          if (entry.asin === 'B08BPBWV1C') {
            console.log('   ⭐ FOUND YOUR ASIN!');
            console.log('   Data:', JSON.stringify(entry, null, 2));
          }
        });
      }

      return;
    }

    if (recentLogs.length === 0) {
      console.log('⚠️ No entries found in audit_log table');
      return;
    }

    console.log('📋 Recent audit log entries:');
    recentLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. Columns:`, Object.keys(log));
      console.log('   Data:', JSON.stringify(log, null, 2));
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuditLogStructure();
