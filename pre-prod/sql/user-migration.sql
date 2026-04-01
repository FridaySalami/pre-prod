-- User Migration SQL for Supabase Dashboard
-- Copy and paste this SQL into your Supabase SQL Editor

-- Step 1: Create user profiles for existing users
-- This will create profiles for all users who don't already have them

INSERT INTO user_profiles (user_id, role, permissions, department)
SELECT 
  u.id as user_id,
  CASE 
    WHEN u.email IN ('jack.w@parkersfoodservice.co.uk', 'jackweston@gmail.com') THEN 'admin'
    ELSE 'user'
  END as role,
  '{}' as permissions,
  NULL as department
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE up.user_id IS NULL;

-- Step 2: Verify the migration worked
-- This will show you all users and their assigned roles
SELECT 
  u.email,
  up.role,
  up.created_at,
  u.created_at as user_created_at
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id
ORDER BY up.role DESC, u.email;

-- Step 3: (Optional) Update specific user roles if needed
-- Uncomment and modify these lines to change specific user roles:

-- Make a specific user an admin:
-- UPDATE user_profiles 
-- SET role = 'admin' 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- Make a specific user a manager:
-- UPDATE user_profiles 
-- SET role = 'manager' 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'manager@example.com');

-- Step 4: View final role summary
SELECT 
  role,
  COUNT(*) as user_count
FROM user_profiles
GROUP BY role
ORDER BY 
  CASE role 
    WHEN 'admin' THEN 1 
    WHEN 'manager' THEN 2 
    WHEN 'user' THEN 3 
  END;
