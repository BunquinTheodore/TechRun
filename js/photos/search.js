// Runner photo search (photos/index.html): bib search, watermarked grid, lightbox, cart and checkout.
// Reads only public data: events/{id} and photos where bibs array-contains the bib. Checkout calls createOrders,
// which splits the cart into one GCash order per photographer (PHP 150 per photo).
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { db, storage, EVENT_ID, IS_CONFIGURED, USING_EMULATORS } from "./firebase.js";
import {
  CONTACT_EMAIL, MAX_PHOTOS_PER_ORDER, PRICE_PER_PHOTO, STATUS_LABELS, el, setNote, plural, formatPeso, createCart,
  validateEmail, validateName, createOrders, checkoutErrorMessage, unavailablePhotoIds, readSavedOrders,
  orderPageHref, forgetOrderLink,
} from "./checkout.js";

/** Bib format accepted by the form. TBA: must match functions/src/config.ts BIB_PATTERN once confirmed. */
const BIB_PATTERN = /^\d{3,5}$/;
const PAGE_SIZE = 48;
const TIME_ZONE = "Asia/Manila";

const $ = (id) => document.getElementById(id);
const ui = {
  form: $("search-form"), bib: $("bib"), bibError: $("bib-error"), searchBtn: $("search-btn"),
  eventField: $("event-field"), event: $("event"), setup: $("setup-note"),
  status: $("status"), grid: $("grid"), moreRow: $("more-row"), moreBtn: $("more-btn"),
  checkout: $("checkout"), groups: $("cart-groups"), checkoutNote: $("checkout-note"),
  checkoutForm: $("checkout-form"), name: $("buyer-name"), nameError: $("name-error"),
  email: $("email"), emailError: $("email-error"), buySelected: $("buy-selected"),
  created: $("created"), createdList: $("created-list"), myOrders: $("my-orders"), myOrdersList: $("my-orders-list"),
  cart: $("cart"), cartCount: $("cart-count"), cartTotal: $("cart-total"), cartSplit: $("cart-split"),
  cartClear: $("cart-clear"), cartCheckout: $("cart-checkout"),
  lb: $("lightbox"), lbTitle: $("lb-title"), lbImg: $("lb-img"), lbCaption: $("lb-caption"),
  lbClose: $("lb-close"), lbPrev: $("lb-prev"), lbNext: $("lb-next"), lbPick: $("lb-pick"),
};

const state = {
  events: [], eventId: EVENT_ID,
  bib: "", photos: [], lastDoc: null, hasMore: false, loading: false, seq: 0, busy: false,
};
let cart = createCart(EVENT_ID, renderCart);

/* ---------- formatting ---------- */

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const toDate = (ts) => (ts && typeof ts.toDate === "function" ? ts.toDate() : null);
const photoTime = (photo) => {
  const date = toDate(photo.takenAt) || toDate(photo.uploadedAt);
  return date ? timeFormat.format(date) : "";
};
const canPick = () => true;

export function normaliseBib(value) {
  return String(value || "").trim().replace(/^#/, "").replace(/[\s-]+/g, "").toUpperCase();
}

/* ---------- storage URLs (thumbs/ and previews/ are public read) ---------- */

const urlCache = new Map();
function storageUrl(path) {
  if (!path) return Promise.reject(new Error("missing path"));
  if (!urlCache.has(path)) {
    const pending = getDownloadURL(ref(storage, path));
    pending.catch(() => urlCache.delete(path));
    urlCache.set(path, pending);
  }
  return urlCache.get(path);
}

function loadImage(img, path, fallbackLabel) {
  storageUrl(path)
    .then((url) => { img.src = url; })
    .catch(() => { img.alt = fallbackLabel; img.closest(".ph-card")?.classList.add("broken"); });
}

/* ---------- events ---------- */

async function loadEvents() {
  try {
    const snap = await getDocs(collection(db, "events"));
    state.events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    state.events = [];
  }
  const wanted = new URLSearchParams(location.search).get("event");
  const ids = state.events.map((e) => e.id);
  state.eventId = ids.includes(wanted) ? wanted : ids.includes(EVENT_ID) || !ids.length ? EVENT_ID : ids[0];
  if (state.events.length > 1) {
    ui.event.replaceChildren(...state.events.map((e) =>
      el("option", { value: e.id, selected: e.id === state.eventId }, e.name || e.id)));
    ui.eventField.hidden = false;
  }
  applyEvent();
}

function applyEvent() {
  cart = createCart(state.eventId, renderCart);
  renderCart();
}

/* ---------- search ---------- */

function showBibError(message) {
  setNote(ui.bibError, message, "warn");
  ui.bib.setAttribute("aria-invalid", message ? "true" : "false");
}

function setStatus(children, { error = false } = {}) {
  ui.status.replaceChildren(...[].concat(children));
  ui.status.classList.toggle("ph-hidden", !children || (Array.isArray(children) && !children.length));
  ui.status.setAttribute("role", error ? "alert" : "status");
}

async function runSearch(rawBib) {
  const bib = normaliseBib(rawBib);
  ui.bib.value = bib;
  if (!bib) return showBibError("Enter the number printed on your bib.");
  if (!BIB_PATTERN.test(bib)) return showBibError("Bib numbers are 3 to 5 digits. Check the number on your bib.");
  showBibError("");

  const url = new URL(location.href);
  url.searchParams.set("bib", bib);
  if (state.events.length > 1) url.searchParams.set("event", state.eventId);
  history.replaceState(null, "", url);

  Object.assign(state, { bib, photos: [], lastDoc: null, hasMore: false, seq: state.seq + 1 });
  ui.grid.replaceChildren();
  await fetchPage();
}

async function fetchPage() {
  const seq = state.seq;
  state.loading = true;
  ui.searchBtn.disabled = true;
  ui.moreBtn.disabled = true;
  ui.grid.setAttribute("aria-busy", "true");
  if (!state.photos.length) setStatus(`Searching for bib ${state.bib}...`);

  // Filtered on the server so paging and the empty state only count photos a buyer can actually see.
  const constraints = [where("bibs", "array-contains", state.bib), where("status", "==", "tagged")];
  if (state.events.length > 1) constraints.push(where("eventId", "==", state.eventId));
  constraints.push(orderBy("takenAt", "desc"), limit(PAGE_SIZE));
  if (state.lastDoc) constraints.push(startAfter(state.lastDoc));

  try {
    const snap = await getDocs(query(collection(db, "photos"), ...constraints));
    if (seq !== state.seq) return;
    const fresh = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.thumbPath);
    state.lastDoc = snap.docs[snap.docs.length - 1] || state.lastDoc;
    state.hasMore = snap.docs.length === PAGE_SIZE;
    const start = state.photos.length;
    state.photos = [...state.photos, ...fresh];
    ui.grid.append(...fresh.map((p, i) => renderCard(p, start + i)));
    renderResultsStatus();
  } catch (error) {
    if (seq !== state.seq) return;
    renderSearchError(error);
  } finally {
    if (seq === state.seq) {
      state.loading = false;
      ui.searchBtn.disabled = false;
      ui.moreBtn.disabled = false;
      ui.grid.removeAttribute("aria-busy");
      ui.moreRow.classList.toggle("ph-hidden", !state.hasMore);
      renderCheckout();
    }
  }
}

function renderResultsStatus() {
  const n = state.photos.length;
  if (n) {
    setStatus(el("span", {}, el("strong", {}, `${state.hasMore ? `${n}+` : n} ${n === 1 ? "photo" : "photos"}`),
      ` of bib ${state.bib}, newest first.`, canPick() ? " Tap the circle on a photo to select it." : ""));
    ui.status.className = "ph-label";
    return;
  }
  ui.status.className = "ph-empty";
  setStatus(el("span", {},
    el("strong", {}, `No photos of bib ${state.bib} yet.`), el("br"),
    "Photos appear here as soon as they are processed, so check back later. Think we missed you? Email ",
    el("a", { href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`TechRun 2027 photos for bib ${state.bib}`)}` }, CONTACT_EMAIL),
    "."));
}

function renderSearchError(error) {
  ui.status.className = "ph-note warn";
  const offline = error?.code === "unavailable" || !navigator.onLine;
  setStatus(el("span", {},
    offline ? "We could not reach the photo library. Check your connection. " : "Something went wrong while searching. ",
    el("button", { class: "ph-btn small", type: "button", onclick: () => fetchPage() }, "Try again")),
  { error: true });
}

/* ---------- grid ---------- */

function renderCard(photo, index) {
  const time = photoTime(photo);
  const credit = photo.photographerCredit || "";
  const label = `Open photo ${index + 1}${time ? `, taken ${time}` : ""}${credit ? `, by ${credit}` : ""}`;
  const img = el("img", { alt: `Watermarked race photo of bib ${state.bib}`, loading: "lazy", decoding: "async",
    width: photo.width && photo.height ? 400 : null, height: photo.width && photo.height ? Math.round(400 * photo.height / photo.width) : null });
  loadImage(img, photo.thumbPath, "Preview unavailable");

  const card = el("li", { class: `ph-card${cart.has(photo.id) ? " selected" : ""}`, "data-id": photo.id },
    el("button", { type: "button", "aria-label": label, onclick: () => openLightbox(index) }, img),
    el("div", { class: "meta" }, el("span", {}, time), el("span", {}, credit)));
  if (canPick()) {
    card.append(el("button", {
      // inline size: photos.css also styles every direct child button of .ph-card as a full width block
      type: "button", class: "pick", style: "width:auto;height:auto;padding:0", "aria-pressed": String(cart.has(photo.id)),
      "aria-label": `Select photo ${index + 1}`, onclick: () => togglePick(photo),
    }, cart.has(photo.id) ? "✓" : "+"));
  }
  return card;
}

function togglePick(photo) {
  const before = cart.has(photo.id);
  const after = cart.toggle(photo);
  if (!before && !after) {
    setNote(ui.checkoutNote, `You can check out up to ${MAX_PHOTOS_PER_ORDER} photos at a time. Create these orders first, then pick more.`, "warn");
  }
  syncPicks();
}

function syncPicks() {
  for (const card of ui.grid.children) {
    const on = cart.has(card.dataset.id);
    card.classList.toggle("selected", on);
    const pick = card.querySelector(".pick");
    if (pick) { pick.setAttribute("aria-pressed", String(on)); pick.textContent = on ? "✓" : "+"; }
  }
  if (!ui.lb.hidden) renderLightbox();
}

/* ---------- cart and checkout ---------- */

function renderCart() {
  if (!cart || !ui.cart) return;
  const n = cart.count();
  const groups = cart.groups();
  ui.cart.classList.toggle("ph-hidden", n === 0);
  ui.cartCount.textContent = `${plural(n, "photo")} selected`;
  ui.cartTotal.textContent = formatPeso(cart.total());
  ui.cartSplit.textContent = groups.length > 1 ? `${groups.length} photographers, paid separately` : "";
  renderCheckout();
}

function thumbFor(item) {
  const img = el("img", { alt: "", loading: "lazy", decoding: "async", width: 96, height: 64 });
  if (item.thumbPath) loadImage(img, item.thumbPath, "Preview unavailable");
  return img;
}

function renderGroup(group, index) {
  const name = group.credit || `Photographer ${index + 1}`;
  return el("div", { class: "ph-group" },
    el("div", { class: "ph-group-head" },
      el("span", { class: "who" }, name),
      el("span", { class: "sum" }, `${plural(group.photos.length, "photo")} x ${formatPeso(PRICE_PER_PHOTO)} = `,
        el("strong", {}, formatPeso(group.subtotal)))),
    el("ul", { class: "ph-group-photos", "aria-label": `Photos by ${name}` },
      group.photos.map((item, i) => el("li", {},
        thumbFor(item),
        el("button", {
          type: "button", class: "remove", "aria-label": `Remove photo ${i + 1} by ${name}`,
          onclick: () => { cart.remove([item.id]); syncPicks(); },
        }, "Remove")))));
}

function renderCheckout() {
  const n = cart.count();
  const visible = n > 0 || state.photos.length > 0;
  ui.checkout.classList.toggle("ph-hidden", !visible);
  if (!visible) return;

  const groups = cart.groups();
  ui.groups.replaceChildren(...(n
    ? [...groups.map(renderGroup),
      el("div", { class: "ph-group-total" },
        el("span", {}, groups.length > 1 ? `Total for ${groups.length} orders` : "Total"),
        el("strong", {}, formatPeso(cart.total())))]
    : [el("p", { class: "ph-note" }, "Tap the circle on a photo to add it to your cart.")]));

  ui.buySelected.disabled = state.busy || n === 0;
  ui.buySelected.textContent = n === 0 ? "Create my orders"
    : groups.length > 1 ? `Create ${groups.length} orders for ${formatPeso(cart.total())}`
      : `Create order for ${formatPeso(cart.total())}`;
}

function setFieldError(input, node, message) {
  setNote(node, message, "warn");
  input.setAttribute("aria-invalid", message ? "true" : "false");
}

async function checkout() {
  if (state.busy || cart.count() === 0) return;
  const name = validateName(ui.name.value);
  const email = validateEmail(ui.email.value);
  setFieldError(ui.name, ui.nameError, name.message);
  setFieldError(ui.email, ui.emailError, email.message);
  if (!name.ok) { ui.name.focus(); return; }
  if (!email.ok) { ui.email.focus(); return; }

  state.busy = true;
  ui.checkout.setAttribute("aria-busy", "true");
  renderCheckout();
  setNote(ui.checkoutNote, "Creating your orders...", "");
  try {
    const orders = await createOrders({ buyerName: name.name, buyerEmail: email.email, photoIds: cart.ids() });
    cart.clear();
    syncPicks();
    setNote(ui.checkoutNote, "", "");
    renderCreated(orders);
  } catch (error) {
    const refused = unavailablePhotoIds(error);
    if (refused.length) { cart.remove(refused); syncPicks(); }
    setNote(ui.checkoutNote, checkoutErrorMessage(error), "warn");
  } finally {
    state.busy = false;
    ui.checkout.removeAttribute("aria-busy");
    renderCheckout();
    renderMyOrders();
  }
}

/* ---------- order links ---------- */

function orderRow(order, { showStatus = false, onForget = null } = {}) {
  const href = order.href || orderPageHref(order.orderId, order.token);
  const facts = [
    Number.isFinite(order.count) ? plural(order.count, "photo") : "",
    Number.isFinite(order.amount) ? formatPeso(order.amount) : "",
    showStatus && STATUS_LABELS[order.status] ? STATUS_LABELS[order.status] : "",
  ].filter(Boolean).join(". ");
  return el("li", { class: "ph-order-row" },
    el("div", { class: "info" },
      el("span", { class: "code" }, order.code || "Order"),
      el("span", { class: "who" }, order.photographerName ? `Pay ${order.photographerName}` : "Photographer"),
      facts ? el("span", { class: "facts" }, facts) : null),
    el("div", { class: "ph-row" },
      el("a", { class: "ph-btn small primary", href }, "Open order"),
      onForget ? el("button", {
        class: "ph-btn small", type: "button", onclick: onForget,
        "aria-label": `Remove ${order.code || "this order"} from this device`,
      }, "Hide") : null));
}

function renderCreated(orders) {
  ui.createdList.replaceChildren(...orders.map((o) => orderRow(o)));
  ui.created.classList.remove("ph-hidden");
  ui.created.scrollIntoView({ block: "start" });
  ui.created.focus({ preventScroll: true });
}

function renderMyOrders() {
  const saved = readSavedOrders();
  ui.myOrders.classList.toggle("ph-hidden", saved.length === 0);
  ui.myOrdersList.replaceChildren(...saved.map((o) => orderRow(o, {
    showStatus: true,
    onForget: () => { forgetOrderLink(o.orderId); renderMyOrders(); },
  })));
}

/* ---------- lightbox ---------- */

const lb = { index: 0, returnFocus: null };
const outside = () => [document.querySelector(".ph-header"), document.querySelector("main"),
  document.querySelector(".ph-footer"), ui.cart].filter(Boolean);

function openLightbox(index) {
  lb.index = index;
  lb.returnFocus = document.activeElement;
  ui.lb.hidden = false;
  outside().forEach((node) => node.setAttribute("inert", ""));
  document.documentElement.style.overflow = "hidden";
  renderLightbox();
  ui.lbClose.focus();
}

function closeLightbox() {
  ui.lb.hidden = true;
  ui.lbImg.removeAttribute("src");
  outside().forEach((node) => node.removeAttribute("inert"));
  document.documentElement.style.overflow = "";
  const card = ui.grid.children[lb.index]?.querySelector("button");
  (card || lb.returnFocus)?.focus?.();
}

function renderLightbox() {
  const photo = state.photos[lb.index];
  if (!photo) return closeLightbox();
  const total = state.photos.length;
  const time = photoTime(photo);
  ui.lbTitle.textContent = `Photo ${lb.index + 1} of ${state.hasMore ? `${total}+` : total}`;
  ui.lbImg.alt = `Watermarked preview of race photo ${lb.index + 1}, bib ${state.bib}`;
  ui.lbImg.removeAttribute("src");
  const shownIndex = lb.index;
  storageUrl(photo.previewPath || photo.thumbPath)
    .then((url) => { if (!ui.lb.hidden && lb.index === shownIndex) ui.lbImg.src = url; })
    .catch(() => { ui.lbCaption.textContent = "This preview could not be loaded. Try again in a moment."; });
  ui.lbCaption.textContent = [time && `Taken ${time}.`, photo.photographerCredit && `Photo by ${photo.photographerCredit}.`]
    .filter(Boolean).join(" ");
  ui.lbPrev.disabled = lb.index === 0;
  ui.lbNext.disabled = lb.index >= total - 1;
  const on = cart.has(photo.id);
  ui.lbPick.classList.toggle("ph-hidden", !canPick());
  ui.lbPick.setAttribute("aria-pressed", String(on));
  ui.lbPick.textContent = on ? "Selected" : "Select";
}

function stepLightbox(delta) {
  const next = lb.index + delta;
  if (next < 0 || next >= state.photos.length) return;
  lb.index = next;
  renderLightbox();
}

function onLightboxKey(event) {
  if (ui.lb.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeLightbox(); return; }
  if (event.key === "ArrowLeft") { event.preventDefault(); stepLightbox(-1); return; }
  if (event.key === "ArrowRight") { event.preventDefault(); stepLightbox(1); return; }
  if (event.key !== "Tab") return;
  const focusable = [...ui.lb.querySelectorAll("button")].filter((b) => !b.disabled && !b.classList.contains("ph-hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  else if (!ui.lb.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
}

/* ---------- wiring ---------- */

function wire() {
  ui.form.addEventListener("submit", (e) => { e.preventDefault(); runSearch(ui.bib.value); });
  ui.bib.addEventListener("input", () => { if (ui.bib.getAttribute("aria-invalid") === "true") showBibError(""); });
  ui.event.addEventListener("change", () => {
    state.eventId = ui.event.value;
    applyEvent();
    if (state.bib) runSearch(state.bib);
  });
  ui.moreBtn.addEventListener("click", () => { if (!state.loading) fetchPage(); });
  ui.checkoutForm.addEventListener("submit", (e) => { e.preventDefault(); checkout(); });
  ui.name.addEventListener("input", () => {
    if (ui.name.getAttribute("aria-invalid") === "true") setFieldError(ui.name, ui.nameError, "");
  });
  ui.email.addEventListener("input", () => {
    if (ui.email.getAttribute("aria-invalid") === "true") setFieldError(ui.email, ui.emailError, "");
  });
  ui.cartClear.addEventListener("click", () => { cart.clear(); syncPicks(); });
  ui.cartCheckout.addEventListener("click", () => {
    ui.checkout.scrollIntoView({ block: "start" });
    ui.name.focus({ preventScroll: true });
  });
  // Another tab (for example an order page) may add or update saved orders.
  window.addEventListener("storage", (e) => { if (!e.key || e.key.includes("myorders")) renderMyOrders(); });
  ui.lbClose.addEventListener("click", closeLightbox);
  ui.lbPrev.addEventListener("click", () => stepLightbox(-1));
  ui.lbNext.addEventListener("click", () => stepLightbox(1));
  ui.lbPick.addEventListener("click", () => { const p = state.photos[lb.index]; if (p) togglePick(p); });
  ui.lb.addEventListener("click", (e) => { if (e.target === ui.lb || e.target.tagName === "FIGURE") closeLightbox(); });
  document.addEventListener("keydown", onLightboxKey);
}

async function init() {
  wire();
  if (!IS_CONFIGURED && !USING_EMULATORS) {
    setNote(ui.setup, "Photo search is not live yet. Photos go up after race day; please check back then.", "warn");
    ui.bib.disabled = true;
    ui.searchBtn.disabled = true;
    setStatus("");
    return;
  }
  renderMyOrders();
  await loadEvents();
  const params = new URLSearchParams(location.search);
  const bib = params.get("bib");
  if (bib) await runSearch(bib);
  else ui.bib.focus();
}

init();
