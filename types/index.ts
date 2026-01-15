/**
 * Media Compression API - Type Definitions
 * Modern TypeScript types for the entire API
 */

// =============================================================================
// Configuration Types
// =============================================================================

export interface ImageCompressionConfig {
  qualities: number[];
  thumbnails: number[];
  formats: ImageFormat[];
  defaultFormat: ImageFormat;
  stripMetadata: boolean;
}

export interface VideoCompressionConfig {
  qualities: number[];
  thumbnails: number;
  thumbnailInterval: number;
  formats: VideoFormat[];
  defaultFormat: VideoFormat;
  codec: string;
  audioCodec: string;
  crf: number;
  preset: VideoPreset;
}

export interface AudioCompressionConfig {
  bitrates: number[];
  formats: AudioFormat[];
  defaultFormat: AudioFormat;
  sampleRates: number[];
  defaultSampleRate: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface QueueConfig {
  retryAttempts: number;
  retryDelay: number;
  priorityLevels: JobPriority[];
}

export interface AppConfig {
  maxFileSize: number;
  timeout: number;
  apiKeys: string[];
  webhookSecret?: string;
  compression: {
    image: ImageCompressionConfig;
    video: VideoCompressionConfig;
    audio: AudioCompressionConfig;
  };
  rateLimit: RateLimitConfig;
  queue: QueueConfig;
}

// =============================================================================
// Media Format Types
// =============================================================================

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';
export type VideoFormat = 'mp4' | 'webm' | 'mov';
export type AudioFormat = 'mp3' | 'aac' | 'opus' | 'wav';
export type MediaType = 'image' | 'video' | 'audio' | 'unknown';
export type VideoPreset =
  | 'ultrafast'
  | 'superfast'
  | 'veryfast'
  | 'faster'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'veryslow';

// =============================================================================
// Job Types
// =============================================================================

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type JobPriority = 'high' | 'medium' | 'low';
export type JobType = 'image' | 'video' | 'audio';

export interface Job {
  id: string;
  type: JobType;
  payload: JobPayload;
  status: JobStatus;
  priority: JobPriority;
  createdAt: string;
  completedAt?: string;
  attempts: number;
  maxAttempts: number;
  progress?: number;
  error?: string | null;
  results?: JobResult;
  qstashMessageId?: string;
}

export interface JobPayload {
  file: {
    buffer: string; // base64 encoded
    name: string;
    type: string;
    size: number;
  };
  options: CompressionOptions;
  apiKey: string;
  extension: string;
}

export type CompressionOptions =
  | ImageCompressionOptions
  | VideoCompressionOptions
  | AudioCompressionOptions;

export interface ImageCompressionOptions {
  qualities?: number[];
  thumbnails?: number[];
  format?: ImageFormat;
  stripMetadata?: boolean;
}

export interface VideoCompressionOptions {
  qualities?: number[];
  thumbnails?: number;
  format?: VideoFormat;
  codec?: string;
  audioCodec?: string;
  crf?: number;
  preset?: VideoPreset;
}

export interface AudioCompressionOptions {
  bitrates?: number[];
  formats?: AudioFormat[];
  sampleRates?: number[];
  defaultFormat?: AudioFormat;
}

// =============================================================================
// Compression Result Types
// =============================================================================

export interface CompressedFile {
  quality?: string;
  bitrate?: string;
  buffer: Buffer;
  size: number;
  format: string;
  metadata?: Record<string, unknown>;
  dimensions?: Dimensions;
  sampleRate?: number;
}

export interface Thumbnail {
  size?: string;
  timestamp?: string;
  buffer: Buffer;
  sizeBytes: number;
  format: string;
  dimensions?: Dimensions;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ImageCompressionResult {
  success: boolean;
  error?: string;
  originals: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
  compressed: CompressedFile[];
  thumbnails: Thumbnail[];
}

export interface VideoCompressionResult {
  success: boolean;
  error?: string;
  originals: {
    width: number;
    height: number;
    duration: number;
    format: string;
    size: number;
    bitrate: number;
  };
  compressed: CompressedFile[];
  thumbnails: Thumbnail[];
}

export interface AudioCompressionResult {
  success: boolean;
  error?: string;
  originals: {
    duration: number;
    format: string;
    size: number;
    bitrate: number;
    sampleRate: number;
    channels: number;
  };
  compressed: CompressedFile[];
}

export type CompressionResult =
  | ImageCompressionResult
  | VideoCompressionResult
  | AudioCompressionResult;

// =============================================================================
// Job Result Types
// =============================================================================

export interface JobResult {
  original: {
    url: string;
    size: number;
    duration?: number;
  };
  compressed: {
    quality?: string;
    bitrate?: string;
    url: string;
    size: number;
    format?: string;
    dimensions?: Dimensions;
    sampleRate?: number;
  }[];
  thumbnails?: {
    size?: string;
    timestamp?: string;
    url: string;
    sizeBytes: number;
    dimensions?: Dimensions;
  }[];
  compressionRatio: string;
}

// =============================================================================
// Storage Types
// =============================================================================

export interface UploadResult {
  success: boolean;
  url?: string;
  size?: number;
  contentType?: string;
  error?: string;
}

export interface MultipleUploadResult {
  success: boolean;
  files: UploadResult[];
  successful: UploadResult[];
  failed: UploadResult[];
}

export interface UploadOptions {
  contentType?: string;
  addRandomSuffix?: boolean;
}

export interface FileToUpload {
  buffer: Buffer;
  name?: string;
  contentType?: string;
}

// =============================================================================
// Queue Types
// =============================================================================

export interface EnqueueOptions {
  priority?: JobPriority;
}

export interface EnqueueResult {
  success: boolean;
  jobId?: string;
  status?: JobStatus;
  estimatedTime?: string;
  error?: string;
}

export interface JobStatusResult {
  success: boolean;
  job?: {
    id: string;
    status: JobStatus;
    type: JobType;
    createdAt: string;
    completedAt?: string;
    progress: number;
    error?: string | null;
  };
  error?: string;
}

export interface UpdateJobResult {
  success: boolean;
  job?: Job;
  error?: string;
}

// =============================================================================
// Middleware Types
// =============================================================================

export interface AuthResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining?: number;
  error?: string;
  resetAfter?: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    queue: boolean;
    storage: boolean;
    rateLimit: boolean;
  };
  config: {
    maxFileSize: string;
    timeout: string;
    apiKeysConfigured: boolean;
  };
}

export interface CompressionJobResponse {
  jobId: string;
  status: JobStatus;
  estimatedTime: string;
  message: string;
}

// =============================================================================
// Form Data Types
// =============================================================================

export interface ParsedFormData {
  fields: Record<string, string | string[] | undefined>;
  files: Record<string, FormidableFile | FormidableFile[] | undefined>;
}

export interface FormidableFile {
  filepath: string;
  originalFilename?: string;
  name?: string;
  mimetype?: string;
  type?: string;
  size: number;
}

export interface ParsedFile {
  buffer: Buffer;
  name: string;
  type: string;
  size: number;
}

// =============================================================================
// Video/Audio Metadata Types
// =============================================================================

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  format: string;
  bitrate: number;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
}

export interface AudioMetadata {
  duration: number;
  format: string;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha?: boolean;
  density?: number;
}

// =============================================================================
// Handler Types
// =============================================================================

export type RequestHandler = (request: Request, apiKey?: string) => Promise<Response>;
export type MiddlewareHandler = (handler: RequestHandler) => RequestHandler;

// =============================================================================
// Webhook Types
// =============================================================================

export interface WebhookPayload {
  jobId: string;
  status: JobStatus;
  type: JobType;
  error?: string;
  results?: JobResult;
  timestamp: string;
}

// =============================================================================
// Environment Variables
// =============================================================================

export interface EnvironmentVariables {
  API_KEYS?: string;
  UPSTASH_QSTASH_REST_URL?: string;
  UPSTASH_QSTASH_TOKEN?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  KV_REST_API_URL?: string;
  KV_REST_API_TOKEN?: string;
  MAX_FILE_SIZE?: string;
  TIMEOUT?: string;
  WEBHOOK_SECRET?: string;
  VERCEL_URL?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvironmentVariables {}
  }
}
