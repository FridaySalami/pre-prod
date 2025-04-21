<script lang="ts">
  import { onMount } from 'svelte';
  
  // Define interfaces for our data structure
  interface RefundDetail {
    id: string;
    date: string;
    amount: number;
    reference?: string;
    customer?: string;
    productTitle?: string;  // Added for test data
  }
  
  interface RefundData {
    totalRefunds: number;
    refundsByDate: Record<string, number>;
    refundsDetails: RefundDetail[];
  }
  
  let loading = false;
  let error: string | null = null;
  let data: RefundData | null = null;
  
  // Use strings for date values to avoid Date object issues with date inputs
  let fromDateStr = getDateStringNDaysAgo(30);
  let toDateStr = getTodayDateString();
  
  // Helper functions for date handling
  function getTodayDateString(): string {
    const today = new Date();
    return formatDateString(today);
  }
  
  function getDateStringNDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return formatDateString(date);
  }
  
  function formatDateString(date: Date): string {
    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  }
  
  // Helper function to safely format display dates
  function formatDisplayDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    
    try {
      // Try to parse the date string
      const date = new Date(dateStr);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateStr);
        return 'Invalid Date';
      }
      
      return date.toLocaleDateString();
    } catch (err) {
      console.error('Error parsing date:', dateStr, err);
      return 'Error';
    }
  }
  
  async function fetchRefundData(): Promise<void> {
    try {
      loading = true;
      error = null;
      
      // Use the string values directly instead of Date objects
      const from = `${fromDateStr}T00:00:00`;
      const to = `${toDateStr}T23:59:59`;
      
      console.log(`Fetching refunds from ${from} to ${to}`);
      
      // Updated to use our new API endpoint
      const response = await fetch(`/api/linnworks/refunds?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const rawData = await response.json();
      console.log('Raw API response:', rawData);
      
      // Check for API error
      if (rawData.error) {
        throw new Error(rawData.error);
      }
      
      // Validate expected structure before assigning
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid data structure returned from API');
      }
      
      data = rawData as RefundData;
      
      console.log('Processed data:', data);
    } catch (err: unknown) {
      // Properly type the error
      if (err instanceof Error) {
        error = err.message;
      } else {
        error = String(err);
      }
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  async function fetchTestData(): Promise<void> {
    try {
      loading = true;
      error = null;
      
      // Use the string values directly instead of Date objects
      const from = `${fromDateStr}T00:00:00`;
      const to = `${toDateStr}T23:59:59`;
      
      console.log(`Fetching test data from ${from} to ${to}`);
      
      // Use the test endpoint
      const response = await fetch(`/api/linnworks/refunds-test?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const rawData = await response.json();
      console.log('Raw test API response:', rawData);
      
      // Check for API error
      if (rawData.error) {
        throw new Error(rawData.error);
      }
      
      data = rawData as RefundData;
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        error = err.message;
      } else {
        error = String(err);
      }
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    // Fetch test data on load to ensure something shows
    fetchTestData();
  });
</script>

<div class="container">
  <h1>Linnworks Refund Data Test Page</h1>
  
  <div class="date-controls">
    <label>
      From:
      <input 
        type="date" 
        bind:value={fromDateStr}
        max={toDateStr}
      />
    </label>
    
    <label>
      To:
      <input 
        type="date" 
        bind:value={toDateStr}
        min={fromDateStr} 
      />
    </label>
    
    <button on:click={fetchRefundData} disabled={loading}>
      {loading ? 'Loading...' : 'Fetch Real Data'}
    </button>
    
    <button on:click={fetchTestData} disabled={loading} class="secondary">
      {loading ? 'Loading...' : 'Use Test Data'}
    </button>
  </div>
  
  {#if error}
    <div class="error">
      <h3>Error</h3>
      <p>{error}</p>
    </div>
  {/if}

  {#if loading}
    <div class="loading">
      <p>Loading refund data...</p>
    </div>
  {/if}
  
  {#if data && !loading}
    <div class="results">
      <h3>Results</h3>
      <p>Total Refunds: {data.totalRefunds}</p>
      
      <h4>Refunds by Date</h4>
      {#if Object.keys(data.refundsByDate).length > 0}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.entries(data.refundsByDate) as [date, count]}
              <tr>
                <td>{formatDisplayDate(date)}</td>
                <td>{count}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p>No refunds found for the selected date range.</p>
      {/if}
      
      <h4>Recent Refunds</h4>
      {#if data.refundsDetails?.length > 0}
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Customer</th>
              <th>Amount</th>
              {#if data.refundsDetails[0].productTitle}
                <th>Product</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each data.refundsDetails.slice(0, 10) as refund}
              <tr>
                <td>{formatDisplayDate(refund.date)}</td>
                <td>{refund.reference || 'N/A'}</td>
                <td>{refund.customer || 'Unknown'}</td>
                <td>£{typeof refund.amount === 'number' ? refund.amount.toFixed(2) : '0.00'}</td>
                {#if refund.productTitle}
                  <td>{refund.productTitle}</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p>No refund details available</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .date-controls {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    align-items: center;
  }
  
  .error {
    background: #ffebee;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
  }
  
  .loading {
    background: #e3f2fd;
    padding: 15px;
    border-radius: 5px;
    margin-bottom: 20px;
    text-align: center;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  
  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }
  
  th {
    background: #f5f5f5;
  }

  button {
    padding: 10px 15px;
    background-color: #4a56e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    background-color: #a0a0a0;
    cursor: not-allowed;
  }
  
  button.secondary {
    background-color: #6c757d;
  }
  
  button.secondary:hover {
    background-color: #5a6268;
  }
</style>