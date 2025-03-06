<script>
  import "../global.css";
  function handleLogout(event) {
    event.preventDefault();
    console.log("Logout clicked");
  }
</script>

<header class="site-header">
  <div class="header-left">
    <h1>Parkers Foodservice Operational Dashboard</h1>
  </div>
  <div class="header-right">
    <span class="user-info">
      Logged in as <em>jackweston@gmail.com</em>
    </span>
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
    <div class="sidebar-logout">
      <button on:click={handleLogout} type="button" class="logout-button">
        <i class="material-icons menu-icon">logout</i>
        <span class="label">Logout</span>
      </button>
    </div>
  </aside>

  <main class="site-main">
    <slot />
  </main>
</div>

<footer class="site-footer">
  <p>Created by Jack Weston | <a href="/" class="footer-link">Release notes</a></p>
</footer>

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
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #E5E7EB;
    height: 70px;
  }
  
  .header-left h1 {
    margin: 0;
    font-size: 2em;
    color: #343434;
  }
  
  .header-right .user-info {
    font-size: 0.8em;
    font-style: italic;
    color: #6B7280;
  }
  
  /* Collapsible Sidebar */
  .sidebar {
    position: fixed;
    top: 70px; /* Start below header */
    bottom: 0;
    left: 0;
    width: 60px; /* Collapsed width */
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
    margin-left: 60px; /* Reserve collapsed sidebar width */
    padding: 24px;
    padding-top: 90px; /* Ensure content is below header */
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
</style>