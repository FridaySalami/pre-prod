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
        <li>UI enhancements including tighter spacing and improved responsiveness. test</li>
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
    max-width: 800px;
    margin: 1rem auto;
    padding: 0.5rem;
    font-family: sans-serif;
    color: #333;
    font-size: 0.9rem;
  }
  
  .release-header {
    text-align: center;
    margin-bottom: 1rem;
  }
  
  h1 {
    font-size: 1.8rem;
    margin-bottom: 0.25rem;
    color: #004225;
  }
  
  .global-release-date {
    font-size: 0.8rem;
    color: #555;
  }
  
  .release-container {
    border: 1px solid #eee;
    border-radius: 6px;
    padding: 1rem;
    background-color: #f9f9f9;
  }
  
  .release-section {
    margin-bottom: 1rem;
  }
  
  .release-section:last-child {
    margin-bottom: 0;
  }
  
  h2 {
    font-size: 1.3rem;
    margin-bottom: 0.25rem;
    color: #004225;
  }
  
  .section-version {
    font-size: 0.8rem;
    color: #555;
    margin-bottom: 0.5rem;
    text-align: left;
  }
  
  ul {
    list-style: disc;
    padding-left: 1.5rem;
    margin: 0;
  }
  
  li {
    margin-bottom: 0.25rem;
    line-height: 1.3;
  }
  
  .release-footer {
    text-align: right;
    font-size: 0.75rem;
    font-style: italic;
    color: #666;
    margin-top: 0.5rem;
  }
</style>