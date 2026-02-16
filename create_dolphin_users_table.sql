-- Create table for storing Dolphin scanner users
create table if not exists public.dolphin_users (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint dolphin_users_name_key unique (first_name, last_name)
);

-- Enable Row Level Security (RLS)
alter table public.dolphin_users enable row level security;

-- Create policy to allow all actions for authenticated users (adjust as needed for your auth model)
-- For now, allowing all operations for testing. In production, restrict based on roles.
create policy "Enable all access for authenticated users" on public.dolphin_users
  for all using (true) with check (true);
