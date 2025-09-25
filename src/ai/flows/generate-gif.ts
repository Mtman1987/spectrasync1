'use server';
/**
 * Converts a Twitch clip video URL into a GIF using the FreeConvert API.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateGifInputSchema = z.object({
  videoUrl: z.string().url().describe('The public URL of the video to convert to a GIF.'),
  videoDuration: z.number().optional().describe('The duration of the video in seconds.'),
});
export type GenerateGifInput = z.infer<typeof GenerateGifInputSchema>;

const GenerateGifOutputSchema = z.object({
  gifUrl: z.string().url().describe('The URL of the generated GIF file.'),
});
export type GenerateGifOutput = z.infer<typeof GenerateGifOutputSchema>;

export async function generateGifFromUrl(input: GenerateGifInput): Promise<GenerateGifOutput> {
  return generateGifFlow(input);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatDurationSeconds(seconds: number): string {
  const clamped = Math.max(1, Math.min(seconds, 60));
  const totalMs = Math.round(clamped * 1000);
  const iso = new Date(totalMs).toISOString();
  return iso.slice(11, 23);
}

async function createFreeConvertJob(videoUrl: string, duration: number | undefined) {
  const token = process.env.FREECONVERT_TOKEN;
  if (!token) {
    throw new Error('FREECONVERT_TOKEN is not configured.');
  }

  const cutEnd = formatDurationSeconds(typeof duration === 'number' && !Number.isNaN(duration) ? duration : 15);

  const body = {
    tasks: {
      'import-1': {
        operation: 'import/url',
        url: videoUrl,
      },
      'convert-1': {
        operation: 'convert',
        input: 'import-1',
        output_format: 'gif',
        options: {
          cut_start: '00:00:00.000',
          cut_end: cutEnd,
          width: 400,
          loop: 0,
          fps: 12,
          compression: 78,
        },
      },
      'export-1': {
        operation: 'export/url',
        input: 'convert-1',
      },
    },
  };

  const response = await fetch('https://api.freeconvert.com/v1/process/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error('FreeConvert job creation failed:', JSON.stringify(json));
    throw new Error(`FreeConvert job creation failed: ${JSON.stringify(json)}`);
  }

  return json;
}

async function pollFreeConvertJob(jobId: string, timeoutMs = 240_000, intervalMs = 5_000) {
  const token = process.env.FREECONVERT_TOKEN;
  if (!token) {
    throw new Error('FREECONVERT_TOKEN is not configured.');
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobId}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await response.json();

    if (json.status === 'finished') {
      const tasks = json.tasks ?? {};
      const exportTask = Object.values(tasks).find((task: any) => task?.operation === 'export/url');
      const url = (exportTask as any)?.result?.url;
      if (url) {
        return url as string;
      }
      throw new Error('FreeConvert job finished but no export URL was returned.');
    }

    if (json.status === 'failed') {
      console.error('FreeConvert job failed:', JSON.stringify(json));
      throw new Error('FreeConvert job failed.');
    }

    await sleep(intervalMs);
  }

  throw new Error('FreeConvert job polling timed out.');
}

const generateGifFlow = ai.defineFlow(
  {
    name: 'generateGifFlow',
    inputSchema: GenerateGifInputSchema,
    outputSchema: GenerateGifOutputSchema,
  },
  async ({ videoUrl, videoDuration }) => {
    const job = await createFreeConvertJob(videoUrl, videoDuration);
    const jobId = job?.id;
    if (!jobId) {
      throw new Error('FreeConvert job did not return an id.');
    }

    const gifUrl = await pollFreeConvertJob(jobId, 240_000, 5_000);
    if (!gifUrl) {
      throw new Error('GIF rendering failed or timed out.');
    }

    return { gifUrl };
  },
);
