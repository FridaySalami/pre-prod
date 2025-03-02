<script>
    // Global layout logic if needed.
  </script>
  
  <header class="site-header">
    <div class="header-left">
      <h1>Operational Dashboard</h1>
    </div>
    <div class="header-right">
      <span class="user-info">Logged in as <em>jackweston@gmail.com</em></span>
    </div>
  </header>
  
  <div class="layout-wrapper">
    <aside class="sidebar">
      <nav>
        <ul>
          <li>
            <a href="#" on:click|preventDefault>
              <!-- Dashboard Icon (example) -->
              <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
              </svg>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="#" on:click|preventDefault>
              <!-- Reports Icon (example) -->
              <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 00-4-4H3m13 6v2a4 4 0 004-4h-2m-4-4a4 4 0 00-4 4v2m4-2a4 4 0 014 4v2" />
              </svg>
              <span>Reports</span>
            </a>
          </li>
          <li>
            <a href="#" on:click|preventDefault>
              <!-- Analytics Icon (example) -->
              <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3h2m-1 0v18m-8-4h16" />
              </svg>
              <span>Analytics</span>
            </a>
          </li>
          <li>
            <a href="#" on:click|preventDefault>
              <!-- Settings Icon (example) -->
              <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3m0-6c1.657 0 3 1.343 3 3s-1.343 3-3 3m0-6v6m-4 0h8" />
              </svg>
              <span>Settings</span>
            </a>
          </li>
          <li>
            <a href="#" on:click|preventDefault>
              <!-- Help Icon (example) -->
              <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.257 14.658l.082-.38A2 2 0 0110 12h.01a2 2 0 011.846 1.342l.094.38M12 18h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
              </svg>
              <span>Help</span>
            </a>
          </li>
        </ul>
      </nav>
      <div class="sidebar-logout">
        <a href="#" on:click|preventDefault>
          <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          <span>Logout</span>
        </a>
      </div>
    </aside>
  
    <main class="site-main">
      <slot />
    </main>
  </div>
  
  <footer class="site-footer">
    <p>Created by Jack Weston | Powered by Svelte &amp; Supabase</p>
  </footer>
  
  <style>
    :global(body) {
      margin: 0;
      font-family: 'Roboto', sans-serif;
      background-color: #F9FAFB;
    }
    
    /* Header */
    .site-header {
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #E5E7EB;
    }
    
    .header-left h1 {
      margin: 0;
      font-size: 3em;
      color: #343434;
      text-align: left;
    }
    
    .header-right .user-info {
      font-size: 0.8em;
      font-style: italic;
      color: #6B7280;
    }
    
    /* Layout wrapper */
    .layout-wrapper {
      display: flex;
      min-height: calc(100vh - 70px);
    }
    
    /* Sidebar */
    .sidebar {
      width: 220px;
      background-color: #fff;
      border-right: 1px solid #E5E7EB;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
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
      margin-right: 8px;
      width: 16px;
      height: 16px;
    }
    
    .sidebar-logout {
  border-top: 1px solid #E5E7EB;
  padding: 12px 0 24px 0; /* Existing padding */
  margin-top: 16px;
  margin-bottom: 40px; /* Added extra bottom margin */
}    
    .sidebar-logout a {
      display: flex;
      align-items: center;
      padding: 12px;
      color: #343434;
      text-decoration: none;
      font-weight: 500;
      transition: background-color 0.2s ease;
      border: 1px solid #E5E7EB;
      border-radius: 4px;
    }
    
    .sidebar-logout a:hover {
      background-color: rgba(62, 207, 142, 0.2);
    }
    
    /* Main Content */
    .site-main {
      flex: 1;
      padding: 24px;
      background-color: #F9FAFB;
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
  </style>