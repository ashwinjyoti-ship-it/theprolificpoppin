import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

export const ANON_COOKIE_NAME = "tpp_anon";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return secret;
}

function sign(id: string): string {
  const sig = createHmac("sha256", authSecret()).update(id).digest("base64url");
  return `${id}.${sig}`;
}

function verify(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !sig) return null;
  const expected = createHmac("sha256", authSecret()).update(id).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return id;
}

export function readAnonIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${ANON_COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    return verify(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function ensureAnonId(request: Request): { anonId: string; setCookie: string | null } {
  const existing = readAnonIdFromCookieHeader(request.headers.get("cookie"));
  if (existing) {
    return { anonId: existing, setCookie: null };
  }
  const anonId = randomUUID();
  const maxAge = 60 * 60 * 24 * 400; // ~13 months
  const setCookie = `${ANON_COOKIE_NAME}=${encodeURIComponent(sign(anonId))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  return { anonId, setCookie };
}

export function attachAnonCookie(response: NextResponse, setCookie: string | null) {
  if (setCookie) {
    response.headers.append("Set-Cookie", setCookie);
  }
  return response;
}

export function hashIp(ip: string): string {
  return createHmac("sha256", authSecret()).update(`ip:${ip || "unknown"}`).digest("hex").slice(0, 40);
}
