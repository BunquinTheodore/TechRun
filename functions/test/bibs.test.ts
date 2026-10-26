import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOKEN_CONFIDENCE,
  extractBibs,
  mergeAdjacentTokens,
  normaliseBib,
  normaliseToken,
  type ExtractOptions,
  type OcrToken,
} from "../src/pipeline/bibs";

const W = 2000;
const H = 1500;

/** A token comfortably inside the frame, 60px tall (4% of the image height). */
function tok(text: string, over: Partial<OcrToken> & { x?: number; y?: number; h?: number; w?: number } = {}): OcrToken {
  const { x = 500, y = 500, h = 60, w = 40 * Math.max(1, text.length), ...rest } = over;
  return { text, box: { x, y, width: w, height: h }, confidence: 0.95, ...rest };
}

function opts(registered: string[], over: Partial<ExtractOptions> = {}): ExtractOptions {
  return { imageWidth: W, imageHeight: H, registered: new Set(registered), ...over };
}

describe("normaliseToken", () => {
  it("keeps a clean digit token unchanged", () => {
    expect(normaliseToken("1234")).toEqual({ value: "1234", substitutions: 0, hasNumericSeparator: false });
  });

  it("maps O and o to 0", () => {
    expect(normaliseToken("1O34").value).toBe("1034");
    expect(normaliseToken("12o4").value).toBe("1204");
  });

  it("maps I, l, i and | to 1 and counts substitutions", () => {
    const r = normaliseToken("I2l4");
    expect(r.value).toBe("1214");
    expect(r.substitutions).toBe(2);
    expect(normaliseToken("|234").value).toBe("1234");
    expect(normaliseToken("12i4").value).toBe("1214");
  });

  it("strips spaces, hyphens, hashes and surrounding punctuation", () => {
    expect(normaliseToken(" 12 34 ").value).toBe("1234");
    expect(normaliseToken("#1234").value).toBe("1234");
    expect(normaliseToken("12-34").value).toBe("1234");
    expect(normaliseToken("(1234).").value).toBe("1234");
    expect(normaliseToken("\"1234\"").value).toBe("1234");
  });

  it("drops a BIB or NO prefix", () => {
    expect(normaliseToken("BIB1234").value).toBe("1234");
    expect(normaliseToken("bib 1234").value).toBe("1234");
    expect(normaliseToken("No.1234").value).toBe("1234");
  });

  it("flags separators between digits that make it a time, date or amount", () => {
    expect(normaliseToken("12:30").hasNumericSeparator).toBe(true);
    expect(normaliseToken("10/26").hasNumericSeparator).toBe(true);
    expect(normaliseToken("1.234").hasNumericSeparator).toBe(true);
    expect(normaliseToken("1,234").hasNumericSeparator).toBe(true);
    expect(normaliseToken("1234.").hasNumericSeparator).toBe(false);
  });

  it("does not substitute letters in a token that is mostly letters", () => {
    // "OIL" would become "011"; too few real digits to trust the substitution.
    expect(normaliseToken("OIL").value).toBe("OIL");
    expect(normaliseToken("lOO").value).toBe("lOO");
  });

  it("leaves other letters in place so the pattern check rejects them", () => {
    expect(normaliseToken("12A4").value).toBe("12A4");
  });

  it("handles empty and whitespace input", () => {
    expect(normaliseToken("").value).toBe("");
    expect(normaliseToken("   ").value).toBe("");
  });
});

describe("normaliseBib", () => {
  it("returns the normalised bib when it matches the pattern", () => {
    expect(normaliseBib(" #1O23 ")).toBe("1023");
    expect(normaliseBib(4321)).toBe("4321");
  });

  it("returns null for non bibs", () => {
    expect(normaliseBib("12")).toBeNull();
    expect(normaliseBib("123456")).toBeNull();
    expect(normaliseBib("12:30")).toBeNull();
    expect(normaliseBib("ABCD")).toBeNull();
    expect(normaliseBib("")).toBeNull();
    expect(normaliseBib(null)).toBeNull();
    expect(normaliseBib(undefined)).toBeNull();
    expect(normaliseBib({})).toBeNull();
    expect(normaliseBib(12.5)).toBeNull();
  });

  it("accepts a custom pattern", () => {
    expect(normaliseBib("12", /^\d{2}$/)).toBe("12");
  });

  it("keeps leading zeros", () => {
    expect(normaliseBib("0042")).toBe("0042");
  });
});

describe("extractBibs: basic matching", () => {
  it("returns a registered bib", () => {
    const r = extractBibs([tok("1234")], opts(["1234"]));
    expect(r.bibs).toEqual(["1234"]);
    expect(r.ambiguous).toEqual([]);
    expect(r.rejected).toEqual([]);
    expect(r.confidence).toBeCloseTo(0.95);
  });

  it("returns several bibs for a group shot, sorted", () => {
    const r = extractBibs([tok("2001"), tok("1001", { x: 900 }), tok("3001", { x: 1300 })], opts(["1001", "2001", "3001"]));
    expect(r.bibs).toEqual(["1001", "2001", "3001"]);
  });

  it("dedupes a bib seen twice and keeps the higher score", () => {
    const r = extractBibs([tok("1234", { confidence: 0.7 }), tok("1234", { x: 900, confidence: 0.9 })], opts(["1234"]));
    expect(r.bibs).toEqual(["1234"]);
    expect(r.scores["1234"]).toBeCloseTo(0.9);
  });

  it("returns nothing for no tokens", () => {
    const r = extractBibs([], opts(["1234"]));
    expect(r).toMatchObject({ bibs: [], ambiguous: [], rejected: [], confidence: 0 });
  });

  it("normalises letters before matching", () => {
    const r = extractBibs([tok("1O2I")], opts(["1021"]));
    expect(r.bibs.concat(r.ambiguous)).toContain("1021");
  });
});

describe("extractBibs: rejections", () => {
  it("rejects tokens that do not match the bib pattern", () => {
    const r = extractBibs([tok("12"), tok("123456"), tok("RUN"), tok("12A4")], opts(["1234"]));
    expect(r.bibs).toEqual([]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["pattern", "pattern", "pattern", "pattern"]);
  });

  it("rejects times, dates and amounts", () => {
    const r = extractBibs([tok("12:30"), tok("10/26")], opts(["1230", "1026"]));
    expect(r.bibs).toEqual([]);
    expect(r.rejected.every((x) => x.reason === "separator")).toBe(true);
  });

  it("rejects tokens shorter than the minimum height ratio", () => {
    // 0.012 * 1500 = 18px; 10px is fine print.
    const r = extractBibs([tok("1234", { h: 10 })], opts(["1234"]));
    expect(r.bibs).toEqual([]);
    expect(r.rejected).toEqual([{ raw: "1234", normalised: "1234", reason: "too_small" }]);
  });

  it("accepts a token exactly at the minimum height", () => {
    const r = extractBibs([tok("1234", { h: 18 })], opts(["1234"]));
    expect(r.bibs).toEqual(["1234"]);
  });

  it("honours a custom minimum height ratio", () => {
    const r = extractBibs([tok("1234", { h: 60 })], opts(["1234"], { minHeightRatio: 0.05 }));
    expect(r.rejected[0]?.reason).toBe("too_small");
  });

  it("rejects pattern valid numbers that are not registered", () => {
    const r = extractBibs([tok("9999")], opts(["1234"]));
    expect(r.bibs).toEqual([]);
    expect(r.ambiguous).toEqual([]);
    expect(r.rejected).toEqual([{ raw: "9999", normalised: "9999", reason: "not_registered" }]);
  });

  it("rejects empty tokens", () => {
    const r = extractBibs([tok("  "), tok("--")], opts(["1234"]));
    expect(r.rejected.map((x) => x.reason)).toEqual(["empty", "empty"]);
  });

  it("checks height before registration so fine print never matches", () => {
    const r = extractBibs([tok("9999", { h: 5 })], opts(["9999"]));
    expect(r.rejected[0]?.reason).toBe("too_small");
  });
});

describe("extractBibs: ambiguity", () => {
  it("marks a low confidence read as ambiguous", () => {
    const r = extractBibs([tok("1234", { confidence: 0.3 })], opts(["1234"]));
    expect(r.bibs).toEqual([]);
    expect(r.ambiguous).toEqual(["1234"]);
    expect(r.confidence).toBe(0);
  });

  it("uses the default confidence when OCR gives none or zero", () => {
    const a = extractBibs([tok("1234", { confidence: null })], opts(["1234"]));
    const b = extractBibs([tok("1234", { confidence: 0 })], opts(["1234"]));
    expect(a.scores["1234"]).toBeCloseTo(DEFAULT_TOKEN_CONFIDENCE);
    expect(b.scores["1234"]).toBeCloseTo(DEFAULT_TOKEN_CONFIDENCE);
    expect(a.bibs).toEqual(["1234"]);
  });

  it("penalises letter substitutions", () => {
    const clean = extractBibs([tok("1234")], opts(["1234"]));
    const sub = extractBibs([tok("I234")], opts(["1234"]));
    expect(sub.scores["1234"]).toBeLessThan(clean.scores["1234"]);
  });

  it("marks heavy substitutions as ambiguous", () => {
    const r = extractBibs([tok("1OI4", { confidence: 0.7 })], opts(["1014"]));
    expect(r.ambiguous).toEqual(["1014"]);
    expect(r.bibs).toEqual([]);
  });

  it("marks a token touching the left edge as ambiguous (maybe cut off)", () => {
    const r = extractBibs([tok("234", { x: 0 })], opts(["234"]));
    expect(r.ambiguous).toEqual(["234"]);
  });

  it("marks tokens touching the top, right and bottom edges as ambiguous", () => {
    const top = extractBibs([tok("234", { y: 0 })], opts(["234"]));
    const right = extractBibs([tok("234", { x: W - 120, w: 120 })], opts(["234"]));
    const bottom = extractBibs([tok("234", { y: H - 60, h: 60 })], opts(["234"]));
    expect(top.ambiguous).toEqual(["234"]);
    expect(right.ambiguous).toEqual(["234"]);
    expect(bottom.ambiguous).toEqual(["234"]);
  });

  it("prefers a confident read over an ambiguous read of the same bib", () => {
    const r = extractBibs([tok("1234", { x: 0 }), tok("1234", { x: 800 })], opts(["1234"]));
    expect(r.bibs).toEqual(["1234"]);
    expect(r.ambiguous).toEqual([]);
  });

  it("treats every plausible bib as ambiguous when no bibs are registered yet", () => {
    const r = extractBibs([tok("1234"), tok("12")], opts([]));
    expect(r.bibs).toEqual([]);
    expect(r.ambiguous).toEqual(["1234"]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["pattern"]);
  });

  it("reports overall confidence as the weakest confirmed bib", () => {
    const r = extractBibs([tok("1001", { confidence: 0.9 }), tok("2002", { x: 900, confidence: 0.7 })], opts(["1001", "2002"]));
    expect(r.confidence).toBeCloseTo(0.7);
  });

  it("honours a custom minimum confidence", () => {
    const r = extractBibs([tok("1234", { confidence: 0.8 })], opts(["1234"], { minConfidence: 0.85 }));
    expect(r.ambiguous).toEqual(["1234"]);
  });
});

describe("extractBibs: image size edge cases", () => {
  it("skips size based checks when the image size is unknown", () => {
    const r = extractBibs([tok("1234", { h: 1, x: 0 })], opts(["1234"], { imageWidth: 0, imageHeight: 0 }));
    expect(r.bibs).toEqual(["1234"]);
  });

  it("ignores tokens with negative or NaN box values gracefully", () => {
    const r = extractBibs([{ text: "1234", box: { x: Number.NaN, y: -5, width: 10, height: Number.NaN } }], opts(["1234"]));
    expect(r.bibs).toEqual([]);
    expect(r.rejected[0]?.reason).toBe("too_small");
  });

  it("accepts a custom bib pattern", () => {
    const r = extractBibs([tok("A123")], opts(["A123"], { pattern: /^A\d{3}$/ }));
    expect(r.bibs).toEqual(["A123"]);
  });
});

describe("mergeAdjacentTokens", () => {
  it("joins two digit groups on the same line with a small gap", () => {
    const merged = mergeAdjacentTokens([
      { text: "12", box: { x: 100, y: 100, width: 60, height: 60 }, confidence: 0.9 },
      { text: "34", box: { x: 175, y: 102, width: 60, height: 58 }, confidence: 0.8 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("1234");
    expect(merged[0].box).toEqual({ x: 100, y: 100, width: 135, height: 60 });
    expect(merged[0].confidence).toBeCloseTo(0.8);
  });

  it("does not join tokens far apart", () => {
    const merged = mergeAdjacentTokens([
      { text: "12", box: { x: 100, y: 100, width: 60, height: 60 } },
      { text: "34", box: { x: 400, y: 100, width: 60, height: 60 } },
    ]);
    expect(merged).toEqual([]);
  });

  it("does not join tokens on different lines", () => {
    const merged = mergeAdjacentTokens([
      { text: "12", box: { x: 100, y: 100, width: 60, height: 60 } },
      { text: "34", box: { x: 170, y: 200, width: 60, height: 60 } },
    ]);
    expect(merged).toEqual([]);
  });

  it("does not join tokens of very different heights", () => {
    const merged = mergeAdjacentTokens([
      { text: "12", box: { x: 100, y: 100, width: 60, height: 60 } },
      { text: "34", box: { x: 170, y: 100, width: 20, height: 20 } },
    ]);
    expect(merged).toEqual([]);
  });

  it("only joins tokens that contain digits", () => {
    const merged = mergeAdjacentTokens([
      { text: "RUN", box: { x: 100, y: 100, width: 60, height: 60 } },
      { text: "34", box: { x: 170, y: 100, width: 60, height: 60 } },
    ]);
    expect(merged).toEqual([]);
  });

  it("lets extractBibs find a bib split into two OCR words", () => {
    const r = extractBibs(
      [
        { text: "12", box: { x: 100, y: 100, width: 60, height: 60 }, confidence: 0.9 },
        { text: "34", box: { x: 170, y: 100, width: 60, height: 60 }, confidence: 0.9 },
      ],
      opts(["1234"]),
    );
    expect(r.bibs).toEqual(["1234"]);
  });

  it("can be turned off", () => {
    const r = extractBibs(
      [
        { text: "12", box: { x: 100, y: 100, width: 60, height: 60 }, confidence: 0.9 },
        { text: "34", box: { x: 170, y: 100, width: 60, height: 60 }, confidence: 0.9 },
      ],
      opts(["1234"], { mergeAdjacent: false }),
    );
    expect(r.bibs).toEqual([]);
  });
});

describe("extractBibs: realistic scene", () => {
  it("keeps the runner bibs and drops sponsor text, timestamps and small print", () => {
    const tokens: OcrToken[] = [
      tok("TECHRUN", { x: 300, y: 300, h: 80 }),
      tok("2027", { x: 700, y: 300, h: 80 }), // banner year, not registered
      tok("1042", { x: 600, y: 800, h: 70 }), // runner one
      tok("2O17", { x: 1200, y: 820, h: 65 }), // runner two, O misread
      tok("12:45:03", { x: 1700, y: 1400, h: 25 }), // camera timestamp
      tok("09171234567", { x: 100, y: 1000, h: 12 }), // phone number on a sign
      tok("5K", { x: 610, y: 760, h: 30 }),
    ];
    const r = extractBibs(tokens, opts(["1042", "2017", "3000"]));
    expect(r.bibs).toEqual(["1042", "2017"]);
    expect(r.ambiguous).toEqual([]);
    expect(r.rejected.map((x) => x.raw)).toEqual(["TECHRUN", "2027", "12:45:03", "09171234567", "5K"]);
  });
});
