import type { Essay } from "@/lib/data";

export type KnowledgeChunkKind = "title" | "heading" | "paragraph" | "note";

export interface KnowledgeChunk {
  essaySlug: string;
  essayTitle: string;
  essayCategory: string;
  order: number;
  kind: KnowledgeChunkKind;
  heading: string | null;
  content: string;
}

export interface DiscussionPrompt {
  system: string;
  userTemplate: string;
}

function stripMarkdownHeading(line: string) {
  return line.replace(/^#{1,3}\s+/, "").trim();
}

function cleanLine(line: string) {
  return line.trim().replace(/\s+/g, " ");
}

export function essayToKnowledgeChunks(essay: Essay): KnowledgeChunk[] {
  const blocks = essay.content
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const chunks: KnowledgeChunk[] = [
    {
      essaySlug: essay.slug,
      essayTitle: essay.title,
      essayCategory: essay.category,
      order: 0,
      kind: "title",
      heading: "Title",
      content: essay.title,
    },
  ];

  let currentHeading: string | null = null;
  let order = 1;

  for (const block of blocks) {
    const firstLine = block.split("\n")[0] ?? "";

    if (/^#{1,3}\s+/.test(firstLine)) {
      currentHeading = stripMarkdownHeading(firstLine);
      chunks.push({
        essaySlug: essay.slug,
        essayTitle: essay.title,
        essayCategory: essay.category,
        order,
        kind: "heading",
        heading: currentHeading,
        content: currentHeading,
      });
      order += 1;
      continue;
    }

    const content = block
      .split("\n")
      .map(cleanLine)
      .filter(Boolean)
      .join(" ");

    if (!content) continue;

    chunks.push({
      essaySlug: essay.slug,
      essayTitle: essay.title,
      essayCategory: essay.category,
      order,
      kind: "paragraph",
      heading: currentHeading,
      content,
    });
    order += 1;
  }

  return chunks;
}

export function buildEssaySearchDocument(essay: Essay) {
  return {
    slug: essay.slug,
    title: essay.title,
    excerpt: essay.excerpt,
    category: essay.category,
    published: essay.published,
    featured: essay.featured,
    readTime: essay.read_time,
    content: essay.content,
    chunks: essayToKnowledgeChunks(essay),
  };
}

export function buildDiscussionPrompt(): DiscussionPrompt {
  return {
    system:
      "You are an essay discussion assistant for theprolificpoppin.com. Answer using the essay knowledge base first. Prefer grounding claims in retrieved essay chunks. If the evidence is incomplete, say so clearly and ask a focused follow-up. Keep the voice thoughtful, direct, and conversational.",
    userTemplate:
      "User question: {{question}}\n\nRelevant essay context:\n{{context}}\n\nAnswer with concise reasoning and cite the essay slug or heading when useful.",
  };
}

