import { put, del } from '@vercel/blob';
import type {
  UploadResult,
  MultipleUploadResult,
  UploadOptions,
  FileToUpload,
} from '../../types/index.js';

export class StorageService {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  }

  async upload(
    file: Buffer | Blob,
    filename: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!this.enabled) {
      throw new Error('Blob storage not configured');
    }

    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());

    try {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: options.contentType ?? 'application/octet-stream',
        addRandomSuffix: options.addRandomSuffix !== false,
      });

      return {
        success: true,
        url: blob.url,
        size: buffer.length,
        contentType: blob.contentType,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async uploadMultiple(files: FileToUpload[], prefix = ''): Promise<MultipleUploadResult> {
    const uploads = files.map((file, index) => {
      const filename = prefix
        ? `${prefix}/${file.name ?? `file-${index}`}`
        : (file.name ?? `file-${index}`);
      return this.upload(file.buffer, filename, {
        contentType: file.contentType,
      });
    });

    const results = await Promise.all(uploads);

    return {
      success: results.every((r) => r.success),
      files: results,
      successful: results.filter((r) => r.success),
      failed: results.filter((r) => !r.success),
    };
  }

  async delete(url: string): Promise<{ success: boolean; error?: string }> {
    if (!this.enabled) {
      return { success: false, error: 'Blob storage not configured' };
    }

    try {
      await del(url);
      return { success: true };
    } catch (error) {
      console.error('Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteMultiple(
    urls: string[]
  ): Promise<{ success: boolean; successful: number; failed: number }> {
    const deletions = urls.map((url) => this.delete(url));
    const results = await Promise.all(deletions);

    return {
      success: results.every((r) => r.success),
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }

  generateFilename(prefix: string, extension: string, randomSuffix = true): string {
    const timestamp = Date.now();
    const random = randomSuffix ? `-${Math.random().toString(36).substring(2, 15)}` : '';
    return `${prefix}-${timestamp}${random}.${extension}`;
  }

  generatePath(type: string, jobId: string, filename: string): string {
    return `${type}/${jobId}/${filename}`;
  }
}

export const storage = new StorageService();
