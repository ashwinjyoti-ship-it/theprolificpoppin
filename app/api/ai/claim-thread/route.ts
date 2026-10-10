import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { attachAnonCookie, ensureAnonId } from "@/lib/anon-helpers";
import { claimThreadForUser } from "@/lib/ai-threads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const threadId = typeof body?.threadId === "string" ? body.threadId.trim() : "";
  if (!threadId) {
    return NextResponse.json({ error: "threadId is required" }, { status: 400 });
  }

  const { anonId, setCookie } = ensureAnonId(request);

  try {
    const claimed = await claimThreadForUser({
      threadId,
      userId: session.user.id,
      anonId,
    });
    const response = NextResponse.json({ ok: true, claimed });
    return attachAnonCookie(response, setCookie);
  } catch (err) {
    console.error("[ai/claim-thread]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not claim thread." }, { status: 500 });
  }
}
