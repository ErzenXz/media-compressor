import { readFileSync } from 'node:fs';
import { kv } from '@vercel/kv';
import { withAuth } from '../../middleware/auth.js';
import { withRateLimit } from '../../middleware/ratelimit.js';
import { storage } from '../../lib/storage.js';
import { queue } from '../../lib/queue.js';
import { compressor } from '../../lib/compressor/index.js';
import {
  parseFormData,
  getMediaType,
  getFileExtension,
  successResponse,
  errorResponse,
} from '../../lib/utils.js';
import type {
  Job,
  VideoCompressionOptions,
  VideoCompressionResult,
  RequestHandler,
} from '../../types/index.js';

const handler: RequestHandler = async (request, apiKey) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await parseFormData(request);
    const fileField = formData.files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return errorResponse('No file provided');
    }

    const buffer = readFileSync(file.filepath);
    const mediaType = getMediaType(file.mimetype ?? file.type ?? '');

    if (mediaType !== 'video') {
      return errorResponse('Invalid file type. Expected a video.');
    }

    const extension = getFileExtension(file.mimetype ?? file.type ?? '');
    const qualitiesField = formData.fields.qualities;
    const thumbnailsField = formData.fields.thumbnails;
    const formatField = formData.fields.format;

    const options: VideoCompressionOptions = {
      qualities: qualitiesField
        ? JSON.parse(Array.isArray(qualitiesField) ? (qualitiesField[0] ?? '[]') : qualitiesField)
        : undefined,
      thumbnails: thumbnailsField
        ? parseInt(Array.isArray(thumbnailsField) ? (thumbnailsField[0] ?? '3') : thumbnailsField)
        : undefined,
      format:
        ((Array.isArray(formatField)
          ? formatField[0]
          : formatField) as VideoCompressionOptions['format']) ?? 'mp4',
    };

    const jobResult = await queue.enqueue('video', {
      file: {
        buffer: buffer.toString('base64'),
        name: file.originalFilename ?? file.name ?? 'video',
        type: file.mimetype ?? file.type ?? 'video/mp4',
        size: buffer.length,
      },
      options,
      apiKey: apiKey ?? '',
      extension,
    });

    if (!jobResult.success) {
      return errorResponse('Failed to queue job');
    }

    return successResponse({
      jobId: jobResult.jobId,
      status: 'queued',
      estimatedTime: jobResult.estimatedTime,
      message: 'Video compression job queued successfully',
    });
  } catch (error) {
    console.error('Video compression error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to compress video', 500);
  }
};

export async function processJob(jobId: string): Promise<void> {
  const jobData = await queue.getJobStatus(jobId);

  if (!jobData.success || jobData.job?.status !== 'queued') {
    return;
  }

  await queue.updateJobStatus(jobId, 'processing', 10);

  try {
    const job = await kv.get<string | Job>(`job:${jobId}`);
    const parsedJob: Job = typeof job === 'string' ? JSON.parse(job) : (job as Job);

    const fileBuffer = Buffer.from(parsedJob.payload.file.buffer, 'base64');
    const options = parsedJob.payload.options;
    const extension = parsedJob.payload.extension;

    await queue.updateJobStatus(jobId, 'processing', 20);

    const compressionResult = (await compressor.compressMedia(
      fileBuffer,
      'video',
      options
    )) as VideoCompressionResult;

    if (!compressionResult.success) {
      throw new Error('Compression failed');
    }

    await queue.updateJobStatus(jobId, 'processing', 60);

    const uploadPromises = [];

    const originalFilename = storage.generateFilename('original', extension);
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('video', jobId, originalFilename), {
        contentType: `video/${extension}`,
      })
    );

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(
        `compressed-${compressed.quality}`,
        compressed.format
      );
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('video', jobId, filename), {
          contentType: `video/${compressed.format}`,
        })
      );
    }

    for (const thumbnail of compressionResult.thumbnails) {
      const filename = storage.generateFilename(
        `thumbnail-${thumbnail.timestamp}`,
        thumbnail.format
      );
      uploadPromises.push(
        storage.upload(thumbnail.buffer, storage.generatePath('video', jobId, filename), {
          contentType: `image/${thumbnail.format}`,
        })
      );
    }

    const uploadResults = await Promise.all(uploadPromises);

    await queue.updateJobStatus(jobId, 'processing', 90);

    const originalUpload = uploadResults[0];
    const compressedUploads = uploadResults.slice(1, 1 + compressionResult.compressed.length);
    const thumbnailUploads = uploadResults.slice(1 + compressionResult.compressed.length);

    const firstCompressed = compressionResult.compressed[0];
    const compressionRatio = firstCompressed
      ? (((fileBuffer.length - firstCompressed.size) / fileBuffer.length) * 100).toFixed(2)
      : '0';

    await queue.saveJobResult(jobId, {
      original: {
        url: originalUpload?.url ?? '',
        size: fileBuffer.length,
        duration: compressionResult.originals.duration,
      },
      compressed: compressionResult.compressed.map((c, i) => ({
        quality: c.quality,
        url: compressedUploads[i]?.url ?? '',
        size: c.size,
        dimensions: c.dimensions,
      })),
      thumbnails: compressionResult.thumbnails.map((t, i) => ({
        timestamp: t.timestamp,
        url: thumbnailUploads[i]?.url ?? '',
        sizeBytes: t.sizeBytes,
      })),
      compressionRatio: `${compressionRatio}%`,
    });
  } catch (error) {
    console.error('Video job processing error:', error);
    await queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
  }
}

export default withRateLimit(withAuth(handler));
