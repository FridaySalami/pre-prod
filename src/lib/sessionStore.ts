import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Initialize the store with null, but explicitly type it as Session | null
export const userSession = writable<Session | null>(null);

// Asynchronously load the initial session and update the store
async function initSession() {
  const { data: { session } } = await supabase.auth.getSession();
  userSession.set(session);
}

initSession();

// Listen for changes to the session and update the store accordingly
supabase.auth.onAuthStateChange((event, session) => {
  userSession.set(session);
});
