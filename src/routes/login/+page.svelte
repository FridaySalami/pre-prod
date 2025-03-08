<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  let email = "";
  let password = "";
  let errorMessage = "";

  async function handleLogin(event: Event) {
    event.preventDefault();
    errorMessage = "";
    console.log("Attempting login with:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    console.log("Login response:", data, error);

    if (error) {
      errorMessage = error.message;
      console.error('Login error:', error);
      return;
    }
    
    if (data.session) {
      console.log("Session token:", data.session.access_token);
      // Send the access token to our API endpoint to set a secure cookie.
      const response = await fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ access_token: data.session.access_token })
      });
      const respText = await response.text();
      console.log("Set-cookie response:", response.status, respText);
      if (!response.ok) {
        errorMessage = "Failed to set session cookie.";
        console.error("Failed to set session cookie, response:", respText);
        return;
      }
      console.log("Cookie set successfully. Redirecting to dashboard...");
      goto('/dashboard');
    } else {
      errorMessage = "Login failed: No session was returned.";
      console.error("Login failed: No session was returned.");
    }
  }
</script>

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
</style>