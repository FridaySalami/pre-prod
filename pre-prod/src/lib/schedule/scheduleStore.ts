// src/lib/scheduleStore.ts
import { writable } from 'svelte/store';

// Create and export the store
export const scheduledHoursData = writable<Record<string, number>>({});

// Export the update function
export function updateScheduledHours(date: string, hours: number): void {
  scheduledHoursData.update(data => {
    const newData = { ...data };
    newData[date] = hours;
    return newData;
  });
}

// Export the date formatting function
export function getFormattedDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date provided to getFormattedDate');
    return '';
  }
  return date.toISOString().split('T')[0];
}

// Export the alias
export const formatDateKey = getFormattedDate;