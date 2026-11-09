// Waitlist: the hero's "Join the waitlist" button opens a dialog that posts to freewaitlists.com.
import { esc } from "./scenes/util.js";

// The pure helpers (validate, payload, response) are exported for the tests in tests/waitlist.test.mjs.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NAME = 80;
const MAX_EMAIL = 254;
const TIMEOUT_MS = 12000;

export function validate({ name = "", email = "" }) {
  const n = name.trim(), e = email.trim();
  if (!e) return { ok: false, field: "email", error: "Enter your email so we can reach you." };
  if (e.length > MAX_EMAIL || !EMAIL_RE.test(e)) return { ok: false, field: "email", error: "That email doesn't look right." };
  if (n.length > MAX_NAME) return { ok: false, field: "name", error: `Keep your name under ${MAX_NAME} characters.` };
  return { ok: true, name: n, email: e.toLowerCase() };
}

export const buildPayload = ({ name, email }, source) => ({
  email,
  meta: { ...(name ? { name } : {}), source },
});

// freewaitlists answers 201 (added), 200 (already on the list, same id) or 4xx with { error }.
export function readResponse(status, body) {
  // a 2xx means the email is in, even if a proxy strips the body; only an explicit success:false fails it
  if (status >= 200 && status < 300 && body?.success !== false) {
    return { ok: true, fresh: status === 201 };
  }
  const reason = typeof body?.error === "string" && body.error ? body.error : null;
  if (status >= 500 || status === 0) return { ok: false, error: "The waitlist is busy right now. Try again in a minute." };
  if (!reason) return { ok: false, error: "Something went wrong. Try again." };
  return { ok: false, error: reason.endsWith(".") ? reason : `${reason}.` };
}

export async function joinWaitlist(endpoint, fields, source, fetchImpl = fetch) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(fields, source)),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    return readResponse(res.status, body);
  } catch (err) {
    console.error("waitlist: request failed", err);
    return { ok: false, error: err?.name === "AbortError" ? "That took too long. Check your connection and try again." : "Couldn't reach the waitlist. Check your connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- dialog ---------- */

function dialogHtml(W, title) {
  return `
<form method="dialog" class="wl-close-form"><button class="wl-x" aria-label="Close">×</button></form>
<div class="wl-body" data-view="form">
  <p class="wl-eb">${esc(title)}</p>
  <h2 class="wl-h" id="wl-title">${esc(W.heading)}</h2>
  <p class="wl-lead">${esc(W.lead)}</p>
  <form class="wl-form" novalidate>
    <label class="wl-f"><span>Name <em>optional</em></span>
      <input name="name" type="text" autofocus autocomplete="name" maxlength="80" placeholder="Juan Dela Cruz"></label>
    <label class="wl-f"><span>Email</span>
      <input name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="you@email.com"></label>
    <p class="wl-err" role="alert" aria-live="assertive"></p>
    <button class="wl-go" type="submit"><span>${esc(W.submit)}</span></button>
    <p class="wl-fine">${esc(W.fine)}</p>
  </form>
</div>
<div class="wl-body" data-view="done" hidden>
  <p class="wl-eb">${esc(title)}</p>
  <h2 class="wl-h wl-done-h" tabindex="-1"></h2>
  <p class="wl-lead wl-done-p"></p>
  <button class="wl-go wl-ok" type="button"><span>Back to the film</span></button>
</div>`;
}

export function initWaitlist({ C, onOpen = () => {}, onClose = () => {} }) {
  const W = C.waitlist;
  if (!W?.endpoint) return;
  const dlg = document.createElement("dialog");
  dlg.id = "waitlist";
  dlg.setAttribute("data-lenis-prevent", ""); // Lenis is stopped while open; let the dialog scroll natively
  dlg.setAttribute("aria-labelledby", "wl-title");
  dlg.innerHTML = dialogHtml(W, C.brand.title);
  document.body.appendChild(dlg);

  const form = dlg.querySelector(".wl-form"), err = dlg.querySelector(".wl-err"), go = form.querySelector(".wl-go");
  const views = { form: dlg.querySelector('[data-view="form"]'), done: dlg.querySelector('[data-view="done"]') };
  let busy = false, request = 0; // request numbers the submit in flight; closing the dialog makes its answer stale

  const setBusy = (on) => {
    busy = on;
    go.disabled = on;
    go.firstElementChild.textContent = on ? "Joining…" : W.submit;
  };
  const show = (v) => { views.form.hidden = v !== "form"; views.done.hidden = v !== "done"; };
  const setError = (msg, field) => {
    err.textContent = msg || "";
    for (const input of form.elements) if (input.name) input.toggleAttribute("aria-invalid", !!msg && input.name === field);
    if (field) form.elements[field]?.focus();
  };

  const open = (source) => {
    if (dlg.open) return;
    dlg.dataset.source = source || W.source;
    show("form");
    setError("");
    setBusy(false);
    dlg.showModal();
    onOpen();
  };
  dlg.addEventListener("close", () => { request++; setBusy(false); onClose(); });
  // a click that starts and ends on the backdrop (outside the dialog box) closes it; drags out of an input do not
  const outside = (e) => {
    const r = dlg.getBoundingClientRect();
    return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  let downOutside = false;
  dlg.addEventListener("pointerdown", (e) => { downOutside = outside(e); });
  dlg.addEventListener("click", (e) => { if (downOutside && outside(e)) dlg.close(); downOutside = false; });
  dlg.querySelector(".wl-ok").addEventListener("click", () => dlg.close());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const v = validate({ name: form.elements.name.value, email: form.elements.email.value });
    if (!v.ok) return setError(v.error, v.field);
    setError("");
    setBusy(true);
    const mine = ++request;
    const r = await joinWaitlist(W.endpoint, v, dlg.dataset.source || W.source);
    if (mine !== request) return; // dialog was closed while this was in flight
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const who = v.name ? `, ${v.name.split(/\s+/)[0]}` : "";
    dlg.querySelector(".wl-done-h").textContent = r.fresh ? `You're on the list${who}.` : `You're already on the list${who}.`;
    dlg.querySelector(".wl-done-p").textContent = r.fresh ? W.success : W.already;
    form.reset();
    show("done");
    dlg.querySelector(".wl-done-h").focus();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-waitlist]");
    if (!btn) return;
    e.preventDefault();
    open(btn.dataset.waitlist);
  });
  return { open };
}
