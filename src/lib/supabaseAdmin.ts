// Server-side Supabase client with service role key for admin operations
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  throw new Error("Missing Supabase server configuration");
}

// Create client with service role key - bypasses RLS
export const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
