import type { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import type { TagDecision } from "../src/pipeline/decide";
import {
  PIPELINE_LOCK_MS,
  chooseTakenAt,
  decideOriginalClaim,
  mergeWithExisting,
  shouldSkipRun,
  withdrawIfInactive,
} from "../src/pipeline/photoDoc";

const NOW = new Date("2027-03-14T12:00:00Z");
const UPLOADED = new Date("2027-03-14T10:00:00Z");

describe("chooseTakenAt", () => {
  it("uses a plausible EXIF time", () => {
    const exif = new Date("2027-03-14T06:30:00Z");
    expect(chooseTakenAt(exif, UPLOADED, NOW)).toBe(exif);
  });
  it("falls back to upload time without EXIF", () => {
    expect(chooseTakenAt(null, UPLOADED, NOW)).toBe(UPLOADED);
  });
  it("falls back for an unset camera clock", () => {
    expect(chooseTakenAt(new Date("2009-01-01T00:00:00Z"), UPLOADED, NOW)).toBe(UPLOADED);
  });
  it("falls back for a time far in the future", () => {
    expect(chooseTakenAt(new Date("2027-03-20T00:00:00Z"), UPLOADED, NOW)).toBe(UPLOADED);
  });
  it("tolerates small clock drift into the future", () => {
    const exif = new Date("2027-03-14T14:00:00Z");
    expect(chooseTakenAt(exif, UPLOADED, NOW)).toBe(exif);
  });
  it("falls back for an invalid date", () => {
    expect(chooseTakenAt(new Date(Number.NaN), UPLOADED, NOW)).toBe(UPLOADED);
  });
});

describe("shouldSkipRun", () => {
  const now = 1_000_000_000;
  it("runs when there is no lock or a new generation", () => {
    expect(shouldSkipRun(undefined, "1", now)).toBe(false);
    expect(shouldSkipRun({ sourceGeneration: "1", pipelineState: "done" }, "2", now)).toBe(false);
  });
  it("skips a generation already done", () => {
    expect(shouldSkipRun({ sourceGeneration: "1", pipelineState: "done" }, "1", now)).toBe(true);
  });
  it("skips while another run is in flight", () => {
    expect(shouldSkipRun({ sourceGeneration: "1", pipelineState: "running", pipelineStartedAtMs: now - 1000 }, "1", now)).toBe(true);
  });
  it("retries a stale running lock", () => {
    expect(
      shouldSkipRun({ sourceGeneration: "1", pipelineState: "running", pipelineStartedAtMs: now - PIPELINE_LOCK_MS - 1 }, "1", now),
    ).toBe(false);
  });
  it("retries a failed run", () => {
    expect(shouldSkipRun({ sourceGeneration: "1", pipelineState: "failed" }, "1", now)).toBe(false);
  });
});

describe("mergeWithExisting", () => {
  const auto: TagDecision = { bibs: ["1001"], suggestedBibs: [], status: "tagged", source: "vision", confidence: 0.9 };
  it("uses the automatic decision for a new photo", () => {
    expect(mergeWithExisting(auto, undefined)).toEqual(auto);
  });
  it("keeps manual tags", () => {
    expect(mergeWithExisting(auto, { source: "manual", bibs: ["2002"], status: "tagged" })).toEqual({
      bibs: ["2002"],
      suggestedBibs: [],
      status: "tagged",
      source: "manual",
      confidence: 1,
    });
  });
  it("replaces earlier automatic tags", () => {
    expect(mergeWithExisting(auto, { source: "vision", bibs: ["3003"], status: "tagged" })).toEqual(auto);
  });
  it("keeps a manual clear as untagged with its review time", () => {
    const reviewedAt = { seconds: 1 } as unknown as Timestamp;
    expect(mergeWithExisting(auto, { source: "manual", bibs: [], status: "untagged", reviewedAt })).toEqual({
      bibs: [],
      suggestedBibs: [],
      status: "untagged",
      source: "manual",
      confidence: 1,
      reviewedAt,
    });
  });
});

describe("decideOriginalClaim", () => {
  const base = { objectName: "originals/ev/u1/p.jpg", eventId: "ev", uploaderUid: "u1", uploaderOk: true };
  it("processes a new photo id", () => {
    expect(decideOriginalClaim(base)).toEqual({ action: "process" });
  });
  it("refuses a second original for the same id", () => {
    expect(decideOriginalClaim({ ...base, existingOriginalPath: "originals/ev/u1/p.png" })).toMatchObject({ action: "refuse", deleteObject: true });
  });
  it("refuses another photographer claiming a recorded id", () => {
    expect(decideOriginalClaim({ ...base, existingUploaderUid: "u2" })).toMatchObject({ action: "refuse", deleteObject: true });
  });
  it("refuses an inactive uploader", () => {
    expect(decideOriginalClaim({ ...base, uploaderOk: false })).toMatchObject({ action: "refuse" });
  });
});

describe("withdrawIfInactive", () => {
  it("withdraws a tagged photo of a revoked photographer", () => {
    expect(withdrawIfInactive({ status: "tagged" as const, bibs: ["1001"] }, false)).toEqual({ status: "withdrawn", bibs: ["1001"] });
  });

  it("leaves photos of active photographers alone", () => {
    expect(withdrawIfInactive({ status: "tagged" as const }, true)).toEqual({ status: "tagged" });
  });

  it("does not touch photos that are not searchable anyway", () => {
    expect(withdrawIfInactive({ status: "review" as const }, false)).toEqual({ status: "review" });
    expect(withdrawIfInactive({ status: "untagged" as const }, false)).toEqual({ status: "untagged" });
  });
});
