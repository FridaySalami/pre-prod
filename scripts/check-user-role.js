// Check user role for debugging
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function checkUserRole() {
  try {
    // Get user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }

    const jackUser = users.users.find(user => user.email === 'jackweston@gmail.com');

    if (!jackUser) {
      console.log('User not found');
      return;
    }

    console.log('User found:', {
      id: jackUser.id,
      email: jackUser.email,
      created_at: jackUser.created_at
    });

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', jackUser.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      console.log('No profile found - this is likely the issue!');

      // Let's see if the table exists and what profiles are there
      const { data: allProfiles, error: allError } = await supabase
        .from('user_profiles')
        .select('*');

      if (allError) {
        console.error('Error checking all profiles:', allError);
      } else {
        console.log('All existing profiles:', allProfiles);
      }

      return;
    }

    console.log('User profile:', profile);

    // Check what role is needed for each route
    console.log('\nRoute requirements:');
    console.log('- /buy-box-monitor requires: manager role');
    console.log('- /buy-box-manager requires: admin role');
    console.log(`- Your current role: ${profile.role || 'none'}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUserRole();
