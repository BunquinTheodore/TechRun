// Shared data contract for the TechRun 2027 race photo system.
// Firestore documents, callable request/response shapes and Storage path helpers.
// Every other module (pipeline, orders, admin, frontend) builds on these names.

import type { Timestamp } from "firebase-admin/firestore";

/* ---------- collections ---------- */

export const COLLECTIONS = {
  events: "events",
  bibs: "bibs",
  photos: "photos",
  orders: "orders",
  photographers: "photographers",
  /** gcashRefs/{13 digit ref}: which orders used a GCash reference number (server only). */
  gcashRefs: "gcashRefs",
  /** Outgoing email queue read by the Firebase Trigger Email extension (server only). */
  mail: "mail",
  /** Fixed window counters for callable throttling (server only, TTL on expireAt). */
  rateLimits: "rateLimits",
} as const;

/** Subcollection under photographers/{uid} holding private data (server only). */
export const PHOTOGRAPHER_PRIVATE_SUBCOLLECTION = "private";
/** Document id inside photographers/{uid}/private/. */
export const PHOTOGRAPHER_PROFILE_DOC = "profile";

/** Subcollection under photos/{photoId} holding server only data. */
export const PHOTO_PRIVATE_SUBCOLLECTION = "private";
/** Document id inside photos/{photoId}/private/. */
export const PHOTO_PRIVATE_DOC = "paths";

/**
 * Custom metadata key the upload page may set to the camera file name. Used only as the download file name.
 * The uploader uid is NOT metadata: it is the {uid} segment of the upload path, enforced by storage.rules.
 */
export const ORIGINAL_NAME_METADATA_KEY = "originalName";

/* ---------- enums ---------- */

export type Distance = "3K" | "5K" | "10K";
export const DISTANCES: readonly Distance[] = ["3K", "5K", "10K"];

/**
 * tagged: has confirmed bibs (searchable, buyable).
 * review: waits for a human (no confident registered bib, ambiguous reads, or a processing failure).
 * untagged: a human confirmed there is no readable bib (left the review queue).
 * withdrawn: was tagged, but the photographer was revoked (hidden from search, not buyable). A re-invite
 *   turns it back into tagged.
 */
export type PhotoStatus = "tagged" | "review" | "untagged" | "withdrawn";
export type PhotoSource = "vision" | "manual" | "none";

export type OrderStatus = "awaiting_payment" | "submitted" | "approved" | "rejected";
/** Whole Philippine pesos (no centavos: the price per photo is a whole peso amount). */
export type Pesos = number;

/* ---------- events/{eventId} (public read) ---------- */

export interface EventDoc {
  name: string;
  /** Race date (TBA until confirmed), null while unknown. */
  date: Timestamp | null;
}

/* ---------- bibs/{eventId}__{bib} (admin read) ---------- */

/** Document id is bibDocId(eventId, bib), so the same number can be registered for several events. */
export interface BibDoc {
  bib: string;
  eventId: string;
  distance: Distance;
  importedAt: Timestamp;
}

/* ---------- photos/{photoId} (public read) ---------- */

/** Fixed public error code. Detailed messages stay in the private doc and the logs. */
export type PhotoErrorCode = "processing_failed";

export interface PhotoDoc {
  eventId: string;
  photographerUid: string;
  /** Credit line copied from photographers/{uid}.credit at upload time. */
  photographerCredit: string;
  /** Confirmed bibs. A group shot carries several, so it appears under every runner in it. */
  bibs: string[];
  /** Candidate bibs for the review queue (status review); empty otherwise. */
  suggestedBibs: string[];
  status: PhotoStatus;
  source: PhotoSource;
  /** 0..1 confidence of the automatic read; 1 for manual. */
  confidence: number;
  /** EXIF capture time, falling back to upload time. Results are ordered by this. */
  takenAt: Timestamp;
  uploadedAt: Timestamp;
  /** Set when a human tagged or cleared the photo (tagPhoto). */
  reviewedAt?: Timestamp;
  /** Storage path of the 1200px watermarked preview (public). */
  previewPath: string;
  /** Storage path of the 400px thumbnail (public). */
  thumbPath: string;
  width: number;
  height: number;
  /** Present only when processing failed. */
  error?: PhotoErrorCode;
}

/* ---------- photos/{photoId}/private/paths (server only) ---------- */

export interface PhotoPrivate {
  /** Storage path of the full resolution original. Never sent to clients except as a signed URL after approval. */
  originalPath: string;
  /** Camera file name from the upload metadata, sanitised; used as the download file name. */
  originalName: string | null;
  /** Storage path of the 2000px scan image used for OCR. */
  scanPath: string;
  contentType: string;
  sizeBytes: number;
  /** Raw OCR tokens kept for debugging accuracy. */
  ocrTokens?: string[];
  /** Uid from the upload path. */
  uploaderUid?: string;
  /** Detailed pipeline error text (never public). */
  pipelineError?: string | null;
}

/* ---------- photographers/{uid} (public read) ---------- */

/** Public profile: exactly these fields. Contact data lives in photographers/{uid}/private/profile. */
export interface PhotographerDoc {
  name: string;
  /** Credit line shown on photos, for example "Photo by Juan Dela Cruz". */
  credit: string;
  /** storage.rules and the upload trigger refuse uploads unless this is true. */
  active: boolean;
  /** GCash account name shown to buyers. null until the photographer saves a GCash profile. */
  gcashName: string | null;
  /** GCash mobile number, normalised to 09XXXXXXXXX. */
  gcashNumber: string | null;
  /** Storage path of the GCash QR image (qr/{uid}.png|jpg|webp, public read), or null. */
  qrPath: string | null;
}

/* ---------- photographers/{uid}/private/profile (server only) ---------- */

export interface PhotographerPrivateProfile {
  email: string;
  invitedBy: string;
  invitedAt: Timestamp;
}

/* ---------- orders/{orderId} (read by its photographer only) ---------- */

export interface OrderDoc {
  /** Short human code the buyer types in the GCash message, for example TR-7K3Q9. */
  code: string;
  buyerName: string;
  buyerEmail: string;
  photographerUid: string;
  photographerName: string;
  photoIds: string[];
  /** thumbPath of each photo, same order as photoIds (for the dashboard list). */
  thumbPaths: string[];
  count: number;
  /** count x PRICE_PER_PHOTO, whole pesos. */
  amount: Pesos;
  pricePerPhoto: Pesos;
  currency: "PHP";
  status: OrderStatus;
  /**
   * SHA-256 hex of each buyer access token. The plain tokens go only to the buyer (createOrders response and
   * emails). reviewOrder adds one so the approve or reject email can carry a working link; old links keep working.
   */
  accessTokenHashes: string[];
  /** receipts/{orderId}/{file}, set by submitReceipt. */
  receiptPath: string | null;
  /** 13 digit GCash reference number, set by submitReceipt. */
  gcashRef: string | null;
  /** True when another order already used the same GCash reference number. */
  duplicateRef: boolean;
  /** The other orders that used this reference number. */
  duplicateOrderIds: string[];
  rejectReason: string | null;
  createdAt: Timestamp;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  approvedAt: Timestamp | null;
  /** Firestore TTL field: set while unpaid or rejected, null once submitted or approved. */
  expireAt: Timestamp | null;
}

/* ---------- gcashRefs/{ref} (server only) ---------- */

export interface GcashRefDoc {
  ref: string;
  orderIds: string[];
  firstUsedAt: Timestamp;
}

/* ---------- mail/{id} (server only, Trigger Email extension format) ---------- */

export interface MailDoc {
  to: string;
  message: { subject: string; text: string; html: string };
}

/* ---------- callable contracts: buyer (no sign in) ---------- */

export interface CreateOrdersRequest {
  buyerName: string;
  buyerEmail: string;
  /** 1..MAX_PHOTOS_PER_CALL ids of tagged photos. Duplicates are ignored. */
  photoIds: string[];
}
export interface CreatedOrder {
  orderId: string;
  code: string;
  /** Plain access token. Shown once; the order page link carries it. */
  token: string;
  /** Site relative link: photos/order.html?id={orderId}&t={token}. */
  url: string;
  photographerName: string;
  amount: Pesos;
  count: number;
}
/** One order per photographer in the cart. */
export type CreateOrdersResponse = CreatedOrder[];

export interface OrderAccessRequest {
  orderId: string;
  token: string;
}

export type GetOrderRequest = OrderAccessRequest;
export interface OrderPhoto {
  photoId: string;
  thumbPath: string;
  /** Public URL of the thumbnail. */
  thumbUrl: string;
}
export interface GetOrderResponse {
  orderId: string;
  code: string;
  status: OrderStatus;
  amount: Pesos;
  pricePerPhoto: Pesos;
  currency: "PHP";
  count: number;
  buyerName: string;
  photos: OrderPhoto[];
  photographer: {
    name: string;
    gcashName: string | null;
    gcashNumber: string | null;
    qrPath: string | null;
    /** Public URL of the QR image, or null. */
    qrUrl: string | null;
    /** False once the organisers revoked the photographer: no GCash details, no new receipts. */
    active: boolean;
  };
  gcashRef: string | null;
  rejectReason: string | null;
  /** ISO times. */
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
}

export interface SubmitReceiptRequest extends OrderAccessRequest {
  /** 13 digits; spaces are ignored. */
  gcashRef: string;
  /** receipts/{orderId}/{file}, already uploaded by the order page. */
  receiptPath: string;
}
export interface SubmitReceiptResponse {
  status: "submitted";
}

export type GetDownloadsRequest = OrderAccessRequest;
export interface DownloadFile {
  photoId: string;
  url: string;
  fileName: string;
}
export interface GetDownloadsResponse {
  files: DownloadFile[];
  /** ISO time the signed URLs expire. */
  expiresAt: string;
}

/* ---------- callable contracts: photographer (signed in) ---------- */

export interface ReviewOrderRequest {
  orderId: string;
  action: "approve" | "reject";
  /** Required for reject, 1..MAX_REJECT_REASON_CHARS characters. */
  reason?: string;
}
export interface ReviewOrderResponse {
  orderId: string;
  status: "approved" | "rejected";
}

export interface SaveGcashProfileRequest {
  gcashName: string;
  /** 09XXXXXXXXX or +639XXXXXXXXX (spaces and dashes ignored). */
  gcashNumber: string;
  /** qr/{uid}.png|jpg|webp already uploaded, or null to keep none. */
  qrPath: string | null;
}
export interface SaveGcashProfileResponse {
  gcashName: string;
  gcashNumber: string;
  qrPath: string | null;
}

/* ---------- callable contracts: admin and tagging ---------- */

export interface InvitePhotographerRequest {
  email: string;
  name: string;
  credit: string;
}
export interface InvitePhotographerResponse {
  uid: string;
  created: boolean;
}

export interface RevokePhotographerRequest {
  /** Either uid or email identifies the photographer. */
  uid?: string;
  email?: string;
}
export interface RevokePhotographerResponse {
  uid: string;
}

export interface ImportBibRow {
  bib: string;
  distance: Distance;
}
/** The raw CSV file text; the server parser handles every export shape. */
export interface ImportBibsRequest {
  eventId: string;
  csvText: string;
}
export interface ImportBibsResponse {
  imported: number;
  /** Rows rejected by validation. row is the 1 based physical line in the CSV file. */
  skipped: { row: number; bib: string; reason: string }[];
}

export interface TagPhotoRequest {
  photoId: string;
  /** Confirmed bibs; [] means a human found no readable bib (status untagged, leaves the queue). */
  bibs: string[];
}
export interface TagPhotoResponse {
  photoId: string;
  bibs: string[];
  /** "withdrawn" when the photo's photographer was revoked (the bibs are kept for a later re-invite). */
  status: "tagged" | "untagged" | "withdrawn";
}

/* ---------- Storage paths ---------- */

export const STORAGE_PREFIX = {
  originals: "originals",
  previews: "previews",
  thumbs: "thumbs",
  scans: "scans",
  receipts: "receipts",
  qr: "qr",
} as const;

export type PhotoStorageKind = "originals" | "previews" | "thumbs" | "scans";

/** Extensions accepted for originals (HEIC is not: the server image library cannot decode it). */
export const ORIGINAL_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
/** Extensions accepted for the GCash QR image. */
export const QR_EXTENSIONS = ["png", "jpg", "webp"] as const;

/** originals/{eventId}/{uid}/{photoId}.{ext} (ext lower case). */
/** Id of the bibs/ doc for a bib in an event. */
export function bibDocId(eventId: string, bib: string): string {
  return `${eventId}__${bib}`;
}

export function originalPath(eventId: string, uid: string, photoId: string, ext: string): string {
  return `${STORAGE_PREFIX.originals}/${eventId}/${uid}/${photoId}.${ext.toLowerCase().replace(/^\./, "")}`;
}
/** previews/{eventId}/{photoId}.jpg (1200px, watermarked, public). */
export function previewPath(eventId: string, photoId: string): string {
  return `${STORAGE_PREFIX.previews}/${eventId}/${photoId}.jpg`;
}
/** thumbs/{eventId}/{photoId}.jpg (400px, public). */
export function thumbPath(eventId: string, photoId: string): string {
  return `${STORAGE_PREFIX.thumbs}/${eventId}/${photoId}.jpg`;
}
/** scans/{eventId}/{photoId}.jpg (2000px OCR input, server only). */
export function scanPath(eventId: string, photoId: string): string {
  return `${STORAGE_PREFIX.scans}/${eventId}/${photoId}.jpg`;
}
/** receipts/{orderId}/{fileName} (buyer upload, readable by the order's photographer). */
export function receiptPathPrefix(orderId: string): string {
  return `${STORAGE_PREFIX.receipts}/${orderId}/`;
}
/** qr/{uid}.{ext} (photographer upload, public read). */
export function qrPath(uid: string, ext: string): string {
  return `${STORAGE_PREFIX.qr}/${uid}.${ext.toLowerCase()}`;
}

export interface ParsedStoragePath {
  kind: PhotoStorageKind;
  eventId: string;
  /** Uploader uid; only originals carry it. */
  uid: string | null;
  photoId: string;
  ext: string;
}

const SEGMENT = "[A-Za-z0-9_-]{1,128}";
const ORIGINAL_PATH_RE = new RegExp(`^originals/(${SEGMENT})/(${SEGMENT})/(${SEGMENT})\\.([A-Za-z0-9]{1,8})$`);
const DERIVED_PATH_RE = new RegExp(`^(previews|thumbs|scans)/(${SEGMENT})/(${SEGMENT})\\.([A-Za-z0-9]{1,8})$`);

/** Parses originals (with uid) and the three derived path shapes; null when the path does not match. */
export function parseStoragePath(path: string): ParsedStoragePath | null {
  const o = ORIGINAL_PATH_RE.exec(path);
  if (o) return { kind: "originals", eventId: o[1], uid: o[2], photoId: o[3], ext: o[4].toLowerCase() };
  const d = DERIVED_PATH_RE.exec(path);
  if (d) return { kind: d[1] as PhotoStorageKind, eventId: d[2], uid: null, photoId: d[3], ext: d[4].toLowerCase() };
  return null;
}
