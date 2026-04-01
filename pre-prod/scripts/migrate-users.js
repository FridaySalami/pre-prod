#!/usr/bin/env node

/**
 * User Profile Migration Script
 * 
 * This script creates user_profiles for all existing Supabase auth.users
 * and allows you to assign admin/manager/user roles.
 * 
 * Your existing users remain completely unchanged - we just add role management.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   PUBLIC_SUPABASE_URL');
  console.error('   PRIVATE_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Define which users should get admin/manager roles
// You can modify this based on email addresses or user IDs
const ROLE_ASSIGNMENTS = {
  // Example assignments - update these with your actual user emails/IDs
  admins: [
    'jack.w@parkersfoodservice.co.uk',
    'jackweston@gmail.com'
    // Add more admin emails here
  ],
  managers: [
    // Add manager emails here
    // 'manager@parkersfoodservice.co.uk'
  ]
  // Everyone else gets 'user' role by default
};

async function migrateUsers() {
  console.log('🔄 Starting user profile migration...\n');

  try {
    // 1. Get all existing users from auth.users
    console.log('📋 Fetching existing users...');

    const { data: existingUsers, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    console.log(`✅ Found ${existingUsers.users.length} existing users\n`);

    // 2. Check which users already have profiles
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id');

    if (profilesError && !profilesError.message.includes('does not exist')) {
      throw new Error(`Failed to check existing profiles: ${profilesError.message}`);
    }

    const existingProfileUserIds = new Set(
      (existingProfiles || []).map(p => p.user_id)
    );

    // 3. Create profiles for users who don't have them
    const usersNeedingProfiles = existingUsers.users.filter(
      user => !existingProfileUserIds.has(user.id)
    );

    console.log(`👥 Creating profiles for ${usersNeedingProfiles.length} users...\n`);

    for (const user of usersNeedingProfiles) {
      const email = user.email;

      // Determine role based on email
      let role = 'user'; // default
      if (ROLE_ASSIGNMENTS.admins.includes(email)) {
        role = 'admin';
      } else if (ROLE_ASSIGNMENTS.managers.includes(email)) {
        role = 'manager';
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
        console.log(`⚠️  Error creating profile for ${email}: ${insertError.message}`);
      } else {
        console.log(`✅ Created ${role} profile for: ${email}`);
      }
    }

    // 4. Summary of all users and their roles
    console.log('\n📊 User Role Summary:');
    console.log('─'.repeat(60));

    const { data: allProfiles } = await supabase
      .from('user_profiles')
      .select(`
        role,
        auth.users!inner(email)
      `);

    const roleCounts = { admin: 0, manager: 0, user: 0 };

    if (allProfiles) {
      allProfiles.forEach(profile => {
        const role = profile.role;
        const email = profile.users?.email || 'unknown';
        roleCounts[role]++;

        const roleIcon = role === 'admin' ? '👑' : role === 'manager' ? '👔' : '👤';
        console.log(`${roleIcon} ${role.toUpperCase().padEnd(8)} ${email}`);
      });
    }

    console.log('─'.repeat(60));
    console.log(`📈 Total: ${roleCounts.admin} admins, ${roleCounts.manager} managers, ${roleCounts.user} users\n`);

    console.log('🎉 User migration completed successfully!\n');

    console.log('🔐 What happens now:');
    console.log('✅ All existing users can still log in normally');
    console.log('✅ Admin users can access /buy-box-manager and /api/match-buy-box');
    console.log('✅ Manager users can access pricing reports');
    console.log('✅ Regular users have standard access');
    console.log('✅ Roles can be updated anytime in the user_profiles table');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nTo fix this:');
    console.error('1. Make sure the security schema is set up first');
    console.error('2. Run: node setup-security-database.js');
    console.error('3. Then run this script again');
    process.exit(1);
  }
}

// Function to update a specific user's role
async function updateUserRole(email, newRole) {
  console.log(`🔄 Updating role for ${email} to ${newRole}...`);

  const { data: user, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) throw new Error(userError.message);

  const targetUser = user.users.find(u => u.email === email);
  if (!targetUser) {
    console.log(`❌ User not found: ${email}`);
    return;
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('user_id', targetUser.id);

  if (updateError) {
    console.log(`❌ Failed to update role: ${updateError.message}`);
  } else {
    console.log(`✅ Successfully updated ${email} to ${newRole}`);
  }
}

// Command line interface
const command = process.argv[2];
const email = process.argv[3];
const role = process.argv[4];

if (command === 'update-role' && email && role) {
  updateUserRole(email, role);
} else if (command === 'migrate') {
  migrateUsers();
} else {
  console.log('🔄 User Profile Migration Tool\n');
  console.log('Usage:');
  console.log('  node migrate-users.js migrate              # Migrate all existing users');
  console.log('  node migrate-users.js update-role <email> <role>  # Update specific user role');
  console.log('');
  console.log('Examples:');
  console.log('  node migrate-users.js migrate');
  console.log('  node migrate-users.js update-role jack@company.com admin');
  console.log('  node migrate-users.js update-role user@company.com manager');
  console.log('');
  console.log('⚠️  Remember to update ROLE_ASSIGNMENTS in this script first!');
}
