import { handleWebhook } from '../lib/utils.js';
import { config } from '../../config.js';
import type { JobStatus } from '../../types/index.js';

interface WebhookPayload {
  jobId: string;
  status: JobStatus;
  error?: string;
}

async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = (await request.json()) as WebhookPayload;
    const signature = request.headers.get('x-webhook-signature');

    if (!config.webhookSecret) {
      console.warn('Webhook secret not configured, skipping signature verification');
    } else {
      await handleWebhook(payload, signature, config.webhookSecret);
    }

    const { jobId, status } = payload;

    if (status === 'completed' || status === 'failed') {
      console.log(`Job ${jobId} ${status}`);

      if (status === 'failed') {
        console.error(`Job failed: ${payload.error}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook received',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

export default handler;
