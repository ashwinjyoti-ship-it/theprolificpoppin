import { NextResponse } from "next/server";
import { attachAnonCookie, ensureAnonId, hashIp, readAnonIdFromCookieHeader } from "@/lib/anon-id";
import { getClientIp } from "@/lib/ai-rate-limit";

export { attachAnonCookie, ensureAnonId, hashIp, readAnonIdFromCookieHeader };

export function getClientIpSafe(request: Request) {
  return getClientIp(request);
}
