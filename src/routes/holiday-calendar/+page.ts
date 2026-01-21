import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/holidays');
  const holidays = response.ok ? await response.json() : [];

  return {
    holidays
  };
};
