// src/lib/sessionStore.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { browser } from '$app/environment';
import type { Session } from '@supabase/supabase-js';

export const userSession = writable<Session | null | undefined>(undefined);

async function initSession() {
  const { data: { session } } = await supabase.auth.getSession();
  userSession.set(session);
}

if (browser) {
  initSession();
  supabase.auth.onAuthStateChange((event, session) => {
    userSession.set(session);
  });
}