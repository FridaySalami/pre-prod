<script lang="ts">
  // Fixed release information for this version.
  let dashboardVersion = "1.0";
  let kaizenVersion = "1.0";
  let globalReleaseDate = "March 5, 2025";
</script>

<main class="release-notes">
  <header class="release-header">
    <h1>Release Notes</h1>
    <p class="global-release-date">Release Date: {globalReleaseDate}</p>
  </header>
  
  <!-- Single container with a border around all release notes -->
  <div class="release-container">
    <section class="release-section">
      <h2>Operations Dashboard</h2>
      <p class="section-version">Release Version: {dashboardVersion}</p>
      <ul>
        <li>Implemented an operational dashboard for tracking shipments, hours worked, and computed metrics.</li>
        <li>Integrated Supabase for persistent data storage and real‑time updates.</li>
        <li>Added editable notes functionality with inline comments via a side panel.</li>
        <li>UI enhancements including tighter spacing and improved responsiveness.</li>
        <!-- New release notes -->
        <li>Switched computed metrics (Shipments Per Hour, Defects DPMO, Order Accuracy) from summing to averaging values (with configurable options to ignore zeros and exclude Sundays).</li>
        <li>Updated previous week totals to calculate averages from previous week data, ensuring accurate week-over-week (WoW) % changes.</li>
        <li>Implemented inversion logic in WoW calculation for metrics where a decrease is positive (e.g. Hours Worked and Defects), with corresponding color adjustments.</li>
        <li>Refactored data structures to enforce consistent type definitions (always-defined values and metricField), eliminating TypeScript errors.</li>
        <li>Enhanced week navigation logic to correctly reload previous week data when cycling between weeks.</li>
      </ul>
    </section>
    
    <section class="release-section">
      <h2>Kaizen Projects</h2>
      <p class="section-version">Release Version: {kaizenVersion}</p>
      <ul>
        <li>Developed a Kanban board with columns: New Suggestions, Under Review, In Progress, and Completed.</li>
        <li>Enabled drag‑and‑drop functionality with immediate updates via Supabase.</li>
        <li>Introduced a side panel for project details with read‑only and edit modes.</li>
        <li>New project submissions are handled via a side panel form with support for comments and thumbs‑up reactions.</li>
        <li>UI tweaks to improve usability and provide a modern look.</li>
      </ul>
    </section>
  </div>
  
  <footer class="release-footer">
    <p>By Jack Weston</p>
  </footer>
</main>

<style>
  .release-notes {
    max-width: 1200px; /* Increased from 800px to 1000px */
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    font-size: 0.95rem;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  .release-header {
    text-align: center;
    margin-bottom: 2rem;
  }
  
  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #004225;
    font-weight: 500; /* Medium weight instead of bold */
    letter-spacing: -0.02em; /* Apple-like letter spacing */
  }
  
  .global-release-date {
    font-size: 0.9rem;
    color: #6B7280;
    font-weight: 400;
  }
  
  .release-container {
    border: 1px solid #E5E7EB;
    border-radius: 12px; /* More rounded corners like Apple */
    padding: 1.5rem 2rem; /* Increased horizontal padding from 1.5rem to 2rem */
    background-color: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  
  .release-section {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #F3F4F6;
  }
  
  .release-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #004225;
    font-weight: 500; /* Medium weight instead of bold */
    letter-spacing: -0.01em; /* Apple-like letter spacing */
  }
  
  .section-version {
    font-size: 0.9rem;
    color: #6B7280;
    margin-bottom: 1rem;
    text-align: left;
  }
  
  ul {
    list-style: none;
    padding-left: 0;
    margin: 0;
  }
  
  li {
    margin-bottom: 0.75rem;
    line-height: 1.5;
    position: relative;
    padding-left: 1.75rem;
  }
  
  li:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.5rem;
    height: 0.5rem;
    width: 0.5rem;
    background-color: #35b07b;
    border-radius: 50%;
  }
  
  .release-footer {
    text-align: right;
    font-size: 0.85rem;
    color: #6B7280;
    margin-top: 1rem;
    font-weight: 400;
  }
</style>