import process from "node:process";
import postgres from "postgres";
import { defaultEssays, defaultPages } from "../lib/data.ts";
import { essayToKnowledgeChunks } from "../lib/knowledge.ts";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is missing.");
}

const sql = postgres(url, {
  max: 1,
  prepare: false,
  ssl: "require",
});

const essayRows = defaultEssays.map(essay => ({
  id: essay.id,
  slug: essay.slug,
  title: essay.title,
  excerpt: essay.excerpt,
  content: essay.content,
  category: essay.category,
  published: essay.published,
  featured: essay.featured,
  created_at: essay.created_at,
  updated_at: essay.updated_at,
  read_time: essay.read_time,
}));

await sql.begin(async tx => {
  await tx`
    truncate table
      featured_essays,
      essay_chunks,
      site_pages,
      essays
    restart identity cascade
  `;

  await tx`
    insert into essays ${tx(
      essayRows,
      "id",
      "slug",
      "title",
      "excerpt",
      "content",
      "category",
      "published",
      "featured",
      "created_at",
      "updated_at",
      "read_time"
    )}
  `;

  const chunkRows = defaultEssays.flatMap(essay =>
    essayToKnowledgeChunks(essay).map(chunk => ({
      essay_id: essay.id,
      chunk_order: chunk.order,
      kind: chunk.kind,
      heading: chunk.heading,
      content: chunk.content,
      token_count: chunk.content.split(/\s+/).filter(Boolean).length,
      embedding_model: null,
    })),
  );

  if (chunkRows.length > 0) {
    await tx`
      insert into essay_chunks ${tx(
        chunkRows,
        "essay_id",
        "chunk_order",
        "kind",
        "heading",
        "content",
        "token_count",
        "embedding_model"
      )}
    `;
  }

  await tx`
    insert into site_pages ${tx(defaultPages, "page_key", "title", "content")}
  `;

  const featuredRows = defaultEssays
    .filter(essay => essay.featured)
    .slice(0, 4)
    .map((essay, index) => ({
      position: index + 1,
      essay_id: essay.id,
    }));

  if (featuredRows.length > 0) {
    await tx`
      insert into featured_essays ${tx(featuredRows, "position", "essay_id")}
    `;
  }
});

await sql.end({ timeout: 5 });

console.log("Neon seed applied successfully.");
