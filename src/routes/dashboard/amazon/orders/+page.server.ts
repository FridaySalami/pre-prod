import { db } from '$lib/supabaseServer';
import { fetchOrdersData } from '$lib/server/data-fetchers';

export async function load({ url }) {
  const dateParam = url.searchParams.get('date');
  const searchParam = url.searchParams.get('search');
  const viewParam = url.searchParams.get('view') || 'daily';

  // Calculate startDate based on params immediately so we can return it
  let startDate: Date;
  let endDate: Date;

  if (!searchParam) {
    if (dateParam) {
      const targetDate = new Date(dateParam);
      endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);

      if (viewParam === 'weekly') {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // 7 days inclusive
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(targetDate);
        startDate.setHours(0, 0, 0, 0);
      }
    } else {
      // Default to yesterday
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      endDate = new Date(yesterday);
      endDate.setHours(23, 59, 59, 999);

      if (viewParam === 'weekly') {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(yesterday);
        startDate.setHours(0, 0, 0, 0);
      }
    }
  }

  return {
    streamed: {
      orders: fetchOrdersData(startDate!, endDate!, searchParam!)
    },
    date: dateParam || (startDate! ? startDate!.toISOString().split('T')[0] : ''),
    search: searchParam || ''
  };
}

