import { describe, expect, it } from "vitest";
import { clientIp } from "../src/lib/rateLimit";
import { isPayablePhotographer, isSafeBuyerName } from "../src/orders/logic";

describe("clientIp", () => {
  it("uses the last X-Forwarded-For entry, the one Google's front end appended", () => {
    expect(clientIp("6.6.6.6, 203.0.113.9", undefined)).toBe("203.0.113.9");
  });

  it("ignores a spoofed first entry that changes on every call", () => {
    const a = clientIp("1.1.1.1, 203.0.113.9", undefined);
    const b = clientIp("2.2.2.2, 203.0.113.9", undefined);
    expect(a).toBe(b);
  });

  it("handles a single entry, repeated headers and blank parts", () => {
    expect(clientIp("203.0.113.9", undefined)).toBe("203.0.113.9");
    expect(clientIp(["6.6.6.6", "203.0.113.9"], undefined)).toBe("203.0.113.9");
    expect(clientIp("203.0.113.9, ", undefined)).toBe("203.0.113.9");
  });

  it("falls back to the socket address, then to empty", () => {
    expect(clientIp(undefined, "198.51.100.1")).toBe("198.51.100.1");
    expect(clientIp("", undefined)).toBe("");
  });
});

describe("isPayablePhotographer", () => {
  const ok = { active: true, gcashName: "Juan Dela Cruz", gcashNumber: "09171234567" };

  it("accepts an active photographer with GCash details", () => {
    expect(isPayablePhotographer(ok)).toBe(true);
  });

  it("refuses a revoked photographer even with GCash details", () => {
    expect(isPayablePhotographer({ ...ok, active: false })).toBe(false);
    expect(isPayablePhotographer({ gcashName: ok.gcashName, gcashNumber: ok.gcashNumber })).toBe(false);
  });

  it("refuses missing GCash details or a missing profile", () => {
    expect(isPayablePhotographer({ ...ok, gcashName: null })).toBe(false);
    expect(isPayablePhotographer({ ...ok, gcashNumber: "" })).toBe(false);
    expect(isPayablePhotographer(undefined)).toBe(false);
  });
});

describe("isSafeBuyerName", () => {
  it("accepts ordinary names", () => {
    for (const name of ["Juan Dela Cruz", "Ma. Theresa Santos", "José Rizal", "O'Brien, Jr.", "Mary-Ann Reyes", "Niño"]) {
      expect(isSafeBuyerName(name), name).toBe(true);
    }
  });

  it("refuses links, digits and markup", () => {
    for (const name of ["evil.com", "see https://x.co", "win at bit.ly/abc", "call 09171234567", "<b>hi</b>", "a@b", "-lead"]) {
      expect(isSafeBuyerName(name), name).toBe(false);
    }
  });
});
