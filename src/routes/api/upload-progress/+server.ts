import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// This endpoint is deprecated. Use the new progress tracking system:
// - Progress tracking: /api/upload/progress/[sessionId]
// - Upload cancellation: /api/upload/cancel/[sessionId]
// - Upload history: /api/upload/history

export const GET: RequestHandler = async () => {
  return json({
    error: 'This endpoint is deprecated',
    message: 'Please use the new progress tracking endpoints',
    newEndpoints: {
      progress: '/api/upload/progress/[sessionId]',
      cancel: '/api/upload/cancel/[sessionId]',
      history: '/api/upload/history'
    }
  }, { status: 410 }); // 410 Gone
};

export const POST: RequestHandler = async () => {
  return json({
    error: 'This endpoint is deprecated',
    message: 'Please use the new progress tracking endpoints'
  }, { status: 410 });
};
