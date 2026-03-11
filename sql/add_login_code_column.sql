-- Add login_code column to dolphin_users table
alter table public.dolphin_users 
add column if not exists login_code text;

-- Add unique constraint to ensure no duplicate login codes
alter table public.dolphin_users 
drop constraint if exists dolphin_users_login_code_key;

alter table public.dolphin_users 
add constraint dolphin_users_login_code_key unique (login_code);
