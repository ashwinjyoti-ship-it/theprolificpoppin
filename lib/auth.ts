const COOKIE_NAME = "admin_session";

function apiKey(): string {
  const key = process.env.ADMIN_API_KEY;
  if (!key) throw new Error("ADMIN_API_KEY is not set");
  return key;
}

export function isAuthorized(request: Request): boolean {
  const header = request.headers.get("x-api-key");
  if (header && header === apiKey()) return true;

  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] === apiKey();
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return password === expected;
}

export function sessionCookie(): string {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  return `${COOKIE_NAME}=${apiKey()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
