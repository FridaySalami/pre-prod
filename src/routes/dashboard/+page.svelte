<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import ShipmentChart from '$lib/ShipmentChart.svelte';

  // Start with session as undefined (unknown)
  let session: any = undefined;
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
  });

  onMount(() => {
    // Once we know the session, if it's null then redirect
    if (session === null) {
      goto('/login');
    }
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

{#if session === undefined}
  <div>Loading...</div>
{:else if session}
  <ShipmentChart />
{:else}
  <!-- When session is null, onMount should have redirected already -->
  <div>Redirecting...</div>
{/if}