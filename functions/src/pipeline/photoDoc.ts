// Pure helpers for the upload trigger: capture time sanity, manual tag protection, idempotency lock.

import type { PhotoDoc } from "../types";
import type { TagDecision } from "./decide";

/** EXIF dates before this are treated as an unset camera clock. */
const EARLIEST_PLAUSIBLE_CAPTURE = Date.UTC(2020, 0, 1);
/** Allow a little camera clock drift into the future. */
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
/** A run that started this long ago without finishing is assumed dead and may be retried. */
export const PIPELINE_LOCK_MS = 10 * 60 * 1000;
/** Raw OCR tokens kept on the private doc for accuracy debugging. */
export const MAX_STORED_OCR_TOKENS = 300;

/** EXIF capture time when plausible, otherwise the upload time. */
export function chooseTakenAt(exif: Date | null, uploadedAt: Date, now: Date = new Date()): Date {
  if (!exif || Number.isNaN(exif.getTime())) return uploadedAt;
  const t = exif.getTime();
  if (t < EARLIEST_PLAUSIBLE_CAPTURE || t > now.getTime() + MAX_FUTURE_SKEW_MS) return uploadedAt;
  return exif;
}

export type PipelineState = "running" | "done" | "failed";

export interface PipelineLock {
  sourceGeneration?: string;
  pipelineState?: PipelineState;
  pipelineStartedAtMs?: number;
}

/** True when this generation of the original was already processed or is being processed right now. */
export function shouldSkipRun(lock: PipelineLock | undefined, generation: string, nowMs: number): boolean {
  if (!lock || lock.sourceGeneration !== generation) return false;
  if (lock.pipelineState === "done") return true;
  if (lock.pipelineState === "running") return nowMs - (lock.pipelineStartedAtMs ?? 0) < PIPELINE_LOCK_MS;
  return false;
}

export type TagFields = Pick<PhotoDoc, "bibs" | "suggestedBibs" | "status" | "source" | "confidence" | "reviewedAt">;

/** A human already tagged or cleared this photo: a re-run must not replace that with an automatic read. */
export function mergeWithExisting(decision: TagDecision, existing: Partial<PhotoDoc> | undefined): TagFields {
  if (existing?.source === "manual" && Array.isArray(existing.bibs)) {
    const kept: TagFields = {
      bibs: existing.bibs,
      suggestedBibs: [],
      status: existing.bibs.length > 0 ? "tagged" : "untagged",
      source: "manual",
      confidence: 1,
    };
    if (existing.reviewedAt) kept.reviewedAt = existing.reviewedAt;
    return kept;
  }
  return { ...decision };
}

/**
 * A photo of a revoked photographer (active false) is never left searchable: "tagged" becomes "withdrawn".
 * Callers read `active` in the same transaction as the photo write, so a revoke cannot slip in between.
 */
export function withdrawIfInactive<T extends { status: PhotoDoc["status"] }>(tags: T, photographerActive: boolean): T {
  return !photographerActive && tags.status === "tagged" ? { ...tags, status: "withdrawn" } : tags;
}

/* ---------- photo id ownership ---------- */

export interface OriginalClaimInput {
  /** Storage path of the object that fired the trigger. */
  objectName: string;
  /** Event id parsed from that path. */
  eventId: string;
  /** originalPath already recorded on photos/{photoId}/private/paths, if any. */
  existingOriginalPath?: string | null;
  /** eventId already on photos/{photoId}, if the public doc exists. */
  existingEventId?: string | null;
  /** Uploader uid already recorded for this photo id, if any. */
  existingUploaderUid?: string | null;
  /** Uploader uid from this object's path. */
  uploaderUid?: string;
  /** The uploader is a verified, active photographer. */
  uploaderOk: boolean;
}

export type OriginalClaimDecision =
  | { action: "process" }
  /** deleteObject is true only when the object is not the photo's registered original. */
  | { action: "refuse"; reason: string; deleteObject: boolean };

/**
 * The server, not the client, decides which object owns a photo id: the first original recorded for an id keeps it.
 * A second object with the same id (another extension or another event) is refused and removed, so it can never
 * replace the original, the preview or the event of a photo someone may already have paid for.
 */
export function decideOriginalClaim(input: OriginalClaimInput): OriginalClaimDecision {
  const known = Boolean(input.existingOriginalPath) && input.existingOriginalPath === input.objectName;
  if (input.existingOriginalPath && !known) {
    return { action: "refuse", reason: "photo id already belongs to another original", deleteObject: true };
  }
  if (!known && input.existingEventId && input.existingEventId !== input.eventId) {
    return { action: "refuse", reason: "photo id already belongs to another event", deleteObject: true };
  }
  if (!known && input.existingUploaderUid && input.uploaderUid !== undefined && input.existingUploaderUid !== input.uploaderUid) {
    return { action: "refuse", reason: "photo id already belongs to another photographer", deleteObject: true };
  }
  if (!input.uploaderOk) {
    return { action: "refuse", reason: "uploader is not an active photographer", deleteObject: !known };
  }
  return { action: "process" };
}
