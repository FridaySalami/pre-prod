<script lang="ts">
  import { onMount } from 'svelte';
  
  // Define types for schedule data
  interface Schedule {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'pending';
  }
  
  let schedules: Schedule[] = [];
  let loading = true;
  let error: string | null = null;
  
  // Fetch schedules data
  async function fetchSchedules() {
    try {
      loading = true;
      // Replace with your actual API endpoint
      const response = await fetch('/api/schedules');
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      schedules = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(error);
    } finally {
      loading = false;
    }
  }
  
  // Function to format date for display
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
  
  onMount(() => {
    fetchSchedules();
  });
</script>

<div class="container">
  <h1>Schedules</h1>
  
  {#if loading}
    <div class="loading">Loading schedules...</div>
  {:else if error}
    <div class="error">
      <p>Error loading schedules: {error}</p>
      <button on:click={fetchSchedules}>Retry</button>
    </div>
  {:else if schedules.length === 0}
    <div class="empty-state">
      <p>No schedules found.</p>
      <button>Create Schedule</button>
    </div>
  {:else}
    <div class="actions">
      <button>Add New Schedule</button>
      <input type="text" placeholder="Search schedules..." />
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each schedules as schedule (schedule.id)}
          <tr>
            <td>{schedule.title}</td>
            <td>{formatDate(schedule.startDate)}</td>
            <td>{formatDate(schedule.endDate)}</td>
            <td>
              <span class="status-badge status-{schedule.status}">
                {schedule.status}
              </span>
            </td>
            <td class="actions">
              <button class="edit">Edit</button>
              <button class="delete">Delete</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .container {
    padding: 1rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .loading, .error, .empty-state {
    padding: 2rem;
    text-align: center;
  }
  
  .error {
    color: crimson;
  }
  
  .actions {
    display: flex;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  
  th {
    background-color: #f2f2f2;
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: capitalize;
  }
  
  .status-active {
    background-color: #d1f7c4;
    color: #2e7d32;
  }
  
  .status-completed {
    background-color: #bbdefb;
    color: #1565c0;
  }
  
  .status-pending {
    background-color: #ffecb3;
    color: #f57f17;
  }
  
  .actions button {
    margin-right: 0.5rem;
    padding: 0.25rem 0.5rem;
  }
</style>
