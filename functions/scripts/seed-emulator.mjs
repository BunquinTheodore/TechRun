// Fills the local Emulator Suite with sample data so every page can be clicked through.
// Emulator only: refuses to run unless the emulator host variables are set.
//
// Run from functions/ while `firebase emulators:start --project techrun-2027` is up:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 node scripts/seed-emulator.mjs
//
// It goes through the real paths where it can: originals are uploaded so onPhotoUploaded derives the
// previews, and orders are created and paid through the createOrders / submitReceipt callables.
// Vision has no credentials on the emulator, so the scan lands in review; the script then tags most photos
// with the bib drawn on them (as a photographer would) and leaves a few in the review queue.
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

const PROJECT = "techrun-2027";
const REGION = "asia-southeast1";
const EVENT_ID = "techrun-2027";
// the emulator registers the upload trigger on the legacy default bucket (js/photos/firebase.js matches it)
const BUCKET = `${PROJECT}.appspot.com`;
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;

for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!process.env[key]) {
    console.error(`${key} is not set. This script only runs against the emulators.`);
    process.exit(2);
  }
}

initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();

const USERS = {
  admin: { email: "admin@techrun.test", name: "Race Admin", claims: { admin: true } },
  lens: { email: "lens@techrun.test", name: "Lena Cruz", claims: { photographer: true },
    gcash: { gcashName: "LENA C.", gcashNumber: "09171234567" } },
  shutter: { email: "shutter@techrun.test", name: "Paolo Reyes", claims: { photographer: true },
    gcash: { gcashName: "PAOLO R.", gcashNumber: "09281234567" } },
};

// bib, distance; the photos below draw some of these on the runners
const BIBS = [
  ["1001", "3K"], ["1002", "3K"], ["1003", "3K"], ["3001", "5K"], ["3002", "5K"], ["3003", "5K"],
  ["5001", "10K"], ["5002", "10K"], ["5003", "10K"],
];

// [photographer, bibs drawn on the photo, bibs to tag (null = leave in review)]
const PHOTOS = [
  ["lens", ["1001"], ["1001"]], ["lens", ["1001", "3001"], ["1001", "3001"]], ["lens", ["1001"], ["1001"]],
  ["lens", ["3001"], ["3001"]], ["lens", ["5001"], ["5001"]], ["lens", ["5002"], null],
  ["shutter", ["1001"], ["1001"]], ["shutter", ["3001", "3002"], ["3001", "3002"]], ["shutter", ["5001"], ["5001"]],
  ["shutter", ["1002"], ["1002"]], ["shutter", ["3003"], null], ["shutter", [], null],
];

const PALETTE = ["#33c7e0", "#c6f24e", "#f2b84e"];

function runnerSvg(bibs, k) {
  const w = 1600, h = 1067;
  const sky = PALETTE[k % 3];
  const runners = (bibs.length ? bibs : [""]).map((bib, i, all) => {
    const x = Math.round(w * (i + 1) / (all.length + 1));
    const tag = bib ? `<rect x="${x - 120}" y="470" width="240" height="170" rx="8" fill="#fff"/>
      <text x="${x}" y="510" font-family="Arial" font-size="26" text-anchor="middle" fill="#000">TECHRUN 2027</text>
      <text x="${x}" y="610" font-family="Arial Black,Arial" font-weight="900" font-size="96" text-anchor="middle" fill="#000">${bib}</text>` : "";
    return `<circle cx="${x}" cy="260" r="80" fill="#222"/>
      <rect x="${x - 160}" y="360" width="320" height="380" rx="60" fill="#111"/>
      <rect x="${x - 140}" y="740" width="90" height="300" fill="#111"/><rect x="${x + 50}" y="740" width="90" height="300" fill="#111"/>
      ${tag}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${sky}"/><rect y="880" width="100%" height="187" fill="#555"/>
    <text x="40" y="70" font-family="Arial" font-size="34" fill="#000">SAMPLE PHOTO ${k + 1}</text>${runners}</svg>`;
}

const jpeg = (svg) => sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer();

function qrSvg(label) {
  const cells = [];
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    const on = finder ? (x % 6 === 0 || y % 6 === 0 || (x % 14 > 1 && x % 14 < 5 && y % 14 > 1 && y % 14 < 5)) : (x * 7 + y * 13 + x * y) % 3 === 0;
    if (on) cells.push(`<rect x="${40 + x * 20}" y="${40 + y * 20}" width="20" height="20"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="560"><rect width="100%" height="100%" fill="#fff"/>
    <g fill="#000">${cells.join("")}</g>
    <text x="250" y="530" font-family="Arial" font-size="24" text-anchor="middle">SAMPLE QR ${label}</text></svg>`;
}

async function ensureUser({ email, name, claims }) {
  const user = await auth.getUserByEmail(email).catch(() => auth.createUser({ email, displayName: name, emailVerified: true }));
  await auth.setCustomUserClaims(user.uid, claims);
  return user.uid;
}

async function callable(name, data) {
  const res = await fetch(`${FUNCTIONS}/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${name}: ${JSON.stringify(body.error ?? body)}`);
  return body.result;
}

async function waitForPhoto(photoId, timeoutMs = 90_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const snap = await db.doc(`photos/${photoId}`).get();
    if (snap.exists) return snap.data();
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`photo ${photoId} was not processed within ${timeoutMs / 1000}s (is the functions emulator up?)`);
}

async function main() {
  const uids = {};
  for (const [key, u] of Object.entries(USERS)) uids[key] = await ensureUser(u);
  console.log("users:", Object.values(USERS).map((u) => u.email).join(", "));

  await db.doc(`events/${EVENT_ID}`).set({ name: "TechRun 2027", date: null });
  const batch = db.batch();
  for (const [bib, distance] of BIBS) batch.set(db.doc(`bibs/${EVENT_ID}__${bib}`), { bib, eventId: EVENT_ID, distance, importedAt: Timestamp.now() });
  await batch.commit();
  console.log(`bibs: ${BIBS.length}`);

  for (const key of ["lens", "shutter"]) {
    const u = USERS[key], uid = uids[key];
    const qrPath = `qr/${uid}.png`;
    await bucket.file(qrPath).save(await sharp(Buffer.from(qrSvg(u.gcash.gcashName))).png().toBuffer(), { contentType: "image/png" });
    await db.doc(`photographers/${uid}`).set({
      name: u.name, credit: `Photo by ${u.name}`, active: true, ...u.gcash, qrPath,
    });
    await db.doc(`photographers/${uid}/private/profile`).set({ email: u.email, invitedBy: uids.admin, invitedAt: Timestamp.now() });
  }
  console.log("photographers: GCash profiles and QR codes saved");

  const photoIds = [];
  for (const [k, [who, drawn, tag]] of PHOTOS.entries()) {
    const photoId = randomUUID();
    const path = `originals/${EVENT_ID}/${uids[who]}/${photoId}.jpg`;
    await bucket.file(path).save(await jpeg(runnerSvg(drawn, k)), {
      contentType: "image/jpeg", metadata: { metadata: { originalName: `IMG_${String(4100 + k)}.jpg` } },
    });
    photoIds.push({ photoId, tag });
  }
  console.log(`photos: ${PHOTOS.length} uploaded, waiting for onPhotoUploaded...`);

  for (const { photoId, tag } of photoIds) {
    await waitForPhoto(photoId);
    if (tag) await db.doc(`photos/${photoId}`).update({ bibs: tag, suggestedBibs: [], status: "tagged", source: "manual", confidence: 1, reviewedAt: Timestamp.now() });
  }
  const tagged = photoIds.filter((p) => p.tag);
  console.log(`photos: ${tagged.length} tagged, ${photoIds.length - tagged.length} left in the review queue`);

  // buyer 1: one order per photographer for bib 1001; the Lena order gets a receipt (waits for her approval)
  const bib1001 = tagged.filter((p) => p.tag.includes("1001")).map((p) => p.photoId);
  const orders = await callable("createOrders", { buyerName: "Juan Dela Cruz", buyerEmail: "juan@example.com", photoIds: bib1001 });
  const lensOrder = orders.find((o) => o.photographerName === USERS.lens.name);
  const receiptPath = `receipts/${lensOrder.orderId}/receipt.jpg`;
  await bucket.file(receiptPath).save(await jpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900">
    <rect width="100%" height="100%" fill="#0a5bd3"/><text x="300" y="200" font-family="Arial" font-size="48" fill="#fff" text-anchor="middle">GCash</text>
    <text x="300" y="420" font-family="Arial" font-size="40" fill="#fff" text-anchor="middle">PHP ${lensOrder.amount}.00</text>
    <text x="300" y="520" font-family="Arial" font-size="28" fill="#fff" text-anchor="middle">Ref No. 1234 567 890123</text>
    <text x="300" y="600" font-family="Arial" font-size="28" fill="#fff" text-anchor="middle">${lensOrder.code}</text>
    <text x="300" y="820" font-family="Arial" font-size="22" fill="#fff" text-anchor="middle">SAMPLE RECEIPT</text></svg>`), { contentType: "image/jpeg" });
  await callable("submitReceipt", { orderId: lensOrder.orderId, token: lensOrder.token, gcashRef: "1234567890123", receiptPath });

  console.log("\nSample orders (open these on the hosting emulator):");
  for (const o of orders) {
    const state = o === lensOrder ? "receipt submitted, waiting for Lena to approve" : "awaiting payment";
    console.log(`  ${o.code}  ${o.photographerName}  PHP ${o.amount}  ${state}\n    http://127.0.0.1:5000/${o.url}`);
  }
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
