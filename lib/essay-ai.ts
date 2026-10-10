import { AI_LIMITS } from "@/lib/ai-config";
import { sql } from "@/lib/db";
import { buildDiscussionPrompt, MR_POPPIN_OPENING } from "@/lib/knowledge";

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

const CHIT_CHAT_RE =
  /^(hi|hello|hey|yo|sup|howdy|good\s+(morning|afternoon|evening)|thanks|thank\s+you|thx|ok|okay|cool|nice|bye|goodbye|see\s+ya|what'?s\s+up|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.?]*$/i;

function tokenize(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function excerpt(text: string, length = 280) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= length) return compact;
  return `${compact.slice(0, length).trim()}...`;
}

function scoreSource(questionTerms: string[], source: KnowledgeRow) {
  const contentTerms = tokenize(`${source.heading || ""} ${source.content}`);
  const titleTerms = tokenize(source.essay_title);
  const contentMatches = questionTerms.filter(term => contentTerms.includes(term)).length;
  const titleMatches = questionTerms.filter(term => titleTerms.includes(term)).length;
  const slugMatches = questionTerms.filter(term => source.essay_slug.includes(term)).length;

  return contentMatches + titleMatches * 2 + slugMatches * 3;
}

/** Greetings / small talk should not pull random essay chunks. */
export function isChitChat(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 24 && CHIT_CHAT_RE.test(trimmed)) return true;
  const terms = tokenize(trimmed);
  return terms.length === 0 && trimmed.length < 40;
}

export async function retrieveEssaySources(
  question: string,
  essaySlug?: string,
  limit = 6,
): Promise<EssayKnowledgeSource[]> {
  if (!essaySlug && isChitChat(question)) {
    return [];
  }

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
  if (questionTerms.length === 0 && !essaySlug) {
    return [];
  }

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
    .filter(row => row.score > 0 || Boolean(essaySlug))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.essayId !== b.essayId) return a.essayId - b.essayId;
      return a.chunkOrder - b.chunkOrder;
    })
    .slice(0, limit);

  // Never fall back to arbitrary score-0 chunks — that made "Hi" return childhood passages.
  return ranked;
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

/** Cap history by turn count and approximate character budget (cheapest token proxy). */
export function trimHistory(history: DiscussionMessage[]): DiscussionMessage[] {
  const recent = history.slice(-AI_LIMITS.maxHistoryTurns * 2);
  let total = 0;
  const kept: DiscussionMessage[] = [];

  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const message = recent[i];
    if (!message) continue;
    const len = message.content.length;
    if (total + len > AI_LIMITS.maxHistoryChars && kept.length > 0) break;
    kept.unshift(message);
    total += len;
  }

  return kept;
}

export function buildContextBlock(sources: EssayKnowledgeSource[]) {
  if (sources.length === 0) return "";

  return sources
    .map((source, index) => {
      const heading = source.heading ? `Heading: ${source.heading}\n` : "";
      return [
        `Source ${index + 1}: ${source.essayTitle} (/essays/${source.essaySlug})`,
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

export function getOpeningLine() {
  return MR_POPPIN_OPENING;
}

/**
 * Archive-only reply when no model key is set.
 * Speaks like Mr. Poppin without promising (or admitting) an unconfigured model.
 */
export function buildArchiveOnlyAnswer(question: string, sources: EssayKnowledgeSource[]): string {
  if (isChitChat(question) || sources.length === 0) {
    if (isChitChat(question)) {
      return `${MR_POPPIN_OPENING}\n\n(I'm quieter when the conversation tools are offline — try a theme from the essays: attention, desire, the body, conditioning.)`;
    }
    return `I don't have a clean match in the archive for that. Try naming a theme the essays care about — attention, desire, the body, consciousness — or an essay title you remember.`;
  }

  const top = sources.slice(0, 2);
  const lines = top.map(source => {
    const bit = excerpt(source.content, 160);
    return `In [${source.essayTitle}](/essays/${source.essaySlug})${source.heading ? ` (${source.heading})` : ""}: ${bit}`;
  });

  return [
    "Here's where the essays look at something close to what you asked:",
    "",
    ...lines,
    "",
    "Sit with whichever line lands. Notice what your body does when you read it — that's the experiment.",
  ].join("\n");
}

export async function saveDiscussionExchange(params: {
  question: string;
  answer: string;
  sources: EssayKnowledgeSource[];
  essayId?: number | null;
  threadId?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
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
              user_id = coalesce(user_id, ${params.userId || null}),
              anonymous_id = coalesce(anonymous_id, ${params.anonymousId || null}::uuid),
              updated_at = now()
          where id = ${params.threadId}
          returning id
        `
      )[0]
    : (
        await sql<{ id: string }[]>`
          insert into ai_discussion_threads (
            essay_id, thread_title, user_prompt, assistant_summary, status, user_id, anonymous_id
          )
          values (
            ${params.essayId || null},
            ${excerpt(params.question, 120)},
            ${params.question},
            ${params.answer},
            ${"answered"},
            ${params.userId || null},
            ${params.anonymousId || null}::uuid
          )
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
      ${JSON.stringify({
        sources: params.sources.map(source => ({
          essaySlug: source.essaySlug,
          chunkId: source.chunkId,
          heading: source.heading,
        })),
      })}::jsonb
    )
  `;

  await sql`
    insert into ai_discussion_messages (thread_id, role, content, metadata)
    values (
      ${thread.id},
      ${"assistant"},
      ${params.answer},
      ${JSON.stringify({
        sources: params.sources.map(source => ({
          essaySlug: source.essaySlug,
          chunkId: source.chunkId,
          heading: source.heading,
        })),
      })}::jsonb
    )
  `;

  return thread.id;
}

export function publicSources(sources: EssayKnowledgeSource[]) {
  return sources.map(source => ({
    essayId: source.essayId,
    essaySlug: source.essaySlug,
    essayTitle: source.essayTitle,
    essayCategory: source.essayCategory,
    chunkId: source.chunkId,
    chunkOrder: source.chunkOrder,
    kind: source.kind,
    heading: source.heading,
    excerpt: source.content.slice(0, 240).trim(),
  }));
}
