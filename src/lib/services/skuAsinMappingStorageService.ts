/**
 * Simplified SKU-ASIN Mapping Storage Service
 * Uses Supabase Storage for file uploads and metadata tracking
 */

import { supabaseAdmin } from '../supabaseAdmin';
import fs from 'fs';
import path from 'path';

export class SkuAsinMappingStorageService {
  private bucket = 'sku-asin-mapping';

  /**
   * Upload CSV file to Supabase Storage
   */
  async uploadFile(filePath: string, originalFileName: string): Promise<{
    success: boolean;
    fileId?: string;
    filePath?: string;
    error?: string;
  }> {
    try {
      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fs.statSync(filePath).size;

      // Generate unique filename
      const timestamp = Date.now();
      const extension = path.extname(originalFileName);
      const baseName = path.basename(originalFileName, extension);
      const uniqueFileName = `${baseName}-${timestamp}${extension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(uniqueFileName, fileBuffer, {
          contentType: 'text/csv',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Save metadata to database
      const { data: fileRecord, error: dbError } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .insert({
          filename: originalFileName,
          file_path: uploadData.path,
          file_size: fileSize,
          status: 'active'
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database save fails
        await supabaseAdmin.storage
          .from(this.bucket)
          .remove([uploadData.path]);
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      return {
        success: true,
        fileId: fileRecord.id,
        filePath: uploadData.path
      };

    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get list of uploaded files
   */
  async getFileList(): Promise<{
    success: boolean;
    files?: any[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .select('*')
        .order('upload_date', { ascending: false });

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      return {
        success: true,
        files: data || []
      };

    } catch (error) {
      console.error('Get files error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download file from Supabase Storage
   */
  async downloadFile(filePath: string): Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .download(filePath);

      if (error) {
        throw new Error(`Download failed: ${error.message}`);
      }

      const content = await data.text();
      return {
        success: true,
        content
      };

    } catch (error) {
      console.error('Download error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete file from storage and database
   */
  async deleteFile(fileId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get file record
      const { data: fileRecord, error: getError } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .select('file_path')
        .eq('id', fileId)
        .single();

      if (getError) {
        throw new Error(`File not found: ${getError.message}`);
      }

      // Delete from storage
      const { error: storageError } = await supabaseAdmin.storage
        .from(this.bucket)
        .remove([fileRecord.file_path]);

      if (storageError) {
        console.warn('Storage deletion warning:', storageError.message);
      }

      // Delete from database
      const { error: dbError } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        throw new Error(`Database deletion failed: ${dbError.message}`);
      }

      return { success: true };

    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear all files
   */
  async clearAllFiles(): Promise<{
    success: boolean;
    deleted?: number;
    error?: string;
  }> {
    try {
      // Get all files
      const { data: files, error: getError } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .select('file_path');

      if (getError) {
        throw new Error(`Query failed: ${getError.message}`);
      }

      if (files && files.length > 0) {
        // Delete from storage
        const filePaths = files.map(f => f.file_path);
        const { error: storageError } = await supabaseAdmin.storage
          .from(this.bucket)
          .remove(filePaths);

        if (storageError) {
          console.warn('Storage deletion warning:', storageError.message);
        }
      }

      // Delete from database
      const { error: dbError } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (dbError) {
        throw new Error(`Database deletion failed: ${dbError.message}`);
      }

      return {
        success: true,
        deleted: files?.length || 0
      };

    } catch (error) {
      console.error('Clear files error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file stats
   */
  async getStats(): Promise<{
    success: boolean;
    stats?: {
      totalFiles: number;
      totalSize: number;
      lastUpload?: string;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('sku_asin_mapping_files')
        .select('file_size, upload_date')
        .eq('status', 'active');

      if (error) {
        throw new Error(`Stats query failed: ${error.message}`);
      }

      const files = data || [];
      const totalSize = files.reduce((sum, file) => sum + (file.file_size || 0), 0);
      const lastUpload = files.length > 0 ?
        files.sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime())[0].upload_date :
        undefined;

      return {
        success: true,
        stats: {
          totalFiles: files.length,
          totalSize,
          lastUpload
        }
      };

    } catch (error) {
      console.error('Stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
