// Server-side Supabase client for database operations
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Configuration from environment variables
// SvelteKit's $env/static/public and $env/dynamic/private are only available 
// within the SvelteKit runtime. For standalone scripts, we use process.env.

// Load .env file for standalone scripts if we are in a Node environment
if (typeof process !== 'undefined' && process.env) {
  dotenv.config();
}

// 1. Define variables with initial values from process.env (for scripts/CI)
let PUBLIC_SUPABASE_URL = (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_URL : '') || '';
let PUBLIC_SUPABASE_ANON_KEY = (typeof process !== 'undefined' ? process.env.PUBLIC_SUPABASE_ANON_KEY : '') || '';
let PRIVATE_SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' ? process.env.PRIVATE_SUPABASE_SERVICE_KEY : '') || '';

// 2. Wrap SvelteKit-specific imports in a way that doesn't break non-SvelteKit runtimes.
// We use a regular import here because Vite/SvelteKit expects them for bundling.
// To prevent tsx from failing, we would ideally use dynamic imports, but tsx still tries to resolve them.
// The real issue is that tsx sees the imports and tries to resolve $env.
// So we use a check and relative imports for the script to bypass this if needed, 
// OR we ensure the script context doesn't trigger the $env path.

// If we're NOT in a standalone script (detected by absence of certain process.env flags or presence of VITE),
// we can safely use the SvelteKit imports. 
// However, to keep it simple and working for BOTH:
import { PUBLIC_SUPABASE_URL as SVELTE_URL, PUBLIC_SUPABASE_ANON_KEY as SVELTE_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';

if (!PUBLIC_SUPABASE_URL) {
    PUBLIC_SUPABASE_URL = SVELTE_URL;
    PUBLIC_SUPABASE_ANON_KEY = SVELTE_KEY;
    PRIVATE_SUPABASE_SERVICE_KEY = env.PRIVATE_SUPABASE_SERVICE_KEY;
}

// Ensure the code doesn't fail immediately during bundling if keys aren't yet populated
const getClient = () => {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase configuration. URL or Anon Key is empty. Ensure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are set.");
  }
  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
};

// Client-side Supabase client (fallback for some logic)
export const supabase = (PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY) 
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
    : null as any;

// Server-side Supabase client with service key (for admin operations)
export const supabaseAdmin = (PUBLIC_SUPABASE_URL && PRIVATE_SUPABASE_SERVICE_KEY)
  ? createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY)
  : supabase; 

// Database client for server-side operations (aliased as 'db')
export const db = (PUBLIC_SUPABASE_URL && PRIVATE_SUPABASE_SERVICE_KEY)
  ? createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_KEY)
  : (PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY)
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
    : null as any;
