import { supabaseAdmin } from '../supabaseAdmin.js';

export interface UploadRecord {
  id: string;
  session_id: string;
  file_type: 'inventory' | 'amazon_listings' | 'sage_reports' | 'linnworks_composition';
  file_name: string;
  file_size: number;
  total_records: number;
  processed_records: number;
  imported_records: number;
  updated_records: number;
  error_count: number;
  status: 'processing' | 'completed' | 'error' | 'cancelled';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  created_by?: string;
}

export class UploadHistoryService {

  /**
   * Create a new upload record
   */
  async createUploadRecord(record: Omit<UploadRecord, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('import_records')
      .insert({
        session_id: record.session_id,
        import_type: record.file_type,
        file_name: record.file_name,
        file_size: record.file_size,
        total_records: record.total_records,
        processed_records: record.processed_records,
        imported_records: record.imported_records,
        updated_records: record.updated_records,
        error_count: record.error_count,
        status: record.status,
        started_at: record.started_at,
        completed_at: record.completed_at,
        error_message: record.error_message,
        created_by: record.created_by
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating upload record:', error);
      throw new Error('Failed to create upload record');
    }

    return data.id;
  }

  /**
   * Update an upload record
   */
  async updateUploadRecord(sessionId: string, updates: Partial<UploadRecord>): Promise<void> {
    const updateData: any = {};

    if (updates.processed_records !== undefined) updateData.processed_records = updates.processed_records;
    if (updates.imported_records !== undefined) updateData.imported_records = updates.imported_records;
    if (updates.updated_records !== undefined) updateData.updated_records = updates.updated_records;
    if (updates.error_count !== undefined) updateData.error_count = updates.error_count;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.completed_at !== undefined) updateData.completed_at = updates.completed_at;
    if (updates.error_message !== undefined) updateData.error_message = updates.error_message;

    const { error } = await supabaseAdmin
      .from('import_records')
      .update(updateData)
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error updating upload record:', error);
      throw new Error('Failed to update upload record');
    }
  }

  /**
   * Get upload history with pagination
   */
  async getUploadHistory(options: {
    limit?: number;
    offset?: number;
    fileType?: string;
    status?: string;
    userId?: string;
  } = {}): Promise<{
    records: UploadRecord[];
    total: number;
  }> {
    const { limit = 50, offset = 0, fileType, status, userId } = options;

    let query = supabaseAdmin
      .from('import_records')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fileType) {
      query = query.eq('import_type', fileType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('created_by', userId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching upload history:', error);
      throw new Error('Failed to fetch upload history');
    }

    return {
      records: data || [],
      total: count || 0
    };
  }

  /**
   * Get upload statistics
   */
  async getUploadStats(userId?: string): Promise<{
    totalUploads: number;
    successfulUploads: number;
    failedUploads: number;
    totalRecordsProcessed: number;
    averageProcessingTime: number;
    recentActivity: UploadRecord[];
  }> {
    let query = supabaseAdmin
      .from('import_records')
      .select('*');

    if (userId) {
      query = query.eq('created_by', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching upload stats:', error);
      throw new Error('Failed to fetch upload stats');
    }

    const records = data || [];
    const totalUploads = records.length;
    const successfulUploads = records.filter(r => r.status === 'completed').length;
    const failedUploads = records.filter(r => r.status === 'error').length;
    const totalRecordsProcessed = records.reduce((sum, r) => sum + (r.processed_records || 0), 0);

    // Calculate average processing time for completed uploads
    const completedUploads = records.filter(r => r.status === 'completed' && r.started_at && r.completed_at);
    const averageProcessingTime = completedUploads.length > 0
      ? completedUploads.reduce((sum, r) => {
        const start = new Date(r.started_at).getTime();
        const end = new Date(r.completed_at!).getTime();
        return sum + (end - start);
      }, 0) / completedUploads.length
      : 0;

    // Get recent activity (last 10 uploads)
    const recentActivity = records
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 10);

    return {
      totalUploads,
      successfulUploads,
      failedUploads,
      totalRecordsProcessed,
      averageProcessingTime,
      recentActivity
    };
  }

  /**
   * Delete old upload records (cleanup)
   */
  async cleanupOldRecords(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabaseAdmin
      .from('import_records')
      .delete()
      .lt('started_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up old records:', error);
      throw new Error('Failed to cleanup old records');
    }

    return data?.length || 0;
  }
}

export const uploadHistoryService = new UploadHistoryService();
