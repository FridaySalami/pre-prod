-- Create the dolphin_logs table
create table public.dolphin_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  level text check (level in ('INFO', 'WARN', 'ERROR', 'CRITICAL')) default 'INFO',
  event_type text not null, -- e.g., 'ORDER_PROCESSED', 'SCAN_MISMATCH', 'BARCODE_ASSIGNED'
  order_id text,            -- Link to specific Order ID (e.g., '511622')
  sku text,                 -- Link to specific Product SKU (e.g., 'WIDGET-001')
  duration_seconds integer, -- Time spent on the action (e.g., time to pack order)
  details jsonb,            -- Flexible JSON for extra data (Item Description, Error Messages, etc)
  user_id text              -- Optional: ID or Name of the packer
);

-- Enable Row Level Security (RLS)
alter table public.dolphin_logs enable row level security;

-- Policy: Allow anyone (Anon key) to INSERT logs
-- This allows the frontend/app to send logs directly.
create policy "Allow public insert to dolphin_logs"
on public.dolphin_logs for insert
with check (true);

-- Policy: Allow only authenticated/service users to SELECT/READ logs
-- This prevents the public from reading your business logs.
create policy "Allow service role to read dolphin_logs"
on public.dolphin_logs for select
using (auth.role() = 'service_role');

-- Create an index on frequently queried columns for dashboard performance
create index dolphin_logs_order_id_idx on public.dolphin_logs (order_id);
create index dolphin_logs_sku_idx on public.dolphin_logs (sku);
create index dolphin_logs_event_type_idx on public.dolphin_logs (event_type);
create index dolphin_logs_created_at_idx on public.dolphin_logs (created_at desc);
