<script lang="ts">
  import "../global.css";
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';
  import type { Session } from '@supabase/supabase-js';

  // Initialize session as undefined
  let session: any = undefined;
  let loggingOut = false;
  
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
    // Only redirect if the session has been determined (i.e., explicitly null) and not when it's still undefined.
    if (browser && session === null && !loggingOut) {
      goto('/login');
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
      console.log("Attempting to sign out with Supabase...");
      const { error } = await supabase.auth.signOut();
      
      // If we get a "session_not_found" error, we can still proceed with logout
      // as the user is effectively already logged out on the server
      if (error && error.code !== 'session_not_found') {
        console.error("Error signing out:", error);
        loggingOut = false;
        return;
      }
      
      if (error && error.code === 'session_not_found') {
        console.log("Session already expired or not found, continuing with logout");
      } else {
        console.log("Successfully signed out from Supabase");
      }
      
      // Manually set the session to null
      userSession.set(null);
      console.log("userSession store set to null");
      
      // Wait one second to show the logout spinner, then redirect
      console.log("Setting timeout for redirect...");
      setTimeout(() => {
        console.log("Redirecting to login page...");
        window.location.href = '/login';
      }, 1000);
    } catch (err) {
      console.error("Unexpected error during logout:", err);
      loggingOut = false;
    }
  }
</script>

<header class="site-header">
  <div class="header-left">
    <h1>Parkers Foodservice Operational Dashboard</h1>
  </div>
  <div class="header-right">
    {#if session}
      <span class="user-info">
        Logged in as <em>{session.user.email}</em>
      </span>
    {/if}
  </div>
</header>

<div class="layout-wrapper">
  <!-- Collapsible Sidebar -->
  <aside class="sidebar">
    <nav>
      <ul>
        <!-- Dashboard Link -->
        <li>
          <a href="/dashboard">
            <i class="material-icons menu-icon">dashboard</i>
            <span class="label">Dashboard</span>
          </a>
        </li>
        <!-- Kaizen Projects Link -->
        <li>
          <a href="/kaizen-projects">
            <i class="material-icons menu-icon">assignment</i>
            <span class="label">Kaizen Projects</span>
          </a>
        </li>
        <!-- Reports Link -->
        <li>
          <a href="/reports">
            <i class="material-icons menu-icon">bar_chart</i>
            <span class="label">Reports</span>
          </a>
        </li>
        <!-- Analytics Link -->
        <li>
          <a href="/analytics">
            <i class="material-icons menu-icon">analytics</i>
            <span class="label">Analytics</span>
          </a>
        </li>
        <!-- Settings Link -->
        <li>
          <a href="/settings">
            <i class="material-icons menu-icon">settings</i>
            <span class="label">Settings</span>
          </a>
        </li>
        <!-- Help Link -->
        <li>
          <a href="/help">
            <i class="material-icons menu-icon">help_outline</i>
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
          <i class="material-icons menu-icon">logout</i>
          <span class="label">Logout</span>
        </button>
      </div>
    {/if}
  </aside>

  <main class="site-main">
    <slot />
  </main>
</div>

<footer class="site-footer">
  <p>Created by Jack Weston | <a href="/release-notes" class="footer-link">Release notes</a></p>
</footer>

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
    background: linear-gradient(90deg, #004225 0%, #006644 100%);
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.06);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(0,0,0,0.1);
    height: 64px; /* Slightly reduced from 70px */
    color: #fff;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 1.5em; /* Slightly smaller */
    font-weight: 500; /* Medium weight instead of bold */
    color: #fff;
    letter-spacing: -0.02em; /* Apple-like letter spacing */
  }
  
  .header-right .user-info {
    font-size: 0.85em;
    font-style: normal; /* Apple typically doesn't use italics for UI */
    color: rgba(255, 255, 255, 0.9);
  }
  
  /* Collapsible Sidebar */
  .sidebar {
    position: fixed;
    top: 64px; /* Match reduced header height */
    bottom: 0;
    left: 0;
    width: 64px; /* Slightly increased from 60px */
    background-color: #fff;
    border-right: 1px solid #E5E7EB;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* Apple-like easing */
    z-index: 1000;
  }
  
  .sidebar:hover {
    width: 220px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); /* Add subtle shadow when expanded */
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
  
 /* .sidebar nav ul li a.active {
    border-left-color: #35b07b; Add indicator for active page 
    background-color: rgba(53, 176, 123, 0.05);
  }*/
  
  .menu-icon {
    font-size: 24px; /* Reduced from 32px */
    margin-right: 12px;
    color: #4B5563; /* Subtle gray for icons */
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
    margin-left: 64px; /* Match sidebar width */
    padding: 20px;
    padding-top: 10px; /* Reduced top padding */
    background-color: #F9FAFB;
    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Footer */
  .site-footer {
    background-color: #fff;
    border-top: 1px solid #E5E7EB;
    color: #6B7280;
    font-size: 0.8em;
    padding: 8px 24px;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 36px; /* Increased slightly for better tap targets */
    display: flex;
    justify-content: flex-end;
    align-items: center;
    z-index: 999; /* Ensure it stays above content but below modals */
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
</style>