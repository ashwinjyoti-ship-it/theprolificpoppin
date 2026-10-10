import { AI_LIMITS, type AiProviderConfig } from "@/lib/ai-config";
import type { DiscussionMessage } from "@/lib/essay-ai";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateParams = {
  system: string;
  question: string;
  history: DiscussionMessage[];
  contextBlock: string;
};

function toChatTurns(history: DiscussionMessage[], question: string, contextBlock: string): ChatTurn[] {
  const turns: ChatTurn[] = [];

  for (const message of history) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const content = message.content.trim();
    if (!content) continue;
    turns.push({ role: message.role, content });
  }

  const userContent = [
    contextBlock ? `Relevant essay passages:\n${contextBlock}` : "No essay passages were retrieved for this turn.",
    "",
    `Reader: ${question}`,
  ].join("\n");

  turns.push({ role: "user", content: userContent });
  return turns;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      err => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function callAnthropic(config: AiProviderConfig, params: GenerateParams): Promise<string> {
  const turns = toChatTurns(params.history, params.question, params.contextBlock);
  const response = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: AI_LIMITS.maxOutputTokens,
        temperature: 0.55,
        system: params.system,
        messages: turns.map(turn => ({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: turn.content,
        })),
      }),
    }),
    AI_LIMITS.providerTimeoutMs,
    "Anthropic",
  );

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new Error(`Anthropic request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content
    ?.filter(part => part.type === "text" && part.text)
    .map(part => part.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("Anthropic returned an empty reply");
  return text;
}

async function callOpenAI(config: AiProviderConfig, params: GenerateParams): Promise<string> {
  const turns = toChatTurns(params.history, params.question, params.contextBlock);
  const response = await withTimeout(
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.55,
        max_tokens: AI_LIMITS.maxOutputTokens,
        messages: [
          { role: "system", content: params.system },
          ...turns.map(turn => ({
            role: turn.role,
            content: turn.content,
          })),
        ],
      }),
    }),
    AI_LIMITS.providerTimeoutMs,
    "OpenAI",
  );

  if (!response.ok) {
    await response.text();
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned an empty reply");
  return text;
}

export async function generateModelReply(
  config: AiProviderConfig,
  params: GenerateParams,
): Promise<{ answer: string; provider: string; model: string }> {
  const answer =
    config.provider === "anthropic"
      ? await callAnthropic(config, params)
      : await callOpenAI(config, params);

  return { answer, provider: config.provider, model: config.model };
}

/** Stream Anthropic SSE; yields text deltas. Falls back to full reply for OpenAI. */
export async function* streamModelReply(
  config: AiProviderConfig,
  params: GenerateParams,
): AsyncGenerator<string, void, unknown> {
  if (config.provider !== "anthropic") {
    const { answer } = await generateModelReply(config, params);
    yield answer;
    return;
  }

  const turns = toChatTurns(params.history, params.question, params.contextBlock);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.providerTimeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: AI_LIMITS.maxOutputTokens,
        temperature: 0.55,
        stream: true,
        system: params.system,
        messages: turns.map(turn => ({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: turn.content,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      await response.text().catch(() => "");
      throw new Error(`Anthropic stream failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const event = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            yield event.delta.text;
          }
        } catch {
          /* skip malformed SSE chunks */
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
