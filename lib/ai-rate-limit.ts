import { AI_LIMITS } from "@/lib/ai-config";

/**
 * Best-effort per-IP rate limit for Vercel serverless.
 * Uses an in-memory sliding window on the current isolate — no Redis / paid infra.
 * Limits spikes within a warm instance; cold starts reset the map (acceptable tradeoff).
 */
type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  const cutoff = now - AI_LIMITS.rateLimitWindowMs;
  bucket.timestamps = bucket.timestamps.filter(ts => ts > cutoff);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const key = ip || "unknown";
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  prune(bucket, now);

  if (bucket.timestamps.length >= AI_LIMITS.rateLimitMaxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + AI_LIMITS.rateLimitWindowMs - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  bucket.timestamps.push(now);

  // Cap map size so a flood of unique IPs can't grow forever in one isolate.
  if (buckets.size > 5_000) {
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  return { ok: true };
}
