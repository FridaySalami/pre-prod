// Server-side data loader for buy-box alerts
// Fetches current competitive state from Render PostgreSQL database

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    // Call our API endpoint that queries the database
    const response = await fetch('/api/buy-box-alerts/current-state');

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      alerts: data.alerts || [],
      lastUpdated: data.lastUpdated || new Date().toISOString(),
      stats: data.stats || {
        total: 0,
        critical: 0,
        high: 0,
        warning: 0,
        success: 0
      }
    };
  } catch (err) {
    console.error('Error loading buy-box alerts:', err);
    throw error(500, 'Failed to load buy-box alerts from database');
  }
};
