// Admin only callables (require the admin custom claim), except tagPhoto which photographers may also call
// for their own photos.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { REGION } from "./config";
import { auth, db } from "./firebase";
import { callerOf, requireAdmin } from "./lib/authz";
import { parseBibCsv } from "./lib/csv";
import { withdrawIfInactive } from "./pipeline/photoDoc";
import { invalid, normalizeBib, requireEmail, requireId, requireText } from "./lib/validate";
import {
  COLLECTIONS,
  PHOTOGRAPHER_PRIVATE_SUBCOLLECTION,
  PHOTOGRAPHER_PROFILE_DOC,
  bibDocId,
  type BibDoc,
  type ImportBibsRequest,
  type ImportBibsResponse,
  type InvitePhotographerRequest,
  type InvitePhotographerResponse,
  type PhotoDoc,
  type PhotographerDoc,
  type PhotoStatus,
  type RevokePhotographerRequest,
  type RevokePhotographerResponse,
  type TagPhotoRequest,
  type TagPhotoResponse,
} from "./types";

/** Firestore batches hold at most 500 writes; stay well below. */
export const BATCH_CHUNK = 400;
/** Most bibs on one photo (group shots). */
export const MAX_BIBS_PER_PHOTO = 30;
/** Largest CSV accepted in one call (callable payloads cap at 10 MB). */
export const MAX_CSV_CHARS = 5_000_000;

/* ---------- photo visibility of one photographer ---------- */

/**
 * Moves every photo of one photographer from one status to another (tagged to withdrawn on revoke, and back on
 * re-invite). Updated photos leave the query, so each round reads the next chunk. Returns how many changed.
 */
export async function setPhotographerPhotoStatus(
  firestore: Firestore,
  uid: string,
  from: PhotoStatus,
  to: PhotoStatus,
): Promise<number> {
  let changed = 0;
  for (;;) {
    const snap = await firestore
      .collection(COLLECTIONS.photos)
      .where("photographerUid", "==", uid)
      .where("status", "==", from)
      .limit(BATCH_CHUNK)
      .get();
    if (snap.empty) return changed;
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { status: to }));
    await batch.commit();
    changed += snap.size;
  }
}

/* ---------- invitePhotographer ---------- */

async function getOrCreateUser(email: string, name: string): Promise<{ uid: string; created: boolean }> {
  try {
    const user = await auth().getUserByEmail(email);
    return { uid: user.uid, created: false };
  } catch (err) {
    if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
    const user = await auth().createUser({ email, displayName: name, emailVerified: false, disabled: false });
    return { uid: user.uid, created: true };
  }
}

export const invitePhotographer = onCall<InvitePhotographerRequest, Promise<InvitePhotographerResponse>>(
  { region: REGION },
  async (request) => {
    const admin = requireAdmin(request);
    const data = (request.data ?? {}) as Partial<InvitePhotographerRequest>;
    const email = requireEmail(data.email);
    const name = requireText(data.name, "name", 120);
    const credit = requireText(data.credit ?? "", "credit", 120, { allowEmpty: true }) || `Photo by ${name}`;

    const { uid, created } = await getOrCreateUser(email, name);
    const user = await auth().getUser(uid);
    // Keep any existing claims (an admin can also be a photographer).
    await auth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), photographer: true });

    // photographers/{uid} is public and holds only the PhotographerDoc fields. Email and invite data stay in
    // the server only photographers/{uid}/private/profile. A re-invite keeps the saved GCash profile.
    const firestore = db();
    const ref = firestore.collection(COLLECTIONS.photographers).doc(uid);
    const profileRef = ref.collection(PHOTOGRAPHER_PRIVATE_SUBCOLLECTION).doc(PHOTOGRAPHER_PROFILE_DOC);
    await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        // Also strips fields an earlier build stored on the public doc.
        tx.update(ref, {
          name,
          credit,
          active: true,
          email: FieldValue.delete(),
          invitedBy: FieldValue.delete(),
          invitedAt: FieldValue.delete(),
        });
      } else {
        const doc: PhotographerDoc = { name, credit, active: true, gcashName: null, gcashNumber: null, qrPath: null };
        tx.set(ref, doc);
      }
      tx.set(profileRef, { email, invitedBy: admin.uid, invitedAt: FieldValue.serverTimestamp() });
    });
    // A re-invite after a revoke puts the photos back on sale.
    const restored = await setPhotographerPhotoStatus(firestore, uid, "withdrawn", "tagged");
    logger.info("photographer invited", { uid, created, restored, by: admin.uid });
    // The photographer signs in on upload.html with this email (email link or Google); the claim is already set.
    return { uid, created };
  },
);

/* ---------- revokePhotographer ---------- */

async function resolveUid(data: Partial<RevokePhotographerRequest>): Promise<string> {
  if (typeof data.uid === "string" && data.uid.trim() !== "") return requireId(data.uid.trim(), "uid");
  const email = requireEmail(data.email);
  try {
    return (await auth().getUserByEmail(email)).uid;
  } catch (err) {
    if ((err as { code?: string }).code === "auth/user-not-found") throw new HttpsError("not-found", "No account uses that email.");
    throw err;
  }
}

export const revokePhotographer = onCall<RevokePhotographerRequest, Promise<RevokePhotographerResponse>>(
  { region: REGION },
  async (request) => {
    const admin = requireAdmin(request);
    const uid = await resolveUid((request.data ?? {}) as Partial<RevokePhotographerRequest>);
    const user = await auth().getUser(uid);
    const { photographer: _removed, ...claims } = user.customClaims ?? {};
    await auth().setCustomUserClaims(uid, claims);
    // Rules, the upload trigger, saveGcashProfile, tagPhoto and createOrders all require active == true, so this
    // takes effect before the ID token (which still carries the claim for up to an hour) expires.
    const firestore = db();
    await firestore.collection(COLLECTIONS.photographers).doc(uid).set({ active: false }, { merge: true });
    await auth().revokeRefreshTokens(uid);
    // Off the search page and out of new carts. Open orders stay: the photographer can still review receipts.
    const withdrawn = await setPhotographerPhotoStatus(firestore, uid, "tagged", "withdrawn");
    logger.info("photographer revoked", { uid, withdrawn, by: admin.uid });
    return { uid };
  },
);

/* ---------- importBibs ---------- */

async function writeBibs(firestore: Firestore, eventId: string, rows: { bib: string; distance: BibDoc["distance"] }[]) {
  for (let start = 0; start < rows.length; start += BATCH_CHUNK) {
    const batch = firestore.batch();
    for (const row of rows.slice(start, start + BATCH_CHUNK)) {
      const doc: Omit<BibDoc, "importedAt"> & { importedAt: FieldValue } = {
        bib: row.bib,
        eventId,
        distance: row.distance,
        importedAt: FieldValue.serverTimestamp(),
      };
      batch.set(firestore.collection(COLLECTIONS.bibs).doc(bibDocId(eventId, row.bib)), doc);
    }
    await batch.commit();
  }
}

export const importBibs = onCall<ImportBibsRequest, Promise<ImportBibsResponse>>(
  { region: REGION, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const admin = requireAdmin(request);
    const data = (request.data ?? {}) as Partial<ImportBibsRequest>;
    const eventId = requireId(data.eventId, "eventId");
    if (typeof data.csvText !== "string") invalid("csvText is required (the raw CSV file text)");
    if (data.csvText.length > MAX_CSV_CHARS) invalid("CSV file is too large");
    // Server side parse with the tolerant parser; skipped rows carry 1 based physical CSV line numbers.
    const parsed = parseBibCsv(data.csvText);
    if (parsed.rows.length === 0 && parsed.skipped.length === 0) invalid("the file has no rows");

    await writeBibs(db(), eventId, parsed.rows);
    logger.info("bibs imported", { eventId, imported: parsed.rows.length, skipped: parsed.skipped.length, by: admin.uid });
    return { imported: parsed.rows.length, skipped: parsed.skipped };
  },
);

/* ---------- tagPhoto ---------- */

function requireBibList(value: unknown): string[] {
  if (!Array.isArray(value)) invalid("bibs must be an array");
  if (value.length > MAX_BIBS_PER_PHOTO) invalid(`at most ${MAX_BIBS_PER_PHOTO} bibs per photo`);
  const bibs: string[] = [];
  for (const raw of value) {
    const bib = normalizeBib(raw);
    if (!bib) invalid(`"${String(raw).slice(0, 20)}" is not a valid bib`);
    if (!bibs.includes(bib)) bibs.push(bib);
  }
  return bibs;
}

export const tagPhoto = onCall<TagPhotoRequest, Promise<TagPhotoResponse>>(
  { region: REGION },
  async (request) => {
    const caller = callerOf(request);
    if (!caller.isAdmin && !caller.isPhotographer) throw new HttpsError("permission-denied", "Not allowed to tag photos.");
    const data = (request.data ?? {}) as Partial<TagPhotoRequest>;
    const photoId = requireId(data.photoId, "photoId");
    const bibs = requireBibList(data.bibs);

    const firestore = db();
    const photoRef = firestore.collection(COLLECTIONS.photos).doc(photoId);
    const photoSnap = await photoRef.get();
    const photo = photoSnap.data() as PhotoDoc | undefined;
    if (!photo) throw new HttpsError("not-found", "Photo not found.");
    if (!caller.isAdmin && photo.photographerUid !== caller.uid) {
      throw new HttpsError("permission-denied", "You can only tag your own photos.");
    }
    if (photo.status === "withdrawn") {
      throw new HttpsError("failed-precondition", "This photo was withdrawn with its photographer. Invite them again to restore it.");
    }
    if (!caller.isAdmin) {
      // The claim outlives a revoke by up to an hour; the active flag does not.
      const me = (await firestore.collection(COLLECTIONS.photographers).doc(caller.uid).get()).data() as Partial<PhotographerDoc> | undefined;
      if (me?.active !== true) throw new HttpsError("permission-denied", "Your photographer access is off.");
    }

    // Every bib must be registered for the photo's event (the bib list is the authority).
    if (bibs.length > 0) {
      const bibSnaps = await firestore.getAll(
        ...bibs.map((b) => firestore.collection(COLLECTIONS.bibs).doc(bibDocId(photo.eventId, b))),
      );
      const unknown = bibs.filter((_, i) => !bibSnaps[i].exists);
      if (unknown.length > 0) invalid(`Not registered for this event: ${unknown.join(", ")}`);
    }

    // [] means a human confirmed there is no readable bib: status untagged leaves the queue (status review only).
    // The owner's active flag is read in the same transaction as the write, so a revoke running at the same time
    // cannot leave this photo searchable ("tagged" becomes "withdrawn").
    const ownerRef = firestore.collection(COLLECTIONS.photographers).doc(photo.photographerUid);
    const status = await firestore.runTransaction(async (tx) => {
      const [current, owner] = await Promise.all([tx.get(photoRef), tx.get(ownerRef)]);
      if ((current.data() as PhotoDoc | undefined)?.status === "withdrawn") {
        throw new HttpsError("failed-precondition", "This photo was withdrawn with its photographer. Invite them again to restore it.");
      }
      const active = (owner.data() as Partial<PhotographerDoc> | undefined)?.active === true;
      const next = withdrawIfInactive({ status: (bibs.length > 0 ? "tagged" : "untagged") as PhotoDoc["status"] }, active).status;
      tx.update(photoRef, {
        bibs,
        suggestedBibs: [],
        status: next,
        source: "manual",
        confidence: 1,
        reviewedAt: FieldValue.serverTimestamp(),
        error: FieldValue.delete(),
      });
      return next as TagPhotoResponse["status"];
    });
    logger.info("photo tagged", { photoId, bibs: bibs.length, by: caller.uid });
    return { photoId, bibs, status };
  },
);
