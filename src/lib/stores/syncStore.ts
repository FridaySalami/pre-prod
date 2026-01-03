import { writable } from 'svelte/store';
import { showToast } from '$lib/toastStore';

interface SyncState {
  syncing: boolean;
  status: string;
  progress: number;
  total: number;
  startTime: number;
  duration: number;
}

const initialState: SyncState = {
  syncing: false,
  status: '',
  progress: 0,
  total: 0,
  startTime: 0,
  duration: 0
};

function createSyncStore() {
  const { subscribe, set, update } = writable<SyncState>(initialState);
  let durationTimer: ReturnType<typeof setInterval> | null = null;

  return {
    subscribe,
    startSync: async (date: string, view: string) => {
      update(s => ({ ...s, syncing: true, status: 'Starting sync...', progress: 0, total: 0, startTime: Date.now(), duration: 0 }));

      // Start timer
      if (durationTimer) clearInterval(durationTimer);
      durationTimer = setInterval(() => {
        update(s => ({ ...s, duration: (Date.now() - s.startTime) / 1000 }));
      }, 100);

      try {
        console.log(`Fetching /api/amazon/orders/sync?date=${date}&view=${view}...`);
        const response = await fetch(`/api/amazon/orders/sync?date=${date}&view=${view}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is null');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              console.log('Stream data:', data);

              if (data.type === 'status') {
                update(s => ({ ...s, status: data.message }));
              } else if (data.type === 'progress') {
                update(s => ({
                  ...s,
                  progress: data.ordersProcessed || 0,
                  total: data.totalOrders || 0,
                  status: `Syncing items... ${data.ordersProcessed}/${data.totalOrders} orders processed`
                }));
              } else if (data.type === 'complete') {
                const endTime = Date.now();
                update(s => {
                  const duration = (endTime - s.startTime) / 1000;
                  return {
                    ...s,
                    status: `Complete! Took ${duration.toFixed(1)}s. ${data.message}`,
                    duration
                  };
                });
                showToast(data.message, 'success');

                // Stop timer
                if (durationTimer) {
                  clearInterval(durationTimer);
                  durationTimer = null;
                }

                // Reset syncing state after a delay, but keep the message for a bit? 
                // Or just let the user see it. The original code reloaded the page.
                // We should probably emit an event or let the component decide to reload.
                // For now, we'll just set syncing to false after a short delay to allow the UI to show "Complete"
                setTimeout(() => {
                  update(s => ({ ...s, syncing: false }));
                  // We might want to trigger a reload if we are on the orders page.
                  // But since this is a global store, we can't easily access window.location.reload() 
                  // in a way that only affects the orders page if it's active.
                  // However, the original code did: setTimeout(() => window.location.reload(), 2000);
                  // We can dispatch a custom event or let the page subscribe to completion.
                }, 2000);
              } else if (data.type === 'error') {
                showToast('Error: ' + data.error, 'error');
                update(s => ({ ...s, status: 'Error: ' + data.error }));
              }
            }
          }
        }
      } catch (e) {
        showToast('Error syncing orders', 'error');
        console.error('Sync error:', e);
        update(s => ({ ...s, status: 'Sync failed', syncing: false }));
        if (durationTimer) {
          clearInterval(durationTimer);
          durationTimer = null;
        }
      }
    },
    reset: () => {
      set(initialState);
      if (durationTimer) {
        clearInterval(durationTimer);
        durationTimer = null;
      }
    }
  };
}

export const syncStore = createSyncStore();
