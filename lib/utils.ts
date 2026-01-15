import formidable from 'formidable';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import type { ParsedFormData, ParsedFile, MediaType, ApiResponse } from '../types/index.js';

export async function parseFormData(request: Request): Promise<ParsedFormData> {
  const form = formidable({
    maxFileSize: config.maxFileSize,
    maxTotalFileSize: config.maxFileSize,
    keepExtensions: true,
    allowEmptyFiles: false,
  });

  return new Promise((resolve, reject) => {
    // @ts-expect-error - formidable expects IncomingMessage but works with Request
    form.parse(request, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          fields: fields as ParsedFormData['fields'],
          files: files as ParsedFormData['files'],
        });
      }
    });
  });
}

export function parseFileFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): ParsedFile {
  return {
    buffer,
    name: filename,
    type: mimeType,
    size: buffer.length,
  };
}

export function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'unknown';
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function getFileExtension(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? 'bin';
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
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
  wav: 'audio/wav',
};

export function getContentType(extension: string): string {
  return EXTENSION_TO_CONTENT_TYPE[extension.toLowerCase()] ?? 'application/octet-stream';
}

export function validateFileSize(size: number): boolean {
  if (size > config.maxFileSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${config.maxFileSize / 1024 / 1024}MB`
    );
  }
  return true;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function calculateCompressionRatio(originalSize: number, compressedSize: number): string {
  if (originalSize === 0) return '0%';
  const ratio = ((originalSize - compressedSize) / originalSize) * 100;
  return `${ratio.toFixed(2)}%`;
}

function createJsonResponse<T>(data: T, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function successResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200
): Response {
  return createJsonResponse(
    {
      success: true,
      ...data,
    },
    status
  );
}

export function errorResponse(message: string, status = 400): Response {
  return createJsonResponse<ApiResponse>(
    {
      success: false,
      error: message,
    },
    status
  );
}

export function fileNotFoundResponse(message = 'File not found'): Response {
  return createJsonResponse<ApiResponse>(
    {
      success: false,
      error: message,
    },
    404
  );
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return createJsonResponse<ApiResponse>(
    {
      success: false,
      error: message,
    },
    401
  );
}

export function tooManyRequestsResponse(message = 'Too many requests'): Response {
  return createJsonResponse<ApiResponse>(
    {
      success: false,
      error: message,
    },
    429
  );
}

export function serverErrorResponse(message = 'Internal server error'): Response {
  return createJsonResponse<ApiResponse>(
    {
      success: false,
      error: message,
    },
    500
  );
}

export async function handleWebhook(
  payload: unknown,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    throw new Error('Missing signature');
  }

  const hmac = createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    throw new Error('Invalid signature');
  }

  return true;
}

export function generateWebhookSignature(payload: unknown, secret: string): string {
  const hmac = createHmac('sha256', secret);
  return hmac.update(JSON.stringify(payload)).digest('hex');
}

export async function sendWebhook(url: string, data: unknown, secret: string): Promise<unknown> {
  const signature = generateWebhookSignature(data, secret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.statusText}`);
  }

  return response.json();
}
