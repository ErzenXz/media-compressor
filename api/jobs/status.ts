import { kv } from '@vercel/kv';
import { withAuth } from '../middleware/auth.js';
import { queue } from '../lib/queue.js';
import { successResponse, errorResponse, fileNotFoundResponse } from '../lib/utils.js';
import type { Job, RequestHandler } from '../../types/index.js';

const handler: RequestHandler = async (request) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const jobId = pathParts[pathParts.length - 1];

    if (!jobId) {
      return errorResponse('Job ID is required');
    }

    const jobData = await queue.getJobStatus(jobId);

    if (!jobData.success) {
      return fileNotFoundResponse('Job not found');
    }

    const job = await kv.get<string | Job>(`job:${jobId}`);
    const parsedJob: Job = typeof job === 'string' ? JSON.parse(job) : (job as Job);

    return successResponse({
      jobId,
      status: jobData.job?.status,
      type: jobData.job?.type,
      createdAt: jobData.job?.createdAt,
      completedAt: jobData.job?.completedAt,
      progress: jobData.job?.progress ?? 0,
      error: jobData.job?.error,
      results: parsedJob?.results ?? null,
    });
  } catch (error) {
    console.error('Job status error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to get job status', 500);
  }
};

export default withAuth(handler);
