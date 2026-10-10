/** Server-only AI provider configuration. Never import from client components. */

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const AI_LIMITS = {
  maxQuestionChars: 2000,
  maxHistoryTurns: 12,
  maxHistoryChars: 12_000,
  providerTimeoutMs: 25_000,
  // Room for a few short paragraphs + essay links. Thinking is capped separately;
  // keep this well above typical reply length so links aren't cut mid-slug.
  maxOutputTokens: 2048,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 12,
} as const;

/**
 * Sonnet 5.5 turns on adaptive (up-front) thinking by default; those tokens count
 * toward max_tokens and caused mid-link truncation in live tests.
 * Docs: thinking.type "disabled" → 400 on Sonnet 5.5.
 * Use "between_tools" (lowest setting; accepted at effort high or below) so
 * tool-less chat replies are text-only, same as disabled on earlier Sonnets.
 * @see https://platform.claude.com/docs/en/build-with-claude/thinking
 */
export const ANTHROPIC_CHAT_THINKING = { type: "between_tools" } as const;

/** Soft guidance; "low" keeps chat snappy. Must stay at high or below with between_tools. */
export const ANTHROPIC_CHAT_EFFORT = "low" as const;

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
