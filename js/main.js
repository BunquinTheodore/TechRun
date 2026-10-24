// Engine: builds the 24 scenes, fits the stage, maps scroll to film time, draws the overlays.
import { CONTENT as C } from "./content.js";
import { buildAll } from "./scenes/index.js";
import { IDLE_POSE, makePoser, clamp, esc } from "./scenes/util.js";
import { FIELD_BG, LIGHT_FIELDS, rgba } from "./palette.js";

const SCENE_PX = 850;          // scroll px for a 2.5s scene; others scale with duration (clamped)
const HOLD_PX = 600;           // extra scroll a resting frame stays put for
const IRIS_SEC = 0.55;         // length of the scene-to-scene iris
const IRIS_SIZE = 4500;        // iris circle diameter, stage px
const BOOT_GATE = ["biometric-scan", 2.3];
const LANDING = ["name", 1.5];
const GUN_SAFETY_MS = 15000;   // never leave the boot stuck at 97%
const COLOR = FIELD_BG;
const REST_SLUG = "laced-rest";

const $ = (id) => document.getElementById(id);
const stage = $("stage"), viewport = $("viewport"), gunCanvas = $("gun"), starsCanvas = $("stars");
const hud = $("hud"), ammoEl = $("ammo"), actEl = $("act"), cueEl = $("cue"), grainEl = $("grain"), cursorEl = $("cursor");
const pips = [...ammoEl.querySelectorAll("u")];
const coarse = matchMedia("(pointer: coarse)").matches;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
let still = calm.matches;

history.scrollRestoration = "manual";
document.documentElement.classList.add("locked");
window.scrollTo(0, 0);
for (const el of [starsCanvas, gunCanvas, grainEl, cursorEl, hud, cueEl, ammoEl]) el.setAttribute("aria-hidden", "true");

// ---------- shared state ----------
const state = { ...IDLE_POSE, px: -16 };
const P = makePoser(state);
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, sx: 0, sy: 0 };
let clock = 0, gunReal = null, gunReady = false;

// scenes always receive this proxy; it works (returns null) before or without the real shoe
const gunApi = {
  project: (part) => (gunReal ? gunReal.project(part) : null),
  pick: (x, y) => (gunReal ? gunReal.pick(x, y) : null),
  highlight: (part) => gunReal?.highlight(part),
  setVisible: (v) => gunReal?.setVisible(v),
};
const env = { shoe: gunApi, mouse, clock: 0, C };

// ---------- grain ----------
function makeGrain() {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d"), img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainEl.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
  } catch (e) { console.error("grain", e); }
}

// ---------- build scenes ----------
const endField = (s) => (s.turn ? s.turn[1] : s.field === "quad" ? "ink" : s.field);
const startField = (s) => (s.field === "quad" ? "ink" : s.field);
const mountScene = (s) => {
  const root = document.createElement("div");
  root.className = `scene ${s.field}${s.stars && s.field === "ink" ? " starry" : ""}`;
  root.dataset.slug = s.slug;
  if (s.rest) root.dataset.rest = s.rest;
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", s.name);
  root.innerHTML = s.html || "";
  stage.insertBefore(root, gunCanvas);
  return root;
};
function addIris(root, tl, s, next) {
  const el = document.createElement("div");
  el.className = "iris";
  const at = s.irisAt || [960, 540];
  const [x, y] = Array.isArray(at) ? at : [at.x, at.y];
  Object.assign(el.style, {
    left: `${x}px`, top: `${y}px`, width: `${IRIS_SIZE}px`, height: `${IRIS_SIZE}px`,
    margin: `${-IRIS_SIZE / 2}px 0 0 ${-IRIS_SIZE / 2}px`, background: COLOR[startField(next)],
  });
  root.appendChild(el);
  gsap.set(el, { scale: 0.02 });
  tl.fromTo(el, { scale: 0.02 }, { scale: 1, duration: IRIS_SEC, ease: "power3.in", immediateRender: false }, Math.max(0, s.dur - IRIS_SEC));
}

let defs = [];
try { defs = buildAll(C, P); } catch (e) { console.error("scenes", e); }
const scenes = [];
let acc = 0;
defs.forEach((s, i) => {
  const root = mountScene(s);
  const tl = gsap.timeline({ paused: true });
  try { s.anim?.(root, tl, env); } catch (e) { console.error("anim", s.slug, e); }
  const next = defs[i + 1];
  if (next && endField(s) !== startField(next)) addIris(root, tl, s, next);
  tl.set({}, {}, s.dur); // the timeline is exactly as long as the scene
  scenes.push({ ...s, root, tl, t0: acc, field0: startField(s) });
  acc += s.dur;
});
const bySlug = Object.fromEntries(scenes.map((s) => [s.slug, s]));
const TOTAL_T = acc;
const END = Math.max(0, TOTAL_T - 0.001);
const timeOf = (slug, sec = 0) => (bySlug[slug] ? bySlug[slug].t0 + sec : null);
const REST_T = timeOf(...LANDING) ?? END;
const GATE_T = Math.min(REST_T, timeOf(...BOOT_GATE) ?? REST_T);

// ---------- scroll map ----------
const SEG = [];
let totalPx = 0;
const addSeg = (px, t0, t1) => {
  if (px <= 0.5) return;
  SEG.push({ y0: totalPx, y1: totalPx + px, t0, t1 });
  totalPx += px;
};
for (const s of scenes) {
  const a = Math.max(s.t0, REST_T), b = s.t0 + s.dur;
  if (b <= REST_T) continue;
  const len = SCENE_PX * clamp(s.dur / 2.5, 0.8, 1.7) * ((b - a) / s.dur);
  const hold = s.t0 + (s.restAt ?? s.dur * 0.55);
  if (s.rest && hold > a + 0.001 && hold < b - 0.001) {
    const first = (len * (hold - a)) / (b - a);
    addSeg(first, a, hold); addSeg(HOLD_PX, hold, hold); addSeg(len - first, hold, b);
  } else addSeg(len, a, b);
}
function scrollToTime(y) {
  if (!SEG.length) return REST_T;
  const g = SEG.find((x) => y < x.y1) || SEG.at(-1);
  const span = g.y1 - g.y0;
  const p = span > 0 ? clamp((y - g.y0) / span) : 1;
  return Math.min(END, g.t0 + (g.t1 - g.t0) * p);
}
const lenis = new Lenis({ lerp: 0.085, smoothWheel: !still, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
lenis.stop();

// ---------- fit ----------
let view = { s: 1, ox: 0, oy: 0 };
const gunPixelRatio = () => {
  const want = Math.max(1, view.s * devicePixelRatio);
  return coarse ? clamp(want, 0.75, 1.25) : Math.min(2, want);
};
function sizeStars() {
  const w = innerWidth, h = innerHeight, k = Math.min(2, devicePixelRatio);
  starsCanvas.width = Math.round(w * k); starsCanvas.height = Math.round(h * k);
  Object.assign(starsCanvas.style, { width: `${w}px`, height: `${h}px` });
  const want = clamp(Math.round((w * h * 170) / (1920 * 1080)), 60, 320);
  while (stars.length < want) stars.push(makeStar());
  stars.length = want;
  starsK = k;
}
function fit() {
  const w = innerWidth, h = innerHeight, s = Math.min(w / 1920, h / 1080);
  view = { s, ox: (w - 1920 * s) / 2, oy: (h - 1080 * s) / 2 };
  stage.style.transform = `translate(${view.ox}px, ${view.oy}px) scale(${s})`;
  stage.style.setProperty("--k", String(1 / s));
  document.body.style.height = `${h + totalPx}px`;
  sizeStars();
  gunReal?.setPixelRatio(gunPixelRatio());
  measureTrack();
}

// ---------- stars (screen coordinates, pushed by the cursor) ----------
const stars = [];
let starsK = 1, starsWanted = false, starsLastOn = -9;
function makeStar(edge = false) {
  return {
    x: Math.random() * innerWidth, y: edge ? innerHeight + 4 : Math.random() * innerHeight, tx: 0, ty: 0,
    a: 0, ta: 0.1 + Math.random() * 0.6, r: 0.6 + Math.floor(Math.random() * 2),
    dx: (Math.random() - 0.5) * 0.1, dy: (Math.random() - 0.5) * 0.1 - 0.06,
  };
}
const starCtx = starsCanvas.getContext("2d");
function drawStars() {
  if (starsWanted) starsLastOn = clock;
  else if (clock - starsLastOn > 0.7) return;
  const w = innerWidth, h = innerHeight, R = 140;
  starCtx.setTransform(1, 0, 0, 1, 0, 0);
  starCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
  starCtx.setTransform(starsK, 0, 0, starsK, 0, 0);
  for (const p of stars) {
    const dx = p.x + p.tx - mouse.x, dy = p.y + p.ty - mouse.y, d = Math.hypot(dx, dy);
    if (d < R && !still) {
      const f = (((R - d) / R) ** 2) * 25, ang = Math.atan2(dy, dx);
      p.tx += (Math.cos(ang) * f) / 50; p.ty += (Math.sin(ang) * f) / 50;
    } else { p.tx -= p.tx / 50; p.ty -= p.ty / 50; }
    if (!still) { p.x += p.dx; p.y += p.dy; }
    p.a += (p.ta - p.a) * 0.05;
    if (p.x < -4 || p.x > w + 4 || p.y < -4 || p.y > h + 4) Object.assign(p, makeStar(true), { a: 0 });
    starCtx.beginPath();
    starCtx.arc(p.x + p.tx, p.y + p.ty, p.r, 0, Math.PI * 2);
    starCtx.fillStyle = rgba("paper", p.a.toFixed(3));
    starCtx.fill();
  }
}

// ---------- cursor, pointer ----------
const curX = gsap.quickTo(cursorEl, "x", { duration: 0.15, ease: "power2.out" });
const curY = gsap.quickTo(cursorEl, "y", { duration: 0.15, ease: "power2.out" });
gsap.set(cursorEl, { x: mouse.x, y: mouse.y });
const POINTABLE = "a, .chip";
addEventListener("pointermove", (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = (e.clientX / innerWidth) * 2 - 1; mouse.ny = -((e.clientY / innerHeight) * 2 - 1);
  curX(e.clientX); curY(e.clientY);
});
addEventListener("pointerover", (e) => {
  if (e.target.closest?.(POINTABLE)) gsap.to(cursorEl, { scale: 1.9, duration: 0.25, ease: "power3.out", overwrite: "auto" });
});
addEventListener("pointerout", (e) => {
  if (e.target.closest?.(POINTABLE)) gsap.to(cursorEl, { scale: 1, duration: 0.25, ease: "power3.out", overwrite: "auto" });
});

// ---------- kit panel + ring (laced-rest) ----------
const panel = document.createElement("div"), ring = document.createElement("i");
panel.id = "skills"; ring.id = "ring";
panel.setAttribute("role", "status"); panel.setAttribute("aria-live", "polite");
ring.setAttribute("aria-hidden", "true");
document.body.appendChild(panel);
stage.appendChild(ring);
let hovered = null, active = null;
const PART_ORDER = Object.keys(C.kit || {});

function panelHtml(part) {
  const kit = C.kit?.[part];
  if (!kit) return "";
  const n = String(PART_ORDER.indexOf(part) + 1).padStart(2, "0");
  const items = kit.items.map((it, i) => `<li${kit.primary.includes(i) ? ' class="p"' : ""}>${esc(it)}</li>`).join("");
  return `<small><span>Part · ${esc(kit.part)}</span><b>${n}/${String(PART_ORDER.length).padStart(2, "0")}</b></small>` +
    `<strong>${esc(kit.group)}</strong><ul>${items}</ul>`;
}
function placePanel(x, y) {
  const w = panel.offsetWidth, h = panel.offsetHeight, M = 12, G = 24;
  let left = x + G + w <= innerWidth - M ? x + G : x - G - w;
  let top = y + G + h <= innerHeight - M ? y + G : y - G - h;
  left = clamp(left, M, Math.max(M, innerWidth - w - M));
  top = clamp(top, M, Math.max(M, innerHeight - h - M));
  gsap.set(panel, { left, top });
}
function placeRing() {
  if (!hovered) return;
  const pt = gunApi.project(hovered);
  if (pt) gsap.set(ring, { left: pt[0], top: pt[1] });
}
function setHover(part, x, y) {
  if (part !== hovered) {
    hovered = part;
    gunApi.highlight(part);
    for (const c of document.querySelectorAll(".chip[data-part]")) c.classList.toggle("on", !!part && c.dataset.part === part);
    if (part) panel.innerHTML = panelHtml(part);
    gsap.to(panel, { autoAlpha: part ? 1 : 0, y: part || still ? 0 : 8, duration: 0.2, ease: "power2.out", overwrite: "auto" });
    if (part) {
      placeRing();
      gsap.fromTo(ring, { scale: still ? 1 : 1.9, rotation: still ? 0 : -70, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: still ? 0.2 : 0.42, ease: "expo.out", overwrite: true });
    } else gsap.to(ring, { scale: 0.6, opacity: 0, duration: 0.2, ease: "power2.in", overwrite: true });
  }
  if (part && x != null) placePanel(x, y);
}
const inRest = () => active && active.slug === REST_SLUG;
const partUnder = (e) => {
  const chip = e.target.closest?.(".chip[data-part]");
  if (chip) return chip.dataset.part;
  return gunApi.pick(e.clientX, e.clientY);
};
addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" || !inRest()) return;
  setHover(partUnder(e), e.clientX, e.clientY);
});
document.documentElement.addEventListener("pointerleave", () => setHover(null));
let down = null;
addEventListener("pointerdown", (e) => { down = e.pointerType === "mouse" ? null : [e.clientX, e.clientY, e.timeStamp]; });
addEventListener("pointerup", (e) => {
  if (!down || !inRest()) return;
  const [x, y, ts] = down;
  down = null;
  if (Math.hypot(e.clientX - x, e.clientY - y) > 12 || e.timeStamp - ts > 600) return;
  const part = partUnder(e);
  setHover(part === hovered ? null : part, e.clientX, e.clientY);
});
// keyboard: Tab onto a chip opens its panel under it
for (const chip of document.querySelectorAll(".chip[data-part]")) {
  if (chip.tabIndex < 0) chip.tabIndex = 0;
  chip.addEventListener("focus", () => {
    const r = chip.getBoundingClientRect();
    setHover(chip.dataset.part, r.left, r.bottom - 24);
  });
  chip.addEventListener("blur", () => setHover(null));
}

// ---------- plain-text copy ----------
function buildAbout() {
  const el = $("about-text");
  if (!el) return;
  const frag = document.createDocumentFragment();
  const add = (tag, text, parent = frag) => {
    const n = document.createElement(tag);
    n.textContent = text;
    parent.appendChild(n);
    return n;
  };
  const list = (rows) => {
    const ul = document.createElement("ul");
    for (const [label, url] of rows) {
      const li = document.createElement("li");
      if (url) {
        const a = add("a", label, li);
        a.href = url; a.tabIndex = -1;
        if (/^https?:/.test(url)) { a.target = "_blank"; a.rel = "noopener"; }
      } else li.textContent = label;
      ul.appendChild(li);
    }
    frag.appendChild(ul);
  };
  const b = C.brand, o = C.organizer, loc = C.location;
  add("h1", b.title);
  add("p", `${o.line}, ${o.label.toLowerCase()} ${o.name}. ${b.tagline}`);
  add("p", `${loc.city}, ${loc.country} (${loc.tzLabel}). ${loc.venue}. ${o.date}. ${o.edition}.`);
  add("h2", "Distances");
  list(C.categories.map((x) => [`${x.name} ${x.label}: ${x.note}`, x.url]));
  add("h2", "The kit");
  list(Object.values(C.kit).map((k) => [`${k.part} · ${k.group}: ${k.items.join(", ")}`]));
  add("h2", "Highlights");
  list(C.highlights.map((x) => [`${x.name} · ${x.category}`, x.url]));
  add("h2", "Race kits");
  list(C.showcases.map((x) => [`${x.title.join(" ")}: ${x.pitch} (${x.stack})`, x.links?.[0]?.[1]]));
  add("h2", "Partners");
  list(C.partners.map((x) => [`${x.title}, ${x.issuer}`, x.url]));
  add("h2", "Contact");
  list(C.contact.links.map((l) => [`${l.label}: ${l.value}`, l.url]));
  add("p", C.contact.footer);
  el.replaceChildren(frag);
}

// ---------- pixel runner: rides #track along the bottom, positioned by film progress ----------
const CAST = ["cyber", "hoodie", "cap"];   // acts 00-02, 03-05, 06-08
const ACTS_PER_RUNNER = 3;
const RUN_ON = 1300, RUN_OFF = 520;        // smoothed scroll speed (px/s): walk -> run above ON, back below OFF
const GAIT_HOLD = 0.35;                    // s a gait must be wanted before it switches (no flicker)
const VEL_RATE = 7;                        // 1/s velocity smoothing
const FACE_MIN = 160;                      // px/s before the runner turns to face the scroll direction
const track = document.createElement("div"), trackFill = document.createElement("i"), runner = document.createElement("div");
track.id = "track"; runner.id = "runner";
track.appendChild(trackFill);
const sprites = {};
for (const who of CAST) {
  for (const gait of ["walk", "run"]) {
    const src = C.assets?.runners?.[who]?.[gait];
    if (!src) continue;
    const img = new Image();
    img.alt = ""; img.decoding = "async"; img.draggable = false; img.src = src; // preloads all six
    runner.appendChild(img);
    sprites[`${who}-${gait}`] = img;
  }
}
for (const el of [track, runner]) { el.setAttribute("aria-hidden", "true"); document.body.appendChild(el); }
const rs = { v: 0, lastY: null, gait: "walk", want: "walk", wantFor: 0, face: 1, faceShown: null, key: "", shown: null, x: null, p: null, left: 0, span: 0 };

// the longest act label sets where the track ends, so the runner never reaches #act
function measureTrack() {
  const acts = [...new Set(scenes.map((s) => s.act).filter(Boolean))], keep = actEl.textContent;
  let w = 0;
  for (const a of acts) { actEl.textContent = a; w = Math.max(w, actEl.offsetWidth); }
  actEl.textContent = keep;
  document.documentElement.style.setProperty("--act-w", `${Math.ceil(w)}px`);
  const r = track.getBoundingClientRect();
  rs.left = r.left; rs.span = Math.max(0, r.width - runner.offsetWidth);
  rs.x = rs.p = null;
}
const castFor = (act) => {
  const n = parseInt(act, 10);
  return CAST[clamp(Math.floor((Number.isFinite(n) ? n : 0) / ACTS_PER_RUNNER), 0, CAST.length - 1)];
};
function updateRunner(dt, cueOn) {
  const s = active;
  const visible = !!s && !autoplay && !cueOn && s.field !== "quad";
  if (visible !== rs.shown) { runner.classList.toggle("on", visible); track.classList.toggle("on", visible); rs.shown = visible; }
  // smoothed scroll velocity (px/s); decays to zero while the film is not under the scroll's control
  const y = lenis.scroll;
  const raw = !autoplay && !frozen && rs.lastY != null && dt > 0 ? (y - rs.lastY) / dt : 0;
  rs.lastY = autoplay || frozen ? null : y;
  rs.v += (raw - rs.v) * (1 - Math.exp(-dt * VEL_RATE));
  const speed = Math.abs(rs.v);
  const want = rs.gait === "walk" ? (speed > RUN_ON ? "run" : "walk") : (speed < RUN_OFF ? "walk" : "run");
  rs.wantFor = want === rs.want ? rs.wantFor + dt : 0;
  rs.want = want;
  if (want !== rs.gait && rs.wantFor >= GAIT_HOLD * (want === "run" ? 0.4 : 1)) rs.gait = want;
  if (rs.v > FACE_MIN) rs.face = 1; else if (rs.v < -FACE_MIN) rs.face = -1;
  if (!s) return;
  const key = `${castFor(s.act)}-${rs.gait}`;
  if (key !== rs.key && sprites[key]) {
    sprites[rs.key]?.classList.remove("on");
    sprites[key].classList.add("on");
    runner.classList.toggle("run", rs.gait === "run");
    rs.key = key;
  }
  const p = TOTAL_T > 0 ? clamp(t / TOTAL_T) : 0;
  const x = Math.round(rs.left + p * rs.span);
  if (x !== rs.x || rs.face !== rs.faceShown) {
    runner.style.transform = `translate3d(${x}px, 0, 0) scaleX(${rs.face})`;
    rs.x = x; rs.faceShown = rs.face;
  }
  if (Math.abs(p - (rs.p ?? -1)) > 0.0005) { trackFill.style.transform = `scaleX(${p.toFixed(4)})`; rs.p = p; }
}

// ---------- film time ----------
let t = 0, autoplay = true, frozen = false;
let lastAmmo = -1, lastAct = null, lastGunVis = null, lastField = null, lastTone = null, starsOpacity = null;

function fieldAt(s, st) {
  let f = s.field0;
  if (s.turn && st >= s.turn[0]) f = s.turn[1];
  return f;
}
function show(time) {
  const idx = scenes.findIndex((s) => time >= s.t0 && time < s.t0 + s.dur);
  const s = scenes[idx < 0 ? scenes.length - 1 : idx];
  if (s !== active) {
    active?.root.classList.remove("on");
    s.root.classList.add("on");
    active = s;
    if (s.slug !== REST_SLUG && hovered) setHover(null);
  }
  const st = clamp(time - s.t0, 0, s.dur);
  s.tl.totalTime(st, false);

  const f = fieldAt(s, st);
  const next = scenes[scenes.indexOf(s) + 1];
  const bgField = next && st > s.dur - 0.25 && endField(s) !== startField(next) ? startField(next) : f;
  if (bgField !== lastField) { viewport.style.backgroundColor = COLOR[bgField]; lastField = bgField; }
  const tone = `${LIGHT_FIELDS.has(f)}|${s.field === "quad"}`;
  if (tone !== lastTone) {
    lastTone = tone;
    for (const el of [hud, ammoEl, actEl]) {
      el.classList.toggle("light", LIGHT_FIELDS.has(f));
      el.classList.toggle("off", s.field === "quad");
    }
    track.classList.toggle("light", LIGHT_FIELDS.has(f));
    runner.classList.toggle("light", LIGHT_FIELDS.has(f));
  }
  const wantStars = f === "ink" && !!(s.stars || (s.turn && s.turn[1] === "ink"));
  starsWanted = wantStars;
  if (starsOpacity !== wantStars) { starsCanvas.style.opacity = wantStars ? "1" : "0"; starsOpacity = wantStars; }

  const ammo = clamp(Math.round(s.ammo || 0), 0, pips.length);
  if (ammo !== lastAmmo) { pips.forEach((u, i) => u.classList.toggle("on", i < ammo)); lastAmmo = ammo; }
  if (s.act !== lastAct) { actEl.textContent = s.act || ""; lastAct = s.act; }
  const gv = !!s.shoe;
  if (gv !== lastGunVis) { gunCanvas.style.visibility = gv ? "" : "hidden"; gunReal?.setVisible(gv); lastGunVis = gv; }

  env.clock = clock;
  if (s.tick) {
    try { s.tick(s.root, st, env); } catch (e) { console.error("tick", s.slug, e); s.tick = null; }
  }
  if (gunReal && gv) {
    try {
      gunReal.render({ sway: still ? [0, 0] : [mouse.sy * -0.2, mouse.sx * 0.2], light: [mouse.sx * 2.2, mouse.sy * 1.2], t: clock });
    } catch (e) { console.error("gun render", e); gunReal = null; }
  }
  placeRing();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  const k = 1 - Math.exp(-dt * 6);
  mouse.sx += (mouse.nx - mouse.sx) * k; mouse.sy += (mouse.ny - mouse.sy) * k;
  if (frozen) {
    // held by __seek
  } else if (autoplay) {
    const cap = gunReady ? REST_T : GATE_T;
    t = still && gunReady ? REST_T : Math.min(t + dt, cap);
    if (t >= REST_T) {
      autoplay = false;
      document.documentElement.classList.remove("locked");
      lenis.start();
      lenis.scrollTo(0, { immediate: true });
    }
  } else {
    lenis.raf(now);
    t = scrollToTime(lenis.scroll);
  }
  const cueOn = !autoplay && !frozen && t < REST_T + 0.15;
  cueEl.classList.toggle("on", cueOn);
  show(t);
  updateRunner(dt, cueOn);
  drawStars();
  requestAnimationFrame(frame);
}

calm.addEventListener("change", () => {
  still = calm.matches;
  lenis.options.smoothWheel = !still;
});

// debug: freeze the loop on a scene time, e.g. __seek("blast", 2)
window.__seek = (slug, sec = 0) => {
  const time = typeof slug === "number" ? slug : timeOf(slug, sec);
  if (time == null) return null;
  frozen = true; autoplay = false;
  t = clamp(time, 0, END);
  show(t); updateRunner(0, false); drawStars();
  return { t, gunReady, shot: active.slug };
};
window.__shots = scenes;

// ---------- boot ----------
async function loadGun() {
  if (!scenes.some((s) => s.shoe)) { gunReady = true; return; } // no 3D scenes in this cut: skip three.js entirely
  try {
    const { mountShoe } = await import("./shoe.js");
    gunReal = await mountShoe(gunCanvas, state, { pixelRatio: gunPixelRatio(), interactive: !coarse });
    gunReal?.setVisible(!!active?.shoe);
  } catch (e) {
    console.error("3D layer", e);
    gunReal = null;
  } finally {
    gunReady = true;
  }
}

makeGrain();
buildAbout();
viewport.insertBefore(starsCanvas, stage); // stars sit between the field colour and the (transparent) starry scenes
stage.style.zIndex = "2";
fit();
addEventListener("resize", fit);
loadGun();
setTimeout(() => { gunReady = true; }, GUN_SAFETY_MS);
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  fit();
  last = performance.now();
  requestAnimationFrame(frame);
});
