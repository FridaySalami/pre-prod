<script lang="ts">
  import { onMount } from 'svelte';
  
  let status = 'idle';
  let error: string | null = null;
  let result: any = null;
  
  // Test our complete API endpoint
  async function testCompleteAuth() {
    status = 'loading';
    error = null;
    result = null;
    
    try {
      // Making a POST request to our endpoint
      const response = await fetch('/api/linnworks-test/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        status = 'error';
        error = data.error || `Error ${response.status}`;
        result = data; // Still save the result for debugging
      } else {
        status = 'success';
        result = data;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
    }
  }
  
  // Test direct token auth
  async function testDirectAuth() {
    status = 'loading';
    error = null;
    result = null;
    
    try {
      const response = await fetch('/api/linnworks-test/direct', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        status = 'error';
        error = data.error || `Error ${response.status}`;
        result = data; // Still save the result for debugging
      } else {
        status = 'success';
        result = data;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Test Swagger Documentation Approach
  async function testSwaggerMethod() {
    status = 'loading';
    error = null;
    result = null;
    
    try {
      const response = await fetch('/api/linnworks-test/swagger', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        status = 'error';
        error = data.error || `Error ${response.status}`;
        result = data;
      } else {
        status = 'success';
        result = data;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Test Correct Auth Parameters
  async function testAuthCorrect() {
    status = 'loading';
    error = null;
    result = null;
    
    try {
      const response = await fetch('/api/linnworks-test/auth-correct', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        status = 'error';
        error = data.error || `Error ${response.status}`;
        result = data;
      } else {
        status = 'success';
        result = data;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="container">
  <h1>Linnworks API Test</h1>
  
  <div class="actions">
    <button on:click={testCompleteAuth} disabled={status === 'loading'}>
      {status === 'loading' ? 'Testing...' : 'Test Complete Auth Flow'}
    </button>
    
    <button on:click={testDirectAuth} disabled={status === 'loading'}>
      {status === 'loading' ? 'Testing...' : 'Test Direct Auth'}
    </button>

    <button on:click={testSwaggerMethod} disabled={status === 'loading'}>
      {status === 'loading' ? 'Testing...' : 'Test Swagger Documentation Approach'}
    </button>

    <button on:click={testAuthCorrect} disabled={status === 'loading'}>
      {status === 'loading' ? 'Testing...' : 'Test Correct Auth Parameters'}
    </button>
  </div>
  
  <div class="status">
    Status: <span class={status}>{status}</span>
  </div>
  
  {#if error}
    <div class="error">
      <h3>Error</h3>
      <p>{error}</p>
    </div>
  {/if}
  
  {#if result}
    <div class="result">
      <h3>Result</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  
  button {
    padding: 10px 15px;
    background: #4a56e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:disabled {
    background: #a0a0a0;
    cursor: not-allowed;
  }
  
  .status {
    margin-bottom: 20px;
    font-weight: bold;
  }
  
  .idle {
    color: #6c757d;
  }
  
  .loading {
    color: #007bff;
  }
  
  .success {
    color: #28a745;
  }
  
  .error {
    color: #dc3545;
  }
  
  .error h3 {
    color: #dc3545;
  }
  
  .result {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 4px;
    overflow: auto;
  }
  
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>