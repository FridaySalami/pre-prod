<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { onMount } from 'svelte';
  
    const dispatch = createEventDispatcher();
  
    let email = "";
    let expiration = ""; // in YYYY-MM-DD format (optional)
  
    async function submitInvite() {
      // Generate a random token on the client or leave that to the server
      // Here we'll let the server generate a token.
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          expires_at: expiration || new Date(new Date().setDate(new Date().getDate() + 7)).toISOString() // default to 7 days from now
        })
      });
      if (res.ok) {
        alert("Invite sent successfully!");
        email = "";
        expiration = "";
        dispatch("inviteCreated");
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
    }
  </script>
  
  <div class="invite-form">
    <h2>Send Invite</h2>
    <label for="email">Email:</label>
    <input id="email" type="email" bind:value={email} placeholder="user@example.com" />
    
    <label for="expiration">Expiration Date (optional):</label>
    <input id="expiration" type="date" bind:value={expiration} />
    
    <button on:click={submitInvite}>Send Invite</button>
  </div>
  
  <style>
    .invite-form {
      max-width: 400px;
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