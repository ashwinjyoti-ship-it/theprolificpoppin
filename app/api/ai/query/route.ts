import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AI_LIMITS, getAiProviderConfig, isAiConfigured } from "@/lib/ai-config";
import { generateModelReply, streamModelReply } from "@/lib/ai-providers";
import { checkRateLimit, getClientIp } from "@/lib/ai-rate-limit";
import {
  ANON_DAILY_LIMIT,
  consumeQuota,
  QUOTA_EXCEEDED_MESSAGE,
  USER_DAILY_LIMIT,
  type QuotaIdentity,
} from "@/lib/ai-quota";
import { sanitizeModelReply, wasTruncatedByStop } from "@/lib/ai-reply";
import { attachAnonCookie, ensureAnonId } from "@/lib/anon-helpers";
import { assertThreadReadable, claimThreadForUser } from "@/lib/ai-threads";
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

async function resolveIdentity(request: Request): Promise<{
  identity: QuotaIdentity;
  userId: string | null;
  anonId: string;
  setCookie: string | null;
}> {
  const session = await auth();
  const { anonId, setCookie } = ensureAnonId(request);
  const ip = getClientIp(request);
  if (session?.user?.id) {
    return {
      identity: { kind: "user", userId: session.user.id },
      userId: session.user.id,
      anonId,
      setCookie,
    };
  }
  return {
    identity: { kind: "anon", anonId, ip },
    userId: null,
    anonId,
    setCookie,
  };
}

/** Restore a prior thread for localStorage persistence. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId")?.trim();

  if (!threadId) {
    return friendlyError(400, "threadId is required");
  }

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return friendlyError(400, "Invalid threadId");
  }

  try {
    const { userId, anonId, setCookie } = await resolveIdentity(request);
    const readable = await assertThreadReadable({ threadId, userId, anonId });
    if (!readable) {
      return attachAnonCookie(friendlyError(404, "Thread not found"), setCookie);
    }

    const messages = await getDiscussionMessages(threadId);
    if (messages.length === 0) {
      return attachAnonCookie(friendlyError(404, "Thread not found"), setCookie);
    }

    if (userId) {
      await claimThreadForUser({ threadId, userId, anonId });
    }

    return attachAnonCookie(
      NextResponse.json({
        threadId,
        configured: isAiConfigured(),
        messages: messages.map(message => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      }),
      setCookie,
    );
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

  let setCookie: string | null = null;

  try {
    const resolved = await resolveIdentity(request);
    setCookie = resolved.setCookie;
    const { identity, userId, anonId } = resolved;

    if (threadId && userId) {
      await claimThreadForUser({ threadId, userId, anonId });
    }

    if (threadId) {
      const readable = await assertThreadReadable({ threadId, userId, anonId });
      if (!readable) {
        return attachAnonCookie(friendlyError(404, "Thread not found"), setCookie);
      }
    }

    const quota = await consumeQuota(identity);
    if (!quota.consumed) {
      const limit = userId ? USER_DAILY_LIMIT : ANON_DAILY_LIMIT;
      return attachAnonCookie(
        NextResponse.json({
          quotaExceeded: true,
          signInRequired: !userId,
          answer: userId
            ? `That's enough looking for one day (${limit} questions). Come back tomorrow and we'll pick it up again.`
            : QUOTA_EXCEEDED_MESSAGE,
          threadId: threadId || null,
          configured: isAiConfigured(),
          model: null,
          provider: null,
          sources: [],
          quota: {
            remaining: 0,
            limit,
            used: quota.used,
            signedIn: Boolean(userId),
          },
        }),
        setCookie,
      );
    }

    const sources = await retrieveEssaySources(question, essaySlug);
    const history = threadId ? trimHistory(await getDiscussionMessages(threadId)) : [];
    const config = getAiProviderConfig();
    const contextBlock = buildContextBlock(sources);
    const system = buildSystemPrompt();
    const primaryEssayId = sources[0]?.essayId ?? null;
    const publicSourceList = publicSources(sources);
    const owner = { userId, anonymousId: anonId };

    if (!config) {
      const answer = buildArchiveOnlyAnswer(question, sources);
      const persistedThreadId = await saveDiscussionExchange({
        question,
        answer,
        sources,
        essayId: primaryEssayId,
        threadId,
        ...owner,
      });

      return attachAnonCookie(
        NextResponse.json({
          threadId: persistedThreadId,
          answer,
          configured: false,
          model: null,
          provider: null,
          sources: publicSourceList,
          quota: {
            remaining: quota.remaining,
            limit: quota.limit,
            used: quota.used,
            signedIn: Boolean(userId),
          },
        }),
        setCookie,
      );
    }

    if (stream && config.provider === "anthropic") {
      const encoder = new TextEncoder();
      let fullAnswer = "";
      let stopReason: string | null = null;
      const cookieHeader = setCookie;

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
              quota: {
                remaining: quota.remaining,
                limit: quota.limit,
                used: quota.used,
                signedIn: Boolean(userId),
              },
            });

            for await (const chunk of streamModelReply(config, {
              system,
              question,
              history,
              contextBlock,
            })) {
              if (chunk.type === "delta") {
                fullAnswer += chunk.text;
                send({ type: "delta", text: chunk.text });
              } else {
                stopReason = chunk.stopReason;
              }
            }

            if (!fullAnswer.trim()) {
              fullAnswer = buildArchiveOnlyAnswer(question, sources);
              send({ type: "delta", text: fullAnswer });
            }

            const truncated = wasTruncatedByStop(stopReason);
            const answer = sanitizeModelReply(fullAnswer, truncated);
            if (answer !== fullAnswer) {
              send({ type: "replace", text: answer });
            }

            const persistedThreadId = await saveDiscussionExchange({
              question,
              answer,
              sources,
              essayId: primaryEssayId,
              threadId,
              ...owner,
            });

            send({
              type: "done",
              threadId: persistedThreadId,
              answer,
              truncated,
            });
            controller.close();
          } catch {
            const answer = sanitizeModelReply(fullAnswer, true);
            if (!answer.trim()) {
              send({
                type: "error",
                error: "Mr. Poppin couldn't finish that reply. Please try again in a moment.",
              });
            } else {
              try {
                const persistedThreadId = await saveDiscussionExchange({
                  question,
                  answer,
                  sources,
                  essayId: primaryEssayId,
                  threadId,
                  ...owner,
                });
                send({ type: "done", threadId: persistedThreadId, answer, truncated: true });
              } catch {
                send({ type: "done", threadId: threadId || null, answer, truncated: true });
              }
            }
            controller.close();
          }
        },
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      };
      if (cookieHeader) {
        headers["Set-Cookie"] = cookieHeader;
      }

      return new Response(readable, { headers });
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
      ...owner,
    });

    return attachAnonCookie(
      NextResponse.json({
        threadId: persistedThreadId,
        answer: generated.answer,
        configured: true,
        model: generated.model,
        provider: generated.provider,
        truncated: generated.truncated,
        sources: publicSourceList,
        quota: {
          remaining: quota.remaining,
          limit: quota.limit,
          used: quota.used,
          signedIn: Boolean(userId),
        },
      }),
      setCookie,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/timed out/i.test(message)) {
      return attachAnonCookie(
        friendlyError(504, "That took too long. Try a shorter question, or try again shortly."),
        setCookie,
      );
    }
    if (/AUTH_SECRET|relation .* does not exist/i.test(message)) {
      console.error("[ai/query]", message);
      return friendlyError(
        500,
        "Chat sign-in or quota tables are not ready yet. Ask Ash to apply the Neon migration.",
      );
    }
    console.error("[ai/query]", message || err);
    return attachAnonCookie(
      friendlyError(500, "Something went sideways. Please try again in a moment."),
      setCookie,
    );
  }
}
