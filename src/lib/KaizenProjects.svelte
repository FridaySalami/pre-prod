<script lang="ts">
    import KanbanBoard from '$lib/KanbanBoard.svelte';
  </script>
  
  <div class="kaizen-projects-page">
    <h1>Kaizen Projects</h1>
    <!-- KanbanBoard includes the columns, cards, and side panel details -->
    <KanbanBoard />
  </div>
  
  <style>
    .kaizen-projects-page {
      padding: 16px;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 24px;
      font-size: 2em;
      color: #004225; /* Match your dashboard theme */
    }
  </style>