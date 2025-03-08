<script lang="ts">
    import { onMount } from 'svelte';
    import InviteRegistration from '$lib/InviteRegistration.svelte';
  
    // Extract the token from the URL
    let token: string | null = null;
    let inviteValid = false;
    let inviteData: any = null;
    let loading = true;
    let errorMessage = '';
  
    onMount(async () => {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');
      if (!token) {
        errorMessage = "No invite token provided.";
        loading = false;
        return;
      }
      // Validate the token via your API
      const res = await fetch(`/api/invites/validate?token=${token}`);
      if (res.ok) {
        inviteData = await res.json();
        inviteValid = true;
      } else {
        const err = await res.json();
        errorMessage = err.error || "Invalid or expired invite token.";
      }
      loading = false;
    });
  </script>
  
  {#if loading}
    <p>Loading...</p>
  {:else if !inviteValid}
    <p>{errorMessage}</p>
  {:else}
    <!-- InviteRegistration handles the rest of the registration flow -->
    <InviteRegistration {inviteData} token={token!} />
  {/if}
  
  <style>
    /* Style as needed */
    p {
      text-align: center;
      font-size: 1.1em;
    }
  </style>