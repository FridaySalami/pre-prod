<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  // Optionally, you can import goto, though using window.location.href works well to force a full reload.
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
    
    // Supabase automatically persists the session in localStorage.
    // Force a full reload to ensure the new session is applied.
    window.location.href = '/release-notes';
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
    margin: 3rem auto;
    padding: 1.5rem 2rem;
    border: 1px solid #E5E7EB;
    border-radius: 10px; /* More rounded corners like Apple */
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08);
    font-family: 'Roboto', sans-serif;
  }
  
  h1 {
    color: #1f2937;
    font-size: 1.5rem;
    font-weight: 500; /* Medium weight instead of bold */
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-align: center;
  }
  
  label {
    display: block;
    margin: 0.75rem 0 0.25rem;
    font-size: 0.9rem;
    color: #4B5563;
    font-weight: 500; /* Medium weight for labels */
  }
  
  input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-size: 0.95rem;
    transition: border 0.2s ease, box-shadow 0.2s ease;
  }
  
  input:focus {
    outline: none;
    border-color: #35b07b;
    box-shadow: 0 0 0 3px rgba(53, 176, 123, 0.15);
  }
  
  input::placeholder {
    color: #9CA3AF;
    font-size: 0.9rem;
  }
  
  button {
    width: 100%;
    background-color: #004225;
    color: #fff;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500; /* Medium weight */
    margin-top: 1rem;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  button:hover {
    background: #006339; /* Slightly darker on hover */
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }
  
  button:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  .error {
    color: #DC2626; /* Less harsh red */
    background-color: #FEF2F2; /* Light red background */
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    border-left: 3px solid #DC2626;
  }
  
  .spinner-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 300px;
    gap: 1rem;
  }
  
  .spinner {
    border: 4px solid rgba(0, 66, 37, 0.1);
    border-top: 4px solid #004225;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>