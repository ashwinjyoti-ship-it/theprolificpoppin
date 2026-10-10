import { hashIp } from "@/lib/anon-id";
import { sql } from "@/lib/db";

import { QUOTA_EXCEEDED_MESSAGE } from "@/lib/ai-quota-copy";

export const ANON_DAILY_LIMIT = 5;
export const USER_DAILY_LIMIT = 50;

export { QUOTA_EXCEEDED_MESSAGE };

/** Calendar day in Asia/Kolkata as YYYY-MM-DD. */
export function istDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

type UsageRow = { question_count: number };

async function getCount(day: string, subjectType: "user" | "anon" | "ip", subjectKey: string) {
  const rows = await sql<UsageRow[]>`
    select question_count
    from ai_chat_usage
    where day_ist = ${day}::date
      and subject_type = ${subjectType}
      and subject_key = ${subjectKey}
    limit 1
  `;
  return rows[0]?.question_count ?? 0;
}

async function bump(day: string, subjectType: "user" | "anon" | "ip", subjectKey: string) {
  await sql`
    insert into ai_chat_usage (day_ist, subject_type, subject_key, question_count)
    values (${day}::date, ${subjectType}, ${subjectKey}, 1)
    on conflict (day_ist, subject_type, subject_key)
    do update set
      question_count = ai_chat_usage.question_count + 1,
      updated_at = now()
  `;
}

export type QuotaIdentity =
  | { kind: "user"; userId: string }
  | { kind: "anon"; anonId: string; ip: string };

export type QuotaSnapshot = {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  dayIst: string;
  signedIn: boolean;
};

export async function getQuotaSnapshot(identity: QuotaIdentity): Promise<QuotaSnapshot> {
  const day = istDay();

  if (identity.kind === "user") {
    const used = await getCount(day, "user", identity.userId);
    return {
      allowed: used < USER_DAILY_LIMIT,
      remaining: Math.max(0, USER_DAILY_LIMIT - used),
      limit: USER_DAILY_LIMIT,
      used,
      dayIst: day,
      signedIn: true,
    };
  }

  const ipKey = hashIp(identity.ip);
  const [anonUsed, ipUsed] = await Promise.all([
    getCount(day, "anon", identity.anonId),
    getCount(day, "ip", ipKey),
  ]);
  // Cookie alone must not reset: either key hitting the cap blocks.
  const used = Math.max(anonUsed, ipUsed);
  return {
    allowed: used < ANON_DAILY_LIMIT,
    remaining: Math.max(0, ANON_DAILY_LIMIT - used),
    limit: ANON_DAILY_LIMIT,
    used,
    dayIst: day,
    signedIn: false,
  };
}

/**
 * Check + increment. `consumed` means this request was counted and may proceed.
 * After a successful 5th free question, remaining may be 0 but consumed is still true.
 */
export async function consumeQuota(
  identity: QuotaIdentity,
): Promise<QuotaSnapshot & { consumed: boolean }> {
  const before = await getQuotaSnapshot(identity);
  if (!before.allowed) {
    return { ...before, consumed: false };
  }

  const day = before.dayIst;
  if (identity.kind === "user") {
    await bump(day, "user", identity.userId);
  } else {
    const ipKey = hashIp(identity.ip);
    await Promise.all([bump(day, "anon", identity.anonId), bump(day, "ip", ipKey)]);
  }

  const after = await getQuotaSnapshot(identity);
  return {
    ...after,
    // This request was within the limit before the bump.
    allowed: true,
    consumed: true,
  };
}
