'use server';
/**
 * Generates a space-themed VIP shoutout using Genkit/Gemini.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateVipShoutoutInputSchema = z.object({
  vipName: z.string().describe('The display name of the VIP streamer.'),
});
export type GenerateVipShoutoutInput = z.infer<typeof GenerateVipShoutoutInputSchema>;

const GenerateVipShoutoutOutputSchema = z.object({
  shoutoutMessage: z.string().describe('The generated witty, space-themed shoutout message.'),
});
export type GenerateVipShoutoutOutput = z.infer<typeof GenerateVipShoutoutOutputSchema>;

export async function generateVipShoutout(
  input: GenerateVipShoutoutInput,
): Promise<GenerateVipShoutoutOutput> {
  return generateVipShoutoutFlow(input);
}

const generateShoutoutPrompt = ai.definePrompt({
  name: 'generateVipShoutoutPrompt',
  input: { schema: GenerateVipShoutoutInputSchema },
  output: { schema: GenerateVipShoutoutOutputSchema },
  prompt: `You are a hype-person for a space-themed Twitch community called 'Cosmic Raid'.
Your task is to generate a witty, fun, and epic space-themed shoutout message for a VIP streamer who has just gone live.
The message should be between 300 and 400 characters. Use space and sci-fi metaphors.

Generate a shoutout for the streamer: @{{{vipName}}}`,
  config: {
    temperature: 0.8,
  },
});

const generateVipShoutoutFlow = ai.defineFlow(
  {
    name: 'generateVipShoutoutFlow',
    inputSchema: GenerateVipShoutoutInputSchema,
    outputSchema: GenerateVipShoutoutOutputSchema,
  },
  async (input) => {
    const { output } = await generateShoutoutPrompt(input);
    return output!;
  },
);
