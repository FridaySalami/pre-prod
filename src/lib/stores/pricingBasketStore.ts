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

// Mock data for UI development
const mockBasketItems: BasketItem[] = [
  {
    id: '1',
    sku: 'SKU001',
    asin: 'B0123456789',
    itemName: 'Premium Widget Pro - 24 Pack',
    currentPrice: 45.99,
    targetPrice: 42.50,
    priceChangeAmount: -3.49, // Decrease of £3.49
    marginAtTarget: 19.4,
    reason: 'Match buy box competitor',
    status: 'pending',
    createdAt: new Date('2025-08-06T10:30:00Z')
  },
  {
    id: '2',
    sku: 'SKU002',
    asin: 'B0987654321',
    itemName: 'Ultra Gadget Set',
    currentPrice: 89.99,
    targetPrice: 85.00,
    priceChangeAmount: -4.99, // Decrease of £4.99
    marginAtTarget: 18.2,
    reason: 'Undercut competitor by £0.01',
    status: 'pending',
    createdAt: new Date('2025-08-06T10:45:00Z')
  },
  {
    id: '3',
    sku: 'SKU003',
    asin: 'B0555666777',
    itemName: 'Essential Tools Bundle',
    currentPrice: 25.49,
    targetPrice: 23.99,
    priceChangeAmount: -1.50, // Decrease of £1.50
    marginAtTarget: 24.0,
    reason: 'Match Amazon buy box',
    status: 'processing',
    createdAt: new Date('2025-08-06T09:15:00Z')
  },
  {
    id: '4',
    sku: 'SKU004',
    asin: 'B0111222333',
    itemName: 'Professional Kit v2',
    currentPrice: 120.00,
    targetPrice: 115.99,
    priceChangeAmount: -4.01, // Decrease of £4.01
    marginAtTarget: 19.7,
    reason: 'Increase competitiveness',
    status: 'failed',
    createdAt: new Date('2025-08-06T08:20:00Z'),
    errorMessage: 'Rate limit exceeded, will retry'
  }
];

// Stores
export const basketItems = writable<BasketItem[]>(mockBasketItems);
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
    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));

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
    // Mock processing delay for submitting changes
    await new Promise(resolve => setTimeout(resolve, 2000));

    selectedItems.subscribe(selected => {
      basketItems.update(items =>
        items.map(item =>
          selected.has(item.id) && item.status === 'pending'
            ? { ...item, status: 'processing' as const }
            : item
        )
      );
    })();

    // Simulate completion after a delay
    setTimeout(() => {
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
    }, 3000);
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
