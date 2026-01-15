import { writeFile, readFile, unlink } from 'node:fs/promises';
import { imageCompressor } from './image.js';
import { videoCompressor } from './video.js';
import { audioCompressor } from './audio.js';
import type {
  MediaType,
  ImageCompressionOptions,
  VideoCompressionOptions,
  AudioCompressionOptions,
  CompressionResult,
  AudioFormat,
  ImageMetadata,
  VideoMetadata,
  AudioMetadata
} from '../../types/index.js';

export class CompressorService {
  readonly imageCompressor = imageCompressor;
  readonly videoCompressor = videoCompressor;
  readonly audioCompressor = audioCompressor;

  async compressMedia(
    buffer: Buffer,
    type: MediaType,
    options: ImageCompressionOptions | VideoCompressionOptions | AudioCompressionOptions = {}
  ): Promise<CompressionResult> {
    switch (type) {
      case 'image':
        return this.imageCompressor.compress(buffer, options as ImageCompressionOptions);
      case 'video':
        return this.videoCompressor.compress(buffer, options as VideoCompressionOptions);
      case 'audio':
        return this.audioCompressor.compress(buffer, options as AudioCompressionOptions);
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async generateThumbnail(
    buffer: Buffer,
    type: MediaType,
    size = 300
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    sizeBytes: number;
    dimensions: { width: number; height: number };
    sizeLabel: string;
  }> {
    switch (type) {
      case 'image':
        return this.imageCompressor.generateThumbnail(buffer, size);
      case 'video':
        return this.generateVideoThumbnail(buffer, size);
      default:
        throw new Error(`Thumbnail generation not supported for type: ${type}`);
    }
  }

  private async generateVideoThumbnail(
    buffer: Buffer,
    size: number
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    sizeBytes: number;
    dimensions: { width: number; height: number };
    sizeLabel: string;
  }> {
    const tempPath = `/tmp/${Date.now()}-video-input.mp4`;
    await writeFile(tempPath, buffer);

    const outputPath = `/tmp/${Date.now()}-thumbnail-${size}.jpg`;

    await videoCompressor.extractThumbnail(tempPath, outputPath, 1);

    const thumbnailBuffer = await readFile(outputPath);

    await this.cleanup(tempPath);
    await this.cleanup(outputPath);

    return {
      success: true,
      buffer: thumbnailBuffer,
      sizeBytes: thumbnailBuffer.length,
      dimensions: {
        width: size,
        height: size
      },
      sizeLabel: `${size}px`
    };
  }

  async getMetadata(
    buffer: Buffer,
    type: MediaType
  ): Promise<ImageMetadata | VideoMetadata | AudioMetadata> {
    switch (type) {
      case 'image':
        return this.imageCompressor.getMetadata(buffer);
      case 'video': {
        const videoTempPath = `/tmp/${Date.now()}-video-metadata.mp4`;
        await writeFile(videoTempPath, buffer);
        const videoMetadata = await videoCompressor.getMetadata(videoTempPath);
        await this.cleanup(videoTempPath);
        return videoMetadata;
      }
      case 'audio': {
        const audioTempPath = `/tmp/${Date.now()}-audio-metadata.mp3`;
        await writeFile(audioTempPath, buffer);
        const audioMetadata = await audioCompressor.getMetadata(audioTempPath);
        await this.cleanup(audioTempPath);
        return audioMetadata;
      }
      default:
        throw new Error(`Metadata retrieval not supported for type: ${type}`);
    }
  }

  async convertFormat(
    buffer: Buffer,
    fromType: MediaType,
    toType: MediaType,
    options: {
      fromFormat?: string;
      toFormat?: AudioFormat;
      bitrate?: string;
      sampleRate?: number;
    } = {}
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    format: string;
    size: number;
  }> {
    if (fromType === 'audio' && toType === 'audio') {
      return this.audioCompressor.convertFormat(
        buffer,
        options.fromFormat ?? 'mp3',
        options.toFormat ?? 'mp3',
        options
      );
    }
    throw new Error(`Format conversion from ${fromType} to ${toType} not supported`);
  }

  private async cleanup(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const compressor = new CompressorService();

export { imageCompressor, videoCompressor, audioCompressor };
