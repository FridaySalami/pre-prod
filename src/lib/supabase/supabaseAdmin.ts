// Server-side Supabase client with service role key for admin operations
import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY
} from '$env/static/public';
import { env } from '$env/dynamic/private';

const { PRIVATE_SUPABASE_SERVICE_KEY } = env;

// Use SvelteKit's environment variable system
const getSupabaseConfig = () => {
  if (browser) {
    throw new Error('supabaseAdmin should only be used on the server');
  }

  // Use SvelteKit static imports for environment variables
  const url = PUBLIC_SUPABASE_URL;
  const serviceKey = PRIVATE_SUPABASE_SERVICE_KEY;

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
