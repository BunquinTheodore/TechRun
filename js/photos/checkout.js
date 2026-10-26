// Cart, checkout and saved order links for the race photo pages, plus small DOM helpers shared with
// search.js and order.js. Price is fixed: PHP 150 per photo, paid by GCash straight to each photographer.
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { functions } from "./firebase.js";

export const CONTACT_EMAIL = "techrun.contactus@gmail.com";

/** Must match functions/src/config.ts PRICE_PER_PHOTO (whole pesos). */
export const PRICE_PER_PHOTO = 150;

/** Must match functions/src/config.ts MAX_PHOTOS_PER_CALL (the most photos one checkout can hold). */
export const MAX_PHOTOS_PER_ORDER = 50;

const MAX_BUYER_NAME = 80;
const MAX_SAVED_ORDERS = 30;
const CART_KEY = "techrun.photos.cart.v2";
const ORDERS_KEY = "techrun.photos.myorders.v1";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

/* ---------- DOM helpers ---------- */

/** Escapes text for HTML. Prefer el() / textContent; use this whenever a string must go into markup. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Builds an element. Text children become text nodes, so data never lands in HTML unescaped. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Shows a message in a .ph-note box. kind: "" | "ok" | "warn". Pass an empty text to hide it. */
export function setNote(node, text, kind = "") {
  if (!node) return;
  const parts = (Array.isArray(text) ? text.flat(Infinity) : [text]).filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  node.className = `ph-note${kind ? ` ${kind}` : ""}${parts.length ? "" : " ph-hidden"}`;
  node.replaceChildren(...parts);
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------- browser storage (may be blocked: private mode, previews) ---------- */

function readJson(store, key) {
  try {
    const raw = window[store].getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(store, key, value) {
  try {
    if (value === null) window[store].removeItem(key);
    else window[store].setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- money ---------- */

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** Formats whole pesos, for example 450 as "₱450". */
export function formatPeso(amount) {
  return Number.isFinite(amount) ? peso.format(amount) : "";
}

/* ---------- cart ---------- */

/**
 * Selected photos for one event, kept in sessionStorage. Every update replaces the stored value.
 * `items` maps photoId to { thumbPath, photographerUid, credit } so the cart can be grouped by photographer.
 */
export function createCart(eventId, onChange) {
  const saved = readJson("sessionStorage", CART_KEY);
  let state = saved && saved.eventId === eventId && saved.items && typeof saved.items === "object"
    ? { eventId, items: { ...saved.items } }
    : { eventId, items: {} };

  const commit = (next) => {
    state = next;
    writeJson("sessionStorage", CART_KEY, state);
    onChange?.(api);
  };

  const api = {
    has: (id) => Object.prototype.hasOwnProperty.call(state.items, id),
    ids: () => Object.keys(state.items),
    count: () => Object.keys(state.items).length,
    total: () => Object.keys(state.items).length * PRICE_PER_PHOTO,
    toggle(photo) {
      if (api.has(photo.id)) {
        api.remove([photo.id]);
        return false;
      }
      if (api.count() >= MAX_PHOTOS_PER_ORDER) return false;
      const item = {
        thumbPath: String(photo.thumbPath || ""),
        photographerUid: String(photo.photographerUid || ""),
        credit: String(photo.photographerCredit || ""),
      };
      commit({ ...state, items: { ...state.items, [photo.id]: item } });
      return true;
    },
    remove(ids) {
      const drop = new Set(ids);
      const kept = Object.fromEntries(Object.entries(state.items).filter(([id]) => !drop.has(id)));
      if (Object.keys(kept).length !== api.count()) commit({ ...state, items: kept });
    },
    clear: () => commit({ ...state, items: {} }),
    /** Cart split the way createOrders splits it: one group per photographer, each with its subtotal. */
    groups() {
      const byUid = new Map();
      for (const [id, item] of Object.entries(state.items)) {
        const key = item.photographerUid || "unknown";
        const group = byUid.get(key) || { photographerUid: key, credit: item.credit || "", photos: [] };
        byUid.set(key, { ...group, credit: group.credit || item.credit || "", photos: [...group.photos, { id, ...item }] });
      }
      return [...byUid.values()].map((g) => ({ ...g, subtotal: g.photos.length * PRICE_PER_PHOTO }));
    },
  };
  return api;
}

/* ---------- saved order links ("my orders", localStorage) ---------- */

/** Builds the buyer's order page link from the id and token (never from server supplied HTML). */
export function orderPageHref(orderId, token, base = window.location.href) {
  const url = new URL("order.html", base);
  url.searchParams.set("id", orderId);
  url.searchParams.set("t", token);
  return url.href;
}

export function isOrderAccess(orderId, token) {
  return typeof orderId === "string" && ORDER_ID_PATTERN.test(orderId)
    && typeof token === "string" && TOKEN_PATTERN.test(token);
}

/** Orders this browser has created or opened, newest first. Empty when storage is blocked. */
export function readSavedOrders() {
  const list = readJson("localStorage", ORDERS_KEY);
  if (!Array.isArray(list)) return [];
  return list.filter((o) => o && isOrderAccess(o.orderId, o.token));
}

/** Adds or refreshes one saved order (matched by orderId). Returns false when storage is blocked. */
export function saveOrderLink(order) {
  if (!order || !isOrderAccess(order.orderId, order.token)) return false;
  const others = readSavedOrders().filter((o) => o.orderId !== order.orderId);
  const previous = readSavedOrders().find((o) => o.orderId === order.orderId) || {};
  const entry = {
    orderId: order.orderId,
    token: order.token,
    code: String(order.code ?? previous.code ?? ""),
    photographerName: String(order.photographerName ?? previous.photographerName ?? ""),
    amount: Number.isFinite(order.amount) ? order.amount : previous.amount ?? null,
    count: Number.isFinite(order.count) ? order.count : previous.count ?? null,
    status: String(order.status ?? previous.status ?? "awaiting_payment"),
    savedAt: previous.savedAt || Date.now(),
  };
  return writeJson("localStorage", ORDERS_KEY, [entry, ...others].slice(0, MAX_SAVED_ORDERS));
}

export function forgetOrderLink(orderId) {
  return writeJson("localStorage", ORDERS_KEY, readSavedOrders().filter((o) => o.orderId !== orderId));
}

export const STATUS_LABELS = {
  awaiting_payment: "Awaiting payment",
  submitted: "Receipt submitted",
  approved: "Approved",
  rejected: "Rejected",
};

/* ---------- checkout ---------- */

export function validateEmail(value) {
  const email = String(value || "").trim();
  if (!email) return { ok: false, email, message: "Enter your email so we can send your order links." };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false, email, message: "That email address does not look right." };
  return { ok: true, email, message: "" };
}

/** Same rule as isSafeBuyerName in functions/src/orders/logic.ts: letters, spaces and . , ' hyphen, no links. */
const BUYER_NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u;
const DOT_INSIDE_WORD = /\.[\p{L}\p{M}]/u;

export function validateName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, name, message: "Enter your name so the photographer can match your payment." };
  if (name.length > MAX_BUYER_NAME) return { ok: false, name, message: `Keep your name under ${MAX_BUYER_NAME} characters.` };
  if (!BUYER_NAME_CHARS.test(name) || DOT_INSIDE_WORD.test(name)) {
    return { ok: false, name, message: "Use letters only for your name, with no numbers or links." };
  }
  return { ok: true, name, message: "" };
}

/** Photo ids the server refused, from a createOrders error. */
export function unavailablePhotoIds(error) {
  const ids = error?.details?.unavailablePhotoIds;
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
}

const CHECKOUT_ERRORS = {
  "functions/invalid-argument": "Some details were not accepted. Check your name, email and selection, then try again.",
  "functions/failed-precondition": "A photographer in your cart cannot take payments yet.",
  "functions/resource-exhausted": "You have made many orders in a short time, or have several unpaid orders. Pay or wait for those first, then try again in an hour.",
  "functions/unavailable": "Checkout is unreachable right now. Check your connection and try again.",
  "functions/deadline-exceeded": "Checkout took too long. Check your connection and try again.",
};

/** Turns a createOrders error into a sentence for the page. */
export function checkoutErrorMessage(error) {
  const code = error?.code || "";
  const unavailable = unavailablePhotoIds(error).length;
  if (code === "functions/invalid-argument" && unavailable) {
    return `${plural(unavailable, "photo")} in your cart ${unavailable === 1 ? "is" : "are"} no longer for sale, so we took ${unavailable === 1 ? "it" : "them"} out. Check your cart and try again.`;
  }
  if (code === "functions/failed-precondition" && unavailable) {
    return `${plural(unavailable, "photo")} came from a photographer who has not set up GCash yet, so we took ${unavailable === 1 ? "it" : "them"} out of your cart. Try again later for those, or check out the rest now.`;
  }
  if (CHECKOUT_ERRORS[code]) return CHECKOUT_ERRORS[code];
  return "Something went wrong on our side. Please try again.";
}

/**
 * Creates one order per photographer. Resolves to the created orders, each with a local `href`, and saves
 * every link in "my orders". Throws the callable error on failure.
 */
export async function createOrders({ buyerName, buyerEmail, photoIds }) {
  const call = httpsCallable(functions, "createOrders");
  const { data } = await call({ buyerName, buyerEmail, photoIds });
  if (!Array.isArray(data) || !data.length) {
    throw Object.assign(new Error("No orders were returned."), { code: "functions/internal" });
  }
  return data
    .filter((o) => o && isOrderAccess(o.orderId, o.token))
    .map((o) => {
      const order = {
        orderId: o.orderId,
        token: o.token,
        code: String(o.code || ""),
        photographerName: String(o.photographerName || ""),
        amount: Number(o.amount),
        count: Number(o.count),
        status: "awaiting_payment",
      };
      saveOrderLink(order);
      return { ...order, href: orderPageHref(order.orderId, order.token) };
    });
}
