<script lang="ts">
  import "../global.css";
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import { browser } from '$app/environment';
  import { supabase } from '$lib/supabaseClient';

  let session: any = null;
  let loggingOut = false;

  const unsubscribe = userSession.subscribe((s) => {
    session = s;
    // When on the client, if there is no session and we’re not in the process of logging out, redirect to /login.
    if (browser && !session && !loggingOut) {
      goto('/login');
    }
  });

  onDestroy(() => {
    unsubscribe();
  });

  async function handleLogout(event: Event) {
    event.preventDefault();
    loggingOut = true;
    console.log("Logout clicked");

    // Call Supabase sign-out.
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      loggingOut = false;
      return;
    }
    
    // Force a full page reload after a delay.
    setTimeout(() => {
      window.location.href = '/login';
    }, 1000);
  }
</script>

<header class="site-header">
  <div class="header-left">
    <h1>Parkers Foodservice Operational Dashboard</h1>
  </div>
  <div class="header-right">
    <span class="user-info">
      Logged in as <em>{session ? session.user.email : "Not logged in"}</em>
    </span>
  </div>
</header>

<div class="layout-wrapper">
  <!-- Collapsible Sidebar -->
  <aside class="sidebar">
    <nav>
      <ul>
        <li>
          <a href="/dashboard">
            <i class="material-icons menu-icon">dashboard</i>
            <span class="label">Dashboard</span>
          </a>
        </li>
        <li>
          <a href="/kaizen-projects">
            <i class="material-icons menu-icon">assignment</i>
            <span class="label">Kaizen Projects</span>
          </a>
        </li>
        <li>
          <a href="/reports">
            <i class="material-icons menu-icon">bar_chart</i>
            <span class="label">Reports</span>
          </a>
        </li>
        <li>
          <a href="/analytics">
            <i class="material-icons menu-icon">analytics</i>
            <span class="label">Analytics</span>
          </a>
        </li>
        <li>
          <a href="/settings">
            <i class="material-icons menu-icon">settings</i>
            <span class="label">Settings</span>
          </a>
        </li>
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
        <button on:click={handleLogout} type="button" class="logout-button">
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
    font-family: 'Roboto', sans-serif;
    background-color: #F9FAFB;
  }
  
  /* Header */
  .site-header {
    background: linear-gradient(90deg, #004225 0%, #006644 100%);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E5E7EB;
    height: 70px;
    color: #fff;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 1.8em;
    color: #fff;
  }
  
  .header-right .user-info {
    font-size: 0.8em;
    font-style: italic;
    color: #E0F2F1;
  }
  
  /* Sidebar */
  .sidebar {
    position: fixed;
    top: 70px;
    bottom: 0;
    left: 0;
    width: 60px;
    background-color: #fff;
    border-right: 1px solid #E5E7EB;
    overflow: hidden;
    transition: width 0.3s ease;
    z-index: 1000;
  }
  
  .sidebar:hover {
    width: 220px;
  }
  
  .sidebar nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .sidebar nav ul li {
    border-bottom: 1px solid #E5E7EB;
  }
  
  .sidebar nav ul li a {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    color: #343434;
    text-decoration: none;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .sidebar nav ul li a:hover {
    background-color: rgba(62, 207, 142, 0.2);
  }
  
  .menu-icon {
    font-size: 32px;
    margin-right: 8px;
    flex-shrink: 0;
  }
  
  .label {
    opacity: 0;
    transition: opacity 0.3s ease;
    white-space: nowrap;
  }
  
  .sidebar:hover .label {
    opacity: 1;
  }
  
  .sidebar-logout {
    border-top: 1px solid #E5E7EB;
    padding: 12px 0;
    margin-top: 16px;
    margin-bottom: 20px;
  }
  
  .logout-button {
    display: flex;
    align-items: center;
    padding: 12px;
    color: #343434;
    background: transparent;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    font-weight: 500;
    transition: background-color 0.2s ease;
    cursor: pointer;
  }
  
  .logout-button:hover {
    background-color: rgba(62, 207, 142, 0.2);
  }
  
  /* Main Content */
  .site-main {
    flex: 1;
    margin-left: 60px;
    padding: 24px;
    padding-top: 90px;
    background-color: #F9FAFB;
    transition: margin-left 0.3s ease;
  }
  
  /* Footer */
  .site-footer {
    background-color: #fff;
    border-top: 1px solid #E5E7EB;
    color: #6B7280;
    font-size: 0.8em;
    padding: 4px 24px;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 24px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  
  .site-footer p {
    margin: 0;
  }
  
  .footer-link {
    color: #004225;
    text-decoration: none;
    font-weight: 500;
  }
  
  .footer-link:hover {
    text-decoration: underline;
  }
  
  /* Logout overlay styles */
  .logout-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  }
  
  .logout-spinner {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #004225;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .logout-overlay p {
    margin-top: 1rem;
    font-size: 1.1rem;
    color: #004225;
  }
</style>