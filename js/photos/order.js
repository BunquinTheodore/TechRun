// Buyer order page (photos/order.html?id=..&t=..). One order is one photographer: the buyer pays them by GCash,
// uploads the receipt with the 13 digit reference number, the photographer approves it, and downloads unlock.
// Every call carries the order id and access token from the link; nothing here needs a sign in.
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { ref, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { functions, storage, IS_CONFIGURED, USING_EMULATORS } from "./firebase.js";
import {
  CONTACT_EMAIL, STATUS_LABELS, el, setNote, plural, formatPeso, isOrderAccess, readSavedOrders, saveOrderLink,
} from "./checkout.js";

const POLL_MS = 20000;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const RECEIPT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const GCASH_REF_PATTERN = /^\d{13}$/;
const TIME_ZONE = "Asia/Manila";

const $ = (id) => document.getElementById(id);
const ui = {
  code: $("order-code"), lead: $("order-lead"), status: $("status"), actions: $("actions"), refresh: $("refresh"),
  steps: $("steps"), help: $("help-link"),
  pay: $("pay-section"), qrBox: $("qr-box"), qrImg: $("qr-img"), qrCaption: $("qr-caption"),
  payAmount: $("pay-amount"), payName: $("pay-name"), payNumber: $("pay-number"), payCode: $("pay-code"),
  howtoAmount: $("howto-amount"), howtoCode: $("howto-code"), copyStatus: $("copy-status"),
  receipt: $("receipt-section"), form: $("receipt-form"), file: $("receipt-file"), gcashRef: $("gcash-ref"),
  preview: $("receipt-preview"), fileError: $("receipt-error"), refError: $("ref-error"),
  progress: $("upload-progress"), pct: $("upload-pct"), submit: $("receipt-submit"),
  filesSection: $("files-section"), files: $("files"), expires: $("expires"), fresh: $("fresh-links"),
  photosSection: $("photos-section"), photos: $("photos"),
};

const getOrderCall = httpsCallable(functions, "getOrder");
const submitReceiptCall = httpsCallable(functions, "submitReceipt");
const getDownloadsCall = httpsCallable(functions, "getDownloads");

const state = { access: null, order: null, loading: false, sending: false, pollTimer: 0, previewUrl: "", downloadsFor: "" };

/* ---------- helpers ---------- */

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});
const formatTime = (iso, format = dateTimeFormat) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? format.format(d) : "";
};

/** Only https links (or http on the local emulators) ever reach an href or src. */
const safeUrl = (url) => typeof url === "string" && (/^https:\/\//.test(url) || (USING_EMULATORS && /^http:\/\//.test(url)));

function contactLink(subject) {
  return el("a", { href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` }, CONTACT_EMAIL);
}

function helpSubject() {
  return `TechRun 2027 photo order ${state.order?.code || ""}`.trim();
}

function showActions(label) {
  ui.refresh.textContent = label || "Check again";
  ui.actions.classList.toggle("ph-hidden", !label);
}

/** Public Storage file (thumbs/, qr/) through the SDK, falling back to the URL the server built. */
async function publicImage(img, path, fallbackUrl) {
  try {
    if (!path) throw new Error("no path");
    img.src = await getDownloadURL(ref(storage, path));
  } catch {
    if (safeUrl(fallbackUrl)) img.src = fallbackUrl;
    else img.closest("figure, li")?.classList.add("broken");
  }
}

/* ---------- reading the link ---------- */

function readAccess() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const orderId = params.get("id") || hash.get("id") || "";
  let token = params.get("t") || hash.get("t") || "";
  if (orderId && !token) token = readSavedOrders().find((o) => o.orderId === orderId)?.token || "";
  return isOrderAccess(orderId, token) ? { orderId, token } : null;
}

/* ---------- rendering ---------- */

function renderSteps(status) {
  const order = ["awaiting_payment", "submitted", "done"];
  const at = status === "approved" || status === "rejected" ? 2 : Math.max(0, order.indexOf(status));
  ui.steps.classList.remove("ph-hidden");
  for (const li of ui.steps.children) {
    const i = order.indexOf(li.dataset.step);
    const done = i < at || status === "approved";
    const current = i === at && status !== "approved";
    const bad = li.dataset.step === "done" && status === "rejected";
    li.classList.toggle("done", done && !bad);
    li.classList.toggle("current", current && !bad);
    li.classList.toggle("bad", bad);
    if (current || bad) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    if (li.dataset.step === "done") li.querySelector(".name").textContent = status === "rejected" ? STATUS_LABELS.rejected : STATUS_LABELS.approved;
    li.querySelector(".state").textContent = bad ? ", not approved" : done ? ", done" : current ? ", current step" : ", not yet";
  }
}

function renderPay(order) {
  const p = order.photographer || {};
  const amount = formatPeso(order.amount);
  ui.payAmount.textContent = amount;
  ui.payName.textContent = p.gcashName || "Not set yet";
  ui.payNumber.textContent = p.gcashNumber || "Not set yet";
  ui.payCode.textContent = order.code;
  ui.howtoAmount.textContent = amount;
  ui.howtoCode.textContent = order.code;
  ui.pay.querySelector('[data-copy="name"]').disabled = !p.gcashName;
  ui.pay.querySelector('[data-copy="number"]').disabled = !p.gcashNumber;

  const hasQr = Boolean(p.qrPath || p.qrUrl);
  ui.qrBox.classList.toggle("ph-hidden", !hasQr);
  if (hasQr && ui.qrImg.dataset.path !== (p.qrPath || p.qrUrl)) {
    ui.qrImg.dataset.path = p.qrPath || p.qrUrl;
    ui.qrImg.alt = `GCash QR code of ${p.gcashName || p.name || "the photographer"}`;
    ui.qrCaption.textContent = `Scan with GCash to pay ${p.name || p.gcashName || "the photographer"}`;
    publicImage(ui.qrImg, p.qrPath, p.qrUrl);
  }
}

function renderPhotos(order) {
  const photos = Array.isArray(order.photos) ? order.photos : [];
  ui.photosSection.classList.toggle("ph-hidden", !photos.length || order.status === "approved");
  if (ui.photos.dataset.order === order.orderId && ui.photos.children.length === photos.length) return;
  ui.photos.dataset.order = order.orderId;
  ui.photos.replaceChildren(...photos.map((photo, i) => {
    const img = el("img", { alt: `Watermarked preview of photo ${i + 1}`, loading: "lazy", decoding: "async" });
    publicImage(img, photo.thumbPath, photo.thumbUrl);
    return el("li", { class: "ph-card" }, img, el("div", { class: "meta" }, el("span", {}, `Photo ${i + 1}`)));
  }));
}

/** False once the organisers removed the photographer: the server stops sending their GCash details. */
const photographerActive = (order) => order.photographer?.active !== false;

function statusMessage(order) {
  const p = order.photographer || {};
  const who = p.name || "the photographer";
  const amount = formatPeso(order.amount);
  const open = order.status === "awaiting_payment" || order.status === "rejected";
  if (open && !photographerActive(order)) {
    return {
      kind: "warn",
      text: [el("strong", {}, "Do not send money for this order. "),
        `${who} is no longer selling photos at TechRun 2027. If you already paid by GCash, upload that receipt below so it can still be checked. Questions? Email `,
        contactLink(helpSubject()), "."],
    };
  }
  switch (order.status) {
    case "awaiting_payment":
      return {
        kind: "",
        text: [el("strong", {}, "Waiting for your payment. "),
          `Send ${amount} for ${plural(order.count, "photo")} to ${who} by GCash with ${order.code} in the message, then upload your receipt below. `,
          "Each photographer is paid separately, so other photographers in your cart have their own order page."],
      };
    case "submitted":
      return {
        kind: "",
        text: [el("strong", {}, "Receipt sent. "),
          `${who} is checking your GCash payment${order.gcashRef ? ` (reference ${order.gcashRef})` : ""}`,
          order.submittedAt ? `, sent ${formatTime(order.submittedAt)}. ` : ". ",
          "This page checks again every 20 seconds, and we email you as soon as it is approved."],
      };
    case "approved":
      return {
        kind: "ok",
        text: [el("strong", {}, "Payment confirmed. "),
          `${who} approved your payment${order.approvedAt ? ` on ${formatTime(order.approvedAt)}` : ""}. Your photos are below. Thank you for running with us.`],
      };
    case "rejected":
      return {
        kind: "warn",
        text: [el("strong", {}, "Your payment was not approved. "),
          order.rejectReason ? [`${who} said: `, el("q", {}, order.rejectReason), ". "] : `${who} could not match your payment. `,
          "Check the amount and reference number, then send a new receipt below. Questions? Email ",
          contactLink(helpSubject()), "."],
      };
    default:
      return { kind: "warn", text: "We could not read the status of this order. Please try again." };
  }
}

function render(order) {
  state.order = order;
  document.title = `Order ${order.code} | TechRun 2027`;
  ui.code.textContent = order.code;
  ui.help.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(helpSubject())}`;
  const who = order.photographer?.name;
  ui.lead.textContent = `${plural(order.count, "photo")} by ${who || "one photographer"}, ${formatPeso(order.pricePerPhoto)} each, ${formatPeso(order.amount)} in all.`;

  const msg = statusMessage(order);
  setNote(ui.status, msg.text, msg.kind);
  renderSteps(order.status);

  // Receipts stay open after a revoke (someone may have paid before it); the GCash details do not.
  const canSendReceipt = order.status === "awaiting_payment" || order.status === "rejected";
  const canPay = canSendReceipt && photographerActive(order);
  ui.pay.classList.toggle("ph-hidden", !canPay);
  ui.receipt.classList.toggle("ph-hidden", !canSendReceipt);
  if (canPay) renderPay(order);
  ui.submit.textContent = order.status === "rejected" ? "Send new receipt" : "Send receipt";
  renderPhotos(order);

  if (order.status === "approved") {
    if (state.downloadsFor !== order.orderId) loadDownloads();
  } else {
    ui.filesSection.classList.add("ph-hidden");
  }
  showActions(order.status === "submitted" ? "Check now" : "");
}

/* ---------- loading and polling ---------- */

function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (state.order?.status !== "submitted" || document.hidden) return;
  state.pollTimer = setTimeout(() => load({ quiet: true }), POLL_MS);
}

function linkError(error) {
  const code = error?.code || "";
  if (code === "functions/permission-denied" || code === "functions/invalid-argument" || code === "functions/not-found") {
    return ["This order link is not valid. Unpaid orders are removed after 7 days. Open the link from your email, or email ",
      contactLink("TechRun 2027 photo order link"), " for help."];
  }
  return null;
}

async function load({ quiet = false } = {}) {
  if (state.loading || !state.access) return;
  state.loading = true;
  clearTimeout(state.pollTimer);
  ui.refresh.disabled = true;
  ui.status.setAttribute("aria-busy", "true");
  try {
    const { data } = await getOrderCall({ orderId: state.access.orderId, token: state.access.token });
    if (!data || typeof data.status !== "string") throw Object.assign(new Error("Empty order"), { code: "functions/internal" });
    saveOrderLink({ ...state.access, code: data.code, photographerName: data.photographer?.name || "",
      amount: data.amount, count: data.count, status: data.status });
    render({ ...data, orderId: state.access.orderId });
  } catch (error) {
    const invalid = linkError(error);
    if (invalid) {
      setNote(ui.status, invalid, "warn");
      [ui.steps, ui.pay, ui.receipt, ui.filesSection, ui.photosSection].forEach((n) => n.classList.add("ph-hidden"));
      showActions("");
      state.order = null;
    } else if (!quiet || !state.order) {
      setNote(ui.status, "We could not load your order right now. Check your connection and try again.", "warn");
      showActions("Try again");
    }
  } finally {
    state.loading = false;
    ui.refresh.disabled = false;
    ui.status.removeAttribute("aria-busy");
    schedulePoll();
  }
}

/* ---------- downloads ---------- */

async function loadDownloads() {
  if (!state.order) return;
  state.downloadsFor = state.order.orderId;
  ui.filesSection.classList.remove("ph-hidden");
  ui.fresh.disabled = true;
  ui.expires.textContent = "Preparing your download links...";
  try {
    const { data } = await getDownloadsCall({ orderId: state.access.orderId, token: state.access.token });
    renderFiles(data || {});
  } catch (error) {
    state.downloadsFor = "";
    ui.expires.textContent = "";
    ui.files.replaceChildren(el("li", { class: "ph-note warn" },
      error?.code === "functions/failed-precondition"
        ? "Downloads open once the photographer confirms your payment."
        : "We could not get your download links. Tap Get fresh links to try again."));
  } finally {
    ui.fresh.disabled = false;
  }
}

function renderFiles(data) {
  const files = Array.isArray(data.files) ? data.files.filter((f) => f && safeUrl(f.url)) : [];
  const thumbs = new Map((state.order?.photos || []).map((p) => [p.photoId, p]));
  const until = formatTime(data.expiresAt, timeFormat);
  ui.expires.textContent = `${plural(files.length, "photo")}.${until ? ` Links work until ${until} (Philippine time).` : ""}`;
  ui.files.replaceChildren(...files.map((file, i) => {
    const name = String(file.fileName || `techrun-2027-photo-${i + 1}.jpg`);
    const thumb = thumbs.get(file.photoId);
    const img = el("img", { alt: "", loading: "lazy", decoding: "async" });
    if (thumb) publicImage(img, thumb.thumbPath, thumb.thumbUrl);
    return el("li", { class: "ph-card" },
      img,
      el("div", { class: "ph-file" },
        el("span", { class: "name" }, name),
        el("a", {
          class: "ph-btn small block", href: file.url, download: name, target: "_blank", rel: "noopener noreferrer",
          "aria-label": `Download ${name}`,
        }, "Download")));
  }));
  if (!files.length) {
    ui.files.replaceChildren(el("li", { class: "ph-note warn" },
      "Your order is approved, but no files are ready yet. Please email ", contactLink(helpSubject()), "."));
  }
}

/* ---------- copy buttons ---------- */

function copyValue(kind) {
  const order = state.order;
  if (!order) return "";
  const p = order.photographer || {};
  return { amount: String(order.amount), name: p.gcashName || "", number: p.gcashNumber || "", code: order.code }[kind] || "";
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el("textarea", { readonly: true, class: "ph-sr" }, text);
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

async function onCopy(button) {
  const text = copyValue(button.dataset.copy);
  if (!text) return;
  const ok = await copyText(text);
  const label = button.closest(".ph-fact")?.querySelector("dt")?.textContent || "Value";
  button.textContent = ok ? "Copied" : "Copy failed";
  ui.copyStatus.textContent = ok ? `${label} copied.` : `Could not copy. Select the ${label.toLowerCase()} and copy it yourself.`;
  setTimeout(() => { button.textContent = "Copy"; }, 2000);
}

/* ---------- receipt ---------- */

function cleanRef(value) {
  return String(value || "").replace(/[\s-]+/g, "");
}

function checkFile(file) {
  if (!file) return "Choose the screenshot of your GCash receipt.";
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    return "HEIC photos are not accepted. Take a screenshot of the GCash receipt instead (screenshots are PNG or JPG).";
  }
  if (!RECEIPT_TYPES[file.type]) return "The receipt must be a JPG, PNG or WEBP image.";
  if (file.size <= 0) return "That file is empty. Choose the receipt screenshot again.";
  if (file.size > MAX_RECEIPT_BYTES) return "The receipt image must be 10 MB or smaller.";
  return "";
}

function setFieldError(input, node, message) {
  setNote(node, message, "warn");
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

function onFileChange() {
  const file = ui.file.files?.[0];
  const problem = file ? checkFile(file) : "";
  setFieldError(ui.file, ui.fileError, problem);
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = "";
  if (file && !problem) {
    state.previewUrl = URL.createObjectURL(file);
    ui.preview.src = state.previewUrl;
    ui.preview.classList.remove("ph-hidden");
  } else {
    ui.preview.removeAttribute("src");
    ui.preview.classList.add("ph-hidden");
  }
}

function setProgress(fraction) {
  const pct = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  ui.progress.style.setProperty("--p", pct);
  ui.pct.textContent = pct;
}

function randomName() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function uploadReceipt(file) {
  const path = `receipts/${state.access.orderId}/${randomName()}.${RECEIPT_TYPES[file.type]}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    task.on("state_changed",
      (snap) => setProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(path));
  });
}

function receiptError(error) {
  const code = error?.code || "";
  if (code === "storage/unauthorized") return "This order is not taking receipts right now. Reload the page to see its status.";
  if (code.startsWith("storage/")) return "The receipt upload failed. Check your connection and try again.";
  if (code === "functions/invalid-argument" && error.message) return error.message;
  if (code === "functions/failed-precondition") return "A receipt was already sent for this order.";
  if (code === "functions/permission-denied") return "This order link is not valid. Open the link from your email.";
  return "We could not send your receipt. Check your connection and try again.";
}

async function onSubmitReceipt(event) {
  event.preventDefault();
  if (state.sending || !state.order) return;
  const file = ui.file.files?.[0];
  const fileProblem = checkFile(file);
  const gcashRef = cleanRef(ui.gcashRef.value);
  const refProblem = GCASH_REF_PATTERN.test(gcashRef) ? "" : "Enter the 13 digit reference number from your GCash receipt.";
  setFieldError(ui.file, ui.fileError, fileProblem);
  setFieldError(ui.gcashRef, ui.refError, refProblem);
  if (fileProblem) { ui.file.focus(); return; }
  if (refProblem) { ui.gcashRef.focus(); return; }

  state.sending = true;
  clearTimeout(state.pollTimer);
  ui.submit.disabled = true;
  ui.form.setAttribute("aria-busy", "true");
  ui.progress.classList.remove("ph-hidden", "done", "error");
  setProgress(0);
  try {
    const receiptPath = await uploadReceipt(file);
    ui.progress.classList.add("done");
    await submitReceiptCall({ orderId: state.access.orderId, token: state.access.token, gcashRef, receiptPath });
    ui.form.reset();
    onFileChange();
    ui.progress.classList.add("ph-hidden");
    await load();
    ui.status.scrollIntoView({ block: "center" });
  } catch (error) {
    ui.progress.classList.add("error");
    const message = receiptError(error);
    if (/reference/i.test(message)) setFieldError(ui.gcashRef, ui.refError, message);
    else setFieldError(ui.file, ui.fileError, message);
    if (error?.code === "functions/failed-precondition") load();
  } finally {
    state.sending = false;
    ui.submit.disabled = false;
    ui.form.removeAttribute("aria-busy");
  }
}

/* ---------- start ---------- */

function wire() {
  ui.refresh.addEventListener("click", () => load());
  ui.fresh.addEventListener("click", () => { state.downloadsFor = ""; loadDownloads(); });
  ui.pay.querySelectorAll(".ph-copy").forEach((b) => b.addEventListener("click", () => onCopy(b)));
  ui.file.addEventListener("change", onFileChange);
  ui.gcashRef.addEventListener("input", () => {
    if (ui.gcashRef.getAttribute("aria-invalid") === "true") setFieldError(ui.gcashRef, ui.refError, "");
  });
  ui.form.addEventListener("submit", onSubmitReceipt);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(state.pollTimer);
    else if (state.order?.status === "submitted") load({ quiet: true });
  });
}

function init() {
  wire();
  if (!IS_CONFIGURED && !USING_EMULATORS) {
    setNote(ui.status, "Photo orders are not live yet. Please check back after race day.", "warn");
    return;
  }
  state.access = readAccess();
  if (!state.access) {
    setNote(ui.status, ["This page needs the order link from your email. Open that link, find it under My orders on the ",
      el("a", { href: "./" }, "race photos page"), ", or email ", contactLink("TechRun 2027 photo order link"), " for help."], "warn");
    return;
  }
  load();
}

init();
