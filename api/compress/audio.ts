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
  AudioCompressionOptions,
  AudioCompressionResult,
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

    if (mediaType !== 'audio') {
      return errorResponse('Invalid file type. Expected an audio file.');
    }

    const extension = getFileExtension(file.mimetype ?? file.type ?? '');
    const bitratesField = formData.fields.bitrates;
    const formatsField = formData.fields.formats;
    const sampleRatesField = formData.fields.sampleRates;
    const formatField = formData.fields.format;

    const options: AudioCompressionOptions = {
      bitrates: bitratesField
        ? JSON.parse(Array.isArray(bitratesField) ? (bitratesField[0] ?? '[]') : bitratesField)
        : undefined,
      formats: formatsField
        ? JSON.parse(Array.isArray(formatsField) ? (formatsField[0] ?? '[]') : formatsField)
        : undefined,
      sampleRates: sampleRatesField
        ? JSON.parse(
            Array.isArray(sampleRatesField) ? (sampleRatesField[0] ?? '[]') : sampleRatesField
          )
        : undefined,
      defaultFormat:
        ((Array.isArray(formatField)
          ? formatField[0]
          : formatField) as AudioCompressionOptions['defaultFormat']) ?? 'mp3',
    };

    const jobResult = await queue.enqueue('audio', {
      file: {
        buffer: buffer.toString('base64'),
        name: file.originalFilename ?? file.name ?? 'audio',
        type: file.mimetype ?? file.type ?? 'audio/mpeg',
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
      message: 'Audio compression job queued successfully',
    });
  } catch (error) {
    console.error('Audio compression error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to compress audio', 500);
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

    await queue.updateJobStatus(jobId, 'processing', 30);

    const compressionResult = (await compressor.compressMedia(
      fileBuffer,
      'audio',
      options
    )) as AudioCompressionResult;

    if (!compressionResult.success) {
      throw new Error('Compression failed');
    }

    await queue.updateJobStatus(jobId, 'processing', 70);

    const uploadPromises = [];

    const originalFilename = storage.generateFilename('original', extension);
    uploadPromises.push(
      storage.upload(fileBuffer, storage.generatePath('audio', jobId, originalFilename), {
        contentType: `audio/${extension}`,
      })
    );

    for (const compressed of compressionResult.compressed) {
      const filename = storage.generateFilename(
        `compressed-${compressed.bitrate}`,
        compressed.format
      );
      uploadPromises.push(
        storage.upload(compressed.buffer, storage.generatePath('audio', jobId, filename), {
          contentType: `audio/${compressed.format}`,
        })
      );
    }

    const uploadResults = await Promise.all(uploadPromises);

    await queue.updateJobStatus(jobId, 'processing', 90);

    const originalUpload = uploadResults[0];
    const compressedUploads = uploadResults.slice(1);

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
        bitrate: c.bitrate,
        url: compressedUploads[i]?.url ?? '',
        size: c.size,
        format: c.format,
        sampleRate: c.sampleRate,
      })),
      compressionRatio: `${compressionRatio}%`,
    });
  } catch (error) {
    console.error('Audio job processing error:', error);
    await queue.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
  }
}

export default withRateLimit(withAuth(handler));
