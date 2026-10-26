// Photographer callables (signed in): reviewOrder (only the order's own photographer) and saveGcashProfile.
// There is no admin path for orders. reviewOrder checks only that the caller took the photos, not the claim, so
// a revoked photographer can still settle receipts that buyers sent; nothing new can be ordered from them.
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { MAX_QR_BYTES, MAX_REJECT_REASON_CHARS, ORDER_REJECTED_TTL_MS, REGION, siteOrigin } from "../config";
import { db } from "../firebase";
import { callerOf } from "../lib/authz";
import { hashToken, MAX_TOKEN_HASHES, newAccessToken } from "../lib/tokens";
import { invalid, requireId, requireText } from "../lib/validate";
import {
  COLLECTIONS,
  type OrderDoc,
  type PhotographerDoc,
  type ReviewOrderRequest,
  type ReviewOrderResponse,
  type SaveGcashProfileRequest,
  type SaveGcashProfileResponse,
} from "../types";
import { IMAGE_CONTENT_TYPE, objectInfo } from "./access";
import { orderApprovedMail, orderRejectedMail, queueMail } from "./emails";
import { isQrPathFor, normalizePhMobile, orderPageUrl } from "./logic";

/** Keeps the first (createOrders) hash, the most recent ones, and adds the new one. */
export function withNewHash(hashes: readonly string[], next: string): string[] {
  if (hashes.length < MAX_TOKEN_HASHES) return [...hashes, next];
  return [hashes[0], ...hashes.slice(-(MAX_TOKEN_HASHES - 2)), next];
}

/* ---------- reviewOrder ---------- */

export const reviewOrder = onCall<ReviewOrderRequest, Promise<ReviewOrderResponse>>({ region: REGION }, async (request) => {
  const caller = callerOf(request);
  const data = (request.data ?? {}) as Partial<ReviewOrderRequest>;
  const orderId = requireId(data.orderId, "orderId");
  if (data.action !== "approve" && data.action !== "reject") invalid('action must be "approve" or "reject"');
  const action = data.action;
  const reason = action === "reject" ? requireText(data.reason, "reason", MAX_REJECT_REASON_CHARS) : null;

  const firestore = db();
  const ref = firestore.collection(COLLECTIONS.orders).doc(orderId);
  const status = await firestore.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data() as OrderDoc | undefined;
    if (!order) throw new HttpsError("not-found", "Order not found.");
    if (order.photographerUid !== caller.uid) throw new HttpsError("permission-denied", "Only the photographer of this order can review it.");
    if (order.status !== "submitted") throw new HttpsError("failed-precondition", "Only orders with a submitted receipt can be reviewed.");

    // A fresh token lets the email carry a working link (only hashes are stored); earlier links keep working.
    const token = newAccessToken();
    const link = `${siteOrigin()}/${orderPageUrl(orderId, token)}`;
    const common = { reviewedAt: FieldValue.serverTimestamp(), accessTokenHashes: withNewHash(order.accessTokenHashes ?? [], hashToken(token)) };
    if (action === "approve") {
      tx.update(ref, { ...common, status: "approved", approvedAt: FieldValue.serverTimestamp(), rejectReason: null, expireAt: null });
      queueMail(firestore, tx, orderApprovedMail(order.buyerEmail, { code: order.code, link }));
      return "approved" as const;
    }
    tx.update(ref, {
      ...common,
      status: "rejected",
      rejectReason: reason,
      expireAt: Timestamp.fromMillis(Date.now() + ORDER_REJECTED_TTL_MS),
    });
    queueMail(firestore, tx, orderRejectedMail(order.buyerEmail, { code: order.code, reason: reason ?? "", link }));
    return "rejected" as const;
  });
  logger.info("order reviewed", { orderId, status, by: caller.uid });
  return { orderId, status };
});

/* ---------- saveGcashProfile ---------- */

const MIN_GCASH_NAME = 2;
const MAX_GCASH_NAME = 80;

export const saveGcashProfile = onCall<SaveGcashProfileRequest, Promise<SaveGcashProfileResponse>>(
  { region: REGION },
  async (request) => {
    const caller = callerOf(request);
    if (!caller.isPhotographer) throw new HttpsError("permission-denied", "Only invited photographers can set a GCash profile.");
    const data = (request.data ?? {}) as Partial<SaveGcashProfileRequest>;
    const gcashName = requireText(data.gcashName, "gcashName", MAX_GCASH_NAME);
    if (gcashName.length < MIN_GCASH_NAME) invalid("gcashName is too short");
    const gcashNumber = normalizePhMobile(data.gcashNumber);
    if (!gcashNumber) invalid("gcashNumber must be a PH mobile number, 09XXXXXXXXX or +639XXXXXXXXX");

    let qrPath: string | null = null;
    if (data.qrPath !== null && data.qrPath !== undefined && data.qrPath !== "") {
      if (!isQrPathFor(caller.uid, data.qrPath)) invalid("qrPath must be qr/{your uid}.png, .jpg or .webp");
      const info = await objectInfo(data.qrPath);
      if (!info) invalid("Upload the QR image first.");
      if (info.size <= 0 || info.size > MAX_QR_BYTES) invalid("The QR image must be 5 MB or smaller.");
      if (!IMAGE_CONTENT_TYPE.test(info.contentType)) invalid("The QR image must be a PNG, JPG or WEBP image.");
      qrPath = data.qrPath;
    }

    // The claim lives in the ID token for up to an hour after a revoke, so the active flag is the authority.
    const ref = db().collection(COLLECTIONS.photographers).doc(caller.uid);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("failed-precondition", "Your photographer profile is missing. Ask the organisers to invite you again.");
      if ((snap.data() as Partial<PhotographerDoc>).active !== true) {
        throw new HttpsError("permission-denied", "Your photographer access is off, so your GCash details cannot change.");
      }
      tx.update(ref, { gcashName, gcashNumber, qrPath });
    });
    logger.info("gcash profile saved", { uid: caller.uid, hasQr: qrPath !== null });
    return { gcashName, gcashNumber, qrPath };
  },
);
