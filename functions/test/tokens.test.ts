import { describe, expect, it } from "vitest";
import { MISSING_HASH, hashToken, newAccessToken, safeEqualHex, tokenMatchesAny, tokenMatchesHash } from "../src/lib/tokens";

describe("access tokens", () => {
  it("creates 32 byte url safe tokens", () => {
    const a = newAccessToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(newAccessToken()).not.toBe(a);
  });

  it("stores only a sha256 hex hash", () => {
    const token = newAccessToken();
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("matches only the right token", () => {
    const token = newAccessToken();
    const hash = hashToken(token);
    expect(tokenMatchesHash(token, hash)).toBe(true);
    expect(tokenMatchesHash(token + "x", hash)).toBe(false);
    expect(tokenMatchesHash("", hash)).toBe(false);
    expect(tokenMatchesHash(undefined, hash)).toBe(false);
    expect(tokenMatchesHash(token, undefined)).toBe(false);
    expect(tokenMatchesHash("x".repeat(300), hash)).toBe(false);
  });

  it("safeEqualHex rejects shape mismatches", () => {
    expect(safeEqualHex("ab", "ab")).toBe(true);
    expect(safeEqualHex("ab", "abcd")).toBe(false);
    expect(safeEqualHex("zz", "zz")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });

  it("tokenMatchesAny checks every stored hash and fails on a missing list", () => {
    const first = newAccessToken();
    const second = newAccessToken();
    const hashes = [hashToken(first), hashToken(second)];
    expect(tokenMatchesAny(first, hashes)).toBe(true);
    expect(tokenMatchesAny(second, hashes)).toBe(true);
    expect(tokenMatchesAny(newAccessToken(), hashes)).toBe(false);
    expect(tokenMatchesAny(first, [])).toBe(false);
    expect(tokenMatchesAny(first, undefined)).toBe(false);
    expect(tokenMatchesAny("anything", [MISSING_HASH])).toBe(false);
  });
});
