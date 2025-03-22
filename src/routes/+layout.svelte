<svelte:head>
  <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined" rel="stylesheet">
</svelte:head>

<script lang="ts">
  import "../global.css";
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';
  import type { Session } from '@supabase/supabase-js';
  import { toastStore } from '$lib/toastStore';

  // Initialize session as undefined
  let session: any = undefined;
  let loggingOut = false;
  
  // Toast notification system
  let toastVisible = false;
  let toastMessage = "";
  let toastType = "info"; // Can be: info, success, warning, error
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Function to show toast
  function showToast(message: string, type: string = "info", duration: number = 5000) {
    // Clear any existing timeout
    if (toastTimeout) clearTimeout(toastTimeout);
    
    // Set toast properties
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
      toastVisible = false;
    }, duration);
  }

  // Subscribe to the toast store
  toastStore.subscribe(toast => {
    toastVisible = toast.show;
    toastMessage = toast.message;
    toastType = toast.type;
  });

  const unsubscribe = userSession.subscribe((s) => {
    console.log("Session subscription triggered with:", s);
    
    // If we're in the process of logging out, always treat the session as null
    if (loggingOut) {
      session = null;
      console.log("In logout process, treating session as null");
    } else {
      session = s;
      console.log("Layout session updated:", session ? "session exists" : "no session or undefined");
    }
    
    // Redirect to login if session is null and we're not already logging out
    if (browser && session === null && !loggingOut && !window.location.pathname.includes('/login')) {
      console.log("Session is null, redirecting to login page");
      window.location.replace('/login'); // Use replace to prevent history issues
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function handleLogout(event: MouseEvent) {
    console.log("Logout function triggered");
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    
    loggingOut = true;
    console.log("loggingOut state set to true");

    try {
      // Create a flag to check if any auth operations succeeded
      let authCleared = false;
      
      // 1. Try the Supabase signOut method first
      console.log("Attempting to sign out with Supabase...");
      try {
        const { error } = await supabase.auth.signOut({
          scope: 'global' // This will invalidate all sessions for this user
        });
        
        if (!error) {
          console.log("Successfully signed out from Supabase");
          authCleared = true;
        } else {
          console.log("Error during Supabase signout:", error);
        }
      } catch (err) {
        console.log("Exception during Supabase signout:", err);
      }
      
      // 2. Clear all localStorage items related to Supabase
      console.log("Clearing localStorage items...");
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          if (key.includes('supabase') || key.includes('sb-')) {
            console.log(`Removing localStorage item: ${key}`);
            localStorage.removeItem(key);
            authCleared = true;
          }
        }
      }
      
      // 3. Clear all cookies
      console.log("Clearing cookies...");
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // 4. Explicitly set the session store to null
      userSession.set(null);
      console.log("userSession store set to null");
      
      // 5. Try to refresh the Supabase client to clear its internal state
      try {
        // @ts-ignore - Using internal API to refresh client state
        if (supabase.auth.refreshSession) {
          await supabase.auth.refreshSession();
          console.log("Refreshed Supabase session");
        }
      } catch (err) {
        console.log("Error refreshing session, continuing:", err);
      }
      
      // 6. Force a full page reload with a brief delay to allow for async operations to complete
      console.log("Setting timeout for reload...");
      setTimeout(() => {
        // Use window.location.replace instead of href to prevent caching issues
        console.log("Performing full page reload...");
        
        // Force browser to not use cache
        window.location.replace('/login?t=' + new Date().getTime());
      }, 1000);
    } catch (err) {
      console.error("Unexpected error during logout:", err);
      loggingOut = false;
    }
  }

</script>

<div class="app-container">
  <aside class="sidebar">
    <div class="sidebar-logo">
      <span class="app-icon">P</span>
    </div>
    <nav>
      <ul>
        <!-- Dashboard Link -->
        <li>
          <a href="/dashboard">
            <i class="material-icons-outlined menu-icon">dashboard</i>
            <span class="label">Dashboard</span>
          </a>
        </li>
        <!-- Kaizen Projects Link -->
        <li>
          <a href="/kaizen-projects">
            <i class="material-icons-outlined menu-icon">assignment</i>
            <span class="label">Kaizen Projects</span>
          </a>
        </li>
        <!-- Reports Link -->
        <li>
          <a href="/reports">
            <i class="material-icons-outlined menu-icon">bar_chart</i>
            <span class="label">Reports</span>
          </a>
        </li>
        <!-- Analytics Link -->
        <li>
          <a href="/analytics">
            <i class="material-icons-outlined menu-icon">analytics</i>
            <span class="label">Analytics</span>
          </a>
        </li>
        <!-- Settings Link -->
        <li>
          <a href="/settings">
            <i class="material-icons-outlined menu-icon">settings</i>
            <span class="label">Settings</span>
          </a>
        </li>
        <!-- Help Link -->
        <li>
          <a href="/help">
            <i class="material-icons-outlined menu-icon">help_outline</i>
            <span class="label">Help</span>
          </a>
        </li>
      </ul>
    </nav>
    {#if session}
      <div class="sidebar-logout">
        <button 
          on:click={handleLogout} 
          type="button" 
          class="logout-button">
          <i class="material-icons-outlined menu-icon">logout</i>
          <span class="label">Logout</span>
        </button>
      </div>
    {/if}
  </aside>

  <div class="content-wrapper">
    <header class="site-header">
      <div class="header-left">
        <h1>Parkers Foodservice</h1>
        <div class="header-divider"></div>
        <span class="header-subtitle">Operations Dashboard</span>
      </div>
      <div class="header-right">
        {#if session}
          <div class="user-badge">
            <i class="material-icons-outlined user-icon">account_circle</i>
            <span class="user-email">{session.user.email}</span>
          </div>
        {/if}
      </div>
    </header>

    <!-- Add below header -->
    <main class="site-main">
      <slot />
    </main>
    
    <footer class="site-footer">
      <p>Created by Jack Weston | <a href="/release-notes" class="footer-link">Release notes</a></p>
    </footer>
  </div>

  <!-- Add Toast Container Here -->
  <div id="toast-container" class:visible={toastVisible}>
    <div class="toast {toastType}">
      <span>{toastMessage}</span>
      <button on:click={() => toastVisible = false}>
        <i class="material-icons-outlined">close</i>
      </button>
    </div>
  </div>
</div>

{#if loggingOut}
  <div class="logout-overlay">
    <div class="logout-spinner"></div>
    <p>Logging out...</p>
  </div>
{/if}

<style>
  :global(*) {
    box-sizing: border-box;
  }
  
  :global(body) {
    margin: 0;
    font-family: 'SF Pro Display', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: #F9FAFB;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Header with gradient background */
  .site-header {
    background-color: white;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E5E7EB;
    height: 64px;
    color: #1F2937;
    position: sticky;
    top: 0;
    z-index: 999;
    width: 100%;
  }
  
  .header-left {
    display: flex;
    align-items: center;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 1.25em;
    font-weight: 600;
    color: #004225;
    letter-spacing: -0.01em;
  }
  
  .header-divider {
    height: 24px;
    width: 1px;
    background-color: #E5E7EB;
    margin: 0 16px;
  }
  
  .header-subtitle {
    color: #6B7280;
    font-size: 1.1em;
    font-weight: 400;
  }
  
  .user-badge {
    display: flex;
    align-items: center;
    background-color: #F3F4F6;
    padding: 8px 16px;
    border-radius: 24px;
    gap: 8px;
  }
  
  .user-icon {
    color: #4B5563;
    font-size: 20px;
  }
  
  .user-email {
    font-size: 0.85em;
    color: #4B5563;
    font-weight: 500;
  }
    
  /* Collapsible Sidebar */
  .sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: 64px;
    background-color: #fff;
    border-right: 1px solid #E5E7EB;
    /* Remove overflow: hidden; which is causing issues */
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Apple-like easing */
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }
  
  .sidebar:hover {
    width: 220px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Add subtle shadow when expanded */
  }
  
  .sidebar-logo {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid #F3F4F6;
  }

  .app-icon {
    width: 32px;
    height: 32px;
    background-color: #004225; /* Flat color instead of gradient */
    color: white;
    border-radius: 10px; /* Slightly more rounded */
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600; /* Slightly bolder */
    font-size: 18px;
    letter-spacing: 0.02em; /* Subtle letter spacing */
    box-shadow: 0 2px 4px rgba(0, 66, 37, 0.2); /* Subtle shadow */
  }

  .sidebar nav {
    flex: 1;
    /* Change from overflow-y: auto to overflow: hidden when collapsed */
    overflow: hidden;
  }
  
  .sidebar:hover nav {
    overflow-y: auto; /* Show scrollbar only when needed and hovered */
  }
  
  .sidebar nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .sidebar nav ul li {
    border-bottom: 1px solid #F3F4F6; /* Lighter border */
  }
  
  .sidebar nav ul li a {
    display: flex;
    align-items: center;
    padding: 12px 16px; /* Increased padding */
    color: #1F2937; /* Darker text */
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s ease;
    border-left: 3px solid transparent; /* For selected state indicator */
  }
  
  .sidebar nav ul li a:hover {
    background-color: rgba(53, 176, 123, 0.1); /* More subtle hover color */
  }
  
  .sidebar nav ul li a.active {
    border-left-color: #004225;
    background-color: rgba(0, 66, 37, 0.05);
  }
  
  .menu-icon {
    font-size: 22px; /* Slightly smaller */
    margin-right: 12px;
    color: #6B7280; /* Lighter gray for inactive */
    flex-shrink: 0;
  }
  
  .label {
    opacity: 0;
    transition: opacity 0.2s ease;
    white-space: nowrap;
    font-size: 0.9em;
  }
  
  .sidebar:hover .label {
    opacity: 1;
  }
  
  .sidebar-logout {
    border-top: 1px solid #E5E7EB;
    padding: 12px 8px; /* Reduced horizontal padding from 16px to 8px */
    margin-top: 16px;
    margin-bottom: 20px;
    width: 100%;
    overflow: hidden; /* Prevent content from overflowing */
  }
  
  .logout-button {
    display: flex;
    align-items: center;
    width: calc(100% - 2px); /* Account for border */
    padding: 10px 8px; /* Reduced horizontal padding from 12px to 8px */
    color: #1F2937;
    background: transparent;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-weight: 500;
    font-size: 0.9em;
    transition: all 0.2s ease;
    cursor: pointer;
    overflow: hidden; /* Prevent content from overflowing */
  }
  
  .logout-button:hover {
    background-color: rgba(239, 68, 68, 0.1); /* Subtle red for logout */
    border-color: rgba(239, 68, 68, 0.2);
    color: rgb(185, 28, 28);
  }
  
  .logout-button:hover .menu-icon {
    color: rgb(185, 28, 28);
  }
  
  /* Ensure menu icon is properly contained */
  .logout-button .menu-icon {
    font-size: 24px;
    margin-right: 12px;
    min-width: 24px; /* Ensure consistent width */
    text-align: center; /* Center the icon */
    color: #4B5563;
    flex-shrink: 0;
  }
  
  /* Main Content */
  .site-main {
    flex: 1;
    padding: 20px;
    padding-top: 10px; /* Reduced top padding */
    background-color: #F9FAFB;
    width: 100%; /* Takes full width of content-wrapper */
    margin-left: 0; /* Remove this as it's redundant with content-wrapper margin */
  }
  
  /* Footer */
  .site-footer {
    background-color: #fff;
    border-top: 1px solid #E5E7EB;
    color: #6B7280;
    font-size: 0.8em;
    padding: 8px 24px;
    height: 36px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    z-index: 999; /* Ensure it stays above content but below modals */
    width: 100%; /* Make sure it extends full width */
    position: sticky;
    bottom: 0;
  }
  
  .site-footer p {
    margin: 0;
  }
  
  .footer-link {
    color: #004225;
    text-decoration: none;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }
  
  .footer-link:hover {
    background-color: rgba(53, 176, 123, 0.1);
    text-decoration: none;
  }
  
  /* Logout overlay styles */
  .logout-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9); /* More opaque */
    backdrop-filter: blur(4px); /* Apple-like blur effect */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  }
  
  .logout-spinner {
    border: 4px solid rgba(0, 66, 37, 0.1); /* Thinner, more subtle spinner */
    border-top: 4px solid #004225;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .logout-overlay p {
    margin-top: 1rem;
    font-size: 1rem; /* Slightly smaller */
    font-weight: 500; /* Medium weight */
    color: #004225;
  }

  .app-container {
    display: flex;
    min-height: 100vh;
  }

  .content-wrapper {
    flex: 1;
    margin-left: 64px; /* Match sidebar width */
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    width: calc(100% - 64px); /* Ensure it takes up the remaining width */
  }

  /* Add these style tweaks to hide scrollbar when not needed */
  .sidebar nav::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .sidebar nav::-webkit-scrollbar-thumb {
    background-color: rgba(107, 114, 128, 0.3);
    border-radius: 4px;
  }

  /* Only show scrollbar on hover */
  .sidebar:not(:hover) nav::-webkit-scrollbar {
    display: none;
  }

  /* Toast notification system */
  #toast-container {
    position: fixed;
    bottom: 50px;
    right: 20px;
    z-index: 1500;
    max-width: 400px;
    min-width: 300px;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
    pointer-events: none;
  }

  #toast-container.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: all;
  }

  .toast {
    background-color: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9em;
    border-left: 4px solid #3B82F6; /* Default blue for info */
  }

  .toast.success {
    border-left-color: #10B981; /* Green for success */
  }

  .toast.warning {
    border-left-color: #F59E0B; /* Yellow for warning */
  }

  .toast.error {
    border-left-color: #EF4444; /* Red for error */
  }

  .toast button {
    background: transparent;
    border: none;
    color: #6B7280;
    cursor: pointer;
    padding: 4px;
    margin-left: 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast button:hover {
    background-color: #F3F4F6;
  }
</style>