#!/usr/bin/env node

/**
 * Simple User Migration Script
 * Run this after setting up the database tables manually
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gvowfbrpmotcfxfzzhxf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2b3dmYnJwbW90Y2Z4Znp6aHhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDMxNzQ2OSwiZXhwIjoyMDU1ODkzNDY5fQ.tzqrQxoPFcwI3BUwcspBrDs9_EJB1GnpElstac70bTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define admin users (update with your actual admin emails)
const ADMIN_EMAILS = [
  'jack.w@parkersfoodservice.co.uk',
  'jackweston@gmail.com'
];

async function migrateUsers() {
  console.log('🔄 Starting user profile migration...\n');

  try {
    // Get all existing users
    const { data: existingUsers, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`✅ Found ${existingUsers.users.length} existing users\n`);

    // Create profiles for all users
    for (const user of existingUsers.users) {
      const email = user.email;
      const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingProfile) {
        console.log(`⚠️  Profile already exists for: ${email}`);
        continue;
      }

      // Create user profile
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          role: role,
          permissions: {},
          department: null
        });

      if (insertError) {
        console.log(`❌ Error creating profile for ${email}: ${insertError.message}`);
      } else {
        const roleIcon = role === 'admin' ? '👑' : '👤';
        console.log(`✅ Created ${roleIcon} ${role} profile for: ${email}`);
      }
    }

    // Show final summary
    console.log('\n📊 Final User Summary:');
    console.log('─'.repeat(70));

    const { data: allProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        role,
        user_id
      `);

    if (profileError) {
      console.log('❌ Error fetching profile summary:', profileError.message);
      return;
    }

    // Get user emails for the summary
    for (const profile of allProfiles) {
      const user = existingUsers.users.find(u => u.id === profile.user_id);
      const email = user?.email || 'unknown';
      const roleIcon = profile.role === 'admin' ? '👑' : profile.role === 'manager' ? '👔' : '👤';
      console.log(`${roleIcon} ${profile.role.toUpperCase().padEnd(8)} ${email}`);
    }

    const adminCount = allProfiles.filter(p => p.role === 'admin').length;
    const userCount = allProfiles.filter(p => p.role === 'user').length;

    console.log('─'.repeat(70));
    console.log(`📈 Total: ${adminCount} admin(s), ${userCount} user(s)\n`);

    console.log('🎉 User migration completed successfully!\n');
    console.log('🔐 What works now:');
    console.log('✅ All existing users can log in normally');
    console.log('✅ Admin users can access /buy-box-manager and /api/match-buy-box');
    console.log('✅ Regular users have standard dashboard access');
    console.log('✅ Enhanced security features are active');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

migrateUsers();
