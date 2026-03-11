<script lang="ts">
    import { createEventDispatcher } from 'svelte';
  
    export let inviteData: any;
    export let token: string;
  
    const dispatch = createEventDispatcher();
  
    let fullName = "";
    let password = ""; // if using password-based registration
  
    async function completeRegistration() {
      // Example: Call an endpoint to accept the invite and create the user.
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          fullName,
          password
        })
      });
      if (res.ok) {
        alert("Registration complete! Please log in.");
        // Redirect to login page.
        window.location.href = '/login';
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    }
  </script>
  
  <div class="invite-registration">
    <h2>Complete Your Registration</h2>
    <p>Welcome, {inviteData.email}!</p>
    <label for="fullName">Full Name:</label>
    <input id="fullName" type="text" bind:value={fullName} placeholder="Your full name" />
    <label for="password">Password:</label>
    <input id="password" type="password" bind:value={password} placeholder="Choose a password" />
    <button on:click={completeRegistration}>Register</button>
  </div>
  
  <style>
    .invite-registration {
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
      margin-bottom: 0.5rem;
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
  </style>