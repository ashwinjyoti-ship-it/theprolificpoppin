/** Server-only AI provider configuration. Never import from client components. */

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const AI_LIMITS = {
  maxQuestionChars: 2000,
  maxHistoryTurns: 12,
  maxHistoryChars: 12_000,
  providerTimeoutMs: 25_000,
  maxOutputTokens: 700,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 12,
} as const;

export type AiProviderName = "anthropic" | "openai";

export type AiProviderConfig = {
  provider: AiProviderName;
  model: string;
  apiKey: string;
};

export function getAiProviderConfig(): AiProviderConfig | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return {
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      apiKey: anthropicKey,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      apiKey: openaiKey,
    };
  }

  return null;
}

export function isAiConfigured(): boolean {
  return getAiProviderConfig() !== null;
}
