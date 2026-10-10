import { NextResponse } from "next/server";
import { AI_LIMITS, getAiProviderConfig, isAiConfigured } from "@/lib/ai-config";
import { generateModelReply, streamModelReply } from "@/lib/ai-providers";
import { checkRateLimit, getClientIp } from "@/lib/ai-rate-limit";
import {
  buildArchiveOnlyAnswer,
  buildContextBlock,
  buildSystemPrompt,
  getDiscussionMessages,
  publicSources,
  retrieveEssaySources,
  saveDiscussionExchange,
  trimHistory,
} from "@/lib/essay-ai";

export const runtime = "nodejs";
export const maxDuration = 30;

function friendlyError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function parseQuestionBody(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const question = typeof record?.question === "string" ? record.question.trim() : "";
  const essaySlug =
    typeof record?.essaySlug === "string" && record.essaySlug.trim() ? record.essaySlug.trim() : undefined;
  const threadId =
    typeof record?.threadId === "string" && record.threadId.trim() ? record.threadId.trim() : undefined;
  const stream = record?.stream === true;
  return { question, essaySlug, threadId, stream };
}

/** Restore a prior thread for localStorage persistence. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId")?.trim();

  if (!threadId) {
    return friendlyError(400, "threadId is required");
  }

  // Basic UUID shape check — avoid probing arbitrary strings into the DB.
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return friendlyError(400, "Invalid threadId");
  }

  try {
    const messages = await getDiscussionMessages(threadId);
    if (messages.length === 0) {
      return friendlyError(404, "Thread not found");
    }

    return NextResponse.json({
      threadId,
      configured: isAiConfigured(),
      messages: messages.map(message => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    });
  } catch {
    return friendlyError(500, "Could not load that conversation. Please try again.");
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return friendlyError(429, "You're asking a bit quickly. Take a breath and try again in a moment.", {
      retryAfterSec: rate.retryAfterSec,
    });
  }

  const body = await request.json().catch(() => null);
  const { question, essaySlug, threadId, stream } = parseQuestionBody(body);

  if (!question) {
    return friendlyError(400, "Please type a question first.");
  }

  if (question.length > AI_LIMITS.maxQuestionChars) {
    return friendlyError(
      400,
      `That question is a little long — keep it under ${AI_LIMITS.maxQuestionChars} characters.`,
    );
  }

  try {
    const sources = await retrieveEssaySources(question, essaySlug);
    const history = threadId ? trimHistory(await getDiscussionMessages(threadId)) : [];
    const config = getAiProviderConfig();
    const contextBlock = buildContextBlock(sources);
    const system = buildSystemPrompt();
    const primaryEssayId = sources[0]?.essayId ?? null;
    const publicSourceList = publicSources(sources);

    if (!config) {
      const answer = buildArchiveOnlyAnswer(question, sources);
      const persistedThreadId = await saveDiscussionExchange({
        question,
        answer,
        sources,
        essayId: primaryEssayId,
        threadId,
      });

      return NextResponse.json({
        threadId: persistedThreadId,
        answer,
        configured: false,
        model: null,
        provider: null,
        sources: publicSourceList,
      });
    }

    // Streaming path (Anthropic SSE → NDJSON for the client).
    if (stream && config.provider === "anthropic") {
      const encoder = new TextEncoder();
      let fullAnswer = "";

      const readable = new ReadableStream({
        async start(controller) {
          const send = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          try {
            send({
              type: "meta",
              configured: true,
              model: config.model,
              provider: config.provider,
              sources: publicSourceList,
            });

            for await (const delta of streamModelReply(config, {
              system,
              question,
              history,
              contextBlock,
            })) {
              fullAnswer += delta;
              send({ type: "delta", text: delta });
            }

            if (!fullAnswer.trim()) {
              fullAnswer = buildArchiveOnlyAnswer(question, sources);
              send({ type: "delta", text: fullAnswer });
            }

            const persistedThreadId = await saveDiscussionExchange({
              question,
              answer: fullAnswer,
              sources,
              essayId: primaryEssayId,
              threadId,
            });

            send({ type: "done", threadId: persistedThreadId, answer: fullAnswer });
            controller.close();
          } catch {
            if (!fullAnswer.trim()) {
              send({
                type: "error",
                error: "Mr. Poppin couldn't finish that reply. Please try again in a moment.",
              });
            } else {
              try {
                const persistedThreadId = await saveDiscussionExchange({
                  question,
                  answer: fullAnswer,
                  sources,
                  essayId: primaryEssayId,
                  threadId,
                });
                send({ type: "done", threadId: persistedThreadId, answer: fullAnswer });
              } catch {
                send({ type: "done", threadId: threadId || null, answer: fullAnswer });
              }
            }
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const generated = await generateModelReply(config, {
      system,
      question,
      history,
      contextBlock,
    });

    const persistedThreadId = await saveDiscussionExchange({
      question,
      answer: generated.answer,
      sources,
      essayId: primaryEssayId,
      threadId,
    });

    return NextResponse.json({
      threadId: persistedThreadId,
      answer: generated.answer,
      configured: true,
      model: generated.model,
      provider: generated.provider,
      sources: publicSourceList,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/timed out/i.test(message)) {
      return friendlyError(504, "That took too long. Try a shorter question, or try again shortly.");
    }
    console.error("[ai/query]", message || err);
    return friendlyError(500, "Something went sideways. Please try again in a moment.");
  }
}
