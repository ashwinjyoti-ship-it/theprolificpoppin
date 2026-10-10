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

/** Atomically increment if under limit; returns new count or null if the cap was hit. */
async function bumpIfUnderLimit(
  day: string,
  subjectType: "user" | "anon" | "ip",
  subjectKey: string,
  limit: number,
): Promise<number | null> {
  const rows = await sql<UsageRow[]>`
    insert into ai_chat_usage (day_ist, subject_type, subject_key, question_count)
    values (${day}::date, ${subjectType}, ${subjectKey}, 1)
    on conflict (day_ist, subject_type, subject_key)
    do update set
      question_count = ai_chat_usage.question_count + 1,
      updated_at = now()
    where ai_chat_usage.question_count < ${limit}
    returning question_count
  `;
  return rows[0]?.question_count ?? null;
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
  const day = istDay();

  if (identity.kind === "user") {
    const used = await bumpIfUnderLimit(day, "user", identity.userId, USER_DAILY_LIMIT);
    if (used === null) {
      const before = await getQuotaSnapshot(identity);
      return { ...before, allowed: false, consumed: false };
    }
    return {
      allowed: true,
      remaining: Math.max(0, USER_DAILY_LIMIT - used),
      limit: USER_DAILY_LIMIT,
      used,
      dayIst: day,
      signedIn: true,
      consumed: true,
    };
  }

  const ipKey = hashIp(identity.ip);
  // Lock both counters in one transaction so concurrent requests cannot slip past the cap,
  // and so a failed second bump rolls back the first.
  const used = await sql.begin(async tx => {
    await tx`
      insert into ai_chat_usage (day_ist, subject_type, subject_key, question_count)
      values
        (${day}::date, ${"anon"}, ${identity.anonId}, 0),
        (${day}::date, ${"ip"}, ${ipKey}, 0)
      on conflict (day_ist, subject_type, subject_key) do nothing
    `;

    const rows = await tx<{ question_count: number }[]>`
      select question_count
      from ai_chat_usage
      where day_ist = ${day}::date
        and (
          (subject_type = ${"anon"} and subject_key = ${identity.anonId})
          or (subject_type = ${"ip"} and subject_key = ${ipKey})
        )
      for update
    `;
    const current = rows.reduce((max, row) => Math.max(max, row.question_count), 0);
    if (current >= ANON_DAILY_LIMIT) {
      return null;
    }

    await tx`
      update ai_chat_usage
      set question_count = question_count + 1,
          updated_at = now()
      where day_ist = ${day}::date
        and (
          (subject_type = ${"anon"} and subject_key = ${identity.anonId})
          or (subject_type = ${"ip"} and subject_key = ${ipKey})
        )
    `;

    return current + 1;
  });

  if (used === null) {
    const before = await getQuotaSnapshot(identity);
    return { ...before, allowed: false, consumed: false };
  }

  return {
    allowed: true,
    remaining: Math.max(0, ANON_DAILY_LIMIT - used),
    limit: ANON_DAILY_LIMIT,
    used,
    dayIst: day,
    signedIn: false,
    consumed: true,
  };
}
