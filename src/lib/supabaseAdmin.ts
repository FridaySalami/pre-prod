// Server-side Supabase client with service role key for admin operations
import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Use runtime environment variables to avoid build-time dependency
const getSupabaseConfig = () => {
  if (browser) {
    throw new Error('supabaseAdmin should only be used on the server');
  }
  
  const url = process.env.PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration. Ensure PUBLIC_SUPABASE_URL and PRIVATE_SUPABASE_SERVICE_KEY are set.");
  }
  
  return { url, serviceKey };
};

// Create client with service role key - bypasses RLS
export const supabaseAdmin = (() => {
  const { url, serviceKey } = getSupabaseConfig();
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
})();
