<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
    
  // Define types for the view stats data
  interface ViewUser {
    Name: string;
    IsOwner: boolean;
    UserId: number;
    EmailAddress?: string;
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
    UserManagement?: UserManagement;
    OrderViewUserPreference?: OrderViewUserPreference;
    Owner?: ViewUser;
    IsCacheable: boolean;
  }
  
  // Get the view ID from the URL parameter
  const viewId = $page.params.viewId;
  
  // State - now properly typed
  let viewStats: ViewStat | null = null;
  let loading = false;
  let error: string | null = null;
  
  // Fetch view stats from our API endpoint
  async function fetchViewStats() {
    loading = true;
    error = null;
    
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
      
      // Find the specific view stats by ID
      const stats = data.viewStatsData || [];
      viewStats = stats.find((view: ViewStat) => view.ViewId.toString() === viewId);
      
      if (!viewStats) {
        throw new Error(`View with ID ${viewId} not found`);
      }
      
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
  <div class="mb-6">
    <a href="/dashboard/linnworks/view-stats" class="text-blue-500 hover:underline">
      &larr; Back to all views
    </a>
    <h1 class="text-2xl font-bold mt-2">
      {#if loading}
        Loading view information...
      {:else if viewStats}
        View: {viewStats.ViewName || `View #${viewId}`}
      {:else}
        View Details
      {/if}
    </h1>
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
  {:else if viewStats}
    <!-- View detailed information -->
    <div class="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div class="bg-gray-100 px-6 py-4">
        <h2 class="text-xl font-semibold">{viewStats.ViewName || `View #${viewId}`}</h2>
        <p class="text-gray-500">ID: {viewStats.ViewId}</p>
      </div>
      
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 class="text-lg font-semibold mb-4">Basic Information</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-gray-700">Total Orders:</span>
                <span class="font-medium text-blue-600">{viewStats.TotalOrders.toLocaleString()}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">System View:</span>
                <span class="font-medium">{viewStats.IsSystem ? 'Yes' : 'No'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">Location ID:</span>
                <span class="font-medium">{viewStats.LocationId}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">Cacheable:</span>
                <span class="font-medium">{viewStats.IsCacheable ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 class="text-lg font-semibold mb-4">Status Information</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-gray-700">Is Calculating:</span>
                <span class="font-medium">{viewStats.IsCalculating ? 'Yes' : 'No'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">View Exists:</span>
                <span class="font-medium">{viewStats.ViewExists ? 'Yes' : 'No'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">Last Requested:</span>
                <span class="font-medium">{formatDate(viewStats.LastRequested)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-700">Expires:</span>
                <span class="font-medium">{formatDate(viewStats.ExpiryDate)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Owner information -->
        {#if viewStats.Owner}
          <div class="mb-6 pb-6 border-b">
            <h3 class="text-lg font-semibold mb-4">Owner Information</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Name:</strong> {viewStats.Owner.Name}</p>
                {#if viewStats.Owner.EmailAddress}
                  <p><strong>Email:</strong> {viewStats.Owner.EmailAddress}</p>
                {/if}
              </div>
              <div>
                <p><strong>User ID:</strong> {viewStats.Owner.UserId}</p>
                <p><strong>Type:</strong> {viewStats.Owner.UserType}</p>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- User access information -->
        {#if viewStats?.UserManagement?.ViewUsers && viewStats.UserManagement.ViewUsers.length > 0}
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4">Users with Access</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Type</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Is Owner</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each viewStats.UserManagement.ViewUsers as user (user.UserId)}
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap">{user.Name}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{user.EmailAddress || 'N/A'}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{user.UserType}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{user.IsOwner ? 'Yes' : 'No'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
        
        <!-- Groups with access -->
        {#if viewStats?.UserManagement?.ViewGroups && viewStats.UserManagement.ViewGroups.length > 0}
          <div>
            <h3 class="text-lg font-semibold mb-4">Groups with Access</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group ID</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group Name</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each viewStats.UserManagement.ViewGroups as group (group.GroupId)}
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap">{group.GroupId}</td>
                      <td class="px-6 py-4 whitespace-nowrap">{group.Name || 'N/A'}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>