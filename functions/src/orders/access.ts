// Shared plumbing for the order callables: buyer token checks, Storage object checks, time formatting.
import type { DocumentReference, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { bucket, db } from "../firebase";
import { tokenMatchesAny } from "../lib/tokens";
import { invalid, requireId } from "../lib/validate";
import { COLLECTIONS, type OrderAccessRequest, type OrderDoc } from "../types";

export interface OrderAccess {
  orderId: string;
  token: string;
  ref: DocumentReference;
}

/** Validates { orderId, token } shapes. The token itself is checked against the order later. */
export function parseOrderAccess(data: unknown): OrderAccess {
  const d = (data ?? {}) as Partial<OrderAccessRequest>;
  const orderId = requireId(d.orderId, "orderId");
  if (typeof d.token !== "string" || d.token.length === 0 || d.token.length > 256) invalid("token is required");
  return { orderId, token: d.token, ref: db().collection(COLLECTIONS.orders).doc(orderId) };
}

/** One error for a missing order and a wrong token, so the link reveals nothing. */
export function deniedLink(): HttpsError {
  return new HttpsError("permission-denied", "This order link is not valid.");
}

/** The order when the token matches, otherwise throws deniedLink. Hashes are always compared in constant time. */
export function requireOrderForToken(order: OrderDoc | undefined, token: string): OrderDoc {
  const ok = tokenMatchesAny(token, order?.accessTokenHashes);
  if (!order || !ok) throw deniedLink();
  return order;
}

export function iso(t: Timestamp | null | undefined): string | null {
  return t ? t.toDate().toISOString() : null;
}

export interface ObjectInfo {
  size: number;
  contentType: string;
}

/** Size and content type of a Storage object, or null when it does not exist. */
export async function objectInfo(path: string): Promise<ObjectInfo | null> {
  const file = bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [meta] = await file.getMetadata();
  return { size: Number(meta.size ?? 0), contentType: String(meta.contentType ?? "") };
}

/** Accepted image types for receipts and QR codes (mirrors storage.rules). */
export const IMAGE_CONTENT_TYPE = /^image\/(jpeg|png|webp)$/;
