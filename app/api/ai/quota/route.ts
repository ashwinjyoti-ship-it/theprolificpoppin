import { NextResponse } from "next/server";
import { auth, readerAuthProviders } from "@/auth";
import { attachAnonCookie, ensureAnonId, getClientIpSafe } from "@/lib/anon-helpers";
import { getQuotaSnapshot } from "@/lib/ai-quota";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const { anonId, setCookie } = ensureAnonId(request);
  const ip = getClientIpSafe(request);

  const identity = session?.user?.id
    ? ({ kind: "user" as const, userId: session.user.id })
    : ({ kind: "anon" as const, anonId, ip });

  try {
    const quota = await getQuotaSnapshot(identity);
    const response = NextResponse.json({
      ...quota,
      email: session?.user?.email ?? null,
      name: session?.user?.name ?? null,
      providers: readerAuthProviders(),
    });
    return attachAnonCookie(response, setCookie);
  } catch (err) {
    console.error("[ai/quota]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not load quota." }, { status: 500 });
  }
}
