<script lang="ts">
    // Set fixed release version numbers per section.
    let dashboardVersion = "1.0";
    let kaizenVersion = "1.0";
    // Optionally, you can also have a global release date if needed.
    let globalReleaseDate = "March 5, 2025";
  </script>
  
  <main class="release-notes">
    <header class="global-header">
      <h1>Release Notes</h1>
      <p class="global-release-date">Release Date: {globalReleaseDate}</p>
    </header>
    
    <section class="release-section">
      <h2>Dashboard</h2>
      <p class="section-version">Release Version: {dashboardVersion}</p>
      <ul>
        <li>Implemented an operational dashboard for tracking shipments, hours worked, and computed metrics.</li>
        <li>Integrated Supabase for persistent data storage and real‑time updates.</li>
        <li>Added editable notes functionality with inline comments.</li>
        <li>UI enhancements including tighter spacing and improved responsiveness.</li>
      </ul>
    </section>
    
    <section class="release-section">
      <h2>Kaizen Projects</h2>
      <p class="section-version">Release Version: {kaizenVersion}</p>
      <ul>
        <li>Developed a Kanban board with four columns: New Suggestions, Under Review, In Progress, and Completed.</li>
        <li>Enabled drag‑and‑drop functionality with immediate updates via Supabase.</li>
        <li>Introduced a side panel for project details with both read‑only and edit modes.</li>
        <li>New project submissions are handled via a side panel form, with support for comments and thumbs‑up reactions.</li>
        <li>UI tweaks to improve usability and provide a modern look.</li>
      </ul>
    </section>
    
    <footer class="release-footer">
      <p>Jack Weston</p>
    </footer>
  </main>
  
  <style>
    .release-notes {
      max-width: 800px;
      margin: 2rem auto;
      padding: 1rem;
      font-family: sans-serif;
      color: #333;
    }
    
    .global-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: #004225;
    }
    
    .global-release-date {
      font-size: 0.9rem;
      color: #555;
    }
    
    .release-section {
      margin-bottom: 2rem;
      padding: 1rem;
      border: 1px solid #eee;
      border-radius: 6px;
      background-color: #f9f9f9;
    }
    
    h2 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
      color: #004225;
    }
    
    .section-version {
      font-size: 0.9rem;
      color: #555;
      margin-bottom: 0.75rem;
      text-align: left;
    }
    
    ul {
      list-style: disc;
      padding-left: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }
    
    .release-footer {
      text-align: right;
      font-size: 0.8rem;
      font-style: italic;
      color: #666;
    }
  </style>