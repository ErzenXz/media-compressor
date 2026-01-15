import { Client } from '@upstash/qstash';
import { kv } from '@vercel/kv';
import { config } from '../config.js';
import type {
  Job,
  JobType,
  JobPayload,
  JobPriority,
  JobStatus,
  JobResult,
  EnqueueOptions,
  EnqueueResult,
  JobStatusResult,
  UpdateJobResult,
} from '../types/index.js';

export class QueueService {
  private readonly qstash: Client;

  constructor() {
    this.qstash = new Client({
      token: process.env.UPSTASH_QSTASH_TOKEN ?? '',
    });
  }

  async enqueue(
    jobType: JobType,
    payload: JobPayload,
    options: EnqueueOptions = {}
  ): Promise<EnqueueResult> {
    const jobId = this.generateJobId();
    const priority: JobPriority = options.priority ?? 'medium';

    const job: Job = {
      id: jobId,
      type: jobType,
      payload,
      status: 'queued',
      priority,
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: config.queue.retryAttempts,
    };

    await kv.set(`job:${jobId}`, JSON.stringify(job));
    await kv.lpush(`queue:${priority}`, jobId);

    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const { messageId } = await this.qstash.publishJSON({
        url: `${baseUrl}/api/jobs/process`,
        body: { jobId },
      });

      await kv.set(
        `job:${jobId}`,
        JSON.stringify({
          ...job,
          qstashMessageId: messageId,
        })
      );

      return {
        success: true,
        jobId,
        status: 'queued',
        estimatedTime: this.estimateTime(jobType),
      };
    } catch (error) {
      console.error('Enqueue error:', error);
      await kv.del(`job:${jobId}`);
      await kv.lrem(`queue:${priority}`, 0, jobId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const jobData = await kv.get<string | Job>(`job:${jobId}`);

    if (!jobData) {
      return {
        success: false,
        error: 'Job not found',
      };
    }

    const job: Job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        type: job.type,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        progress: job.progress ?? 0,
        error: job.error,
      },
    };
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress: number | null = null,
    error: string | null = null
  ): Promise<UpdateJobResult> {
    const jobData = await kv.get<string | Job>(`job:${jobId}`);

    if (!jobData) {
      return { success: false, error: 'Job not found' };
    }

    const job: Job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
    const updatedJob: Job = {
      ...job,
      status,
      progress: progress !== null ? progress : job.progress,
      error,
      ...(status === 'completed' || status === 'failed'
        ? { completedAt: new Date().toISOString() }
        : {}),
    };

    await kv.set(`job:${jobId}`, JSON.stringify(updatedJob));

    if (status === 'completed' || status === 'failed') {
      await kv.lrem(`queue:${job.priority}`, 0, jobId);
    }

    return { success: true, job: updatedJob };
  }

  async saveJobResult(jobId: string, result: JobResult): Promise<UpdateJobResult> {
    const jobData = await kv.get<string | Job>(`job:${jobId}`);

    if (!jobData) {
      return { success: false, error: 'Job not found' };
    }

    const job: Job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData;
    const updatedJob: Job = {
      ...job,
      status: 'completed',
      progress: 100,
      error: null,
      completedAt: new Date().toISOString(),
      results: result,
    };

    await kv.set(`job:${jobId}`, JSON.stringify(updatedJob));
    await kv.lrem(`queue:${job.priority}`, 0, jobId);

    return { success: true, job: updatedJob };
  }

  async failJob(jobId: string, error: string): Promise<UpdateJobResult> {
    return this.updateJobStatus(jobId, 'failed', null, error);
  }

  generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  estimateTime(jobType: JobType): string {
    const estimates: Record<JobType, string> = {
      image: '30-60 seconds',
      video: '2-5 minutes',
      audio: '1-2 minutes',
    };
    return estimates[jobType] ?? '1-3 minutes';
  }
}

export const queue = new QueueService();
