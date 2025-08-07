import { writable, derived } from 'svelte/store';

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
  errorMessage?: string;
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
export const selectedItems = writable<Set<string>>(new Set());
export const isProcessing = writable<boolean>(false);
export const userEmail = writable<string>('jack@example.com');

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

    // Process changes immediately
    selectedItems.subscribe(selected => {
      basketItems.update(items =>
        items.map(item =>
          selected.has(item.id) && item.status === 'pending'
            ? { ...item, status: 'completed' as const }
            : item
        )
      );
    })();

    selectedItems.set(new Set());
    isProcessing.set(false);
  },

  deleteSelected: () => {
    selectedItems.subscribe(selected => {
      basketItems.update(items =>
        items.filter(item => !selected.has(item.id))
      );
    })();
    selectedItems.set(new Set());
  }
};
