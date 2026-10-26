// Pure bib recognition: turn OCR tokens into registered bib numbers.
// No Firebase or network imports here so it stays fast to unit test.

import { BIB_PATTERN, EDGE_MARGIN_RATIO, MIN_AUTO_CONFIDENCE, MIN_BIB_HEIGHT_RATIO } from "../config";

/** Axis aligned box in pixels of the image the OCR ran on. */
export interface TokenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrToken {
  text: string;
  box: TokenBox;
  /** 0..1 when the OCR engine reports it; null, undefined or 0 means unknown. */
  confidence?: number | null;
}

export type RejectReason = "empty" | "separator" | "pattern" | "too_small" | "not_registered";

export interface RejectedToken {
  raw: string;
  normalised: string;
  reason: RejectReason;
}

export interface BibExtraction {
  /** Registered bibs read with enough confidence, sorted. */
  bibs: string[];
  /** Plausible bibs that need a second opinion (low confidence, cut off at the edge, registry empty). Sorted. */
  ambiguous: string[];
  rejected: RejectedToken[];
  /** Best score per bib in bibs and ambiguous. */
  scores: Record<string, number>;
  /** Weakest score among bibs, 0 when there are none. */
  confidence: number;
}

export interface ExtractOptions {
  imageWidth: number;
  imageHeight: number;
  /** Registered bibs for the event. Empty means the list is not imported yet: every plausible bib goes to ambiguous. */
  registered: ReadonlySet<string>;
  pattern?: RegExp;
  minHeightRatio?: number;
  edgeMarginRatio?: number;
  minConfidence?: number;
  /** Also try joining digit groups the OCR split in two ("12" "34"). Default true. */
  mergeAdjacent?: boolean;
}

/** Score given to a token when the OCR engine reports no confidence (TEXT_DETECTION often reports 0). */
export const DEFAULT_TOKEN_CONFIDENCE = 0.85;
/** Score multiplier per letter that had to be read as a digit. */
export const SUBSTITUTION_PENALTY = 0.9;

/** Look alike letters read as digits. Kept to the safest pairs. */
const LOOKALIKES: Readonly<Record<string, string>> = { O: "0", o: "0", I: "1", l: "1", i: "1", "|": "1" };

/** Separators that make a number a time, date or amount, not a bib. */
const NUMERIC_SEPARATOR_RE = /[0-9OoIli|][:/.,][0-9OoIli|]/;
const BIB_PREFIX_RE = /^(?:bib|no)[\s.#:]*(?=[0-9OoIl|])/i;
const STRIP_RE = /[^A-Za-z0-9|]/g;

export interface NormalisedToken {
  value: string;
  substitutions: number;
  hasNumericSeparator: boolean;
}

/**
 * Normalise one OCR token: drop a BIB/NO prefix, strip spaces and punctuation, and read look alike letters
 * as digits when at least half of the characters are real digits (so words like "OIL" stay words).
 */
export function normaliseToken(raw: string): NormalisedToken {
  const unprefixed = raw.trim().replace(/^[#\s]+/, "").replace(BIB_PREFIX_RE, "");
  const hasNumericSeparator = NUMERIC_SEPARATOR_RE.test(unprefixed);
  const compact = unprefixed.replace(STRIP_RE, "");
  const realDigits = (compact.match(/[0-9]/g) ?? []).length;
  if (compact.length === 0 || realDigits < Math.ceil(compact.length / 2)) {
    return { value: compact, substitutions: 0, hasNumericSeparator };
  }
  let substitutions = 0;
  const value = Array.from(compact)
    .map((ch) => {
      const digit = LOOKALIKES[ch];
      if (digit === undefined) return ch;
      substitutions += 1;
      return digit;
    })
    .join("");
  return { value, substitutions, hasNumericSeparator };
}

/** Normalise a bib typed by a person or returned by a model. Null unless it matches the pattern. */
export function normaliseBib(input: unknown, pattern: RegExp = BIB_PATTERN): string | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
  } else if (typeof input !== "string") {
    return null;
  }
  const n = normaliseToken(String(input));
  if (n.hasNumericSeparator || n.value.length === 0) return null;
  return pattern.test(n.value) ? n.value : null;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function isDigitGroup(text: string): boolean {
  const v = normaliseToken(text).value;
  return v.length > 0 && /^\d+$/.test(v);
}

const MERGE_MAX_GAP_RATIO = 0.6;
const MERGE_MIN_OVERLAP_RATIO = 0.6;
const MERGE_MIN_HEIGHT_RATIO = 0.6;
const MERGE_MAX_OVERLAP_RATIO = 0.25;

/**
 * Candidate tokens made by joining two digit groups on the same line with a small gap.
 * Returns only the joined tokens; the caller keeps the originals.
 */
export function mergeAdjacentTokens(tokens: readonly OcrToken[]): OcrToken[] {
  const digits = tokens.filter((t) => isDigitGroup(t.text));
  const out: OcrToken[] = [];
  for (const a of digits) {
    for (const b of digits) {
      if (a === b) continue;
      const ah = finite(a.box.height);
      const bh = finite(b.box.height);
      if (ah <= 0 || bh <= 0) continue;
      if (Math.min(ah, bh) / Math.max(ah, bh) < MERGE_MIN_HEIGHT_RATIO) continue;
      const h = Math.max(ah, bh);
      const gap = b.box.x - (a.box.x + a.box.width);
      if (gap > MERGE_MAX_GAP_RATIO * h || gap < -MERGE_MAX_OVERLAP_RATIO * h) continue;
      const top = Math.max(a.box.y, b.box.y);
      const bottom = Math.min(a.box.y + ah, b.box.y + bh);
      if (bottom - top < MERGE_MIN_OVERLAP_RATIO * Math.min(ah, bh)) continue;
      const x = Math.min(a.box.x, b.box.x);
      const y = Math.min(a.box.y, b.box.y);
      const confidences = [a.confidence, b.confidence].filter((c): c is number => typeof c === "number" && c > 0);
      out.push({
        text: `${a.text}${b.text}`,
        box: {
          x,
          y,
          width: Math.max(a.box.x + a.box.width, b.box.x + b.box.width) - x,
          height: Math.max(a.box.y + ah, b.box.y + bh) - y,
        },
        confidence: confidences.length === 2 ? Math.min(...confidences) : null,
      });
    }
  }
  return out;
}

function touchesEdge(box: TokenBox, w: number, h: number, ratio: number): boolean {
  const mx = ratio * w;
  const my = ratio * h;
  return (
    finite(box.x) <= mx ||
    finite(box.y) <= my ||
    finite(box.x) + finite(box.width) >= w - mx ||
    finite(box.y) + finite(box.height) >= h - my
  );
}

type Verdict = { kind: "rejected"; rejection: RejectedToken } | { kind: "candidate"; bib: string; score: number; sure: boolean };

function judgeToken(token: OcrToken, o: Required<ExtractOptions>): Verdict {
  const n = normaliseToken(token.text);
  const reject = (reason: RejectReason): Verdict => ({ kind: "rejected", rejection: { raw: token.text, normalised: n.value, reason } });
  if (n.value.length === 0) return reject("empty");
  if (n.hasNumericSeparator) return reject("separator");
  if (!o.pattern.test(n.value)) return reject("pattern");
  const sized = o.imageWidth > 0 && o.imageHeight > 0;
  if (sized && finite(token.box.height) / o.imageHeight < o.minHeightRatio) return reject("too_small");
  const registryEmpty = o.registered.size === 0;
  if (!registryEmpty && !o.registered.has(n.value)) return reject("not_registered");
  const base = typeof token.confidence === "number" && token.confidence > 0 ? Math.min(1, token.confidence) : DEFAULT_TOKEN_CONFIDENCE;
  const score = base * SUBSTITUTION_PENALTY ** n.substitutions;
  const cutOff = sized && touchesEdge(token.box, o.imageWidth, o.imageHeight, o.edgeMarginRatio);
  return { kind: "candidate", bib: n.value, score, sure: !registryEmpty && !cutOff && score >= o.minConfidence };
}

/** Filter OCR tokens down to registered bibs. See BibExtraction for the meaning of each list. */
export function extractBibs(tokens: readonly OcrToken[], options: ExtractOptions): BibExtraction {
  const o: Required<ExtractOptions> = {
    pattern: BIB_PATTERN,
    minHeightRatio: MIN_BIB_HEIGHT_RATIO,
    edgeMarginRatio: EDGE_MARGIN_RATIO,
    minConfidence: MIN_AUTO_CONFIDENCE,
    mergeAdjacent: true,
    ...options,
  };
  const sure = new Map<string, number>();
  const unsure = new Map<string, number>();
  const rejected: RejectedToken[] = [];
  const keepBest = (m: Map<string, number>, bib: string, score: number) => m.set(bib, Math.max(score, m.get(bib) ?? 0));

  const merged = o.mergeAdjacent ? mergeAdjacentTokens(tokens) : [];
  const all = [...tokens.map((t) => ({ t, original: true })), ...merged.map((t) => ({ t, original: false }))];
  for (const { t, original } of all) {
    const v = judgeToken(t, o);
    if (v.kind === "rejected") {
      if (original) rejected.push(v.rejection);
      continue;
    }
    keepBest(v.sure ? sure : unsure, v.bib, v.score);
  }

  const scores: Record<string, number> = {};
  for (const [bib, s] of unsure) scores[bib] = s;
  for (const [bib, s] of sure) scores[bib] = Math.max(s, scores[bib] ?? 0);
  const bibs = [...sure.keys()].sort();
  const ambiguous = [...unsure.keys()].filter((b) => !sure.has(b)).sort();
  const confidence = bibs.length > 0 ? Math.min(...bibs.map((b) => sure.get(b) ?? 0)) : 0;
  return { bibs, ambiguous, rejected, scores, confidence };
}
