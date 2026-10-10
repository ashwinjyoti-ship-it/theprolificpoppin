import { sql } from "@/lib/db";

/** Attach a thread to the signed-in user when it still belongs to this anonymous id (or is unowned). */
export async function claimThreadForUser(params: {
  threadId: string;
  userId: string;
  anonId: string | null;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(params.threadId)) return false;

  const rows = await sql<{ id: string }[]>`
    update ai_discussion_threads
    set user_id = ${params.userId},
        updated_at = now()
    where id = ${params.threadId}
      and (
        user_id = ${params.userId}
        or (
          user_id is null
          and (
            anonymous_id is null
            ${params.anonId ? sql`or anonymous_id = ${params.anonId}::uuid` : sql``}
          )
        )
      )
    returning id
  `;

  return Boolean(rows[0]);
}

export async function assertThreadReadable(params: {
  threadId: string;
  userId: string | null;
  anonId: string | null;
}): Promise<boolean> {
  const rows = await sql<{ user_id: string | null; anonymous_id: string | null }[]>`
    select user_id, anonymous_id::text as anonymous_id
    from ai_discussion_threads
    where id = ${params.threadId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return false;
  // Once claimed by an account, only that user may read (cookie alone must not).
  if (row.user_id) {
    return Boolean(params.userId && row.user_id === params.userId);
  }
  // Legacy threads with no owner stay readable (localStorage restore).
  if (!row.anonymous_id) return true;
  if (params.anonId && row.anonymous_id === params.anonId) return true;
  return false;
}
