<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';

  let email = '';
  let password = '';
  let errorMessage = '';
  let loading = false;

  async function handleLogin(event: Event) {
    event.preventDefault();
    errorMessage = '';
    loading = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error || !data.session) {
      errorMessage = error ? error.message : 'No session returned';
      loading = false;
      return;
    }
    
    // Update the session store automatically via Supabase's onAuthStateChange.
    // Force a full page reload to ensure all pages pick up the new session.
    window.location.href = '/dashboard';
  }
</script>

{#if loading}
  <div class="spinner-container">
    <div class="spinner"></div>
  </div>
{:else}
  <form on:submit|preventDefault={handleLogin} class="login-container">
    <h1>Login</h1>
    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
    <label for="email">Email:</label>
    <input id="email" type="email" bind:value={email} placeholder="you@example.com" required />

    <label for="password">Password:</label>
    <input id="password" type="password" bind:value={password} placeholder="Your password" required />

    <button type="submit">Login</button>
  </form>
{/if}

<style>
  .login-container {
    max-width: 400px;
    margin: 2rem auto;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }
  label {
    display: block;
    margin: 0.5rem 0 0.25rem;
  }
  input {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 1rem;
  }
  button {
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    opacity: 0.9;
  }
  .error {
    color: red;
    margin-bottom: 1rem;
  }
  .spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 300px;
  }
  .spinner {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #004225;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>