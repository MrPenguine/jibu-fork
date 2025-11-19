export const PRICING = {
  OPENAI: {
    'gpt-4o': { input: 5, output: 15 }, // per 1M tokens
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
  },
  ELEVENLABS: {
    characters: 0.3, // per 1000 characters
  },
  DEEPGRAM: {
    seconds: 0.0043, // per second
  },
  TWILIO: {
    minutes: 0.0085, // per minute
  },
} as const;

export function calculateLLMCost(
  tokens: number,
  model: string,
  type: 'input' | 'output',
): number {
  const price = (PRICING.OPENAI as any)[model]?.[type] || 0;
  return Math.round((tokens / 1_000_000) * price * 1_000_000); // microUSD
}

export function calculateTTSCost(characters: number): number {
  const pricePerThousand = PRICING.ELEVENLABS.characters;
  const usd = (characters / 1000) * pricePerThousand;
  return Math.round(usd * 1_000_000);
}

export function calculateSTTCost(seconds: number): number {
  const usd = seconds * PRICING.DEEPGRAM.seconds;
  return Math.round(usd * 1_000_000);
}

export function calculateCallCost(minutes: number): number {
  const usd = minutes * PRICING.TWILIO.minutes;
  return Math.round(usd * 1_000_000);
}
