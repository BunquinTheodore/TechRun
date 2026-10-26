// Buyer callables (no sign in): createOrders, getOrder, submitReceipt, getDownloads.
// Buyers prove access with the order id plus the plain token from the createOrders response or email link.
import { FieldValue, Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  CREATE_ORDERS_LIMIT_GLOBAL_HOUR,
  CREATE_ORDERS_LIMIT_PER_EMAIL_HOUR,
  CREATE_ORDERS_LIMIT_PER_IP_HOUR,
  CURRENCY,
  DOWNLOAD_URL_TTL_MS,
  ENFORCE_APP_CHECK,
  MAX_OPEN_ORDERS_PER_EMAIL,
  MAX_PHOTOS_PER_CALL,
  MAX_RECEIPT_BYTES,
  ORDER_UNPAID_TTL_MS,
  PRICE_PER_PHOTO,
  REGION,
  siteOrigin,
} from "../config";
import { bucket, db } from "../firebase";
import { attachmentDisposition, downloadFileName } from "../lib/fileName";
import { clientIp, consumeRateLimit, HOUR_MS } from "../lib/rateLimit";
import { hashToken, newAccessToken } from "../lib/tokens";
import { invalid, requireEmail, requireIdArray, requireText } from "../lib/validate";
import {
  COLLECTIONS,
  PHOTO_PRIVATE_DOC,
  PHOTO_PRIVATE_SUBCOLLECTION,
  PHOTOGRAPHER_PRIVATE_SUBCOLLECTION,
  PHOTOGRAPHER_PROFILE_DOC,
  type CreatedOrder,
  type CreateOrdersRequest,
  type CreateOrdersResponse,
  type DownloadFile,
  type GcashRefDoc,
  type GetDownloadsRequest,
  type GetDownloadsResponse,
  type GetOrderRequest,
  type GetOrderResponse,
  type OrderDoc,
  type PhotoDoc,
  type PhotographerDoc,
  type PhotographerPrivateProfile,
  type PhotoPrivate,
  type SubmitReceiptRequest,
  type SubmitReceiptResponse,
} from "../types";
import { IMAGE_CONTENT_TYPE, iso, objectInfo, parseOrderAccess, requireOrderForToken } from "./access";
import { ordersCreatedMail, queueMail, receiptSubmittedMail } from "./emails";
import {
  groupByPhotographer,
  isPayablePhotographer,
  isReceiptPathFor,
  isSafeBuyerName,
  newOrderCode,
  normalizeGcashRef,
  orderPageUrl,
  publicStorageUrl,
  type CartPhoto,
} from "./logic";

const BUYER_CALL = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK } as const;
const MAX_BUYER_NAME = 80;
const CODE_ATTEMPTS = 6;
/** Firestore allows at most 30 values in an `in` filter. */
const IN_QUERY_LIMIT = 30;

function absolute(path: string): string {
  return `${siteOrigin()}/${path}`;
}

/* ---------- createOrders ---------- */

async function throttle(email: string, ip: string): Promise<void> {
  const firestore = db();
  const [byEmail, byIp] = await Promise.all([
    consumeRateLimit(firestore, { scope: "orders:email", subject: email, limit: CREATE_ORDERS_LIMIT_PER_EMAIL_HOUR, windowMs: HOUR_MS }),
    consumeRateLimit(firestore, { scope: "orders:ip", subject: ip, limit: CREATE_ORDERS_LIMIT_PER_IP_HOUR, windowMs: HOUR_MS }),
  ]);
  if (!byEmail || !byIp) throw new HttpsError("resource-exhausted", "Too many orders in a short time. Try again in an hour.");
  // Checked last so calls refused above do not use up the shared allowance.
  const overall = await consumeRateLimit(firestore, {
    scope: "orders:global",
    subject: "all",
    limit: CREATE_ORDERS_LIMIT_GLOBAL_HOUR,
    windowMs: HOUR_MS,
  });
  if (!overall) {
    logger.warn("createOrders global hourly cap reached");
    throw new HttpsError("resource-exhausted", "We are getting a lot of orders right now. Try again in an hour.");
  }
}

/** `count` order codes no other order uses, checked with one `in` query per 30 codes instead of one per code. */
async function uniqueCodes(count: number): Promise<string[]> {
  const orders = db().collection(COLLECTIONS.orders);
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const codes = new Set<string>();
    while (codes.size < count) codes.add(newOrderCode());
    const list = [...codes];
    const chunks = Array.from({ length: Math.ceil(list.length / IN_QUERY_LIMIT) }, (_, i) =>
      list.slice(i * IN_QUERY_LIMIT, (i + 1) * IN_QUERY_LIMIT));
    const clashes = await Promise.all(chunks.map((c) => orders.where("code", "in", c).limit(1).get()));
    if (clashes.every((snap) => snap.empty)) return list;
  }
  throw new HttpsError("unavailable", "Could not create an order code. Try again.");
}

/** Loads the cart photos; every one must exist and be tagged. */
async function loadCart(photoIds: string[]): Promise<CartPhoto[]> {
  const firestore = db();
  const snaps = await firestore.getAll(...photoIds.map((id) => firestore.collection(COLLECTIONS.photos).doc(id)));
  const cart: CartPhoto[] = [];
  const unavailable: string[] = [];
  snaps.forEach((snap, i) => {
    const p = snap.data() as PhotoDoc | undefined;
    if (!p || p.status !== "tagged" || !p.photographerUid) unavailable.push(photoIds[i]);
    else cart.push({ photoId: photoIds[i], photographerUid: p.photographerUid, thumbPath: p.thumbPath });
  });
  if (unavailable.length > 0) {
    throw new HttpsError("invalid-argument", "Some photos are no longer available. Remove them and try again.", {
      unavailablePhotoIds: unavailable,
    });
  }
  return cart;
}

export const createOrders = onCall<CreateOrdersRequest, Promise<CreateOrdersResponse>>(BUYER_CALL, async (request) => {
  const data = (request.data ?? {}) as Partial<CreateOrdersRequest>;
  const buyerName = requireText(data.buyerName, "buyerName", MAX_BUYER_NAME);
  if (!isSafeBuyerName(buyerName)) invalid("Enter your name using letters only (no numbers or links).");
  const buyerEmail = requireEmail(data.buyerEmail, "buyerEmail");
  const photoIds = requireIdArray(data.photoIds, "photoIds", 1, MAX_PHOTOS_PER_CALL);

  const firestore = db();
  const groups = groupByPhotographer(await loadCart(photoIds));

  const photographerSnaps = await firestore.getAll(
    ...groups.map((g) => firestore.collection(COLLECTIONS.photographers).doc(g.photographerUid)),
  );
  const photographers = photographerSnaps.map((s) => s.data() as Partial<PhotographerDoc> | undefined);
  // Revoked photographers (active false) are never payable, even if a photo slipped past the withdraw step.
  const notPayable = groups.filter((_, i) => !isPayablePhotographer(photographers[i]));
  if (notPayable.length > 0) {
    throw new HttpsError("failed-precondition", "Some photographers cannot take GCash orders yet. Remove their photos and try again.", {
      unavailablePhotoIds: notPayable.flatMap((g) => g.photoIds),
    });
  }

  // Throttled only once the cart is valid, so a stale cart does not use up the buyer's (or everyone's) allowance.
  await throttle(buyerEmail, clientIp(request.rawRequest?.headers?.["x-forwarded-for"], request.rawRequest?.ip));
  const codes = await uniqueCodes(groups.length);

  const now = Date.now();
  const openOrders = firestore
    .collection(COLLECTIONS.orders)
    .where("buyerEmail", "==", buyerEmail)
    .where("status", "==", "awaiting_payment")
    .limit(MAX_OPEN_ORDERS_PER_EMAIL + 1);
  // The open order cap is read and enforced in the same transaction as the writes, so parallel calls cannot overshoot it.
  const created = await firestore.runTransaction(async (tx) => {
    const open = (await tx.get(openOrders)).size;
    if (open + groups.length > MAX_OPEN_ORDERS_PER_EMAIL) {
      throw new HttpsError(
        "resource-exhausted",
        `You have ${open} unpaid orders. Pay or wait for them to expire before starting more (limit ${MAX_OPEN_ORDERS_PER_EMAIL}).`,
      );
    }
    return writeOrders(tx, { buyerName, buyerEmail, groups, photographers, codes, now });
  });
  logger.info("orders created", { orders: created.map((o) => o.orderId), photos: photoIds.length });
  return created;
});

interface OrderBatch {
  buyerName: string;
  buyerEmail: string;
  groups: ReturnType<typeof groupByPhotographer>;
  photographers: (Partial<PhotographerDoc> | undefined)[];
  codes: string[];
  now: number;
}

/** Creates one order per photographer group plus the buyer email, inside the caller's transaction. */
function writeOrders(tx: Transaction, { buyerName, buyerEmail, groups, photographers, codes, now }: OrderBatch): CreatedOrder[] {
  const firestore = db();
  const created: CreatedOrder[] = [];
  for (const [i, g] of groups.entries()) {
    const ref = firestore.collection(COLLECTIONS.orders).doc();
    const token = newAccessToken();
    const code = codes[i];
    const photographerName = photographers[i]?.name ?? "";
    const doc: Omit<OrderDoc, "createdAt"> & { createdAt: FieldValue } = {
      code,
      buyerName,
      buyerEmail,
      photographerUid: g.photographerUid,
      photographerName,
      photoIds: g.photoIds,
      thumbPaths: g.thumbPaths,
      count: g.count,
      amount: g.amount,
      pricePerPhoto: PRICE_PER_PHOTO,
      currency: CURRENCY,
      status: "awaiting_payment",
      accessTokenHashes: [hashToken(token)],
      receiptPath: null,
      gcashRef: null,
      duplicateRef: false,
      duplicateOrderIds: [],
      rejectReason: null,
      createdAt: FieldValue.serverTimestamp(),
      submittedAt: null,
      reviewedAt: null,
      approvedAt: null,
      expireAt: Timestamp.fromMillis(now + ORDER_UNPAID_TTL_MS),
    };
    tx.create(ref, doc);
    created.push({ orderId: ref.id, code, token, url: orderPageUrl(ref.id, token), photographerName, amount: g.amount, count: g.count });
  }
  queueMail(
    firestore,
    tx,
    ordersCreatedMail(
      buyerEmail,
      buyerName,
      created.map((o) => ({ code: o.code, photographerName: o.photographerName, amount: o.amount, count: o.count, link: absolute(o.url) })),
    ),
  );
  return created;
}

/* ---------- getOrder ---------- */

export const getOrder = onCall<GetOrderRequest, Promise<GetOrderResponse>>(BUYER_CALL, async (request) => {
  const access = parseOrderAccess(request.data);
  const order = requireOrderForToken((await access.ref.get()).data() as OrderDoc | undefined, access.token);
  const p = (await db().collection(COLLECTIONS.photographers).doc(order.photographerUid).get()).data() as
    | Partial<PhotographerDoc>
    | undefined;
  const bucketName = bucket().name;
  // A revoked photographer's GCash details are never shown again, so nobody is sent to pay them.
  const active = p?.active === true;
  return {
    orderId: access.orderId,
    code: order.code,
    status: order.status,
    amount: order.amount,
    pricePerPhoto: order.pricePerPhoto,
    currency: order.currency,
    count: order.count,
    buyerName: order.buyerName,
    photos: order.photoIds.map((photoId, i) => ({
      photoId,
      thumbPath: order.thumbPaths[i] ?? "",
      thumbUrl: order.thumbPaths[i] ? publicStorageUrl(bucketName, order.thumbPaths[i]) : "",
    })),
    photographer: {
      name: p?.name ?? order.photographerName,
      gcashName: active ? (p?.gcashName ?? null) : null,
      gcashNumber: active ? (p?.gcashNumber ?? null) : null,
      qrPath: active ? (p?.qrPath ?? null) : null,
      qrUrl: active && p?.qrPath ? publicStorageUrl(bucketName, p.qrPath) : null,
      active,
    },
    gcashRef: order.gcashRef,
    rejectReason: order.status === "rejected" ? order.rejectReason : null,
    createdAt: iso(order.createdAt) ?? new Date(0).toISOString(),
    submittedAt: iso(order.submittedAt),
    approvedAt: iso(order.approvedAt),
  };
});

/* ---------- submitReceipt ---------- */

async function requireUploadedReceipt(path: string): Promise<void> {
  const info = await objectInfo(path);
  if (!info) invalid("Upload the receipt screenshot first.");
  if (info.size <= 0 || info.size > MAX_RECEIPT_BYTES) invalid("The receipt image must be 10 MB or smaller.");
  if (!IMAGE_CONTENT_TYPE.test(info.contentType)) invalid("The receipt must be a JPG, PNG or WEBP image.");
}

export const submitReceipt = onCall<SubmitReceiptRequest, Promise<SubmitReceiptResponse>>(BUYER_CALL, async (request) => {
  const access = parseOrderAccess(request.data);
  const data = (request.data ?? {}) as Partial<SubmitReceiptRequest>;
  const gcashRef = normalizeGcashRef(data.gcashRef);
  if (!gcashRef) invalid("Enter the 13 digit GCash reference number.");
  if (!isReceiptPathFor(access.orderId, data.receiptPath)) invalid("receiptPath must be receipts/{orderId}/{file}.");
  const receiptPath = data.receiptPath;

  // Token first, so an invalid link learns nothing about uploaded files.
  requireOrderForToken((await access.ref.get()).data() as OrderDoc | undefined, access.token);
  await requireUploadedReceipt(receiptPath);

  const firestore = db();
  const refDoc = firestore.collection(COLLECTIONS.gcashRefs).doc(gcashRef);
  const result = await firestore.runTransaction(async (tx) => {
    const [orderSnap, refSnap] = await Promise.all([tx.get(access.ref), tx.get(refDoc)]);
    const order = requireOrderForToken(orderSnap.data() as OrderDoc | undefined, access.token);
    if (order.status !== "awaiting_payment" && order.status !== "rejected") {
      throw new HttpsError("failed-precondition", "A receipt was already sent for this order.");
    }
    // A resubmission with a corrected reference frees the old one, so a mistyped number that belongs to someone
    // else's real payment is not flagged as a duplicate later.
    const oldRefDoc =
      order.gcashRef && order.gcashRef !== gcashRef ? firestore.collection(COLLECTIONS.gcashRefs).doc(order.gcashRef) : null;
    const oldRefSnap = oldRefDoc ? await tx.get(oldRefDoc) : null;
    // Allowed even after the photographer was revoked: a buyer who paid before that still needs a review, and
    // reviewOrder lets the order's own photographer finish it (getOrder already hides their GCash details).
    const profileSnap = await tx.get(
      firestore
        .collection(COLLECTIONS.photographers)
        .doc(order.photographerUid)
        .collection(PHOTOGRAPHER_PRIVATE_SUBCOLLECTION)
        .doc(PHOTOGRAPHER_PROFILE_DOC),
    );
    const used = refSnap.exists ? ((refSnap.data() as GcashRefDoc).orderIds ?? []) : [];
    const others = used.filter((id) => id !== access.orderId);
    const duplicateRef = others.length > 0;
    if (oldRefDoc && oldRefSnap?.exists) {
      const remaining = ((oldRefSnap.data() as GcashRefDoc).orderIds ?? []).filter((id) => id !== access.orderId);
      if (remaining.length === 0) tx.delete(oldRefDoc);
      else tx.update(oldRefDoc, { orderIds: remaining });
    }
    if (refSnap.exists) {
      tx.update(refDoc, { orderIds: FieldValue.arrayUnion(access.orderId) });
    } else {
      tx.create(refDoc, { ref: gcashRef, orderIds: [access.orderId], firstUsedAt: FieldValue.serverTimestamp() });
    }
    tx.update(access.ref, {
      status: "submitted",
      gcashRef,
      receiptPath,
      duplicateRef,
      duplicateOrderIds: others.slice(0, 20),
      rejectReason: null,
      submittedAt: FieldValue.serverTimestamp(),
      expireAt: null,
    });
    const email = (profileSnap.data() as Partial<PhotographerPrivateProfile> | undefined)?.email;
    if (email) {
      queueMail(
        firestore,
        tx,
        receiptSubmittedMail(email, {
          code: order.code,
          buyerName: order.buyerName,
          amount: order.amount,
          gcashRef,
          duplicateRef,
          dashboardLink: absolute("photos/upload.html#orders"),
        }),
      );
    }
    return { duplicateRef, emailed: Boolean(email) };
  });
  if (!result.emailed) logger.warn("submitReceipt: photographer has no email on file", { orderId: access.orderId });
  logger.info("receipt submitted", { orderId: access.orderId, duplicateRef: result.duplicateRef });
  return { status: "submitted" };
});

/* ---------- getDownloads ---------- */

async function signedFile(
  photoId: string,
  privateSnap: DocumentSnapshot,
  expires: number,
  used: Set<string>,
): Promise<DownloadFile | null> {
  const priv = privateSnap.data() as Partial<PhotoPrivate> | undefined;
  if (!priv?.originalPath) {
    logger.error("approved photo has no original path", { photoId });
    return null;
  }
  const ext = priv.originalPath.split(".").pop()?.toLowerCase() ?? "jpg";
  const fileName = downloadFileName(priv.originalName, photoId, ext === "jpeg" ? "jpg" : ext, used);
  try {
    const [url] = await bucket()
      .file(priv.originalPath)
      .getSignedUrl({ version: "v4", action: "read", expires, responseDisposition: attachmentDisposition(fileName) });
    return { photoId, url, fileName };
  } catch (err) {
    // Usually a setup gap: signing needs the functions service account to hold Service Account Token Creator
    // (iam.serviceAccounts.signBlob) on itself. See functions/README.md, "Download links".
    logger.error("getDownloads: could not sign a download URL", { photoId, error: err instanceof Error ? err.message : String(err) });
    throw new HttpsError("internal", "Downloads are not available right now. Email techrun.contactus@gmail.com with your order code.");
  }
}

export const getDownloads = onCall<GetDownloadsRequest, Promise<GetDownloadsResponse>>(BUYER_CALL, async (request) => {
  const access = parseOrderAccess(request.data);
  const order = requireOrderForToken((await access.ref.get()).data() as OrderDoc | undefined, access.token);
  if (order.status !== "approved") {
    throw new HttpsError("failed-precondition", "Downloads open once the photographer confirms your payment.");
  }
  const firestore = db();
  const expires = Date.now() + DOWNLOAD_URL_TTL_MS;
  const privateSnaps = await firestore.getAll(
    ...order.photoIds.map((id) =>
      firestore.collection(COLLECTIONS.photos).doc(id).collection(PHOTO_PRIVATE_SUBCOLLECTION).doc(PHOTO_PRIVATE_DOC),
    ),
  );
  const used = new Set<string>();
  const files: DownloadFile[] = [];
  // Sequential so duplicate file names are numbered in cart order.
  for (const [i, id] of order.photoIds.entries()) {
    const f = await signedFile(id, privateSnaps[i], expires, used);
    if (f) files.push(f);
  }
  return { files, expiresAt: new Date(expires).toISOString() };
});
