import { writable } from 'svelte/store';

export interface AIAssistantData {
  pageType: string;
  data: any;
  lastUpdated: Date;
}

export interface AIAssistantState {
  isVisible: boolean;
  currentData: AIAssistantData | null;
}

// Create the store
function createAIAssistantStore() {
  const { subscribe, set, update } = writable<AIAssistantState>({
    isVisible: false,
    currentData: null
  });

  return {
    subscribe,
    // Show the assistant
    show: () => update(state => ({ ...state, isVisible: true })),
    // Hide the assistant
    hide: () => update(state => ({ ...state, isVisible: false })),
    // Update the current page data
    updateData: (pageType: string, data: any) => update(state => ({
      ...state,
      currentData: {
        pageType,
        data,
        lastUpdated: new Date()
      }
    })),
    // Clear data when leaving a page
    clearData: () => update(state => ({ ...state, currentData: null })),
    // Toggle visibility
    toggle: () => update(state => ({ ...state, isVisible: !state.isVisible }))
  };
}

export const aiAssistantStore = createAIAssistantStore();
