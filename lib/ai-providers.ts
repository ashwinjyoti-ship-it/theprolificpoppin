import {
  AI_LIMITS,
  ANTHROPIC_CHAT_EFFORT,
  ANTHROPIC_CHAT_THINKING,
  type AiProviderConfig,
} from "@/lib/ai-config";
import { sanitizeModelReply, wasTruncatedByStop } from "@/lib/ai-reply";
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

export type ModelReply = {
  answer: string;
  provider: string;
  model: string;
  truncated: boolean;
  stopReason: string | null;
};

export type StreamChunk =
  | { type: "delta"; text: string }
  | { type: "end"; stopReason: string | null };

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

function anthropicBody(config: AiProviderConfig, params: GenerateParams, stream: boolean) {
  const turns = toChatTurns(params.history, params.question, params.contextBlock);
  return {
    model: config.model,
    max_tokens: AI_LIMITS.maxOutputTokens,
    temperature: 0.55,
    // Cap up-front thinking so tokens go to the visible reply (see ANTHROPIC_CHAT_THINKING).
    thinking: ANTHROPIC_CHAT_THINKING,
    output_config: { effort: ANTHROPIC_CHAT_EFFORT },
    system: params.system,
    stream: stream || undefined,
    messages: turns.map(turn => ({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content,
    })),
  };
}

function extractAnthropicText(content: Array<{ type?: string; text?: string }> | undefined): string {
  return (
    content
      ?.filter(part => part.type === "text" && part.text)
      .map(part => part.text)
      .join("\n")
      .trim() || ""
  );
}

async function callAnthropic(config: AiProviderConfig, params: GenerateParams): Promise<ModelReply> {
  const response = await withTimeout(
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody(config, params, false)),
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
    stop_reason?: string | null;
  };

  const stopReason = payload.stop_reason ?? null;
  const raw = extractAnthropicText(payload.content);
  if (!raw) throw new Error("Anthropic returned an empty reply");

  const truncated = wasTruncatedByStop(stopReason);
  return {
    answer: sanitizeModelReply(raw, truncated),
    provider: config.provider,
    model: config.model,
    truncated,
    stopReason,
  };
}

async function callOpenAI(config: AiProviderConfig, params: GenerateParams): Promise<ModelReply> {
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
    await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string | null;
    }>;
  };
  const choice = payload.choices?.[0];
  const raw = choice?.message?.content?.trim() || "";
  if (!raw) throw new Error("OpenAI returned an empty reply");

  const stopReason = choice?.finish_reason ?? null;
  const truncated = stopReason === "length";
  return {
    answer: sanitizeModelReply(raw, truncated),
    provider: config.provider,
    model: config.model,
    truncated,
    stopReason,
  };
}

export async function generateModelReply(
  config: AiProviderConfig,
  params: GenerateParams,
): Promise<ModelReply> {
  return config.provider === "anthropic"
    ? callAnthropic(config, params)
    : callOpenAI(config, params);
}

/** Stream Anthropic SSE as text deltas, then an end chunk with stop_reason. */
export async function* streamModelReply(
  config: AiProviderConfig,
  params: GenerateParams,
): AsyncGenerator<StreamChunk, void, unknown> {
  if (config.provider !== "anthropic") {
    const reply = await generateModelReply(config, params);
    yield { type: "delta", text: reply.answer };
    yield { type: "end", stopReason: reply.stopReason };
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.providerTimeoutMs);
  let stopReason: string | null = null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody(config, params, true)),
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
            delta?: { type?: string; text?: string; stop_reason?: string | null };
          };
          // Only stream visible text; ignore thinking deltas if any still appear.
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            yield { type: "delta", text: event.delta.text };
          }
          if (event.type === "message_delta" && event.delta && "stop_reason" in event.delta) {
            stopReason = event.delta.stop_reason ?? null;
          }
        } catch {
          /* skip malformed SSE chunks */
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  yield { type: "end", stopReason };
}
