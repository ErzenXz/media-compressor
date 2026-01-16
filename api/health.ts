import { config } from '../config.js';
import type { HealthCheckResponse } from '../types/index.js';

async function handler(_request: Request): Promise<Response> {
  const health: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      queue: Boolean(process.env.UPSTASH_QSTASH_TOKEN),
      storage: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      rateLimit: Boolean(process.env.KV_REST_API_TOKEN),
    },
    config: {
      maxFileSize: `${config.maxFileSize / 1024 / 1024}MB`,
      timeout: `${config.timeout / 1000}s`,
      apiKeysConfigured: config.apiKeys.length > 0,
    },
  };

  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default handler;
