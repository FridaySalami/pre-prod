import { json } from '@sveltejs/kit';
import { uploadHistoryService } from '$lib/services/uploadHistoryService.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const fileType = url.searchParams.get('fileType') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const userId = url.searchParams.get('userId') || undefined;

    const result = await uploadHistoryService.getUploadHistory({
      limit,
      offset,
      fileType,
      status,
      userId
    });

    return json({
      success: true,
      records: result.records,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching upload history:', error);
    return json({
      success: false,
      error: 'Failed to fetch upload history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const daysOld = parseInt(url.searchParams.get('daysOld') || '90');
    const deletedCount = await uploadHistoryService.cleanupOldRecords(daysOld);

    return json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old upload records`
    });
  } catch (error) {
    console.error('Error cleaning up upload history:', error);
    return json({
      success: false,
      error: 'Failed to cleanup upload history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
