'use server';
/**
 * @fileOverview A function for ingesting and transforming a video source using the Shotstack Ingest API.
 */

import { z } from 'zod';

// Define the input schema for our function.
// This is flexible to allow for different rendition options.
const StageAndTransformSourceInputSchema = z.object({
  url: z.string().url(),
  outputs: z.record(z.any()).optional(), // Allow any valid 'outputs' object
});

type StageAndTransformSourceInput = z.infer<typeof StageAndTransformSourceInputSchema>;

// Define the expected output schema from the Shotstack Ingest API.
// This is a simplified version; the full response can be more complex.
const IngestApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  response: z.object({
    id: z.string(),
    status: z.string(),
    // other fields like 'url', 'renditions', etc., will also be present
  }),
});

type IngestApiResponse = z.infer<typeof IngestApiResponseSchema>;

/**
 * Ingests a video from a URL and optionally creates renditions using the Shotstack Ingest API.
 *
 * @param input - The URL of the video and optional output configurations.
 * @returns The response from the Shotstack Ingest API.
 */
export async function stageAndTransformSource(
  input: StageAndTransformSourceInput
): Promise<IngestApiResponse> {
  // Validate input against the schema
  const validation = StageAndTransformSourceInputSchema.safeParse(input);
  if (!validation.success) {
    throw new Error(`Invalid input: ${validation.error.message}`);
  }

  // It's best practice to store API keys in environment variables
  // and not hardcode them in the source code.
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) {
    throw new Error('SHOTSTACK_API_KEY is not configured in environment variables.');
  }

  // The endpoint you provided for ingesting sources
  const ingestApiUrl = 'https://api.shotstack.io/stage/sources';

  console.log(`Ingesting video from URL: ${input.url}`);

  const response = await fetch(ingestApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
    body: JSON.stringify(input), // Pass the whole input object
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Shotstack Ingest API error:', errorText);
    throw new Error(`Failed to ingest source: ${response.statusText} - ${errorText}`);
  }

  const responseData = await response.json();
  console.log(`Successfully submitted ingest job. Ingest ID: ${responseData.response.id}`);

  return responseData;
}
