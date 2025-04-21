<script lang="ts">
  import { onMount } from 'svelte';
  
  let loading = false;
  let authStatus: 'unknown' | 'success' | 'failed' = 'unknown';
  let testResults = {
    auth: null as any,
    orders: null as any
  };
  let error: string | null = null;
  let fromDate = getISODateString(30); // 30 days ago
  let toDate = getISODateString(0);    // today
  
  // Helper function to get ISO date string for N days ago
  function getISODateString(daysAgo: number): string {
    const date = new Date();
    if (daysAgo > 0) {
      date.setDate(date.getDate() - daysAgo);
    }
    return date.toISOString().split('T')[0];
  }
  
  // Test auth
  async function testAuth() {
    loading = true;
    authStatus = 'unknown';
    error = null;
    
    try {
      const response = await fetch('/api/linnworks-test/auth');
      
      // Check if response is OK
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        
        // Handle HTML error pages
        if (contentType.includes('text/html')) {
          throw new Error(`Server error ${response.status}: HTML error page returned`);
        }
        
        // Try to get error text
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON but got ${contentType}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        authStatus = 'success';
        testResults.auth = data;
      } else {
        authStatus = 'failed';
        error = data.error || 'Authentication failed with unknown error';
      }
    } catch (err) {
      authStatus = 'failed';
      error = err instanceof Error ? err.message : String(err);
      console.error('Auth test error:', err);
    } finally {
      loading = false;
    }
  }
  
  // Test orders API
  async function testOrders() {
    loading = true;
    error = null;
    
    try {
      const from = `${fromDate}T00:00:00`;
      const to = `${toDate}T23:59:59`;
      
      const response = await fetch(`/dashboard?fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`);
      
      // Check if response is OK
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        
        // Handle HTML error pages
        if (contentType.includes('text/html')) {
          throw new Error(`Server error ${response.status}: HTML error page returned`);
        }
        
        // Try to get error text
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON but got ${contentType}`);
      }
      
      const data = await response.json();
      testResults.orders = data;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error('Orders test error:', err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    // Automatically run auth test on page load
    testAuth();
  });
</script>

<div class="container">
  <h1>Linnworks API Test Page</h1>
  
  <section class="test-section">
    <h2>Authentication Test</h2>
    <div class="card">
      <div class="actions">
        <button on:click={testAuth} disabled={loading}>
          {loading ? 'Testing...' : 'Test Authentication'}
        </button>
      </div>
      
      {#if authStatus === 'success'}
        <div class="result success">
          <h3>✓ Authentication Successful</h3>
          <ul>
            <li>Token received: {testResults.auth?.hasToken ? 'Yes' : 'No'}</li>
            <li>Server URL: {testResults.auth?.server || 'Not available'}</li>
            <li>Token expires in: {testResults.auth?.expires || 'Unknown'} seconds</li>
          </ul>
        </div>
      {:else if authStatus === 'failed'}
        <div class="result error">
          <h3>✗ Authentication Failed</h3>
          <p>{error}</p>
        </div>
      {:else}
        <div class="result pending">
          <p>Authentication status unknown. Run the test.</p>
        </div>
      {/if}
    </div>
  </section>
  
  <section class="test-section">
    <h2>Orders API Test</h2>
    <div class="card">
      <div class="date-controls">
        <label>
          From:
          <input type="date" bind:value={fromDate} max={toDate} />
        </label>
        
        <label>
          To:
          <input type="date" bind:value={toDate} min={fromDate} />
        </label>
      </div>
      
      <div class="actions">
        <button on:click={testOrders} disabled={loading || authStatus !== 'success'}>
          {loading ? 'Testing...' : 'Test Orders API'}
        </button>
        {#if authStatus !== 'success'}
          <p class="hint">Authentication must succeed before testing the Orders API</p>
        {/if}
      </div>
      
      {#if testResults.orders}
        <div class="result success">
          <h3>✓ Orders API Response</h3>
          <ul>
            <li>Total refunds: {testResults.orders.totalRefunds}</li>
            <li>Dates with refunds: {Object.keys(testResults.orders.refundsByDate || {}).length}</li>
            <li>Refund details: {testResults.orders.refundsDetails?.length || 0} records</li>
          </ul>
          
          {#if testResults.orders.refundsDetails?.length > 0}
            <h4>Sample Refunds</h4>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each testResults.orders.refundsDetails.slice(0, 5) as refund}
                  <tr>
                    <td>{new Date(refund.date).toLocaleDateString()}</td>
                    <td>{refund.reference || 'N/A'}</td>
                    <td>{refund.customer || 'Unknown'}</td>
                    <td>£{refund.amount.toFixed(2)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>
      {:else if error}
        <div class="result error">
          <h3>✗ Orders API Error</h3>
          <p>{error}</p>
        </div>
      {:else}
        <div class="result pending">
          <p>Run the test to see results.</p>
        </div>
      {/if}
    </div>
  </section>
  
  <section class="test-section">
    <h2>Raw Response Data</h2>
    <div class="card">
      <details>
        <summary>Authentication Response</summary>
        <pre>{JSON.stringify(testResults.auth, null, 2)}</pre>
      </details>
      
      <details>
        <summary>Orders API Response</summary>
        <pre>{JSON.stringify(testResults.orders, null, 2)}</pre>
      </details>
    </div>
  </section>
</div>

<style>
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  h1 {
    margin-bottom: 30px;
    color: #333;
  }
  
  .test-section {
    margin-bottom: 30px;
  }
  
  .card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .actions {
    margin-bottom: 20px;
  }
  
  button {
    background: #4a56e2;
    color: white;
    border: none;
    padding: 10px 15px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  button:disabled {
    background: #a0a0a0;
    cursor: not-allowed;
  }
  
  .date-controls {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }
  
  .date-controls input {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .result {
    padding: 15px;
    border-radius: 4px;
    margin-top: 15px;
  }
  
  .success {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    color: #155724;
  }
  
  .error {
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    color: #721c24;
  }
  
  .pending {
    background: #fff3cd;
    border: 1px solid #ffeeba;
    color: #856404;
  }
  
  pre {
    background: #f1f1f1;
    padding: 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  details {
    margin-top: 10px;
  }
  
  summary {
    cursor: pointer;
    padding: 10px 0;
    font-weight: bold;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
  }
  
  th, td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  
  th {
    background-color: #f2f2f2;
  }
  
  .hint {
    color: #6c757d;
    font-size: 0.9em;
    margin-top: 5px;
    margin-bottom: 0;
  }
</style>