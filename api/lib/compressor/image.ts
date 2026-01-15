import sharp from 'sharp';
import { config } from '../../../config.js';
import type {
  ImageCompressionOptions,
  ImageCompressionResult,
  CompressedFile,
  Thumbnail,
  ImageMetadata,
  ImageFormat
} from '../../../types/index.js';

export class ImageCompressor {
  async compress(
    buffer: Buffer,
    options: ImageCompressionOptions = {}
  ): Promise<ImageCompressionResult> {
    const {
      qualities = config.compression.image.qualities,
      thumbnails = config.compression.image.thumbnails,
      format = config.compression.image.defaultFormat,
      stripMetadata = config.compression.image.stripMetadata
    } = options;

    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Apply metadata stripping if requested
    const processedImage = stripMetadata ? image.withMetadata({}) : image;

    const results: (CompressedFile | { type: 'thumbnails'; items: Thumbnail[] })[] = [];

    for (const quality of qualities) {
      const compressed = await processedImage
        .clone()
        .toFormat(format as keyof sharp.FormatEnum, { quality })
        .toBuffer();

      results.push({
        quality: `${quality}%`,
        buffer: compressed,
        size: compressed.length,
        format,
        metadata: {
          width: metadata.width ?? 0,
          height: metadata.height ?? 0,
          originalSize: buffer.length
        }
      });
    }

    if (thumbnails && thumbnails.length > 0) {
      const thumbnailResults: Thumbnail[] = [];

      for (const size of thumbnails) {
        const thumbnail = await processedImage
          .clone()
          .resize(size, size, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFormat(format as keyof sharp.FormatEnum, { quality: 80 })
          .toBuffer();

        thumbnailResults.push({
          size: `${size}px`,
          buffer: thumbnail,
          sizeBytes: thumbnail.length,
          format,
          dimensions: {
            width: Math.min(metadata.width ?? size, size),
            height: Math.min(metadata.height ?? size, size)
          }
        });
      }

      results.push({
        type: 'thumbnails',
        items: thumbnailResults
      });
    }

    return {
      success: true,
      originals: {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? 'unknown',
        size: buffer.length
      },
      compressed: results.filter((r): r is CompressedFile => !('type' in r)),
      thumbnails:
        results.find(
          (r): r is { type: 'thumbnails'; items: Thumbnail[] } =>
            'type' in r && r.type === 'thumbnails'
        )?.items ?? []
    };
  }

  async compressSingle(
    buffer: Buffer,
    quality = 75,
    format: ImageFormat = 'webp'
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    size: number;
    format: ImageFormat;
    quality: number;
  }> {
    const compressed = await sharp(buffer)
      .withMetadata({})
      .toFormat(format as keyof sharp.FormatEnum, { quality })
      .toBuffer();

    return {
      success: true,
      buffer: compressed,
      size: compressed.length,
      format,
      quality
    };
  }

  async generateThumbnail(
    buffer: Buffer,
    size = 300
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    sizeBytes: number;
    dimensions: { width: number; height: number };
    sizeLabel: string;
  }> {
    const metadata = await sharp(buffer).metadata();

    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    return {
      success: true,
      buffer: thumbnail,
      sizeBytes: thumbnail.length,
      dimensions: {
        width: Math.min(metadata.width ?? size, size),
        height: Math.min(metadata.height ?? size, size)
      },
      sizeLabel: `${size}px`
    };
  }

  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      density: metadata.density
    };
  }

  calculateCompressionRatio(originalSize: number, compressedSize: number): string {
    const ratio = ((originalSize - compressedSize) / originalSize) * 100;
    return ratio.toFixed(2);
  }
}

export const imageCompressor = new ImageCompressor();
