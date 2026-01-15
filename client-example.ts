/**
 * Media Compression API - TypeScript Client Example
 *
 * This example demonstrates how to use the Media Compression API
 * to compress images, videos, and audio files.
 */

import { createReadStream } from 'node:fs';
import type { JobStatus, JobResult } from './types/index.js';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL ?? 'https://your-domain.vercel.app';
const API_KEY = process.env.API_KEY ?? 'your_api_key';

// Types
interface CompressionResponse {
  success: boolean;
  jobId?: string;
  status?: JobStatus;
  estimatedTime?: string;
  message?: string;
  error?: string;
}

interface JobStatusResponse {
  success: boolean;
  jobId?: string;
  status?: JobStatus;
  type?: string;
  createdAt?: string;
  completedAt?: string;
  progress?: number;
  error?: string;
  results?: JobResult;
}

interface ImageCompressionOptions {
  qualities?: number[];
  thumbnails?: number[];
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
}

interface VideoCompressionOptions {
  qualities?: number[];
  thumbnails?: number;
  format?: 'mp4' | 'webm' | 'mov';
}

interface AudioCompressionOptions {
  bitrates?: number[];
  format?: 'mp3' | 'aac' | 'opus' | 'wav';
}

// Helper to convert stream to buffer
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
    opus: 'audio/opus',
    wav: 'audio/wav'
  };
  return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
}

// Helper to create form data with file
async function createFormDataWithFile(
  filePath: string,
  options: Record<string, unknown> = {}
): Promise<FormData> {
  const formData = new FormData();

  // Read file as blob
  const stream = createReadStream(filePath);
  const buffer = await streamToBuffer(stream);
  const blob = new Blob([buffer], {
    type: getMimeType(filePath)
  });

  formData.append('file', blob, filePath.split('/').pop() ?? 'file');

  // Add options
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  return formData;
}

/**
 * Compress an image file
 */
export async function compressImage(
  filePath: string,
  options: ImageCompressionOptions = {}
): Promise<CompressionResponse> {
  const formData = await createFormDataWithFile(filePath, options as Record<string, unknown>);

  const response = await fetch(`${API_BASE_URL}/api/compress/image`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  });

  return response.json() as Promise<CompressionResponse>;
}

/**
 * Compress a video file
 */
export async function compressVideo(
  filePath: string,
  options: VideoCompressionOptions = {}
): Promise<CompressionResponse> {
  const formData = await createFormDataWithFile(filePath, options as Record<string, unknown>);

  const response = await fetch(`${API_BASE_URL}/api/compress/video`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  });

  return response.json() as Promise<CompressionResponse>;
}

/**
 * Compress an audio file
 */
export async function compressAudio(
  filePath: string,
  options: AudioCompressionOptions = {}
): Promise<CompressionResponse> {
  const formData = await createFormDataWithFile(filePath, options as Record<string, unknown>);

  const response = await fetch(`${API_BASE_URL}/api/compress/audio`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY
    },
    body: formData
  });

  return response.json() as Promise<CompressionResponse>;
}

/**
 * Get the status of a compression job
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/jobs/status/${jobId}`, {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY
    }
  });

  return response.json() as Promise<JobStatusResponse>;
}

/**
 * Wait for a job to complete, polling at the specified interval
 */
export async function waitForJobCompletion(
  jobId: string,
  pollInterval = 5000
): Promise<JobStatusResponse> {
  let status = await getJobStatus(jobId);

  while (status.success && status.status !== 'completed' && status.status !== 'failed') {
    console.log(`Job ${jobId}: ${status.status} (${status.progress ?? 0}%)`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    status = await getJobStatus(jobId);
  }

  return status;
}

/**
 * Main example function
 */
async function main(): Promise<void> {
  try {
    console.log('Starting image compression...');

    const imageJob = await compressImage('./example-image.jpg', {
      qualities: [80, 60, 40],
      thumbnails: [200, 400],
      format: 'webp'
    });

    if (!imageJob.success || !imageJob.jobId) {
      console.error('Failed to queue image job:', imageJob.error);
      return;
    }

    console.log('Image job queued:', imageJob.jobId);
    console.log('Estimated time:', imageJob.estimatedTime);

    const imageResult = await waitForJobCompletion(imageJob.jobId);

    if (imageResult.success && imageResult.status === 'completed') {
      console.log('Image compression completed!');
      console.log('Results:', JSON.stringify(imageResult.results, null, 2));
    } else {
      console.error('Image compression failed:', imageResult.error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
