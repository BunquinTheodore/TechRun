// Photographer dashboard (photos/upload.html): tabs for Upload, Orders and GCash profile.
// Sign in (Google or email link), require the photographer or admin claim, then upload many images with
// uploadBytesResumable to originals/{eventId}/{uid}/{photoId}.{ext}, three at a time, and watch photos/{photoId}
// for the scan result written by the onPhotoUploaded function. The storage rules and the trigger take the
// uploader from the {uid} path segment. The Orders and GCash tabs live in orders.js.
import { SDK, EVENT_ID, IS_CONFIGURED, USING_EMULATORS, auth, db, storage } from "./firebase.js";
import { startPhotographerDashboard } from "./orders.js";

const {
  onAuthStateChanged, getIdTokenResult, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut,
} = await import(`${SDK}/firebase-auth.js`);
const { collection, getDocs, doc, onSnapshot, query, where, limit } = await import(`${SDK}/firebase-firestore.js`);
const { ref, uploadBytesResumable } = await import(`${SDK}/firebase-storage.js`);

const MAX_BYTES = 25 * 1024 * 1024; // matches storage.rules
const CONCURRENCY = 3;
const EMAIL_KEY = "techrun.photos.signinEmail";
/**
 * MIME type to the file extension the storage rules accept. HEIC is not accepted anywhere: the server image
 * library cannot decode it, so iPhone photos must be exported as JPG (most apps do this when sharing).
 */
const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_EXT = new Set(["heic", "heif"]);
const TYPE_BY_EXT = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
/** photos/{id}.status written by the server: tagged, review (needs a person) or untagged (no bibs visible). */
const SCAN_LABEL = { tagged: "Tagged", review: "Sent to manual review", untagged: "No bibs visible" };
const FINAL_STATUSES = new Set(["tagged", "review", "untagged"]);
const TABS = ["upload", "orders", "gcash"];

const $ = (id) => document.getElementById(id);
const el = {
  who: $("who"), signout: $("signout"), configNote: $("config-note"), msg: $("msg"),
  signin: $("signin"), google: $("google"), emailForm: $("email-form"), email: $("email"), emailBtn: $("email-btn"),
  denied: $("denied"), recheck: $("recheck"), app: $("app"), event: $("event"), drop: $("drop"), files: $("files"),
  total: $("total"), totalProgress: $("total-progress"), totalLabel: $("total-label"), totalPct: $("total-pct"),
  retryAll: $("retry-all"), clearDone: $("clear-done"), list: $("list"),
  tabs: TABS.map((name) => $(`tab-${name}`)), panels: TABS.map((name) => $(`panel-${name}`)),
};

/** @type {Map<string, any>} queue items by photoId, in insertion order */
const items = new Map();
let active = 0;
let canUpload = false;
/** Stops the Orders and GCash listeners of the signed in photographer. */
let stopDashboard = null;
let dashboardUid = null;

// ---------- small helpers ----------

function show(node, on) { node.classList.toggle("ph-hidden", !on); }

function note(text, kind = "") {
  el.msg.className = `ph-note${kind ? ` ${kind}` : ""}`;
  el.msg.textContent = text;
  show(el.msg, Boolean(text));
}

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
function storageDel(key) { try { localStorage.removeItem(key); } catch { /* private mode */ } }

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function friendlyError(err) {
  const code = err && err.code ? String(err.code) : "";
  if (code === "storage/unauthorized") return "Upload refused. Your photographer access may be off, or the file is not a JPG, PNG or WEBP of 25 MB or less.";
  if (code === "storage/canceled") return "Upload cancelled.";
  if (code === "storage/retry-limit-exceeded") return "Connection lost. Try again.";
  if (code === "storage/quota-exceeded") return "Storage quota reached. Tell the TechRun team.";
  if (code === "auth/popup-closed-by-user") return "Sign in window closed.";
  if (code === "auth/invalid-email") return "That email address looks wrong.";
  return (err && err.message) || "Something went wrong.";
}

// ---------- auth ----------

async function completeEmailLink() {
  if (!isSignInWithEmailLink(auth, location.href)) return;
  let email = storageGet(EMAIL_KEY);
  if (!email) email = window.prompt("Confirm the email address the sign in link was sent to") || "";
  if (!email) { note("Sign in link opened without an email address. Request a new link.", "warn"); return; }
  try {
    await signInWithEmailLink(auth, email.trim(), location.href);
    storageDel(EMAIL_KEY);
  } catch (err) {
    note(friendlyError(err), "warn");
  } finally {
    history.replaceState(null, "", location.pathname);
  }
}

el.google.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err && err.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
    note(friendlyError(err), "warn");
  }
});

el.emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = el.email.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  el.email.setAttribute("aria-invalid", String(!valid));
  if (!valid) { note("Enter a valid email address.", "warn"); return; }
  el.emailBtn.disabled = true;
  try {
    await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    storageSet(EMAIL_KEY, email);
    note(`Sign in link sent to ${email}. Open it on this device.`, "ok");
  } catch (err) {
    note(friendlyError(err), "warn");
  } finally {
    el.emailBtn.disabled = false;
  }
});

el.signout.addEventListener("click", () => {
  if (active > 0 && !window.confirm("Uploads are still running. Sign out anyway?")) return;
  signOut(auth);
});

el.recheck.addEventListener("click", () => auth.currentUser && applyUser(auth.currentUser, true));

// ---------- tabs ----------

const visibleTabs = () => TABS.filter((t, i) => !el.tabs[i].classList.contains("ph-hidden"));

function selectTab(name, focus = false) {
  const visible = visibleTabs();
  const target = visible.includes(name) ? name : (visible[0] || "upload");
  TABS.forEach((t, i) => {
    const on = t === target;
    el.tabs[i].setAttribute("aria-selected", String(on));
    el.tabs[i].tabIndex = on ? 0 : -1;
    show(el.panels[i], on);
  });
  if (focus) el.tabs[TABS.indexOf(target)].focus();
  const hash = target === "upload" ? "" : `#${target}`;
  if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
}

el.tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(TABS[i]));
  tab.addEventListener("keydown", (event) => {
    const visible = visibleTabs();
    const at = visible.indexOf(TABS[i]);
    let next = null;
    if (event.key === "ArrowRight") next = visible[(at + 1) % visible.length];
    else if (event.key === "ArrowLeft") next = visible[(at - 1 + visible.length) % visible.length];
    else if (event.key === "Home") next = visible[0];
    else if (event.key === "End") next = visible[visible.length - 1];
    if (!next) return;
    event.preventDefault();
    selectTab(next, true);
  });
});

function setDashboard(uid, withGcash = true) {
  const key = uid ? `${uid}:${withGcash}` : null;
  if (dashboardUid === key) return;
  if (stopDashboard) { stopDashboard(); stopDashboard = null; }
  dashboardUid = key;
  if (uid) stopDashboard = startPhotographerDashboard(uid, { gcash: withGcash });
}

/**
 * True when buyers placed orders for this account's photos. A photographer the organisers revoked loses the
 * claim but must still approve or reject receipts already sent (firestore.rules let them read their orders).
 */
async function hasOwnOrders(uid) {
  try {
    const snap = await getDocs(query(collection(db, "orders"), where("photographerUid", "==", uid), limit(1)));
    return !snap.empty;
  } catch {
    return false;
  }
}

async function applyUser(user, forceRefresh = false) {
  show(el.signin, !user);
  show(el.who, Boolean(user));
  show(el.signout, Boolean(user));
  if (!user) { show(el.denied, false); show(el.app, false); canUpload = false; setDashboard(null); return; }
  el.who.textContent = user.email || "Signed in";
  let claims = {};
  try {
    claims = (await getIdTokenResult(user, forceRefresh)).claims;
  } catch (err) {
    note(friendlyError(err), "warn");
  }
  const isPhotographer = claims.photographer === true;
  const isAdmin = claims.admin === true;
  canUpload = isPhotographer || isAdmin;
  const showOrders = isPhotographer || (await hasOwnOrders(user.uid));
  show(el.denied, !canUpload && !showOrders);
  show(el.app, canUpload || showOrders);
  // Orders and the GCash profile belong to a photographer; an admin only account sees the upload tab.
  // A revoked photographer with orders sees only the Orders tab.
  show(el.tabs[0], canUpload);
  show(el.tabs[1], showOrders);
  show(el.tabs[2], isPhotographer);
  setDashboard(showOrders ? user.uid : null, isPhotographer);
  selectTab(location.hash.slice(1));
  if (!canUpload) {
    if (showOrders) note("Your photographer access is off, so uploads and new orders are closed. Please still approve or reject the receipts buyers sent you.", "warn");
    return;
  }
  if (!isPhotographer) note("Admin account without the photographer role: storage only accepts uploads from photographers.", "warn");
  else note("");
  await loadEvents();
}

// ---------- events ----------

async function loadEvents() {
  const previous = el.event.value;
  let events = [];
  try {
    const snap = await getDocs(collection(db, "events"));
    events = snap.docs.map((d) => ({ id: d.id, name: (d.data() && d.data().name) || d.id }));
  } catch (err) {
    note(`Could not load events: ${friendlyError(err)}`, "warn");
  }
  if (!events.some((e) => e.id === EVENT_ID)) events.unshift({ id: EVENT_ID, name: EVENT_ID });
  el.event.replaceChildren(...events.map((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.name === e.id ? e.id : `${e.name} (${e.id})`;
    return opt;
  }));
  el.event.value = events.some((e) => e.id === previous) ? previous : (events.find((e) => e.id === EVENT_ID) || events[0]).id;
}

// ---------- queue ----------

function extensionFor(file) {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  if (ALLOWED_EXT.has(fromName) && file.name.includes(".")) return fromName === "jpeg" ? "jpg" : fromName;
  return EXT_BY_TYPE[(file.type || "").toLowerCase()] || null;
}

function isHeic(file) {
  const fromName = (file.name.split(".").pop() || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return HEIC_EXT.has(fromName) || type === "image/heic" || type === "image/heif";
}

function validate(file, ext) {
  const type = (file.type || "").toLowerCase();
  if (isHeic(file)) return "HEIC is not supported. Export the photo as JPG and upload that.";
  if (type && !type.startsWith("image/")) return "Not an image.";
  if (!type && !ext) return "Not an image.";
  if (!ext) return "Unsupported image type. Use JPG, PNG or WEBP.";
  if (file.size > MAX_BYTES) return `Too large (${fmtBytes(file.size)}). The limit is 25 MB.`;
  if (file.size === 0) return "Empty file.";
  return null;
}

function buildRow(item) {
  const li = document.createElement("li");
  li.className = "up-item";
  const head = document.createElement("div");
  head.className = "up-head";
  const name = document.createElement("span");
  name.className = "up-name";
  name.textContent = item.file.name;
  name.title = item.file.name;
  const actions = document.createElement("div");
  actions.className = "ph-row";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "ph-btn small ph-hidden";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => retryItem(item));
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ph-btn small ph-hidden";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => item.task && item.task.cancel());
  actions.append(retry, cancel);
  head.append(name, actions);

  const progress = document.createElement("div");
  progress.className = "ph-progress";
  const info = document.createElement("div");
  info.className = "info";
  const state = document.createElement("span");
  const pct = document.createElement("span");
  info.append(state, pct);
  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = "fill";
  track.append(fill);
  progress.append(info, track);

  const scan = document.createElement("div");
  scan.className = "up-scan ph-hidden";

  li.append(head, progress, scan);
  item.dom = { li, retry, cancel, progress, state, pct, scan };
  return li;
}

function renderItem(item) {
  const { retry, cancel, progress, state, pct } = item.dom;
  const percent = item.file.size ? Math.round((item.transferred / item.file.size) * 100) : 0;
  progress.style.setProperty("--p", `${item.state === "done" ? 100 : percent}%`);
  progress.classList.toggle("done", item.state === "done");
  progress.classList.toggle("error", item.state === "error" || item.state === "invalid");
  const labels = {
    queued: "Waiting", uploading: `Uploading ${fmtBytes(item.transferred)} of ${fmtBytes(item.file.size)}`,
    done: "Uploaded", error: item.error || "Failed", invalid: item.error || "Rejected",
  };
  state.textContent = labels[item.state] || "";
  pct.textContent = item.state === "invalid" ? "" : `${item.state === "done" ? 100 : percent}%`;
  show(retry, item.state === "error");
  show(cancel, item.state === "uploading");
}

function renderScan(item, data) {
  const scan = item.dom.scan;
  show(scan, true);
  if (!data) { scan.textContent = "Scanning for bibs"; return; }
  const status = String(data.status || "");
  const bibs = Array.isArray(data.bibs) ? data.bibs.map(String) : [];
  const label = document.createElement("span");
  label.textContent = data.error ? "Scan failed, sent to manual review" : (SCAN_LABEL[status] || "Scanning");
  const chips = bibs.map((b) => {
    const chip = document.createElement("span");
    chip.className = "ph-chip on";
    chip.textContent = b;
    return chip;
  });
  scan.replaceChildren(label, ...chips);
}

function watchPhoto(item) {
  if (item.unwatch) return;
  renderScan(item, null);
  item.unwatch = onSnapshot(doc(db, "photos", item.id), (snap) => {
    const data = snap.exists() ? snap.data() : null;
    renderScan(item, data);
    if (data && FINAL_STATUSES.has(String(data.status)) && item.unwatch) { item.unwatch(); item.unwatch = null; item.watched = true; }
  }, (err) => {
    item.dom.scan.textContent = `Could not read scan status: ${friendlyError(err)}`;
  });
}

function renderTotal() {
  const valid = [...items.values()].filter((i) => i.state !== "invalid");
  show(el.total, items.size > 0);
  const totalBytes = valid.reduce((s, i) => s + i.file.size, 0);
  const sent = valid.reduce((s, i) => s + (i.state === "done" ? i.file.size : i.transferred), 0);
  const done = valid.filter((i) => i.state === "done").length;
  const failed = valid.filter((i) => i.state === "error").length;
  const pct = totalBytes ? Math.round((sent / totalBytes) * 100) : 0;
  el.totalProgress.style.setProperty("--p", `${pct}%`);
  el.totalProgress.classList.toggle("done", valid.length > 0 && done === valid.length);
  el.totalProgress.classList.toggle("error", failed > 0);
  el.totalLabel.textContent = `${done} of ${valid.length} uploaded${failed ? `, ${failed} failed` : ""}`;
  el.totalPct.textContent = `${pct}%`;
  show(el.retryAll, failed > 0);
}

function addFiles(fileList) {
  if (!canUpload) return;
  const eventId = el.event.value || EVENT_ID;
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) { note("Sign in again before uploading.", "warn"); return; }
  const rows = [];
  for (const file of fileList) {
    const ext = extensionFor(file);
    const error = validate(file, ext);
    const item = {
      id: crypto.randomUUID(), file, ext, eventId, uid, state: error ? "invalid" : "queued",
      error, transferred: 0, task: null, unwatch: null, dom: null,
    };
    items.set(item.id, item);
    rows.push(buildRow(item));
    renderItem(item);
  }
  el.list.prepend(...rows.reverse());
  renderTotal();
  pump();
}

function pump() {
  for (const item of items.values()) {
    if (active >= CONCURRENCY) break;
    if (item.state === "queued") startUpload(item);
  }
}

function startUpload(item) {
  active += 1;
  item.state = "uploading";
  item.error = null;
  item.transferred = 0;
  renderItem(item);
  // The {uid} segment must be the signed in user (storage.rules); the trigger reads the uploader from it.
  const path = `originals/${item.eventId}/${item.uid}/${item.id}.${item.ext}`;
  // The rules accept only image/jpeg, image/png and image/webp, so send the type that matches the extension.
  const contentType = TYPE_BY_EXT[item.ext];
  // originalName is only used as the download file name for buyers.
  const metadata = { contentType, customMetadata: { originalName: item.file.name.slice(0, 200) } };
  const task = uploadBytesResumable(ref(storage, path), item.file, metadata);
  item.task = task;
  task.on("state_changed", (snap) => {
    item.transferred = snap.bytesTransferred;
    renderItem(item);
    renderTotal();
  }, (err) => {
    finish(item, "error", friendlyError(err));
  }, () => {
    item.transferred = item.file.size;
    finish(item, "done", null);
    watchPhoto(item);
  });
}

function finish(item, state, error) {
  active = Math.max(0, active - 1);
  item.state = state;
  item.error = error;
  item.task = null;
  renderItem(item);
  renderTotal();
  pump();
}

function retryItem(item) {
  if (item.state !== "error") return;
  item.state = "queued";
  item.transferred = 0;
  renderItem(item);
  renderTotal();
  pump();
}

el.retryAll.addEventListener("click", () => {
  for (const item of items.values()) {
    if (item.state === "error") { item.state = "queued"; item.transferred = 0; renderItem(item); }
  }
  renderTotal();
  pump();
});

el.clearDone.addEventListener("click", () => {
  for (const [id, item] of items) {
    const scanSettled = item.state === "done" && !item.unwatch;
    if (item.state === "invalid" || scanSettled) { item.dom.li.remove(); items.delete(id); }
  }
  renderTotal();
});

el.files.addEventListener("change", () => {
  addFiles([...el.files.files]);
  el.files.value = "";
});

["dragenter", "dragover"].forEach((type) => el.drop.addEventListener(type, (event) => {
  event.preventDefault();
  el.drop.classList.add("over");
}));
["dragleave", "dragend"].forEach((type) => el.drop.addEventListener(type, () => el.drop.classList.remove("over")));
el.drop.addEventListener("drop", (event) => {
  event.preventDefault();
  el.drop.classList.remove("over");
  if (event.dataTransfer && event.dataTransfer.files) addFiles([...event.dataTransfer.files]);
});
// a file dropped outside the drop zone should not navigate away from the page
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

window.addEventListener("beforeunload", (event) => {
  const pending = [...items.values()].some((i) => i.state === "uploading" || i.state === "queued");
  if (pending) { event.preventDefault(); event.returnValue = ""; }
});

// ---------- start ----------

show(el.configNote, !IS_CONFIGURED && !USING_EMULATORS);
await completeEmailLink();
onAuthStateChanged(auth, (user) => { applyUser(user).catch((err) => note(friendlyError(err), "warn")); });
