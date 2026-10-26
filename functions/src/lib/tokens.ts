// Order access token helpers. Orders store only the SHA-256 hash; the plain token goes to the buyer once
// (createOrders response and the order email link).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Bytes of randomness in an access token (256 bits). */
export const ACCESS_TOKEN_BYTES = 32;

/** Stand in hash compared when an order does not exist, so a miss costs the same as a wrong token. */
export const MISSING_HASH = "0".repeat(64);

/** New random URL safe access token (43 base64url characters). */
export function newAccessToken(): string {
  return randomBytes(ACCESS_TOKEN_BYTES).toString("base64url");
}

/** SHA-256 hex of a token, the form stored on orders. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant time comparison of two equal length hex strings. False on any shape mismatch. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length || a.length === 0 || a.length % 2 !== 0) return false;
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** True when the plain token hashes to the stored hash (constant time). */
export function tokenMatchesHash(token: unknown, storedHash: unknown): boolean {
  if (typeof token !== "string" || token.length === 0 || token.length > 256) return false;
  if (typeof storedHash !== "string") return false;
  return safeEqualHex(hashToken(token), storedHash);
}

/** Most token hashes one order keeps (createOrders plus one per review email). */
export const MAX_TOKEN_HASHES = 8;

/**
 * True when the token matches any stored hash. Every hash is compared (no early exit), and an empty or
 * missing list is compared against MISSING_HASH, so timing does not reveal which case happened.
 */
export function tokenMatchesAny(token: unknown, storedHashes: unknown): boolean {
  const hashes = Array.isArray(storedHashes) && storedHashes.length > 0 ? storedHashes.slice(0, MAX_TOKEN_HASHES) : [MISSING_HASH];
  let ok = false;
  for (const h of hashes) ok = tokenMatchesHash(token, h) || ok;
  return ok && Array.isArray(storedHashes) && storedHashes.length > 0;
}
