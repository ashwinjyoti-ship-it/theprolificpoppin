import { sql } from "@/lib/db";
import { buildDiscussionPrompt } from "@/lib/knowledge";

type KnowledgeRow = {
  essay_id: number | string;
  essay_slug: string;
  essay_title: string;
  essay_category: string;
  chunk_id: number | string;
  chunk_order: number;
  kind: string;
  heading: string | null;
  content: string;
};

export type EssayKnowledgeSource = {
  essayId: number;
  essaySlug: string;
  essayTitle: string;
  essayCategory: string;
  chunkId: number;
  chunkOrder: number;
  kind: string;
  heading: string | null;
  content: string;
  score: number;
};

export type DiscussionMessage = {
  role: string;
  content: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
]);

function tokenize(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function excerpt(text: string, length = 280) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return `${compact.slice(0, length).trim()}...`;
}

function scoreSource(questionTerms: string[], source: KnowledgeSourceCandidate) {
  const contentTerms = tokenize(`${source.heading || ""} ${source.content}`);
  const titleTerms = tokenize(source.essay_title);
  const contentMatches = questionTerms.filter(term => contentTerms.includes(term)).length;
  const titleMatches = questionTerms.filter(term => titleTerms.includes(term)).length;
  const slugMatches = questionTerms.filter(term => source.essay_slug.includes(term)).length;

  return contentMatches + titleMatches * 2 + slugMatches * 3;
}

type KnowledgeSourceCandidate = KnowledgeRow;

export async function retrieveEssaySources(question: string, essaySlug?: string, limit = 6): Promise<EssayKnowledgeSource[]> {
  const rows = await sql<KnowledgeRow[]>`
    select
      e.id as essay_id,
      e.slug as essay_slug,
      e.title as essay_title,
      e.category as essay_category,
      c.id as chunk_id,
      c.chunk_order,
      c.kind,
      c.heading,
      c.content
    from essay_chunks c
    join essays e on e.id = c.essay_id
    where e.published = true
      ${essaySlug ? sql`and e.slug = ${essaySlug}` : sql``}
    order by e.id asc, c.chunk_order asc
  `;

  const questionTerms = tokenize(question);
  const ranked = rows
    .map(row => ({
      essayId: Number(row.essay_id),
      essaySlug: row.essay_slug,
      essayTitle: row.essay_title,
      essayCategory: row.essay_category,
      chunkId: Number(row.chunk_id),
      chunkOrder: row.chunk_order,
      kind: row.kind,
      heading: row.heading,
      content: row.content,
      score: scoreSource(questionTerms, row),
    }))
    .filter(row => row.score > 0 || essaySlug)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.essayId !== b.essayId) return a.essayId - b.essayId;
      return a.chunkOrder - b.chunkOrder;
    })
    .slice(0, limit);

  return ranked.length > 0
    ? ranked
    : rows.slice(0, limit).map(row => ({
        essayId: Number(row.essay_id),
        essaySlug: row.essay_slug,
        essayTitle: row.essay_title,
        essayCategory: row.essay_category,
        chunkId: Number(row.chunk_id),
        chunkOrder: row.chunk_order,
        kind: row.kind,
        heading: row.heading,
        content: row.content,
        score: 0,
      }));
}

export async function getDiscussionMessages(threadId: string): Promise<DiscussionMessage[]> {
  const rows = await sql<DiscussionMessage[]>`
    select role, content
    from ai_discussion_messages
    where thread_id = ${threadId}
    order by created_at asc
  `;

  return rows;
}

export function buildContextBlock(sources: EssayKnowledgeSource[]) {
  return sources
    .map((source, index) => {
      const heading = source.heading ? `Heading: ${source.heading}\n` : "";
      return [
        `Source ${index + 1}: ${source.essayTitle} (${source.essaySlug})`,
        heading.trim(),
        `Excerpt: ${excerpt(source.content)}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function buildSystemPrompt() {
  return buildDiscussionPrompt().system;
}

export function buildUserPrompt(
  question: string,
  sources: EssayKnowledgeSource[],
  history: DiscussionMessage[] = [],
) {
  const conversation = history.length > 0
    ? [
        "Conversation so far:",
        ...history.map(message => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`),
        "",
      ].join("\n")
    : "";

  return [
    `User question: ${question}`,
    "",
    conversation,
    conversation ? "" : undefined,
    "Relevant essay context:",
    buildContextBlock(sources),
    "",
    "Answer with grounded reasoning. Cite essay slugs or headings when useful. If the context is thin, say that plainly.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function saveDiscussionExchange(params: {
  question: string;
  answer: string;
  sources: EssayKnowledgeSource[];
  essayId?: number | null;
  threadId?: string | null;
}) {
  const thread = params.threadId
    ? (
        await sql<{ id: string }[]>`
          update ai_discussion_threads
          set essay_id = coalesce(essay_id, ${params.essayId || null}),
              thread_title = coalesce(thread_title, ${excerpt(params.question, 120)}),
              user_prompt = ${params.question},
              assistant_summary = ${params.answer},
              status = ${"answered"},
              updated_at = now()
          where id = ${params.threadId}
          returning id
        `
      )[0]
    : (
        await sql<{ id: string }[]>`
          insert into ai_discussion_threads (essay_id, thread_title, user_prompt, assistant_summary, status)
          values (${params.essayId || null}, ${excerpt(params.question, 120)}, ${params.question}, ${params.answer}, ${"answered"})
          returning id
        `
      )[0];

  if (!thread) {
    throw new Error("Unable to persist discussion thread");
  }

  await sql`
    insert into ai_discussion_messages (thread_id, role, content, metadata)
    values (
      ${thread.id},
      ${"user"},
      ${params.question},
      ${JSON.stringify({ sources: params.sources.map(source => ({ essaySlug: source.essaySlug, chunkId: source.chunkId, heading: source.heading })) })}::jsonb
    )
  `;

  await sql`
    insert into ai_discussion_messages (thread_id, role, content, metadata)
    values (
      ${thread.id},
      ${"assistant"},
      ${params.answer},
      ${JSON.stringify({ sources: params.sources.map(source => ({ essaySlug: source.essaySlug, chunkId: source.chunkId, heading: source.heading, score: source.score })) })}::jsonb
    )
  `;

  return thread.id;
}
