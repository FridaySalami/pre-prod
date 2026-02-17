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

      const processStream = async (url: string, prefix: string) => {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url);

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
                update(s => ({ ...s, status: `${prefix}: ${data.message}` }));
              } else if (data.type === 'progress') {
                update(s => ({
                  ...s,
                  progress: data.ordersProcessed || 0,
                  total: data.totalOrders || 0, // This might need adjustment if we chain
                  status: `${prefix}: ${data.message || `Processing... ${data.ordersProcessed}/${data.totalOrders}`}` // Fallback message
                }));
              } else if (data.type === 'error') {
                throw new Error(data.error);
              } else if (data.type === 'complete') {
                // Just log, don't finish global sync yet
                console.log(`${prefix} Complete: ${data.message}`);
                showToast(data.message, 'success');
              }
            }
          }
        }
      };

      try {
        // Step 1: Sync Orders
        await processStream(`/api/amazon/orders/sync?date=${date}&view=${view}`, 'Orders');

        // Step 2: Sync Items
        await processStream(`/api/amazon/orders/sync-items?date=${date}&view=${view}`, 'Items');

        const endTime = Date.now();
        update(s => {
          const duration = (endTime - s.startTime) / 1000;
          return {
            ...s,
            status: `All Syncs Complete! Took ${duration.toFixed(1)}s.`,
            duration
          };
        });

        // Stop timer
        if (durationTimer) {
          clearInterval(durationTimer);
          durationTimer = null;
        }

        setTimeout(() => {
          update(s => ({ ...s, syncing: false }));
        }, 2000);

      } catch (e: any) {
        showToast('Error syncing: ' + e.message, 'error');
        console.error('Sync error:', e);
        update(s => ({ ...s, status: 'Sync failed: ' + e.message, syncing: false }));
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
