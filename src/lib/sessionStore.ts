import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

async function getInitialSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export const userSession = writable(await getInitialSession());

supabase.auth.onAuthStateChange((event, session) => {
  userSession.set(session);
});