import { NextResponse } from "next/server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  getDiscussionMessages,
  retrieveEssaySources,
  saveDiscussionExchange,
} from "@/lib/essay-ai";

export const runtime = "nodejs";

function buildFallbackAnswer(question: string, sources: Awaited<ReturnType<typeof retrieveEssaySources>>) {
  if (sources.length === 0) {
    return `I couldn’t find a strong match in the essay library for: "${question}". Try naming a topic, essay, or phrase from the text.`;
  }

  const highlights = sources
    .slice(0, 3)
    .map(source => `- ${source.essayTitle}${source.heading ? `, ${source.heading}` : ""}: ${source.content.slice(0, 180).trim()}${source.content.length > 180 ? "..." : ""}`)
    .join("\n");

  return [
    `I found the most relevant essay passages for "${question}".`,
    "",
    highlights,
    "",
    "The AI model is not configured yet, so this response is grounded directly in the essay knowledge base.",
  ].join("\n");
}

async function generateAnswer(
  question: string,
  sources: Awaited<ReturnType<typeof retrieveEssaySources>>,
  history: Awaited<ReturnType<typeof getDiscussionMessages>>,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      answer: buildFallbackAnswer(question, sources),
      configured: false,
      model: null as string | null,
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(question, sources, history) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const answer = payload?.choices?.[0]?.message?.content?.trim();

  return {
    answer: answer || buildFallbackAnswer(question, sources),
    configured: true,
    model,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const essaySlug = typeof body?.essaySlug === "string" && body.essaySlug.trim() ? body.essaySlug.trim() : undefined;
  const threadId = typeof body?.threadId === "string" && body.threadId.trim() ? body.threadId.trim() : undefined;

  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const sources = await retrieveEssaySources(question, essaySlug);
  const history = threadId ? await getDiscussionMessages(threadId) : [];
  const generated = await generateAnswer(question, sources, history);
  const primaryEssayId = sources[0]?.essayId ?? null;
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
    configured: generated.configured,
    model: generated.model,
    sources: sources.map(source => ({
      essayId: source.essayId,
      essaySlug: source.essaySlug,
      essayTitle: source.essayTitle,
      essayCategory: source.essayCategory,
      chunkId: source.chunkId,
      chunkOrder: source.chunkOrder,
      kind: source.kind,
      heading: source.heading,
      score: source.score,
      excerpt: source.content.slice(0, 240).trim(),
    })),
  });
}
