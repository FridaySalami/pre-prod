import { writable, derived, get } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { browser } from '$app/environment';

export interface BasketItem {
  id: string;
  sku: string;
  asin: string;
  itemName?: string;
  currentPrice: number;
  targetPrice: number;
  priceChangeAmount?: number;
  marginAtTarget?: number;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  feedId?: string;
  submittedAt?: Date;
}

export interface HistoryItem extends BasketItem {
  status: 'completed' | 'failed' | 'cancelled';
  completedAt: Date;
  batchId?: string;
  feedId?: string;
}

export interface BatchHistoryRecord {
  id: string;
  user_email: string;
  item_count: number;
  feed_id: string | null;
  status: string;
  submitted_at: string;
  completed_at: string | null;
  source: string;
  total_price_change: number;
  items: any[];
  error_message: string | null;
}

export interface BasketSummary {
  totalItems: number;
  pendingItems: number;
  totalPriceChange: number;
  avgMarginImprovement: number;
  estimatedProcessingTime: number;
}

// Stores - Initialize with empty basket for production
export const basketItems = writable<BasketItem[]>([]);
export const historyItems = writable<HistoryItem[]>([]);
export const selectedItems = writable<Set<string>>(new Set());
export const isProcessing = writable<boolean>(false);
export const userEmail = writable<string>('jack@example.com');
export const showHistory = writable<boolean>(false);

// Derived stores
export const basketSummary = derived(basketItems, ($items): BasketSummary => {
  const pendingItems = $items.filter(item => item.status === 'pending');
  const totalPriceChange = pendingItems.reduce((sum, item) => sum + (item.priceChangeAmount || 0), 0);
  const avgMarginImprovement = pendingItems.length > 0
    ? pendingItems.reduce((sum, item) => sum + (item.marginAtTarget || 0), 0) / pendingItems.length
    : 0;

  return {
    totalItems: $items.length,
    pendingItems: pendingItems.length,
    totalPriceChange,
    avgMarginImprovement,
    estimatedProcessingTime: pendingItems.length * 2 // 2 seconds per item estimate
  };
});

export const activeItems = derived(basketItems, ($items) =>
  $items.filter(item => item.status === 'pending' || item.status === 'processing')
);

export const recentHistory = derived(historyItems, ($history) =>
  $history
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 20) // Show last 20 completed items
);

export const shortEmail = derived(userEmail, ($email): string => {
  if (!$email) return 'Guest';
  const [username] = $email.split('@');
  return `${username}@...`;
});

// Actions (mock implementations for UI)
export const basketActions = {
  addItem: (item: Omit<BasketItem, 'id' | 'createdAt'>) => {
    basketItems.update(items => [
      ...items,
      {
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date()
      }
    ]);
  },

  removeItem: (id: string) => {
    basketItems.update(items => items.filter(item => item.id !== id));
    selectedItems.update(selected => {
      selected.delete(id);
      return selected;
    });
  },

  updateItem: (id: string, updates: Partial<BasketItem>) => {
    basketItems.update(items =>
      items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  },

  clearBasket: () => {
    basketItems.set([]);
    selectedItems.set(new Set());
  },

  moveToHistory: (itemIds: string[]) => {
    basketItems.update(items => {
      const itemsToMove = items.filter(item => itemIds.includes(item.id));
      const remainingItems = items.filter(item => !itemIds.includes(item.id));

      // Add completed items to history
      historyItems.update(history => [
        ...history,
        ...itemsToMove.map(item => ({
          ...item,
          completedAt: new Date(),
          status: item.status as 'completed' | 'failed' | 'cancelled'
        }))
      ]);

      return remainingItems;
    });

    // Remove moved items from selection
    selectedItems.update(selected => {
      itemIds.forEach(id => selected.delete(id));
      return selected;
    });
  },

  clearHistory: () => {
    historyItems.set([]);
  },

  autoCleanupCompleted: () => {
    // Automatically move completed/failed items to history after a delay
    setTimeout(() => {
      basketItems.subscribe(items => {
        const completedIds = items
          .filter(item => item.status === 'completed' || item.status === 'failed')
          .map(item => item.id);

        if (completedIds.length > 0) {
          basketActions.moveToHistory(completedIds);
        }
      })();
    }, 3000); // 3 second delay to let user see the success
  },

  toggleSelection: (id: string) => {
    selectedItems.update(selected => {
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return selected;
    });
  },

  selectAll: () => {
    basketItems.subscribe(items => {
      const pendingIds = items
        .filter(item => item.status === 'pending')
        .map(item => item.id);
      selectedItems.set(new Set(pendingIds));
    })();
  },

  clearSelection: () => {
    selectedItems.set(new Set());
  },

  retryItem: (id: string) => {
    basketItems.update(items =>
      items.map(item =>
        item.id === id ? { ...item, status: 'pending' as const, errorMessage: undefined } : item
      )
    );
  },

  processSelected: async () => {
    isProcessing.set(true);

    // Process selected items immediately
    selectedItems.subscribe(selected => {
      basketItems.update(items =>
        items.map(item =>
          selected.has(item.id)
            ? { ...item, status: 'completed' as const }
            : item
        )
      );
    })();

    selectedItems.set(new Set());
    isProcessing.set(false);
  },

  submitChanges: async () => {
    isProcessing.set(true);

    try {
      // Get current state
      const currentBasketItems = get(basketItems);
      const currentSelectedItems = get(selectedItems);
      const currentUserEmail = get(userEmail);

      // Filter selected pending items
      const itemsToSubmit = currentBasketItems.filter(item =>
        currentSelectedItems.has(item.id) && item.status === 'pending'
      );

      if (itemsToSubmit.length === 0) {
        console.warn('No items selected for submission');
        isProcessing.set(false);
        return;
      }

      console.log(`🛒 Submitting ${itemsToSubmit.length} items to batch price update API`);

      // Mark items as processing
      basketItems.update(items =>
        items.map(item =>
          currentSelectedItems.has(item.id) && item.status === 'pending'
            ? { ...item, status: 'processing' as const }
            : item
        )
      );

      // Call the batch price update API
      const response = await fetch('/api/batch-price-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToSubmit.map(item => ({
            id: item.id,
            sku: item.sku,
            asin: item.asin,
            currentPrice: item.currentPrice,
            targetPrice: item.targetPrice,
            reason: item.reason
          })),
          userEmail: currentUserEmail
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Batch submission successful:', result);

        // Mark submitted items as completed
        basketItems.update(items =>
          items.map(item =>
            currentSelectedItems.has(item.id) && item.status === 'processing'
              ? {
                ...item,
                status: 'completed' as const,
                feedId: result.feedId,
                submittedAt: new Date()
              }
              : item
          )
        );

        // Auto-cleanup completed items after a delay
        basketActions.autoCleanupCompleted();

        // Show success notification (if toast function is available)
        if (typeof window !== 'undefined' && (window as any).showSuccessToast) {
          (window as any).showSuccessToast(
            'Batch Submitted Successfully',
            `${itemsToSubmit.length} price updates submitted to Amazon. Feed ID: ${result.feedId}`,
            8000
          );
        }

      } else {
        console.error('❌ Batch submission failed:', result);

        // Handle rate limiting
        if (result.code === 'RATE_LIMITED') {
          const waitMinutes = Math.ceil((result.waitTime || 0) / 60000);

          // Mark items back to pending
          basketItems.update(items =>
            items.map(item =>
              currentSelectedItems.has(item.id) && item.status === 'processing'
                ? {
                  ...item,
                  status: 'pending' as const,
                  errorMessage: `Rate limited. Wait ${waitMinutes} minutes.`
                }
                : item
            )
          );

          if (typeof window !== 'undefined' && (window as any).showWarningToast) {
            (window as any).showWarningToast(
              'Rate Limit Exceeded',
              `Please wait ${waitMinutes} minutes before submitting another batch. Amazon allows 5 submissions per 5 minutes.`,
              10000
            );
          }

        } else {
          // Mark items as failed
          basketItems.update(items =>
            items.map(item =>
              currentSelectedItems.has(item.id) && item.status === 'processing'
                ? {
                  ...item,
                  status: 'failed' as const,
                  errorMessage: result.error || 'Submission failed'
                }
                : item
            )
          );

          if (typeof window !== 'undefined' && (window as any).showErrorToast) {
            (window as any).showErrorToast(
              'Batch Submission Failed',
              result.error || 'Failed to submit price updates to Amazon',
              8000
            );
          }
        }
      }

    } catch (error) {
      console.error('❌ Batch submission error:', error);

      // Mark items as failed
      selectedItems.subscribe(currentSelectedItems => {
        basketItems.update(items =>
          items.map(item =>
            currentSelectedItems.has(item.id) && item.status === 'processing'
              ? {
                ...item,
                status: 'failed' as const,
                errorMessage: 'Network error during submission'
              }
              : item
          )
        );
      })();

      if (typeof window !== 'undefined' && (window as any).showErrorToast) {
        (window as any).showErrorToast(
          'Submission Error',
          'Network error occurred while submitting to Amazon',
          8000
        );
      }
    } finally {
      // Clear selection and stop processing
      selectedItems.set(new Set());
      isProcessing.set(false);
    }
  },

  deleteSelected: () => {
    selectedItems.subscribe(selected => {
      basketItems.update(items =>
        items.filter(item => !selected.has(item.id))
      );
    })();
    selectedItems.set(new Set());
  },

  loadHistoryFromSupabase: async () => {
    if (!browser) {
      console.log('📱 Not in browser, skipping history load');
      return; // Only run in browser
    }

    try {
      const currentUserEmail = get(userEmail);
      if (!currentUserEmail) {
        console.log('❌ No user email set, cannot load history');
        return;
      }

      console.log(`📊 Loading batch history from Supabase for user: ${currentUserEmail}`);

      // Fetch recent batch updates for the user
      const { data: batchHistory, error } = await supabase
        .from('batch_price_updates')
        .select('*')
        .eq('user_email', currentUserEmail)
        .order('submitted_at', { ascending: false })
        .limit(100); // Get last 100 batch submissions

      if (error) {
        console.error('❌ Error loading batch history:', error);
        return;
      }

      if (!batchHistory || batchHistory.length === 0) {
        console.log('📭 No batch history found for user');
        return;
      }

      console.log(`✅ Loaded ${batchHistory.length} batch records from Supabase`, batchHistory);

      // Convert batch records to history items
      const historyItemsFromDb: HistoryItem[] = [];

      batchHistory.forEach((batch: BatchHistoryRecord) => {
        if (batch.items && Array.isArray(batch.items)) {
          batch.items.forEach((item: any, index: number) => {
            historyItemsFromDb.push({
              id: `${batch.id}_${index}`,
              sku: item.sku || item.SKU || 'Unknown',
              asin: item.asin || item.ASIN || 'Unknown',
              itemName: item.itemName || item.name || 'Unknown Item',
              currentPrice: parseFloat(item.currentPrice || item.old_price || '0'),
              targetPrice: parseFloat(item.targetPrice || item.newPrice || item.new_price || '0'),
              priceChangeAmount: parseFloat(item.targetPrice || item.newPrice || '0') - parseFloat(item.currentPrice || item.old_price || '0'),
              marginAtTarget: 0, // Not stored in batch data
              reason: item.reason || 'Batch price update',
              status: batch.status === 'completed' ? 'completed' :
                batch.status === 'failed' ? 'failed' : 'completed',
              createdAt: new Date(batch.submitted_at),
              completedAt: new Date(batch.completed_at || batch.submitted_at),
              batchId: batch.id,
              feedId: batch.feed_id || undefined,
              submittedAt: new Date(batch.submitted_at)
            });
          });
        }
      });

      // Update the history store
      historyItems.set(historyItemsFromDb);
      console.log(`✅ Loaded ${historyItemsFromDb.length} individual price updates into history`);

    } catch (error) {
      console.error('❌ Error loading history from Supabase:', error);
    }
  },

  refreshHistory: async () => {
    await basketActions.loadHistoryFromSupabase();
  },

  testSupabaseConnection: async () => {
    if (!browser) return;

    try {
      console.log('🔍 Testing Supabase connection...');
      const { data, error } = await supabase
        .from('batch_price_updates')
        .select('count(*)')
        .limit(1);

      if (error) {
        console.error('❌ Supabase connection test failed:', error);
        return false;
      }

      console.log('✅ Supabase connection successful', data);
      return true;
    } catch (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
  }
};

// Auto-load history when the store initializes (browser only)
if (browser) {
  console.log('🚀 Initializing pricing basket store in browser');

  // Load history after a short delay to ensure everything is initialized
  setTimeout(() => {
    console.log('⏰ Auto-loading history from Supabase...');
    basketActions.loadHistoryFromSupabase();
  }, 1000);

  // Also load when user email changes
  userEmail.subscribe(($email) => {
    if ($email && $email !== 'jack@example.com') {
      console.log(`👤 User email changed to: ${$email}, reloading history`);
      setTimeout(() => {
        basketActions.loadHistoryFromSupabase();
      }, 500);
    }
  });
}
