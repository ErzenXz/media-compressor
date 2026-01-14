import { imageCompressor } from './image.js';
import { videoCompressor } from './video.js';
import { audioCompressor } from './audio.js';

export class CompressorService {
  constructor() {
    this.imageCompressor = imageCompressor;
    this.videoCompressor = videoCompressor;
    this.audioCompressor = audioCompressor;
  }

  async compressMedia(buffer, type, options = {}) {
    switch (type) {
      case 'image':
        return this.imageCompressor.compress(buffer, options);
      case 'video':
        return this.videoCompressor.compress(buffer, options);
      case 'audio':
        return this.audioCompressor.compress(buffer, options);
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async generateThumbnail(buffer, type, size = 300) {
    switch (type) {
      case 'image':
        return this.imageCompressor.generateThumbnail(buffer, size);
      case 'video':
        return this.generateVideoThumbnail(buffer, size);
      default:
        throw new Error(`Thumbnail generation not supported for type: ${type}`);
    }
  }

  async generateVideoThumbnail(buffer, size) {
    const tempPath = `/tmp/${Date.now()}-video-input.mp4`;

    await this.writeFile(tempPath, buffer);

    const outputPath = `/tmp/${Date.now()}-thumbnail-${size}.jpg`;

    await videoCompressor.extractThumbnail(tempPath, outputPath, 1);

    const thumbnailBuffer = await this.readFile(outputPath);

    await this.cleanup(tempPath);
    await this.cleanup(outputPath);

    return {
      success: true,
      buffer: thumbnailBuffer,
      sizeBytes: thumbnailBuffer.length,
      dimensions: {
        width: size,
        height: size,
      },
      sizeLabel: `${size}px`,
    };
  }

  async getMetadata(buffer, type) {
    switch (type) {
      case 'image':
        return this.imageCompressor.getMetadata(buffer);
      case 'video': {
        const videoTempPath = `/tmp/${Date.now()}-video-metadata.mp4`;
        await this.writeFile(videoTempPath, buffer);
        const videoMetadata = await videoCompressor.getMetadata(videoTempPath);
        await this.cleanup(videoTempPath);
        return videoMetadata;
      }
      case 'audio': {
        const audioTempPath = `/tmp/${Date.now()}-audio-metadata.mp3`;
        await this.writeFile(audioTempPath, buffer);
        const audioMetadata = await audioCompressor.getMetadata(audioTempPath);
        await this.cleanup(audioTempPath);
        return audioMetadata;
      }
      default:
        throw new Error(`Metadata retrieval not supported for type: ${type}`);
    }
  }

  async convertFormat(buffer, fromType, toType, options = {}) {
    if (fromType === 'audio' && toType === 'audio') {
      return this.audioCompressor.convertFormat(
        buffer,
        options.fromFormat,
        options.toFormat,
        options
      );
    }
    throw new Error(`Format conversion from ${fromType} to ${toType} not supported`);
  }

  writeFile(path, buffer) {
    return new Promise((resolve, reject) => {
      require('fs').writeFile(path, buffer, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  readFile(path) {
    return new Promise((resolve, reject) => {
      require('fs').readFile(path, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  cleanup(path) {
    return new Promise((resolve) => {
      require('fs').unlink(path, () => resolve());
    });
  }
}

export const compressor = new CompressorService();
