// Photo admin page (photos/admin.html). Requires the admin custom claim. Setup only, no orders.
// Bib CSV import (importBibs, the raw file text is parsed on the server), photographer invites
// (invitePhotographer) and the manual review queue (photos with status review, tagged through tagPhoto).
// All writes go through callables.
import { SDK, EVENT_ID, IS_CONFIGURED, USING_EMULATORS, auth, db, storage, functions } from "./firebase.js";

const {
  onAuthStateChanged, getIdTokenResult, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, signOut,
} = await import(`${SDK}/firebase-auth.js`);
const {
  collection, getDocs, query, where, orderBy, limit, startAfter,
} = await import(`${SDK}/firebase-firestore.js`);
const { ref, getDownloadURL } = await import(`${SDK}/firebase-storage.js`);
const { httpsCallable } = await import(`${SDK}/firebase-functions.js`);

const EMAIL_KEY = "techrun.photos.signinEmail";
/** Must match functions/src/admin.ts MAX_CSV_CHARS. */
const MAX_CSV_CHARS = 5_000_000;
const REVIEW_PAGE = 24;
const MAX_BIBS_PER_PHOTO = 30;
const BIB_TOKEN = /^[A-Za-z0-9]{1,12}$/; // final bib format is TBA; the server validates against bibs/

const call = {
  importBibs: httpsCallable(functions, "importBibs"),
  invitePhotographer: httpsCallable(functions, "invitePhotographer"),
  tagPhoto: httpsCallable(functions, "tagPhoto"),
};

const $ = (id) => document.getElementById(id);
const el = {
  who: $("who"), signout: $("signout"), configNote: $("config-note"), msg: $("msg"),
  signin: $("signin"), google: $("google"), emailForm: $("email-form"), email: $("email"), emailBtn: $("email-btn"),
  denied: $("denied"), recheck: $("recheck"), app: $("app"), event: $("event"), reloadEvents: $("reload-events"),
  bibsForm: $("bibs-form"), bibsFile: $("bibs-file"), bibsPreview: $("bibs-preview"), bibsBtn: $("bibs-btn"), bibsResult: $("bibs-result"),
  inviteForm: $("invite-form"), invEmail: $("inv-email"), invName: $("inv-name"), invCredit: $("inv-credit"), inviteBtn: $("invite-btn"),
  review: $("review"), reviewEmpty: $("review-empty"), reviewMore: $("review-more"), reviewRefresh: $("review-refresh"),
};

let csvText = null; // raw text of the chosen CSV file, sent as is to importBibs
let reviewCursor = null;
let reviewLoading = false;

// ---------- helpers ----------

/** Escape text for use inside HTML element content or a quoted attribute. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"'`]/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;",
  })[c]);
}

function show(node, on) { node.classList.toggle("ph-hidden", !on); }

function note(text, kind = "") {
  el.msg.className = `ph-note${kind ? ` ${kind}` : ""}`;
  el.msg.textContent = text;
  show(el.msg, Boolean(text));
  if (text) el.msg.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
function storageDel(key) { try { localStorage.removeItem(key); } catch { /* private mode */ } }

function friendlyError(err) {
  const code = err && err.code ? String(err.code) : "";
  if (code === "functions/permission-denied" || code === "permission-denied") return "Permission denied. This needs the admin role.";
  if (code === "functions/unimplemented") return "That server function is not deployed yet.";
  if (code === "functions/deadline-exceeded") return "The server took too long. Some rows may have been imported; run the import again.";
  if (code === "functions/unauthenticated") return "Your session expired. Sign in again.";
  if (code === "auth/popup-closed-by-user") return "Sign in window closed.";
  return (err && err.message) || "Something went wrong.";
}

async function busy(button, fn) {
  button.disabled = true;
  try { return await fn(); } finally { button.disabled = false; }
}

const currentEvent = () => el.event.value || EVENT_ID;

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
  await busy(el.emailBtn, async () => {
    try {
      await sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
      storageSet(EMAIL_KEY, email);
      note(`Sign in link sent to ${email}. Open it on this device.`, "ok");
    } catch (err) {
      note(friendlyError(err), "warn");
    }
  });
});

el.signout.addEventListener("click", () => signOut(auth));
el.recheck.addEventListener("click", () => auth.currentUser && applyUser(auth.currentUser, true));

async function applyUser(user, forceRefresh = false) {
  show(el.signin, !user);
  show(el.who, Boolean(user));
  show(el.signout, Boolean(user));
  if (!user) { show(el.denied, false); show(el.app, false); return; }
  el.who.textContent = user.email || "Signed in";
  let claims = {};
  try {
    claims = (await getIdTokenResult(user, forceRefresh)).claims;
  } catch (err) {
    note(friendlyError(err), "warn");
  }
  const isAdmin = claims.admin === true;
  show(el.denied, !isAdmin);
  show(el.app, isAdmin);
  if (!isAdmin) return;
  note("");
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
  el.event.value = events.some((e) => e.id === previous) ? previous : EVENT_ID;
  await loadReview(true);
}

el.event.addEventListener("change", () => {
  csvText = null;
  el.bibsFile.value = "";
  show(el.bibsPreview, false);
  show(el.bibsResult, false);
  el.bibsBtn.disabled = true;
  loadReview(true);
});
el.reloadEvents.addEventListener("click", () => busy(el.reloadEvents, loadEvents));

// ---------- bib CSV import ----------

function renderProblems(title, list) {
  if (!list.length) return "";
  const body = list.slice(0, 200).map((p) => `<tr><td>${esc(p.row)}</td><td>${esc(p.bib ?? "")}</td><td>${esc(p.reason)}</td></tr>`).join("");
  const more = list.length > 200 ? `<p class="ph-lead">${esc(list.length - 200)} more not shown.</p>` : "";
  return `<h3 class="ph-label">${esc(title)}</h3><div class="ph-scroll"><table class="ph-table">
    <thead><tr><th scope="col">Line</th><th scope="col">Bib</th><th scope="col">Reason</th></tr></thead>
    <tbody>${body}</tbody></table></div>${more}`;
}

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

el.bibsFile.addEventListener("change", async () => {
  csvText = null;
  el.bibsBtn.disabled = true;
  show(el.bibsResult, false);
  const file = el.bibsFile.files && el.bibsFile.files[0];
  if (!file) { show(el.bibsPreview, false); return; }
  let text = "";
  try {
    text = await file.text();
  } catch (err) {
    el.bibsPreview.className = "ph-note warn";
    el.bibsPreview.textContent = `Could not read the file: ${friendlyError(err)}`;
    show(el.bibsPreview, true);
    return;
  }
  if (text.length > MAX_CSV_CHARS) {
    el.bibsPreview.className = "ph-note warn";
    el.bibsPreview.textContent = `The file is too large (${fmtBytes(file.size)}). Split it into smaller files.`;
    show(el.bibsPreview, true);
    return;
  }
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim() !== "").length;
  el.bibsPreview.className = lines ? "ph-note" : "ph-note warn";
  el.bibsPreview.innerHTML = lines
    ? `<strong>${esc(file.name)}</strong>, ${esc(fmtBytes(file.size))}, about ${esc(lines)} lines including any header, for event ${esc(currentEvent())}.`
    : "The file is empty.";
  show(el.bibsPreview, true);
  csvText = lines ? text : null;
  el.bibsBtn.disabled = !csvText;
});

el.bibsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!csvText) return;
  const eventId = currentEvent();
  await busy(el.bibsBtn, async () => {
    el.bibsBtn.textContent = "Importing";
    try {
      const { data } = await call.importBibs({ eventId, csvText });
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      el.bibsResult.innerHTML = `<div class="ph-note${skipped.length ? " warn" : " ok"}"><strong>${esc(data.imported)} bibs imported</strong> into ${esc(eventId)}.`
        + (skipped.length ? ` ${esc(skipped.length)} rows skipped. Line numbers are lines in the CSV file.` : "") + `</div>`
        + renderProblems("Skipped rows", skipped);
    } catch (err) {
      el.bibsResult.innerHTML = `<div class="ph-note warn"><strong>Import failed.</strong> ${esc(friendlyError(err))}</div>`;
    } finally {
      el.bibsBtn.textContent = "Import";
      show(el.bibsResult, true);
    }
  });
});

// ---------- invite ----------

el.inviteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = el.invEmail.value.trim();
  const name = el.invName.value.trim();
  const credit = el.invCredit.value.trim() || name;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  el.invEmail.setAttribute("aria-invalid", String(!emailOk));
  el.invName.setAttribute("aria-invalid", String(!name));
  if (!emailOk || !name) { note("Enter the photographer's email and name.", "warn"); return; }
  await busy(el.inviteBtn, async () => {
    try {
      const { data } = await call.invitePhotographer({ email, name, credit });
      note(`${name} (${email}) is now a photographer${data.created ? ", new account created" : ""}. They may need to sign out and back in.`, "ok");
      el.inviteForm.reset();
    } catch (err) {
      note(friendlyError(err), "warn");
    }
  });
});

// ---------- review queue ----------

function parseBibs(text) {
  const tokens = String(text).split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  return [...new Set(tokens)];
}

async function previewUrl(path) {
  if (!path) return "";
  try { return await getDownloadURL(ref(storage, path)); } catch { return ""; }
}

function fmtTime(ts) {
  const date = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  return date ? date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "";
}

async function reviewCard(snap) {
  const p = snap.data();
  const id = snap.id;
  const url = await previewUrl(p.previewPath || p.thumbPath);
  const suggested = Array.isArray(p.suggestedBibs) ? p.suggestedBibs.map(String) : [];
  const current = Array.isArray(p.bibs) ? p.bibs.map(String) : [];
  const li = document.createElement("li");
  li.className = "ph-card";
  li.dataset.id = id;
  const img = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener"><img src="${esc(url)}" alt="Photo ${esc(id)}" loading="lazy" /></a>`
    : `<div class="ph-empty">Preview not ready</div>`;
  const chips = suggested.map((b) => `<button type="button" class="ph-chip" data-bib="${esc(b)}" aria-label="Add bib ${esc(b)}">${esc(b)}</button>`).join("");
  li.innerHTML = `${img}
    <div class="meta"><span>${p.error ? "Scan failed" : `Scan ${p.confidence != null ? `${esc(Math.round(Number(p.confidence) * 100))}%` : "unsure"}`}</span><span>${esc(fmtTime(p.takenAt))}</span></div>
    <div class="meta"><span>${esc(p.photographerCredit || "")}</span><span>${esc(id.slice(0, 8))}</span></div>
    <form class="ad-tag" novalidate>
      ${chips ? `<div class="bibs" style="padding:0">${chips}</div>` : ""}
      <label class="ph-sr" for="tag-${esc(id)}">Bibs in photo ${esc(id)}</label>
      <input id="tag-${esc(id)}" class="ph-input" type="text" inputmode="numeric" autocomplete="off" value="${esc(current.join(" "))}" placeholder="Bibs, for example 1234 5678" />
      <div class="ph-row">
        <button type="submit" class="ph-btn small primary">Save tags</button>
        <button type="button" class="ph-btn small" data-none>No bibs visible</button>
      </div>
      <p class="ph-hidden" role="status" style="margin:0;font-size:13px"></p>
    </form>`;
  wireCard(li, id);
  return li;
}

function wireCard(li, photoId) {
  const form = li.querySelector("form");
  const input = form.querySelector("input");
  const status = form.querySelector("[role=status]");
  const buttons = [...form.querySelectorAll("button")];
  const say = (text) => { status.textContent = text; show(status, Boolean(text)); };

  form.querySelectorAll("[data-bib]").forEach((chip) => chip.addEventListener("click", () => {
    input.value = parseBibs(`${input.value} ${chip.dataset.bib}`).join(" ");
    input.focus();
  }));

  async function submit(bibs) {
    const invalid = bibs.filter((b) => !BIB_TOKEN.test(b));
    if (invalid.length) { input.setAttribute("aria-invalid", "true"); say(`Not a bib: ${invalid.join(", ")}`); return; }
    if (bibs.length > MAX_BIBS_PER_PHOTO) { say(`At most ${MAX_BIBS_PER_PHOTO} bibs per photo.`); return; }
    input.setAttribute("aria-invalid", "false");
    buttons.forEach((b) => { b.disabled = true; });
    say("Saving");
    try {
      const { data } = await call.tagPhoto({ photoId, bibs });
      // tagged (bibs saved) and untagged (no bibs visible) both leave the queue
      if (data.status === "review") {
        say("Saved, still in review.");
        buttons.forEach((b) => { b.disabled = false; });
        return;
      }
      li.remove();
      if (!el.review.children.length) show(el.reviewEmpty, true);
    } catch (err) {
      say(friendlyError(err));
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const bibs = parseBibs(input.value);
    if (!bibs.length) { say("Type at least one bib, or use No bibs visible."); return; }
    submit(bibs);
  });
  form.querySelector("[data-none]").addEventListener("click", () => {
    if (window.confirm("Mark this photo as having no readable bibs?")) submit([]);
  });
}

async function loadReview(reset) {
  if (reviewLoading) return;
  reviewLoading = true;
  if (reset) { reviewCursor = null; el.review.replaceChildren(); }
  show(el.reviewEmpty, false);
  el.reviewMore.disabled = true;
  try {
    const parts = [
      collection(db, "photos"),
      where("eventId", "==", currentEvent()),
      where("status", "==", "review"),
      orderBy("takenAt", "desc"),
    ];
    if (reviewCursor) parts.push(startAfter(reviewCursor));
    parts.push(limit(REVIEW_PAGE));
    const snap = await getDocs(query(...parts));
    const cards = await Promise.all(snap.docs.map(reviewCard));
    el.review.append(...cards);
    reviewCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : reviewCursor;
    show(el.reviewMore, snap.docs.length === REVIEW_PAGE);
    show(el.reviewEmpty, el.review.children.length === 0);
  } catch (err) {
    note(`Could not load the review queue: ${friendlyError(err)}`, "warn");
  } finally {
    el.reviewMore.disabled = false;
    reviewLoading = false;
  }
}

el.reviewMore.addEventListener("click", () => loadReview(false));
el.reviewRefresh.addEventListener("click", () => loadReview(true));

// ---------- start ----------

show(el.configNote, !IS_CONFIGURED && !USING_EMULATORS);
await completeEmailLink();
onAuthStateChanged(auth, (user) => { applyUser(user).catch((err) => note(friendlyError(err), "warn")); });
