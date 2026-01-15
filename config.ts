import type { AppConfig, JobStatus as JobStatusType } from './types/index.js';

export const config: AppConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '') || 500 * 1024 * 1024,
  timeout: parseInt(process.env.TIMEOUT ?? '') || 300000,
  apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
  webhookSecret: process.env.WEBHOOK_SECRET,

  compression: {
    image: {
      qualities: [90, 75, 60, 45],
      thumbnails: [100, 300, 500],
      formats: ['jpeg', 'png', 'webp', 'avif'],
      defaultFormat: 'webp',
      stripMetadata: true,
    },

    video: {
      qualities: [1080, 720, 480, 360],
      thumbnails: 3,
      thumbnailInterval: 10,
      formats: ['mp4', 'webm', 'mov'],
      defaultFormat: 'mp4',
      codec: 'libx264',
      audioCodec: 'aac',
      crf: 23,
      preset: 'medium',
    },

    audio: {
      bitrates: [320, 192, 128, 64],
      formats: ['mp3', 'aac', 'opus', 'wav'],
      defaultFormat: 'mp3',
      sampleRates: [44100, 48000],
      defaultSampleRate: 44100,
    },
  },

  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },

  queue: {
    retryAttempts: 3,
    retryDelay: 5000,
    priorityLevels: ['high', 'medium', 'low'],
  },
};

export const jobStatus: Record<string, JobStatusType> = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type { AppConfig, JobStatusType };
