// Photographer dashboard tabs on photos/upload.html: "Orders" (live list of this photographer's orders with
// receipt, GCash reference, duplicate warning and Approve / Reject through the reviewOrder callable) and
// "GCash profile" (name, number and QR image, saved through saveGcashProfile). Only the photographer who took
// the photos reviews an order; there is no admin path. Every value from Firestore is escaped before it is
// placed in HTML.
import { SDK, db, storage, functions } from "./firebase.js";

const {
  collection, doc, query, where, orderBy, limit, onSnapshot,
} = await import(`${SDK}/firebase-firestore.js`);
const { ref, getDownloadURL, uploadBytes, deleteObject } = await import(`${SDK}/firebase-storage.js`);
const { httpsCallable } = await import(`${SDK}/firebase-functions.js`);

/** Must match functions/src/config.ts. */
const CURRENCY = "PHP";
const MAX_REJECT_REASON_CHARS = 300;
const MAX_QR_BYTES = 5 * 1024 * 1024;
const MIN_GCASH_NAME = 2;
const MAX_GCASH_NAME = 80;
const ORDERS_LIMIT = 100;
const THUMBS_SHOWN = 8;
/** QR content types the storage rules accept, with the extension saveGcashProfile expects. */
const QR_EXT_BY_TYPE = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const STATUS_LABEL = {
  awaiting_payment: "Waiting for payment",
  submitted: "Receipt sent, check payment",
  approved: "Approved",
  rejected: "Rejected",
};

const call = {
  reviewOrder: httpsCallable(functions, "reviewOrder"),
  saveGcashProfile: httpsCallable(functions, "saveGcashProfile"),
};

const $ = (id) => document.getElementById(id);

// ---------- helpers ----------

/** Escape text for use inside HTML element content or a quoted attribute. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;",
  })[c]);
}

function show(node, on) { node.classList.toggle("ph-hidden", !on); }

function say(node, text, kind = "") {
  node.className = `ph-note${kind ? ` ${kind}` : ""}`;
  node.textContent = text;
  show(node, Boolean(text));
}

function friendlyError(err) {
  const code = err && err.code ? String(err.code) : "";
  if (code === "functions/unauthenticated") return "Your session expired. Sign in again.";
  if (code === "functions/unavailable" || code === "unavailable") return "Could not reach the server. Check the connection and try again.";
  if (code === "storage/unauthorized") return "Upload refused. Use a PNG, JPG or WEBP image of 5 MB or less.";
  if (code === "permission-denied") return "Permission denied. Sign out and back in, then try again.";
  if (code === "failed-precondition") return "This list needs a database index that is still building. Try again in a few minutes.";
  return (err && err.message) || "Something went wrong.";
}

function fmtTime(ts) {
  const date = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  return date ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "";
}

function fmtAmount(amount) {
  const n = Number(amount);
  return `${CURRENCY} ${Number.isFinite(n) ? n.toLocaleString("en-PH") : "?"}`;
}

/** Same rule as functions/src/orders/logic.ts normalizePhMobile: returns 09XXXXXXXXX or null. */
export function normalizePhMobile(value) {
  const compact = String(value ?? "").trim().replace(/[\s\-.()]/g, "");
  if (/^09\d{9}$/.test(compact)) return compact;
  const intl = /^\+?639(\d{9})$/.exec(compact);
  return intl ? `09${intl[1]}` : null;
}

const urlCache = new Map();
/** Download URL for a storage path, cached per path. Resolves to "" when it cannot be read. */
function storageUrl(path) {
  if (!path) return Promise.resolve("");
  if (!urlCache.has(path)) {
    urlCache.set(path, getDownloadURL(ref(storage, path)).catch(() => { urlCache.delete(path); return ""; }));
  }
  return urlCache.get(path);
}

// ---------- orders ----------

function orderSignature(o) {
  return JSON.stringify([
    o.status, o.gcashRef, o.receiptPath, o.duplicateRef, o.duplicateOrderIds, o.rejectReason, o.amount, o.count,
    o.submittedAt && o.submittedAt.seconds, o.approvedAt && o.approvedAt.seconds,
  ]);
}

function orderCardHtml(id, o) {
  const status = String(o.status || "");
  const thumbPaths = Array.isArray(o.thumbPaths) ? o.thumbPaths : [];
  const extra = thumbPaths.length - THUMBS_SHOWN;
  const thumbs = thumbPaths.slice(0, THUMBS_SHOWN)
    .map((_, i) => `<li><img data-thumb="${i}" alt="Photo ${i + 1} of order ${esc(o.code)}" loading="lazy" /></li>`).join("")
    + (extra > 0 ? `<li class="ord-more">+${esc(extra)}</li>` : "");
  const dupIds = Array.isArray(o.duplicateOrderIds) ? o.duplicateOrderIds.map(String) : [];
  const dup = o.duplicateRef === true
    ? `<div class="ph-note warn ord-dup" role="alert"><strong>DUPLICATE REFERENCE</strong>
        This GCash reference number was already used on ${dupIds.length ? `another order (${esc(dupIds.join(", "))})` : "another order"}.
        The same receipt may have been sent twice. Check your GCash app very carefully before approving.</div>`
    : "";
  const receipt = o.receiptPath
    ? `<figure class="ord-receipt"><a data-receipt-link target="_blank" rel="noopener"><img data-receipt alt="GCash receipt for order ${esc(o.code)}" /></a>
        <figcaption>Receipt sent by the buyer. Opens full size in a new tab.</figcaption></figure>`
    : "";
  const reason = status === "rejected" && o.rejectReason
    ? `<p class="ord-reason"><span class="ph-label">Reason sent to the buyer</span>${esc(o.rejectReason)}</p>` : "";
  const actions = status === "submitted"
    ? `<div class="ph-note ord-check"><strong>Check before approving.</strong> Open your GCash app and confirm that
        ${esc(fmtAmount(o.amount))} arrived with reference ${esc(o.gcashRef || "shown above")}. A receipt picture alone is not proof of payment.</div>
      <div class="ph-row ord-actions">
        <button type="button" class="ph-btn primary" data-approve>Approve</button>
        <button type="button" class="ph-btn" data-reject-open>Reject</button>
      </div>
      <form class="ord-reject ph-hidden" novalidate>
        <label class="ph-label" for="reason-${esc(id)}">Reason for the buyer (required)</label>
        <textarea id="reason-${esc(id)}" class="ph-input" maxlength="${MAX_REJECT_REASON_CHARS}" required
          placeholder="For example: no payment with this reference arrived in GCash"></textarea>
        <div class="ph-row">
          <button type="submit" class="ph-btn primary">Send rejection</button>
          <button type="button" class="ph-btn" data-reject-cancel>Cancel</button>
        </div>
      </form>`
    : "";
  return `
    <div class="ord-head">
      <span class="ord-code">${esc(o.code || id)}</span>
      <span class="ord-status" data-status="${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>
    </div>
    <dl class="ord-dl">
      <div><dt>Buyer</dt><dd>${esc(o.buyerName)}</dd></div>
      <div><dt>Amount</dt><dd>${esc(fmtAmount(o.amount))} for ${esc(o.count)} photo${Number(o.count) === 1 ? "" : "s"}</dd></div>
      <div><dt>GCash ref</dt><dd class="ord-ref">${esc(o.gcashRef || "Not sent yet")}</dd></div>
      <div><dt>Ordered</dt><dd>${esc(fmtTime(o.createdAt))}</dd></div>
      ${o.submittedAt ? `<div><dt>Receipt sent</dt><dd>${esc(fmtTime(o.submittedAt))}</dd></div>` : ""}
      ${o.approvedAt ? `<div><dt>Approved</dt><dd>${esc(fmtTime(o.approvedAt))}</dd></div>` : ""}
    </dl>
    ${dup}
    ${receipt}
    ${thumbs ? `<ul class="ord-thumbs" aria-label="Photos in this order">${thumbs}</ul>` : ""}
    ${reason}
    ${actions}
    <p class="ord-msg ph-hidden" role="status" aria-live="polite"></p>`;
}

function loadCardImages(li, o) {
  const thumbPaths = Array.isArray(o.thumbPaths) ? o.thumbPaths : [];
  li.querySelectorAll("[data-thumb]").forEach((img) => {
    storageUrl(thumbPaths[Number(img.dataset.thumb)]).then((url) => { if (url) img.src = url; });
  });
  const receipt = li.querySelector("[data-receipt]");
  if (receipt) {
    storageUrl(o.receiptPath).then((url) => {
      if (url) { receipt.src = url; li.querySelector("[data-receipt-link]").href = url; }
      else receipt.alt = "The receipt image could not be loaded.";
    });
  }
}

function wireCard(li, id, o) {
  const msg = li.querySelector(".ord-msg");
  const status = (text) => { msg.textContent = text; show(msg, Boolean(text)); };
  const approve = li.querySelector("[data-approve]");
  if (!approve) return;
  const openReject = li.querySelector("[data-reject-open]");
  const form = li.querySelector(".ord-reject");
  const reason = form.querySelector("textarea");
  const buttons = [...li.querySelectorAll("button")];
  const setBusy = (on) => buttons.forEach((b) => { b.disabled = on; });

  async function review(action, extra) {
    setBusy(true);
    status(action === "approve" ? "Approving" : "Sending rejection");
    try {
      const { data } = await call.reviewOrder({ orderId: id, action, ...extra });
      status("");
      // The live list re-renders or drops this card, so confirm in the panel message instead.
      say($("orders-msg"), data.status === "approved"
        ? `Order ${o.code || id} approved. The buyer was emailed a download link.`
        : `Order ${o.code || id} rejected. The buyer was emailed the reason.`, "ok");
    } catch (err) {
      status(friendlyError(err));
      setBusy(false);
    }
  }

  approve.addEventListener("click", () => {
    const refText = o.gcashRef ? ` with reference ${o.gcashRef}` : "";
    const dupText = o.duplicateRef === true ? "\n\nWARNING: this reference number was already used on another order." : "";
    const ok = window.confirm(`Approve order ${o.code || id}?\n\nOnly approve if ${fmtAmount(o.amount)}${refText} shows in your GCash app.${dupText}`);
    if (ok) review("approve", {});
  });
  openReject.addEventListener("click", () => { show(form, true); reason.focus(); });
  form.querySelector("[data-reject-cancel]").addEventListener("click", () => { show(form, false); status(""); });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = reason.value.trim();
    reason.setAttribute("aria-invalid", String(!text));
    if (!text) { status("Write a reason so the buyer knows what to fix."); reason.focus(); return; }
    review("reject", { reason: text.slice(0, MAX_REJECT_REASON_CHARS) });
  });
}

function startOrders(uid) {
  const el = {
    list: $("orders-list"), empty: $("orders-empty"), filter: $("orders-filter"), msg: $("orders-msg"),
    more: $("orders-more"), badge: $("orders-badge"),
  };
  /** @type {Map<string, {li: HTMLElement, sig: string}>} */
  const cards = new Map();
  let unsubList = null;
  let loadFailed = false;

  function render(snap) {
    if (loadFailed) { say(el.msg, ""); loadFailed = false; }
    const seen = new Set();
    const ordered = [];
    for (const d of snap.docs) {
      const o = d.data();
      const sig = orderSignature(o);
      seen.add(d.id);
      let entry = cards.get(d.id);
      if (!entry || entry.sig !== sig) {
        const li = document.createElement("li");
        li.className = "ord-card";
        li.dataset.status = String(o.status || "");
        li.innerHTML = orderCardHtml(d.id, o);
        wireCard(li, d.id, o);
        loadCardImages(li, o);
        if (entry) entry.li.replaceWith(li);
        entry = { li, sig };
        cards.set(d.id, entry);
      }
      ordered.push(entry.li);
    }
    for (const [id, entry] of cards) {
      if (!seen.has(id)) { entry.li.remove(); cards.delete(id); }
    }
    // Only touch the DOM order when it changed, so a reason being typed keeps its focus.
    const children = [...el.list.children];
    if (children.length !== ordered.length || children.some((node, i) => node !== ordered[i])) el.list.replaceChildren(...ordered);
    show(el.empty, ordered.length === 0);
    show(el.more, snap.docs.length >= ORDERS_LIMIT);
  }

  function listen() {
    if (unsubList) unsubList();
    cards.clear();
    el.list.replaceChildren();
    show(el.empty, false);
    const parts = [collection(db, "orders"), where("photographerUid", "==", uid)];
    if (el.filter.value) parts.push(where("status", "==", el.filter.value));
    parts.push(orderBy("createdAt", "desc"), limit(ORDERS_LIMIT));
    unsubList = onSnapshot(query(...parts), render, (err) => {
      loadFailed = true;
      say(el.msg, `Could not load orders: ${friendlyError(err)}`, "warn");
    });
  }

  const onFilter = () => listen();
  el.filter.addEventListener("change", onFilter);
  listen();

  // Count of orders waiting for this photographer's decision, shown on the Orders tab.
  const unsubBadge = onSnapshot(
    query(collection(db, "orders"), where("photographerUid", "==", uid), where("status", "==", "submitted")),
    (snap) => { el.badge.textContent = snap.size ? String(snap.size) : ""; show(el.badge, snap.size > 0); },
    () => show(el.badge, false),
  );

  return () => {
    el.filter.removeEventListener("change", onFilter);
    if (unsubList) unsubList();
    unsubBadge();
    cards.clear();
    el.list.replaceChildren();
    show(el.badge, false);
  };
}

// ---------- GCash profile ----------

function startGcash(uid) {
  const el = {
    form: $("gcash-form"), name: $("gcash-name"), number: $("gcash-number"), qr: $("gcash-qr"),
    removeWrap: $("gcash-remove-wrap"), remove: $("gcash-remove"), btn: $("gcash-btn"), msg: $("gcash-msg"),
    missing: $("gcash-missing"), curName: $("gcash-cur-name"), curNumber: $("gcash-cur-number"),
    curQr: $("gcash-cur-qr"), curNoQr: $("gcash-cur-noqr"),
  };
  let current = { gcashName: "", gcashNumber: "", qrPath: null };
  let dirty = false;
  let saving = false;

  function fillForm() {
    el.name.value = current.gcashName;
    el.number.value = current.gcashNumber;
    el.qr.value = "";
    el.remove.checked = false;
    show(el.removeWrap, Boolean(current.qrPath));
    dirty = false;
  }

  function renderCurrent() {
    el.curName.textContent = current.gcashName || "Not set";
    el.curNumber.textContent = current.gcashNumber || "Not set";
    show(el.missing, !current.gcashName || !current.gcashNumber);
    show(el.curNoQr, !current.qrPath);
    show(el.curQr, false);
    el.curQr.removeAttribute("src");
    if (current.qrPath) {
      const path = current.qrPath;
      getDownloadURL(ref(storage, path)).then((url) => {
        if (current.qrPath !== path) return;
        el.curQr.src = url;
        show(el.curQr, true);
      }).catch(() => show(el.curNoQr, true));
    }
  }

  const unsub = onSnapshot(doc(db, "photographers", uid), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    current = {
      gcashName: typeof data.gcashName === "string" ? data.gcashName : "",
      gcashNumber: typeof data.gcashNumber === "string" ? data.gcashNumber : "",
      qrPath: typeof data.qrPath === "string" && data.qrPath ? data.qrPath : null,
    };
    renderCurrent();
    if (!dirty && !saving) fillForm();
  }, (err) => say(el.msg, `Could not load your GCash profile: ${friendlyError(err)}`, "warn"));

  const onInput = () => { dirty = true; };

  function validate() {
    const gcashName = el.name.value.trim();
    const gcashNumber = normalizePhMobile(el.number.value);
    const file = el.qr.files && el.qr.files[0];
    const qrType = file ? (file.type || "").toLowerCase() : "";
    const nameOk = gcashName.length >= MIN_GCASH_NAME && gcashName.length <= MAX_GCASH_NAME;
    el.name.setAttribute("aria-invalid", String(!nameOk));
    el.number.setAttribute("aria-invalid", String(!gcashNumber));
    if (!nameOk) return { error: "Enter the account name exactly as GCash shows it." };
    if (!gcashNumber) return { error: "Enter a PH mobile number, for example 0917 123 4567 or +63 917 123 4567." };
    if (file && !QR_EXT_BY_TYPE[qrType]) return { error: "The QR image must be a PNG, JPG or WEBP file." };
    if (file && (file.size === 0 || file.size > MAX_QR_BYTES)) return { error: "The QR image must be 5 MB or smaller." };
    return { gcashName, gcashNumber, file, qrType };
  }

  async function onSubmit(event) {
    event.preventDefault();
    const v = validate();
    if (v.error) { say(el.msg, v.error, "warn"); return; }
    saving = true;
    el.btn.disabled = true;
    const oldQr = current.qrPath;
    try {
      let qrPath = el.remove.checked ? null : oldQr;
      if (v.file) {
        say(el.msg, "Uploading the QR image");
        qrPath = `qr/${uid}.${QR_EXT_BY_TYPE[v.qrType]}`;
        await uploadBytes(ref(storage, qrPath), v.file, { contentType: v.qrType, cacheControl: "no-cache" });
        urlCache.delete(qrPath);
      }
      say(el.msg, "Saving");
      const { data } = await call.saveGcashProfile({ gcashName: v.gcashName, gcashNumber: v.gcashNumber, qrPath });
      // A QR saved under another extension, or a removed QR, leaves an old file behind: clean it up.
      if (oldQr && oldQr !== data.qrPath) deleteObject(ref(storage, oldQr)).catch(() => {});
      current = { gcashName: data.gcashName, gcashNumber: data.gcashNumber, qrPath: data.qrPath || null };
      renderCurrent();
      fillForm();
      say(el.msg, "GCash profile saved. Buyers see it on their order page.", "ok");
    } catch (err) {
      say(el.msg, friendlyError(err), "warn");
    } finally {
      saving = false;
      el.btn.disabled = false;
    }
  }

  el.form.addEventListener("input", onInput);
  el.form.addEventListener("submit", onSubmit);

  return () => {
    unsub();
    el.form.removeEventListener("input", onInput);
    el.form.removeEventListener("submit", onSubmit);
    say(el.msg, "");
  };
}

/**
 * Starts the Orders tab, and the GCash profile tab unless gcash is false (a revoked photographer only settles
 * orders). Returns a stop function that detaches every listener (call it on sign out or when the user changes).
 */
export function startPhotographerDashboard(uid, { gcash = true } = {}) {
  const stops = gcash ? [startOrders(uid), startGcash(uid)] : [startOrders(uid)];
  return () => stops.forEach((stop) => stop());
}
