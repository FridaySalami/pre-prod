import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { amazonFeedsRateLimiter } from '$lib/utils/rate-limiter';

export const GET: RequestHandler = async () => {
  const status = amazonFeedsRateLimiter.getStatus();

  return json({
    success: true,
    rateLimiter: {
      ...status,
      estimatedWaitTimeFormatted: formatWaitTime(status.estimatedWaitTime)
    }
  });
};

function formatWaitTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }

  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
