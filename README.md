# Media Compression API

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-username%2Fmedia-compressor&env=API_KEYS,UPSTASH_QSTASH_TOKEN,BLOB_READ_WRITE_TOKEN,KV_REST_API_URL,KV_REST_API_TOKEN&envDescription=Required%20environment%20variables%20for%20the%20Media%20Compression%20API&envLink=https%3A%2F%2Fgithub.com%2Fyour-username%2Fmedia-compressor%23environment-variables&project-name=media-compression-api&repository-name=media-compression-api)

A high-performance, TypeScript-based media compression API built for Vercel. Compress images, videos, and audio files with multiple quality levels, automatic thumbnail generation, and scalable async processing.

## Features

- **Multi-format Support**: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, MOV, MP3, AAC, Opus, WAV
- **Multiple Quality Levels**: Generate compressed versions at different quality/bitrate settings
- **Thumbnail Generation**: Automatic thumbnail generation for images and videos
- **Async Processing**: Queue-based processing with Upstash QStash
- **Cloud Storage**: Vercel Blob storage for compressed files
- **Authentication**: API key-based authentication
- **Rate Limiting**: Built-in rate limiting with Vercel KV (100 req/min)
- **Webhook Support**: Webhook notifications for job completion
- **TypeScript**: Fully typed codebase with strict type checking
- **Node.js 24**: Built with the latest Node.js runtime

## Tech Stack

| Component            | Technology             |
| -------------------- | ---------------------- |
| **Runtime**          | Node.js 24 on Vercel   |
| **Language**         | TypeScript 5.8+        |
| **Image Processing** | Sharp                  |
| **Video/Audio**      | FFmpeg (fluent-ffmpeg) |
| **Queue**            | Upstash QStash         |
| **Storage**          | Vercel Blob            |
| **Rate Limiting**    | Vercel KV              |

---

## Quick Start

### 1-Click Deploy to Vercel

Click the button above to deploy instantly. You'll be prompted to configure the required environment variables.

### Manual Deployment

#### Prerequisites

- Node.js 24+ installed
- pnpm package manager
- Vercel account
- Upstash account (for QStash)

#### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/media-compressor.git
cd media-compressor
```

#### Step 2: Install Dependencies

```bash
pnpm install
```

#### Step 3: Set Up External Services

##### Upstash QStash (Required)

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new QStash database
3. Copy the `QSTASH_TOKEN` from the REST API section

##### Vercel Blob Storage (Required)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** > **Create Database** > **Blob**
3. Create a new Blob store
4. Copy the `BLOB_READ_WRITE_TOKEN`

##### Vercel KV (Required)

1. In Vercel Dashboard, go to **Storage** > **Create Database** > **KV**
2. Create a new KV database
3. Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`

#### Step 4: Configure Environment Variables

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Required: API keys for authentication (comma-separated)
API_KEYS=your-secure-api-key-here

# Required: Upstash QStash
UPSTASH_QSTASH_TOKEN=your-qstash-token

# Required: Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token

# Required: Vercel KV
KV_REST_API_URL=https://your-kv-url.upstash.io
KV_REST_API_TOKEN=your-kv-token

# Optional: Configuration
MAX_FILE_SIZE=524288000    # 500MB
TIMEOUT=300000              # 5 minutes

# Optional: Webhook notifications
WEBHOOK_SECRET=your-webhook-secret
```

#### Step 5: Deploy to Vercel

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Step 6: Add Environment Variables to Vercel

```bash
# Add each environment variable
vercel env add API_KEYS production
vercel env add UPSTASH_QSTASH_TOKEN production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add KV_REST_API_URL production
vercel env add KV_REST_API_TOKEN production
```

Or add them via the Vercel Dashboard under **Settings** > **Environment Variables**.

---

## Local Development

```bash
# Start development server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

---

## API Reference

### Authentication

All endpoints (except `/api/health`) require an API key:

```bash
# Using X-API-Key header
curl -H "X-API-Key: your_api_key" https://your-app.vercel.app/api/health

# Using Authorization header
curl -H "Authorization: Bearer your_api_key" https://your-app.vercel.app/api/health
```

---

### Health Check

Check API status and service availability.

```http
GET /api/health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:00:00.000Z",
  "version": "2.0.0",
  "services": {
    "queue": true,
    "storage": true,
    "rateLimit": true
  },
  "config": {
    "maxFileSize": "500MB",
    "timeout": "300s",
    "apiKeysConfigured": true
  }
}
```

---

### Image Compression

Compress images with multiple quality levels and generate thumbnails.

```http
POST /api/compress/image
Content-Type: multipart/form-data
```

**Parameters:**

| Parameter       | Type       | Required | Default            | Description                          |
| --------------- | ---------- | -------- | ------------------ | ------------------------------------ |
| `file`          | File       | Yes      | -                  | Image file to compress               |
| `qualities`     | JSON array | No       | `[90, 75, 60, 45]` | Quality levels (1-100)               |
| `thumbnails`    | JSON array | No       | `[100, 300, 500]`  | Thumbnail sizes in pixels            |
| `format`        | String     | No       | `webp`             | Output format: jpeg, png, webp, avif |
| `stripMetadata` | Boolean    | No       | `true`             | Remove EXIF metadata                 |

**Example:**

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "file=@photo.jpg" \
  -F 'qualities=[80, 60, 40]' \
  -F 'thumbnails=[200, 400]' \
  -F "format=webp" \
  https://your-app.vercel.app/api/compress/image
```

**Response:**

```json
{
  "success": true,
  "jobId": "job_1705312800000_abc123xyz",
  "status": "queued",
  "estimatedTime": "30-60 seconds",
  "message": "Image compression job queued successfully"
}
```

---

### Video Compression

Compress videos to multiple resolutions with thumbnail extraction.

```http
POST /api/compress/video
Content-Type: multipart/form-data
```

**Parameters:**

| Parameter    | Type       | Required | Default                 | Description                   |
| ------------ | ---------- | -------- | ----------------------- | ----------------------------- |
| `file`       | File       | Yes      | -                       | Video file to compress        |
| `qualities`  | JSON array | No       | `[1080, 720, 480, 360]` | Resolution heights            |
| `thumbnails` | Number     | No       | `3`                     | Number of thumbnails          |
| `format`     | String     | No       | `mp4`                   | Output format: mp4, webm, mov |

**Example:**

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "file=@video.mp4" \
  -F 'qualities=[1080, 720, 480]' \
  -F "thumbnails=5" \
  -F "format=mp4" \
  https://your-app.vercel.app/api/compress/video
```

**Response:**

```json
{
  "success": true,
  "jobId": "job_1705312800000_def456uvw",
  "status": "queued",
  "estimatedTime": "2-5 minutes",
  "message": "Video compression job queued successfully"
}
```

---

### Audio Compression

Compress audio files to multiple bitrates.

```http
POST /api/compress/audio
Content-Type: multipart/form-data
```

**Parameters:**

| Parameter  | Type       | Required | Default               | Description                        |
| ---------- | ---------- | -------- | --------------------- | ---------------------------------- |
| `file`     | File       | Yes      | -                     | Audio file to compress             |
| `bitrates` | JSON array | No       | `[320, 192, 128, 64]` | Bitrates in kbps                   |
| `format`   | String     | No       | `mp3`                 | Output format: mp3, aac, opus, wav |

**Example:**

```bash
curl -X POST \
  -H "X-API-Key: your_api_key" \
  -F "file=@audio.wav" \
  -F 'bitrates=[320, 192, 128]' \
  -F "format=mp3" \
  https://your-app.vercel.app/api/compress/audio
```

**Response:**

```json
{
  "success": true,
  "jobId": "job_1705312800000_ghi789rst",
  "status": "queued",
  "estimatedTime": "1-2 minutes",
  "message": "Audio compression job queued successfully"
}
```

---

### Job Status

Check the status of a compression job.

```http
GET /api/jobs/status/{jobId}
```

**Example:**

```bash
curl -H "X-API-Key: your_api_key" \
  https://your-app.vercel.app/api/jobs/status/job_1705312800000_abc123xyz
```

**Response (Processing):**

```json
{
  "success": true,
  "jobId": "job_1705312800000_abc123xyz",
  "status": "processing",
  "type": "image",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "progress": 60,
  "error": null,
  "results": null
}
```

**Response (Completed):**

```json
{
  "success": true,
  "jobId": "job_1705312800000_abc123xyz",
  "status": "completed",
  "type": "image",
  "createdAt": "2026-01-15T10:00:00.000Z",
  "completedAt": "2026-01-15T10:00:45.000Z",
  "progress": 100,
  "error": null,
  "results": {
    "original": {
      "url": "https://blob.vercel-storage.com/.../original.jpg",
      "size": 5242880
    },
    "compressed": [
      {
        "quality": "80%",
        "url": "https://blob.vercel-storage.com/.../compressed-80.webp",
        "size": 2621440
      },
      {
        "quality": "60%",
        "url": "https://blob.vercel-storage.com/.../compressed-60.webp",
        "size": 1310720
      }
    ],
    "thumbnails": [
      {
        "size": "200px",
        "url": "https://blob.vercel-storage.com/.../thumbnail-200.webp",
        "sizeBytes": 25000,
        "dimensions": { "width": 200, "height": 150 }
      }
    ],
    "compressionRatio": "50.00%"
  }
}
```

---

## Client Example

See `client-example.ts` for a complete TypeScript client implementation:

```typescript
import { compressImage, waitForJobCompletion } from './client-example';

// Compress an image
const job = await compressImage('./photo.jpg', {
  qualities: [80, 60],
  thumbnails: [200, 400],
  format: 'webp'
});

console.log('Job queued:', job.jobId);

// Wait for completion
const result = await waitForJobCompletion(job.jobId);

if (result.status === 'completed') {
  console.log('Compressed URLs:', result.results?.compressed);
}
```

---

## Configuration

Edit `config.ts` to customize default settings:

```typescript
export const config: AppConfig = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  timeout: 300000, // 5 minutes

  compression: {
    image: {
      qualities: [90, 75, 60, 45],
      thumbnails: [100, 300, 500],
      formats: ['jpeg', 'png', 'webp', 'avif'],
      defaultFormat: 'webp',
      stripMetadata: true
    },
    video: {
      qualities: [1080, 720, 480, 360],
      thumbnails: 3,
      formats: ['mp4', 'webm', 'mov'],
      defaultFormat: 'mp4',
      codec: 'libx264',
      crf: 23,
      preset: 'medium'
    },
    audio: {
      bitrates: [320, 192, 128, 64],
      formats: ['mp3', 'aac', 'opus', 'wav'],
      defaultFormat: 'mp3',
      sampleRates: [44100, 48000]
    }
  },

  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100 // 100 requests per minute
  }
};
```

---

## Environment Variables

| Variable                | Required | Description                                 |
| ----------------------- | -------- | ------------------------------------------- |
| `API_KEYS`              | Yes      | Comma-separated list of valid API keys      |
| `UPSTASH_QSTASH_TOKEN`  | Yes      | Upstash QStash authentication token         |
| `BLOB_READ_WRITE_TOKEN` | Yes      | Vercel Blob storage token                   |
| `KV_REST_API_URL`       | Yes      | Vercel KV REST API URL                      |
| `KV_REST_API_TOKEN`     | Yes      | Vercel KV authentication token              |
| `MAX_FILE_SIZE`         | No       | Maximum file size in bytes (default: 500MB) |
| `TIMEOUT`               | No       | Request timeout in ms (default: 300000)     |
| `WEBHOOK_SECRET`        | No       | Secret for webhook signature verification   |

---

## Error Handling

All errors return a consistent JSON format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

| Status Code | Description                               |
| ----------- | ----------------------------------------- |
| `400`       | Bad Request - Invalid parameters          |
| `401`       | Unauthorized - Invalid or missing API key |
| `404`       | Not Found - Job not found                 |
| `405`       | Method Not Allowed                        |
| `429`       | Too Many Requests - Rate limit exceeded   |
| `500`       | Internal Server Error                     |

---

## Rate Limiting

- **Default Limit**: 100 requests per minute per API key
- **Headers**: Responses include rate limit information

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
Retry-After: 60  (when rate limited)
```

---

## File Size Limits

- **Maximum File Size**: 500MB (configurable)
- **Function Timeout**: 5 minutes (Vercel Pro/Enterprise)
- **Memory**: 2048MB per function

---

## Project Structure

```
media-compressor/
├── api/
│   ├── compress/
│   │   ├── image.ts      # Image compression endpoint
│   │   ├── video.ts      # Video compression endpoint
│   │   └── audio.ts      # Audio compression endpoint
│   ├── jobs/
│   │   ├── status.ts     # Job status endpoint
│   │   ├── process.ts    # Job processor (QStash worker)
│   │   └── webhook.ts    # Webhook receiver
│   └── health.ts         # Health check endpoint
├── lib/
│   ├── compressor/       # Compression modules
│   ├── queue.ts          # QStash queue service
│   ├── storage.ts        # Blob storage service
│   └── utils.ts          # Utility functions
├── middleware/
│   ├── auth.ts           # Authentication middleware
│   └── ratelimit.ts      # Rate limiting middleware
├── types/
│   └── index.ts          # TypeScript type definitions
├── config.ts             # Configuration
├── client-example.ts     # Example client
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies
└── vercel.json           # Vercel configuration
```

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## Support

- [GitHub Issues](https://github.com/your-username/media-compressor/issues)
- [Documentation](https://github.com/your-username/media-compressor#readme)
