// Supabase client that is safe to use in scripts (GitHub Actions, standalone tools)
// It uses only process.env and does not import any SvelteKit ($env, $lib) modules
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env locally
if (typeof process !== 'undefined') {
  dotenv.config();
}

const PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || '';
const PUBLIC_SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY || '';
const PRIVATE_SUPABASE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY || '';

if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
  // We throw only during actual usage, not module load
}

export const supabase = (PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
  : null as any;

export const supabaseAdmin = (PUBLIC_SUPABASE_URL && PRIVATE_SUPABASE_SERVICE_KEY)
  ? createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY)
  : supabase;

export const db = supabaseAdmin;
