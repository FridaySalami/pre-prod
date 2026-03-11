// src/lib/toastStore.ts
import { writable } from 'svelte/store';

export const toastStore = writable({
  show: false,
  message: '',
  type: 'info',
});

export function showToast(message: string, type: string = 'info', duration: number = 5000) {
  toastStore.set({
    show: true,
    message,
    type,
  });
  
  setTimeout(() => {
    toastStore.update(toast => ({ ...toast, show: false }));
  }, duration);
}