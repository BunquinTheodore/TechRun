// Pure decision step: turn the Vision extraction into the photo's tags (Cloud Vision only).
// Only confident, registered reads are tagged automatically. Anything else waits for a human in the review
// queue (status review), with the candidates kept as suggestedBibs.

import { MIN_AUTO_CONFIDENCE } from "../config";
import type { PhotoSource } from "../types";
import type { BibExtraction } from "./bibs";

export interface TagDecision {
  bibs: string[];
  suggestedBibs: string[];
  status: "tagged" | "review";
  source: PhotoSource;
  confidence: number;
}

export interface DecideInput {
  vision: BibExtraction;
  registered: ReadonlySet<string>;
  /** Any step failed (OCR). The photo then always waits for a human. */
  hadErrors?: boolean;
  minConfidence?: number;
}

export function decideTags(input: DecideInput): TagDecision {
  const min = input.minConfidence ?? MIN_AUTO_CONFIDENCE;
  const { vision } = input;
  const registryEmpty = input.registered.size === 0;
  const confirmed = new Map<string, number>();
  const suggested = new Map<string, number>();

  for (const bib of vision.bibs) {
    const score = vision.scores[bib] ?? vision.confidence;
    // With no registered list yet nothing is confirmed; a weak read is only a suggestion.
    if (!registryEmpty && input.registered.has(bib) && score >= min) confirmed.set(bib, score);
    else suggested.set(bib, score);
  }
  for (const bib of vision.ambiguous) {
    if (!confirmed.has(bib)) suggested.set(bib, Math.max(suggested.get(bib) ?? 0, vision.scores[bib] ?? 0));
  }

  const bibs = [...confirmed.keys()].sort();
  const suggestedBibs = [...suggested.keys()].filter((b) => !confirmed.has(b)).sort();
  const sure = bibs.length > 0 && suggestedBibs.length === 0 && !input.hadErrors;
  const status: TagDecision["status"] = sure ? "tagged" : "review";
  const source: PhotoSource = bibs.length === 0 && suggestedBibs.length === 0 ? "none" : "vision";
  const confidence =
    bibs.length > 0
      ? Math.min(...bibs.map((b) => confirmed.get(b) ?? 0))
      : suggestedBibs.length > 0
        ? Math.max(...suggestedBibs.map((b) => suggested.get(b) ?? 0))
        : 0;
  return { bibs, suggestedBibs, status, source, confidence };
}
