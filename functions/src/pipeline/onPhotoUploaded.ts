// Storage trigger: originals/{eventId}/{uid}/{photoId}.{ext} finalized.
// Steps: derive images (derive.ts), OCR (ocr.ts, Cloud Vision only), bib filter (bibs.ts), decision (decide.ts),
// then write photos/{photoId} and photos/{photoId}/private/paths.
// Idempotent per object generation. Any failure is logged and the photo lands in review, never lost.
// Identity is decided by the path, which storage.rules ties to request.auth.uid: the uploader must still be an
// active photographer (Auth claims and photographers/{uid}), and the first original recorded for a photo id keeps it.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onObjectFinalized, type StorageObjectData } from "firebase-functions/v2/storage";
import { REGION, REGISTERED_BIBS_CACHE_MS } from "../config";
import { sanitizeFileName } from "../lib/fileName";
import { auth, bucket, db } from "../firebase";
import {
  COLLECTIONS,
  PHOTO_PRIVATE_DOC,
  PHOTO_PRIVATE_SUBCOLLECTION,
  STORAGE_PREFIX,
  parseStoragePath,
  previewPath,
  scanPath,
  thumbPath,
  ORIGINAL_NAME_METADATA_KEY,
  type PhotoDoc,
  type PhotoPrivate,
  type PhotographerDoc,
} from "../types";
import { extractBibs, type BibExtraction } from "./bibs";
import { decideTags } from "./decide";
import { deriveImages, type DerivedImages } from "./derive";
import { detectText } from "./ocr";
import {
  MAX_STORED_OCR_TOKENS,
  chooseTakenAt,
  decideOriginalClaim,
  mergeWithExisting,
  shouldSkipRun,
  withdrawIfInactive,
  type PipelineLock,
  type PipelineState,
} from "./photoDoc";

const PUBLIC_CACHE_CONTROL = "public, max-age=86400";
const PRIVATE_CACHE_CONTROL = "private, max-age=0, no-store";

type PrivateDoc = PhotoPrivate & PipelineLock & { pipelineError?: string | null; updatedAt?: FirebaseFirestore.FieldValue };

/* ---------- registered bibs, cached per instance ---------- */

const registeredCache = new Map<string, { at: number; bibs: Set<string> }>();

async function loadRegisteredBibs(eventId: string): Promise<Set<string>> {
  const hit = registeredCache.get(eventId);
  if (hit && Date.now() - hit.at < REGISTERED_BIBS_CACHE_MS) return hit.bibs;
  const snap = await db().collection(COLLECTIONS.bibs).where("eventId", "==", eventId).select("bib").get();
  const bibs = new Set(snap.docs.map((d) => String(d.get("bib") ?? d.id)));
  // An empty list is never cached, so the first import takes effect on the next upload.
  if (bibs.size > 0) registeredCache.set(eventId, { at: Date.now(), bibs });
  else registeredCache.delete(eventId);
  return bibs;
}

type UploaderCheck = { ok: true; credit: string } | { ok: false; reason: string };

/**
 * storage.rules already required the path uid to be the signed in, active photographer. Check again here so a
 * photographer revoked between upload and processing is refused. Transient lookup errors throw.
 */
async function verifyUploader(uid: string): Promise<UploaderCheck> {
  if (!uid) return { ok: false, reason: "missing uploader uid" };
  let user;
  try {
    user = await auth().getUser(uid);
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") return { ok: false, reason: "unknown uploader" };
    throw err;
  }
  if (user.disabled) return { ok: false, reason: "uploader account is disabled" };
  if (user.customClaims?.photographer !== true) return { ok: false, reason: "uploader has no photographer claim" };
  const snap = await db().collection(COLLECTIONS.photographers).doc(uid).get();
  const p = snap.data() as Partial<PhotographerDoc> | undefined;
  if (!p || p.active !== true) return { ok: false, reason: "uploader is not an active photographer" };
  return { ok: true, credit: p.credit || p.name || "" };
}

async function removeObject(bucketName: string, name: string): Promise<void> {
  await bucket(bucketName)
    .file(name)
    .delete({ ignoreNotFound: true })
    .catch((err: unknown) => logger.error("onPhotoUploaded: could not delete refused object", { name, error: errorMessage(err) }));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ---------- steps ---------- */

async function saveDerived(bucketName: string, eventId: string, photoId: string, d: DerivedImages): Promise<void> {
  const b = bucket(bucketName);
  const save = (path: string, buffer: Buffer, cacheControl: string) =>
    b.file(path).save(buffer, { resumable: false, contentType: "image/jpeg", metadata: { cacheControl } });
  await Promise.all([
    save(scanPath(eventId, photoId), d.scan.buffer, PRIVATE_CACHE_CONTROL),
    save(previewPath(eventId, photoId), d.preview.buffer, PUBLIC_CACHE_CONTROL),
    save(thumbPath(eventId, photoId), d.thumb.buffer, PUBLIC_CACHE_CONTROL),
  ]);
}

interface ScanOutcome {
  vision: BibExtraction;
  ocrTokens: string[];
  errors: string[];
}

async function scanBibs(scan: DerivedImages["scan"], registered: Set<string>): Promise<ScanOutcome> {
  const errors: string[] = [];
  let tokens: Awaited<ReturnType<typeof detectText>>["tokens"] = [];
  try {
    tokens = (await detectText(scan.buffer)).tokens;
  } catch (err) {
    errors.push(`ocr: ${errorMessage(err)}`);
    logger.error("onPhotoUploaded: Vision OCR failed", { error: errorMessage(err) });
  }
  const vision = extractBibs(tokens, { imageWidth: scan.width, imageHeight: scan.height, registered });
  return { vision, ocrTokens: tokens.slice(0, MAX_STORED_OCR_TOKENS).map((t) => t.text), errors };
}

/* ---------- handler ---------- */

export async function processOriginal(obj: StorageObjectData): Promise<void> {
  const parsed = parseStoragePath(obj.name ?? "");
  if (!parsed || parsed.kind !== "originals") {
    if (obj.name?.startsWith(`${STORAGE_PREFIX.originals}/`)) logger.warn("onPhotoUploaded: unexpected original path", { name: obj.name });
    return;
  }
  const { eventId, photoId } = parsed;
  const uploaderUid = parsed.uid ?? "";
  const generation = String(obj.generation ?? "");
  const photoRef = db().collection(COLLECTIONS.photos).doc(photoId);
  const privRef = photoRef.collection(PHOTO_PRIVATE_SUBCOLLECTION).doc(PHOTO_PRIVATE_DOC);
  const startedMs = Date.now();
  const uploader = await verifyUploader(uploaderUid);

  const outcome = await db().runTransaction(async (tx) => {
    const [privSnap, photoSnap] = await Promise.all([tx.get(privRef), tx.get(photoRef)]);
    const priv = privSnap.data() as (PipelineLock & Partial<PhotoPrivate>) | undefined;
    const decision = decideOriginalClaim({
      objectName: obj.name,
      eventId,
      existingOriginalPath: priv?.originalPath ?? null,
      existingEventId: (photoSnap.get("eventId") as string | undefined) ?? null,
      existingUploaderUid: priv?.uploaderUid ?? null,
      uploaderUid,
      uploaderOk: uploader.ok,
    });
    if (decision.action === "refuse") return decision;
    if (shouldSkipRun(priv, generation, startedMs)) return { action: "skip" as const };
    // originalPath is recorded in the claim itself, so a second object racing for the same id is refused.
    tx.set(
      privRef,
      { originalPath: obj.name, uploaderUid, sourceGeneration: generation, pipelineState: "running", pipelineStartedAtMs: startedMs },
      { merge: true },
    );
    return { action: "process" as const };
  });
  if (outcome.action === "refuse") {
    logger.warn("onPhotoUploaded: original refused", {
      name: obj.name,
      photoId,
      uploaderUid,
      reason: outcome.reason,
      uploaderReason: uploader.ok ? null : uploader.reason,
      deleted: outcome.deleteObject,
    });
    if (outcome.deleteObject) await removeObject(obj.bucket, obj.name);
    return;
  }
  if (outcome.action === "skip") {
    logger.info("onPhotoUploaded: already processed or in progress, skipping", { photoId, generation });
    return;
  }
  const credit = uploader.ok ? uploader.credit : "";

  const uploadedAt = obj.timeCreated ? new Date(obj.timeCreated) : new Date();
  const errors: string[] = [];
  let derived: DerivedImages | null = null;
  let scan: ScanOutcome | null = null;
  let registered = new Set<string>();

  try {
    const [original] = await bucket(obj.bucket).file(obj.name).download();
    derived = await deriveImages(original);
    await saveDerived(obj.bucket, eventId, photoId, derived);
  } catch (err) {
    errors.push(`derive: ${errorMessage(err)}`);
    logger.error("onPhotoUploaded: could not derive images", { photoId, error: errorMessage(err) });
  }

  if (derived) {
    try {
      registered = await loadRegisteredBibs(eventId);
      if (registered.size === 0) logger.warn("onPhotoUploaded: no registered bibs for event, reads go to review", { eventId });
      scan = await scanBibs(derived.scan, registered);
      errors.push(...scan.errors);
    } catch (err) {
      errors.push(`scan: ${errorMessage(err)}`);
      logger.error("onPhotoUploaded: bib scan failed", { photoId, error: errorMessage(err) });
    }
  }

  const decision = scan
    ? decideTags({ vision: scan.vision, registered, hadErrors: errors.length > 0 })
    : { bibs: [], suggestedBibs: [], status: "review" as const, source: "none" as const, confidence: 0 };

  const takenAt = chooseTakenAt(derived?.takenAt ?? null, uploadedAt);

  const base = {
    eventId,
    photographerUid: uploaderUid,
    photographerCredit: credit,
    takenAt: Timestamp.fromDate(takenAt),
    uploadedAt: Timestamp.fromDate(uploadedAt),
    previewPath: previewPath(eventId, photoId),
    thumbPath: thumbPath(eventId, photoId),
    width: derived?.width ?? 0,
    height: derived?.height ?? 0,
    // Only a fixed code is public; the detailed text stays on the private doc and in the logs.
    ...(errors.length > 0 ? { error: "processing_failed" as const } : {}),
  };

  const state: PipelineState = derived ? "done" : "failed";
  const privateDoc: PrivateDoc = {
    originalPath: obj.name,
    originalName: sanitizeFileName(obj.metadata?.[ORIGINAL_NAME_METADATA_KEY]),
    scanPath: scanPath(eventId, photoId),
    contentType: obj.contentType ?? "application/octet-stream",
    sizeBytes: Number(obj.size ?? 0),
    ocrTokens: scan?.ocrTokens ?? [],
    uploaderUid,
    sourceGeneration: generation,
    pipelineState: state,
    pipelineStartedAtMs: startedMs,
    pipelineError: errors.length > 0 ? errors.join("; ") : null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  const photographerRef = db().collection(COLLECTIONS.photographers).doc(uploaderUid);
  // One transaction reads the current photo (a manual tag saved during OCR wins) and the photographer's active flag
  // (a revoke during processing withdraws the photo instead of leaving it searchable).
  const tags = await db().runTransaction(async (tx) => {
    const [photoSnap, photographerSnap] = await Promise.all([tx.get(photoRef), tx.get(photographerRef)]);
    const active = (photographerSnap.data() as Partial<PhotographerDoc> | undefined)?.active === true;
    const merged = withdrawIfInactive(mergeWithExisting(decision, photoSnap.data() as Partial<PhotoDoc> | undefined), active);
    // set without merge clears a stale error field from an earlier failed run.
    tx.set(photoRef, { ...base, ...merged } satisfies PhotoDoc);
    tx.set(privRef, privateDoc);
    return merged;
  });

  logger.info("onPhotoUploaded: done", {
    photoId,
    eventId,
    status: tags.status,
    source: tags.source,
    bibs: tags.bibs,
    suggested: tags.suggestedBibs,
    rejected: scan?.vision.rejected.length ?? 0,
    ms: Date.now() - startedMs,
  });
}

export const onPhotoUploaded = onObjectFinalized(
  { region: REGION, memory: "2GiB", timeoutSeconds: 300 },
  async (event) => {
    try {
      await processOriginal(event.data);
    } catch (err) {
      // Last resort: the Firestore write itself failed. Release the lock so a retry or re-upload can run again.
      logger.error("onPhotoUploaded: pipeline failed", { name: event.data.name, error: errorMessage(err) });
      const parsed = parseStoragePath(event.data.name ?? "");
      if (parsed?.kind === "originals") {
        const privRef = db()
          .collection(COLLECTIONS.photos)
          .doc(parsed.photoId)
          .collection(PHOTO_PRIVATE_SUBCOLLECTION)
          .doc(PHOTO_PRIVATE_DOC);
        // Only release a lock this object owns; a refused object must not touch another photo's state.
        await db()
          .runTransaction(async (tx) => {
            const priv = (await tx.get(privRef)).data() as Partial<PhotoPrivate> | undefined;
            if (priv?.originalPath !== event.data.name) return;
            tx.set(privRef, { pipelineState: "failed", pipelineError: errorMessage(err) }, { merge: true });
          })
          .catch((e: unknown) => logger.error("onPhotoUploaded: could not release lock", { error: errorMessage(e) }));
      }
      throw err;
    }
  },
);
