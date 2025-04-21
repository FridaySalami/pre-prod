<script lang="ts">
  import { onMount } from 'svelte';

  // Define types for the view stats data
  interface ViewUser {
    Name: string;
    IsOwner: boolean;
    UserId: number;
    EmailAddress: string;
    UserType: string;
  }

  interface ViewGroup {
    GroupId: number;
    Name: string;
  }

  interface UserManagement {
    ViewId: number;
    ViewUsers: ViewUser[];
    ViewGroups: ViewGroup[];
  }

  interface OrderViewUserPreference {
    ViewId: number;
    IsVisible: boolean;
    Sequence: number;
  }

  interface ViewStat {
    ViewId: number;
    ViewName: string;
    IsSystem: boolean;
    TotalOrders: number;
    LocationId: string;
    ExpiryDate: string;
    IsCalculating: boolean;
    ViewExists: boolean;
    LastRequested: string;
    UserManagement: UserManagement;
    OrderViewUserPreference: OrderViewUserPreference;
    Owner: ViewUser;
    IsCacheable: boolean;
  }

  // State
  let viewStats: ViewStat[] = [];
  let loading = false;
  let error: string | null = null;
  let successMessage: string | null = null;

  // Fetch view stats from our API endpoint
  async function fetchViewStats() {
    loading = true;
    error = null;
    successMessage = null;
    
    try {
      const response = await fetch('/api/linnworks-test/view-stats');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
      
      viewStats = data.viewStatsData || [];
      successMessage = data.message;
      console.log('Fetched view stats:', viewStats);
    } catch (err) {
      console.error('Failed to fetch view stats:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }
  
  // Format date for display
  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  // Load data when component mounts
  onMount(fetchViewStats);
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Linnworks Order View Stats</h1>
    
    <button 
      on:click={fetchViewStats}
      class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      disabled={loading}
    >
      {loading ? 'Refreshing...' : 'Refresh Data'}
    </button>
  </div>

  <!-- Loading spinner -->
  {#if loading}
    <div class="flex justify-center py-8">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p class="mt-3">Loading data...</p>
      </div>
    </div>
  {:else if error}
    <!-- Error message -->
    <div class="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6">
      <p class="font-bold">Error:</p>
      <p>{error}</p>
    </div>
  {:else if successMessage}
    <!-- Success message -->
    <div class="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg mb-6">
      <p>{successMessage}</p>
    </div>
  {/if}

  <!-- View stats grid -->
  {#if viewStats && viewStats.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {#each viewStats as view}
        <div class="bg-white rounded-lg shadow-md overflow-hidden">
          <div class="bg-gray-100 px-4 py-3 border-b">
            <h2 class="text-lg font-semibold">{view.ViewName || 'Unnamed View'}</h2>
          </div>
          
          <div class="p-4">
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">View ID:</span>
              <span class="font-medium">{view.ViewId}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">Total Orders:</span>
              <span class="font-medium text-blue-600">{view.TotalOrders.toLocaleString()}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">System View:</span>
              <span class="font-medium">{view.IsSystem ? 'Yes' : 'No'}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">Currently Calculating:</span>
              <span class="font-medium">{view.IsCalculating ? 'Yes' : 'No'}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">Last Requested:</span>
              <span class="font-medium">{formatDate(view.LastRequested)}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">Expires:</span>
              <span class="font-medium">{formatDate(view.ExpiryDate)}</span>
            </div>
            
            <div class="mb-4 flex justify-between items-center">
              <span class="text-gray-700">Cacheable:</span>
              <span class="font-medium">{view.IsCacheable ? 'Yes' : 'No'}</span>
            </div>
            
            {#if view.Owner}
              <div class="mt-6 pt-4 border-t">
                <h3 class="text-md font-semibold mb-2">Owner</h3>
                <p>{view.Owner.Name}</p>
                {#if view.Owner.EmailAddress}
                  <p class="text-sm text-gray-500">{view.Owner.EmailAddress}</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else if !loading && !error}
    <p class="text-center py-8 text-gray-500">No view stats available.</p>
  {/if}
</div>

<style>
  /* Additional styling if needed */
</style>