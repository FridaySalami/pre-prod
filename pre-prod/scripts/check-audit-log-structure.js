// Check audit_log table structure and recent entries
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkAuditLogStructure() {
  try {
    console.log('🔍 Checking audit_log table structure...\n');

    // Get recent entries to see the structure
    const { data: recentLogs, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching audit logs:', error);
      return;
    }

    if (recentLogs.length === 0) {
      console.log('⚠️ No entries found in audit_log table');
      return;
    }

    console.log('📋 Recent audit log entries:');
    recentLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. Entry at ${new Date(log.created_at).toLocaleString()}:`);
      console.log('   Columns:', Object.keys(log));
      console.log('   Data:', JSON.stringify(log, null, 2));
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuditLogStructure();
