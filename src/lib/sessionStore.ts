// src/lib/sessionStore.ts
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Define the proper type for the session store
// It can be Session, null (logged out), or undefined (not yet loaded)
type SessionType = Session | null | undefined;

// Initialize with undefined to indicate "not yet loaded"
const initialValue: SessionType = browser ? undefined : null;

// Create the store with proper typing
export const userSession: Writable<SessionType> = writable(initialValue);

// Initialize the session if in browser
if (browser) {
  // Set up auth state listener
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event, session ? "session exists" : "no session");
    userSession.set(session);
  });
  
  // Initial session fetch
  initializeSession();
}

async function initializeSession() {
  try {
    console.log("Initializing session...");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      userSession.set(null);
      return;
    }
    
    userSession.set(data.session);
    console.log("Session initialized:", data.session ? "session exists" : "no session");
  } catch (err) {
    console.error("Error initializing session:", err);
    userSession.set(null);
  }
}