// Fixed window throttling for public callables. Counters live in rateLimits/{hash}; a Firestore TTL policy on
// expireAt removes old windows. Document ids are hashes, so emails and IPs are not stored in clear.
import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "../types";

export const HOUR_MS = 60 * 60 * 1000;

export interface RateLimitRule {
  /** What is being limited, for example "checkout:email". */
  scope: string;
  /** Who is limited, for example the buyer email or client IP. Empty subjects are not limited. */
  subject: string;
  limit: number;
  windowMs: number;
}

/** Start of the fixed window holding nowMs. */
export function windowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

/** Stable document id for one subject in one window. */
export function rateLimitDocId(scope: string, subject: string, startMs: number): string {
  return createHash("sha256").update(`${scope}\n${subject.toLowerCase()}\n${startMs}`, "utf8").digest("hex");
}

/**
 * Client IP of a callable request. Cloud Functions (Cloud Run) sit behind Google's front end, which APPENDS the
 * address it saw to whatever X-Forwarded-For the caller sent. Earlier entries are caller controlled, so only the
 * last entry is trusted. The callables are reached directly (the web SDK calls the cloudfunctions.net / run.app
 * URL, not a Hosting rewrite or a load balancer), so no extra proxy hop sits after it.
 */
export function clientIp(forwardedFor: string | string[] | undefined, fallback: string | undefined): string {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
  const entries = (header ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const last = entries[entries.length - 1];
  return (last || fallback || "").slice(0, 64);
}

/** Counts one call against the rule. False when the subject is already at the limit for this window. */
export async function consumeRateLimit(firestore: Firestore, rule: RateLimitRule, nowMs: number = Date.now()): Promise<boolean> {
  if (!rule.subject) return true;
  const start = windowStart(nowMs, rule.windowMs);
  const ref = firestore.collection(COLLECTIONS.rateLimits).doc(rateLimitDocId(rule.scope, rule.subject, start));
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = Number(snap.get("count") ?? 0);
    if (count >= rule.limit) return false;
    tx.set(ref, {
      scope: rule.scope,
      count: count + 1,
      expireAt: Timestamp.fromMillis(start + 2 * rule.windowMs),
    });
    return true;
  });
}
