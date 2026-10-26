// Pure order helpers: grouping a cart per photographer, amounts, order codes, GCash input validation and
// the Storage paths buyers and photographers may reference. No Firebase imports, fully unit tested.
import { randomInt } from "node:crypto";
import { PRICE_PER_PHOTO } from "../config";
import { QR_EXTENSIONS, STORAGE_PREFIX, type Pesos, type PhotographerDoc } from "../types";

/* ---------- grouping and amounts ---------- */

export interface CartPhoto {
  photoId: string;
  photographerUid: string;
  thumbPath: string;
}

export interface OrderGroup {
  photographerUid: string;
  photoIds: string[];
  thumbPaths: string[];
  count: number;
  amount: Pesos;
}

/** count x price, whole pesos. Throws on a count that is not a positive whole number. */
export function orderAmount(count: number, pricePerPhoto: Pesos = PRICE_PER_PHOTO): Pesos {
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError("an order needs at least one photo");
  if (!Number.isSafeInteger(pricePerPhoto) || pricePerPhoto < 1) throw new RangeError("price must be a whole number of pesos");
  return count * pricePerPhoto;
}

/**
 * Splits a cart into one group per photographer, keeping the cart order inside each group and ordering groups
 * by first appearance. Duplicate photo ids are counted once.
 */
export function groupByPhotographer(photos: readonly CartPhoto[], pricePerPhoto: Pesos = PRICE_PER_PHOTO): OrderGroup[] {
  const groups = new Map<string, { photoIds: string[]; thumbPaths: string[] }>();
  const seen = new Set<string>();
  for (const p of photos) {
    if (seen.has(p.photoId)) continue;
    seen.add(p.photoId);
    let g = groups.get(p.photographerUid);
    if (!g) {
      g = { photoIds: [], thumbPaths: [] };
      groups.set(p.photographerUid, g);
    }
    g.photoIds.push(p.photoId);
    g.thumbPaths.push(p.thumbPath);
  }
  return [...groups.entries()].map(([photographerUid, g]) => ({
    photographerUid,
    photoIds: g.photoIds,
    thumbPaths: g.thumbPaths,
    count: g.photoIds.length,
    amount: orderAmount(g.photoIds.length, pricePerPhoto),
  }));
}

/* ---------- who can be paid, who is buying ---------- */

/**
 * A photographer can take new orders and receipts only while active (not revoked by the organisers) and with
 * a saved GCash name and number.
 */
export function isPayablePhotographer(p: Partial<PhotographerDoc> | undefined): boolean {
  return p?.active === true && Boolean(p.gcashName) && Boolean(p.gcashNumber);
}

/**
 * The buyer name goes into an email to an address the caller picks, so it must read as a name: letters,
 * spaces and . , ' and hyphen only, no digits, and no dot joined to the next letter (no "site.com" links).
 */
const BUYER_NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u;
const DOT_INSIDE_WORD = /\.[\p{L}\p{M}]/u;

export function isSafeBuyerName(name: string): boolean {
  return BUYER_NAME_CHARS.test(name) && !DOT_INSIDE_WORD.test(name);
}

/* ---------- order codes ---------- */

/** Code alphabet without look alike characters (no 0, O, 1, I, L, U). */
export const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORDER_CODE_LENGTH = 5;
export const ORDER_CODE_PATTERN = new RegExp(`^TR-[${ORDER_CODE_ALPHABET}]{${ORDER_CODE_LENGTH}}$`);

/** Short human code for the GCash message, for example TR-7K3Q9. Not a secret: the access token is. */
export function newOrderCode(rand: (max: number) => number = randomInt): string {
  let body = "";
  for (let i = 0; i < ORDER_CODE_LENGTH; i += 1) body += ORDER_CODE_ALPHABET[rand(ORDER_CODE_ALPHABET.length)];
  return `TR-${body}`;
}

/* ---------- GCash input ---------- */

/** GCash reference number: 13 digits once spaces are removed. null when it does not match. */
export function normalizeGcashRef(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const ref = String(value).replace(/\s+/g, "");
  return /^\d{13}$/.test(ref) ? ref : null;
}

/**
 * Philippine mobile number as 09XXXXXXXXX. Accepts 09XXXXXXXXX or +639XXXXXXXXX (also 639XXXXXXXXX),
 * ignoring spaces, dashes, dots and brackets. null when it is not a PH mobile number.
 */
export function normalizePhMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s\-.()]/g, "");
  if (/^09\d{9}$/.test(compact)) return compact;
  const intl = /^\+?639(\d{9})$/.exec(compact);
  return intl ? `09${intl[1]}` : null;
}

/* ---------- Storage paths a client may hand back ---------- */

const RECEIPT_FILE_RE = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;

/** True when path is receipts/{orderId}/{file} for this order with an accepted file name. */
export function isReceiptPathFor(orderId: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  const prefix = `${STORAGE_PREFIX.receipts}/${orderId}/`;
  if (!path.startsWith(prefix)) return false;
  return RECEIPT_FILE_RE.test(path.slice(prefix.length));
}

/** True when path is qr/{uid}.png|jpg|webp for this uid. */
export function isQrPathFor(uid: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  return (QR_EXTENSIONS as readonly string[]).some((ext) => path === `${STORAGE_PREFIX.qr}/${uid}.${ext}`);
}

/** Site relative order page link carrying the id and the plain token. */
export function orderPageUrl(orderId: string, token: string): string {
  return `photos/order.html?id=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;
}

/**
 * Public download URL of a Storage object whose rules allow public read (thumbs, previews, qr).
 * Points at the Storage emulator when FIREBASE_STORAGE_EMULATOR_HOST is set.
 */
export function publicStorageUrl(bucketName: string, path: string, env: NodeJS.ProcessEnv = process.env): string {
  const host = env.FIREBASE_STORAGE_EMULATOR_HOST;
  const base = host ? `http://${host.replace(/^https?:\/\//, "")}` : "https://firebasestorage.googleapis.com";
  return `${base}/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(path)}?alt=media`;
}
