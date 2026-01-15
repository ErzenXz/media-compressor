import ffmpeg from 'fluent-ffmpeg';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { config } from '../../config.js';
import type {
  AudioCompressionOptions,
  AudioCompressionResult,
  CompressedFile,
  AudioMetadata,
  AudioFormat,
} from '../../types/index.js';

export class AudioCompressor {
  private readonly tempDir = '/tmp';

  async compress(
    buffer: Buffer,
    options: AudioCompressionOptions = {}
  ): Promise<AudioCompressionResult> {
    const {
      bitrates = config.compression.audio.bitrates,
      sampleRates = config.compression.audio.sampleRates,
      defaultFormat = config.compression.audio.defaultFormat,
    } = options;

    const tempPath = `${this.tempDir}/${Date.now()}-input.mp3`;
    await writeFile(tempPath, buffer);

    const results: CompressedFile[] = [];
    const metadata = await this.getMetadata(tempPath);

    for (const bitrate of bitrates) {
      const outputPath = `${tempPath}-${bitrate}kbps.${defaultFormat}`;

      await this.compressAudio(tempPath, outputPath, {
        bitrate: `${bitrate}k`,
        sampleRate: sampleRates[0] ?? 44100,
        format: defaultFormat,
      });

      const compressedBuffer = await readFile(outputPath);
      await this.cleanup(outputPath);

      results.push({
        bitrate: `${bitrate}kbps`,
        buffer: compressedBuffer,
        size: compressedBuffer.length,
        format: defaultFormat,
        sampleRate: sampleRates[0] ?? 44100,
        metadata: {
          originalSize: buffer.length,
          duration: metadata.duration,
          originalBitrate: metadata.bitrate,
        },
      });
    }

    await this.cleanup(tempPath);

    return {
      success: true,
      originals: {
        duration: metadata.duration,
        format: metadata.format,
        size: buffer.length,
        bitrate: metadata.bitrate,
        sampleRate: metadata.sampleRate,
        channels: metadata.channels,
      },
      compressed: results,
    };
  }

  private async compressAudio(
    input: string,
    output: string,
    options: {
      bitrate: string;
      sampleRate: number;
      format: string;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioBitrate(options.bitrate)
        .audioFrequency(options.sampleRate)
        .toFormat(options.format)
        .outputOptions(['-q:a', '2'])
        .output(output)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  async convertFormat(
    buffer: Buffer,
    fromFormat: string,
    toFormat: AudioFormat,
    options: { bitrate?: string; sampleRate?: number } = {}
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    format: AudioFormat;
    size: number;
  }> {
    const tempInput = `${this.tempDir}/${Date.now()}-input.${fromFormat}`;
    const tempOutput = `${this.tempDir}/${Date.now()}-output.${toFormat}`;

    await writeFile(tempInput, buffer);

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(tempInput);

      if (options.bitrate) {
        command.audioBitrate(options.bitrate);
      }

      if (options.sampleRate) {
        command.audioFrequency(options.sampleRate);
      }

      command
        .toFormat(toFormat)
        .output(tempOutput)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const outputBuffer = await readFile(tempOutput);

    await this.cleanup(tempInput);
    await this.cleanup(tempOutput);

    return {
      success: true,
      buffer: outputBuffer,
      format: toFormat,
      size: outputBuffer.length,
    };
  }

  async getMetadata(inputPath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

        resolve({
          duration: metadata.format?.duration ?? 0,
          format: metadata.format?.format_name ?? 'unknown',
          bitrate: parseInt(String(metadata.format?.bit_rate ?? 0)) / 1000,
          sampleRate: parseInt(String(audioStream?.sample_rate ?? '44100')),
          channels: audioStream?.channels ?? 2,
          codec: audioStream?.codec_name ?? 'unknown',
        });
      });
    });
  }

  async normalizeAudio(buffer: Buffer): Promise<{
    success: boolean;
    buffer: Buffer;
    size: number;
  }> {
    const tempInput = `${this.tempDir}/${Date.now()}-input.mp3`;
    const tempOutput = `${this.tempDir}/${Date.now()}-normalized.mp3`;

    await writeFile(tempInput, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInput)
        .audioFilters([
          {
            filter: 'loudnorm',
            options: {
              I: '-16',
              TP: '-1.5',
              LRA: '11',
            },
          },
        ])
        .output(tempOutput)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const outputBuffer = await readFile(tempOutput);

    await this.cleanup(tempInput);
    await this.cleanup(tempOutput);

    return {
      success: true,
      buffer: outputBuffer,
      size: outputBuffer.length,
    };
  }

  async trimAudio(
    buffer: Buffer,
    startTime: number,
    endTime: number
  ): Promise<{
    success: boolean;
    buffer: Buffer;
    size: number;
    duration: number;
  }> {
    const tempInput = `${this.tempDir}/${Date.now()}-input.mp3`;
    const tempOutput = `${this.tempDir}/${Date.now()}-trimmed.mp3`;
    const duration = endTime - startTime;

    await writeFile(tempInput, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(tempInput)
        .setStartTime(startTime)
        .setDuration(duration)
        .output(tempOutput)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const outputBuffer = await readFile(tempOutput);

    await this.cleanup(tempInput);
    await this.cleanup(tempOutput);

    return {
      success: true,
      buffer: outputBuffer,
      size: outputBuffer.length,
      duration,
    };
  }

  private async cleanup(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Ignore cleanup errors
    }
  }

  calculateCompressionRatio(originalSize: number, compressedSize: number): string {
    const ratio = ((originalSize - compressedSize) / originalSize) * 100;
    return ratio.toFixed(2);
  }
}

export const audioCompressor = new AudioCompressor();
