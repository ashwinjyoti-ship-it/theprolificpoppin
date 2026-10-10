/**
 * Repair replies that were cut off (e.g. stop_reason max_tokens mid-markdown-link).
 * Prefer preventing truncation via thinking caps + higher max_tokens; this is the safety net.
 */
export function sanitizeModelReply(text: string, truncated = false): string {
  let out = text
    .replace(/\u2014/g, ", ")
    .replace(/\u2013/g, "-")
    .replace(/,\s+,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .trimEnd();

  // Incomplete markdown link: [Title](/essays/partial-slug
  if (/\[[^\]]*\]\([^)\s]*$/.test(out)) {
    out = out.replace(/\[[^\]]*\]\([^)\s]*$/, "").trimEnd();
    truncated = true;
  }

  // Incomplete link title: [Desire as Bai
  if (/\[[^\]]*$/.test(out)) {
    out = out.replace(/\[[^\]]*$/, "").trimEnd();
    truncated = true;
  }

  // Trailing bare /essays/slug fragment
  if (/\/essays\/[a-z0-9-]*$/i.test(out) && !/\[[^\]]+\]\(\/essays\/[a-z0-9-]+\)$/i.test(out)) {
    out = out.replace(/\s*\/essays\/[a-z0-9-]*$/i, "").trimEnd();
    truncated = true;
  }

  // Dangling punctuation left by a cut
  out = out.replace(/[,:;]\s*$/, "").trimEnd();

  if (truncated && out && !/[.!?…)"']$/.test(out)) {
    // Prefer a clean sentence end over a mid-thought fragment.
    out = `${out}…`;
  }

  return out.trim();
}

export function wasTruncatedByStop(stopReason: string | null | undefined): boolean {
  return stopReason === "max_tokens";
}
