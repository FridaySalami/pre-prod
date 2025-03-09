<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { userSession } from '$lib/sessionStore';
  import KaizenProjects from '$lib/KanbanBoard.svelte';

  let session: any = null;
  const unsubscribe = userSession.subscribe((s) => {
    session = s;
  });

  onMount(() => {
    if (!session) {
      goto('/login');
    }
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<KaizenProjects />