<script lang="ts">
  // Fixed release information for this version.
  let appVersion = "1.0";
  let globalReleaseDate = "March 5, 2025";
</script>

<main class="release-notes">
  <header class="release-header">
    <h1>Release Notes</h1>
    <p class="global-release-date">Version {appVersion} | Release Date: {globalReleaseDate}</p>
  </header>
  
  <!-- Single container with a border around all release notes -->
  <div class="release-container">
    <section class="release-section">
      <h2>User Interface & Navigation</h2>
      <ul class="feature-list">
        <li>Redesigned header with improved layout and visual hierarchy</li>
        <li>Added new user profile dropdown menu with quick access to settings and logout</li>
        <li>Streamlined sidebar navigation by removing redundant items</li>
        <li>Updated icon set to use outlined Material Icons for a more modern look</li>
        <li>Fixed scrollbar issues in collapsed sidebar navigation</li>
        <li>Improved responsive design across all pages</li>
      </ul>
    </section>

    <section class="release-section">
      <h2>User Management</h2>
      <ul class="feature-list">
        <li>Implemented account settings page with profile, notification, and interface customization</li>
        <li>Added password change functionality with strength meter and real-time validation</li>
        <li>Created user profile view showing account information and activity</li>
        <li>Added toast notification system for improved user feedback</li>
        <li>Enhanced form validation and error handling throughout the application</li>
      </ul>
    </section>
    
    <section class="release-section">
      <h2>Operations Dashboard</h2>
      <ul class="feature-list">
        <li>Implemented an operational dashboard for tracking shipments, hours worked, and computed metrics</li>
        <li>Integrated Supabase for persistent data storage and real‑time updates</li>
        <li>Switched computed metrics (Shipments Per Hour, Defects DPMO, Order Accuracy) from summing to averaging values</li>
        <li>Updated previous week totals to calculate averages from previous week data, ensuring accurate WoW % changes</li>
        <li>Implemented inversion logic in WoW calculation for metrics where a decrease is positive</li>
        <li>Refactored data structures to enforce consistent type definitions</li>
        <li>Enhanced week navigation logic to correctly reload previous week data</li>
        <li>Removed note and flag functionality to streamline the interface</li>
        <li>Reduced cell sizes throughout the dashboard for a more compact layout</li>
        <li>Added CSV export functionality with comprehensive data</li>
        <li>Fixed naming consistency for metrics across all calculations</li>
        <li>Improved header display with weekday names above date formats</li>
        <li>Added tooltips for calculated fields showing formulas</li>
      </ul>
    </section>
    
    <section class="release-section">
      <h2>Kaizen Projects</h2>
      <ul class="feature-list">
        <li>Developed a Kanban board with columns: New Suggestions, Under Review, In Progress, and Completed</li>
        <li>Enabled drag‑and‑drop functionality with immediate updates via Supabase</li>
        <li>Introduced a side panel for project details with read‑only and edit modes</li>
        <li>Implemented project commenting system with author attribution and timestamps</li>
        <li>Added "thumbs up" reactions to help prioritize popular improvement ideas</li>
        <li>Created streamlined new project submission form with auto-filled user information</li>
        <li>Enhanced accessibility throughout with proper ARIA attributes, keyboard navigation, and screen reader support</li>
        <li>Implemented robust error handling with user-friendly notifications</li>
        <li>Added verification steps for database operations to ensure data consistency</li>
        <li>Optimized UI with smooth animations, intuitive controls, and responsive design</li>
        <li>Improved visual hierarchy with clear section organization and consistent typography</li>
        <li>Added support for project metadata including deadlines, owners, and detailed descriptions</li>
        <li>Implemented proper date formatting for improved readability</li>
      </ul>
    </section>

    <section class="release-section">
      <h2>Schedule Management</h2>
      <ul class="feature-list">
        <li>Created interactive employee scheduling system with monthly calendar view</li>
        <li>Implemented weekly recurring schedule patterns with intuitive checkbox interface</li>
        <li>Added role-based visual organization with color coding for different positions</li>
        <li>Developed employee management system with add/remove functionality</li>
        <li>Integrated real-time data persistence via Supabase database</li>
        <li>Implemented dynamic employee count indicators showing staffing levels for each day</li>
        <li>Created responsive, mobile-friendly calendar design that adapts to screen size</li>
        <li>Added month navigation for easy historical and future schedule viewing</li>
        <li>Implemented dual view system: Calendar View for visualization and Schedule Manager for pattern setup</li>
        <li>Enhanced accessibility with proper ARIA attributes and keyboard navigation</li>
        <li>Improved empty state handling with helpful prompts and clear user flow</li>
        <li>Created role-based ordering on calendar to display employees by position hierarchy</li>
        <li>Added employee leave management with visual indicators in the calendar</li>
        <li>Implemented single-day and date range leave request capabilities</li>
        <li>Added intelligent leave management that respects employee work schedules</li>
        <li>Created an employee leave modal with type selection and date controls</li>
        <li>Developed bulk leave request functionality for efficient time-off management</li>
        <li>Integrated leave status indicators with calendar view for visual feedback</li>
        <li>Added automatic employee count adjustments to exclude employees on leave</li>
        <li>Added error handling and loading states for smooth user experience</li>
        <li>Secured route with proper authentication protection matching application standards</li>
      </ul>
    </section>

    <section class="release-section">
      <h2>Performance & Security</h2>
      <ul class="feature-list">
        <li>Optimized database queries for faster dashboard loading</li>
        <li>Improved authentication flow with better session management</li>
        <li>Added input sanitization to prevent security vulnerabilities</li>
        <li>Enhanced error handling and logging throughout the application</li>
        <li>Improved Supabase integration for more efficient data synchronization</li>
      </ul>
    </section>
  </div>
  
  <footer class="release-footer">
    <p>By Jack Weston</p>
  </footer>
</main>

<style>
  .release-notes {
    max-width: 980px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    font-size: 0.95rem;
    line-height: 1.4;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  .release-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 0.25rem;
    color: #004225;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  
  .global-release-date {
    font-size: 0.9rem;
    color: #6B7280;
    font-weight: 400;
  }
  
  .release-container {
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 1.5rem 2rem;
    background-color: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  .release-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid #F3F4F6;
  }
  
  .release-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  
  h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
    color: #004225;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  
  .feature-list {
    list-style: none;
    padding-left: 0;
    margin: 0.25rem 0 0 0;
  }
  
  .feature-list li {
    margin-bottom: 0.4rem;
    line-height: 1.4;
    position: relative;
    padding-left: 1.5rem;
  }
  
  .feature-list li:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.45rem;
    height: 0.45rem;
    width: 0.45rem;
    background-color: #35b07b;
    border-radius: 50%;
  }
  
  .release-footer {
    text-align: right;
    font-size: 0.85rem;
    color: #6B7280;
    margin-top: 0.75rem;
    font-weight: 400;
  }
  
  /* Added spacing between individual list items for better readability */
  .feature-list li:last-child {
    margin-bottom: 0;
  }
  
  /* Slightly smaller container for better readability of single column content */
  @media (min-width: 768px) {
    .release-notes {
      font-size: 0.95rem;
    }
  }
  
  @media (max-width: 767px) {
    .release-container {
      padding: 1.25rem 1.5rem;
    }
    
    h2 {
      font-size: 1.3rem;
    }
    
    .feature-list li {
      margin-bottom: 0.5rem;
    }
  }
</style>