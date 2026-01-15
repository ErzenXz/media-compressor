import { kv } from '@vercel/kv';
import { config } from '../config.js';
import type { RateLimitResult, RequestHandler } from '../types/index.js';

export async function rateLimitMiddleware(
  apiKey: string | undefined,
  ip: string
): Promise<RateLimitResult> {
  const key = `ratelimit:${apiKey ?? ip}`;
  const current = await kv.get<number>(key);

  if (current !== null && current >= config.rateLimit.maxRequests) {
    return {
      success: false,
      error: 'Rate limit exceeded',
      resetAfter: config.rateLimit.windowMs,
    };
  }

  const newValue = (current ?? 0) + 1;
  await kv.set(key, newValue, { ex: config.rateLimit.windowMs / 1000 });

  return {
    success: true,
    remaining: config.rateLimit.maxRequests - newValue,
  };
}

export function withRateLimit(handler: RequestHandler): RequestHandler {
  return async function (request: Request, apiKey?: string): Promise<Response> {
    const ip =
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
    const rateLimit = await rateLimitMiddleware(apiKey, ip);

    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: rateLimit.error,
          resetAfter: rateLimit.resetAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimit.resetAfter ?? 60000) / 1000).toString(),
          },
        }
      );
    }

    const response = await handler(request, apiKey);

    // Clone the response to modify headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-RateLimit-Remaining', (rateLimit.remaining ?? 0).toString());
    newHeaders.set('X-RateLimit-Limit', config.rateLimit.maxRequests.toString());

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
