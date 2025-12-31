// Server-side Supabase client for database operations
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase configuration");
}

// Client-side Supabase client (for auth and public operations)
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Server-side Supabase client with service key (for admin operations)
export const supabaseAdmin = PRIVATE_SUPABASE_SERVICE_KEY
  ? createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY)
  : supabase; // Fallback to regular client if service key not available

// Database client for server-side operations
export const db = supabaseAdmin;
