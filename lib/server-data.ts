import { sql } from "@/lib/db";
import { Essay, PageContent, categories } from "@/lib/data";
import { essayToKnowledgeChunks } from "@/lib/knowledge";

type EssayRow = {
  id: string | number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  published: boolean;
  featured: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  read_time: number;
};

type PageRow = {
  page_key: string;
  title: string;
  content: string;
  updated_at?: Date | string;
};

function toDateString(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString().split("T")[0];
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().split("T")[0];
}

function rowToEssay(row: EssayRow): Essay {
  return {
    id: typeof row.id === "number" ? row.id : Number(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    published: row.published,
    featured: row.featured,
    created_at: toDateString(row.created_at),
    updated_at: toDateString(row.updated_at),
    read_time: row.read_time,
  };
}

export async function getEssays(): Promise<Essay[]> {
  const rows = await sql<EssayRow[]>`select * from essays order by id asc`;
  return rows.map(rowToEssay);
}

export async function getPublishedEssays(): Promise<Essay[]> {
  return (await getEssays()).filter(essay => essay.published);
}

export async function getEssayBySlug(slug: string): Promise<Essay | undefined> {
  const rows = await sql<EssayRow[]>`select * from essays where slug = ${slug} limit 1`;
  return rows[0] ? rowToEssay(rows[0]) : undefined;
}

export async function getFeaturedIds(): Promise<number[]> {
  const rows = await sql<{ essay_id: string | number }[]>`select essay_id from featured_essays order by position asc`;
  return rows.map(row => typeof row.essay_id === "number" ? row.essay_id : Number(row.essay_id));
}

export async function getFeaturedEssays(): Promise<Essay[]> {
  const ids = await getFeaturedIds();
  const essays = await getPublishedEssays();
  return ids.map(id => essays.find(essay => essay.id === id)).filter(Boolean) as Essay[];
}

export async function saveFeaturedIds(ids: number[]) {
  await sql.begin(async tx => {
    await tx`delete from featured_essays`;
    for (const [index, essayId] of ids.slice(0, 4).entries()) {
      await tx`
        insert into featured_essays (position, essay_id)
        values (${index + 1}, ${essayId})
      `;
    }
  });
}

export async function saveEssay(essay: Partial<Essay> & { title: string; content: string; category: string }): Promise<Essay> {
  const existingById = essay.id ? await sql<EssayRow[]>`select * from essays where id = ${essay.id} limit 1` : [];
  const slug = essay.slug || essay.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const excerpt = essay.excerpt || `${essay.content.substring(0, 150).trim()}...`;
  const readTime = essay.read_time || Math.max(1, Math.ceil(essay.content.split(/\s+/).length / 200));

  const saved = await sql.begin(async tx => {
    let row: EssayRow | undefined;

    if (existingById[0]) {
      const [updated] = await tx<EssayRow[]>`
        update essays
        set title = ${essay.title},
            slug = ${slug},
            excerpt = ${excerpt},
            content = ${essay.content},
            category = ${essay.category},
            published = ${essay.published ?? true},
            featured = ${essay.featured ?? false},
            updated_at = now(),
            read_time = ${readTime}
        where id = ${existingById[0].id}
        returning *
      `;
      row = updated;
      await tx`delete from essay_chunks where essay_id = ${row.id}`;
    } else {
      const [inserted] = await tx<EssayRow[]>`
        insert into essays (slug, title, excerpt, content, category, published, featured, read_time)
        values (${slug}, ${essay.title}, ${excerpt}, ${essay.content}, ${essay.category}, ${essay.published ?? true}, ${essay.featured ?? false}, ${readTime})
        returning *
      `;
      row = inserted;
    }

    if (!row) throw new Error("Unable to save essay");

    const chunks = essayToKnowledgeChunks({
      id: Number(row.id),
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      content: row.content,
      category: row.category,
      published: row.published,
      featured: row.featured,
      created_at: toDateString(row.created_at),
      updated_at: toDateString(row.updated_at),
      read_time: row.read_time,
    });

    for (const chunk of chunks) {
      await tx`
        insert into essay_chunks (essay_id, chunk_order, kind, heading, content, token_count)
        values (${row.id}, ${chunk.order}, ${chunk.kind}, ${chunk.heading}, ${chunk.content}, ${chunk.content.split(/\s+/).length})
      `;
    }

    return rowToEssay(row);
  });

  return saved;
}

export async function deleteEssay(id: number): Promise<void> {
  await sql`delete from essays where id = ${id}`;
}

export async function getPages(): Promise<PageContent[]> {
  const rows = await sql<PageRow[]>`select page_key, title, content from site_pages order by page_key asc`;
  return rows.map(row => ({ page_key: row.page_key, title: row.title, content: row.content }));
}

export async function getPage(pageKey: string): Promise<PageContent | undefined> {
  const rows = await sql<PageRow[]>`select page_key, title, content from site_pages where page_key = ${pageKey} limit 1`;
  return rows[0] ? { page_key: rows[0].page_key, title: rows[0].title, content: rows[0].content } : undefined;
}

export async function savePage(page: PageContent): Promise<void> {
  await sql`
    insert into site_pages (page_key, title, content)
    values (${page.page_key}, ${page.title}, ${page.content})
    on conflict (page_key) do update set
      title = excluded.title,
      content = excluded.content,
      updated_at = now()
  `;
}

export function getCategoryInfo(key: string) {
  return categories.find(cat => cat.key === key);
}
