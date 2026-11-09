// Scenes 20-24: highlights-rest, showcase-1, showcase-2, partners-rest, blast.
import { pad, q, qa, esc, count, linkAttrs } from "./util.js";
import { PALETTE, GRADIENT_STOPS, LIGHT_FIELDS } from "../palette.js";
import { PORTRAIT, SW, DH, lay } from "../stage.js";

const ACT_HL = "04 · Highlights";
const ACT_KITS = "03 · Race Kit";
const ACT_PARTNERS = "07 · Partners";
const ACT_REGISTER = "05 · Register";
// touch screens (no hover): the hint copy says "tap" / "hold" instead of "hover"
const TOUCH = typeof matchMedia === "function" && matchMedia("(hover: none)").matches;

const ARROW = (px = 34) =>
  `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" aria-hidden="true"><path d="M5 19L19 5M8 5h11v11"/></svg>`;
const scope = (slug) => `.scene[data-slug="${slug}"]`;
const maskLine = (inner, cls = "") => `<span class="mask"><span class="${cls}">${inner}</span></span>`;
const photoSrc = (C, key) => (C.assets.photos[key] || key);
const isSprite = (src) => /\.png$/i.test(src);
const gradDefs = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${GRADIENT_STOPS.map((c, i) =>
  `<stop offset="${(i / (GRADIENT_STOPS.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("")}</linearGradient></defs>`;

// shared pieces (eyebrow, label, live dot); `S` is the scene scope selector
const baseCss = (S) => `
${S} .hl-eb{position:absolute;display:flex;align-items:center;gap:19px;font:700 20px/1 var(--mono);letter-spacing:.34em;text-transform:uppercase;white-space:nowrap;color:var(--lime)}
${S}.lime .hl-eb,${S}.cyan .hl-eb,${S}.orange .hl-eb,${S}.paper .hl-eb{color:var(--ink)}
${S} .hl-lab{position:absolute;font:700 20px/1 var(--mono);letter-spacing:.3em;text-transform:uppercase;white-space:nowrap}
${S} .hl-dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:currentColor;margin-right:14px;vertical-align:1px}${PORTRAIT ? `
${S} .hl-eb{font-size:28px}
${S} .hl-lab{font-size:28px}` : ""}`;

/* ---------------- scene 20: highlights-rest ---------------- */
// hold this long on a touch card to open its preview instead of following the link
const LONG_PRESS_MS = 400;
const PRESS_SLOP = 10;   // px a finger may drift before the press counts as a scroll

function highlightsRest(C) {
  const S = scope("highlights-rest");
  const list = C.highlights, n = list.length;
  // desktop: header over one row of tall poster cards; portrait: stacked header over a 2x2 grid
  const G = lay(
    { cols: 4, gap: 40, x: 100, w: 400, y0: 336, yEnd: 976, eb: [100, 96], tag: "right:100px;top:100px", head: [146, 136], rule: [300, 1720],
      pv: { w: 520, h: 480 } },
    { cols: 2, gap: 20, x: 90, w: 440, y0: 278, yEnd: 1390, eb: [90, 30], tag: "left:90px;top:76px", head: [114, 112], rule: [250, 900],
      pv: { w: 760, h: 720 } },
  );
  const { cols: COLS, gap: GAP, x: X0, w: W, y0: Y0, yEnd: YEND } = G;
  const rows = Math.ceil(n / COLS), H = Math.floor((YEND - Y0 - GAP * (rows - 1)) / rows);
  const cards = list.map((p, i) => {
    const l = X0 + (i % COLS) * (W + GAP), t = Y0 + Math.floor(i / COLS) * (H + GAP);
    const src = photoSrc(C, p.img), sprite = p.sprite || isSprite(src);
    return `<a class="hl-card f-${esc(p.field || "ink")}" ${linkAttrs(p.url)} aria-label="${esc(p.name)}: ${esc(p.category)}"
        data-name="${esc(p.name)}" data-cat="${esc(p.category)}" data-full="${esc(src)}" data-sprite="${sprite ? 1 : 0}"
        style="left:${l}px;top:${t}px;width:${W}px;height:${H}px">
      <span class="hl-ph${sprite ? " sp" : ""}"><img class="${sprite ? "sprite" : "photo"}" src="${esc(src)}" alt=""></span>
      <span class="hl-top"><span>${pad(i + 1)}</span><span>${esc(p.category)}</span></span>
      <span class="hl-nm">${esc(p.name)}</span>
      <span class="hl-ar">${ARROW(36)}</span></a>`;
  }).join("");
  const PV = G.pv;
  return {
    slug: "highlights-rest", name: "Highlights", act: ACT_HL, field: "cyan", dur: 2.0, stars: false,
    // rests almost at once: one scroll lands here and the card intro then plays by itself (time based, not scrubbed)
    turn: null, rest: TOUCH ? "hold a card to preview, tap to open" : "hover a card to preview, click to open", restAt: 0.3, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-card{position:absolute;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;padding:0 24px 22px;border:3px solid var(--ink);
  text-decoration:none;overflow:hidden;transition:background-color .2s,color .2s,box-shadow .2s;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
${S} .hl-card.f-ink{background:var(--ink);color:var(--paper)}
${S} .hl-card.f-paper{background:var(--paper);color:var(--ink)}
${S} .hl-card.f-lime{background:var(--lime);color:var(--ink)}
${S} .hl-card.f-orange{background:var(--orange);color:var(--ink)}
${S} .hl-card.f-cyan{background:transparent;color:var(--ink)}
${S} .hl-card:hover,${S} .hl-card:focus-visible,${S} .hl-card.pv-on{background:var(--ink);color:var(--paper);box-shadow:10px 10px 0 rgba(var(--ink-rgb),.55)}
${S} .hl-card.f-ink:hover,${S} .hl-card.f-ink:focus-visible,${S} .hl-card.f-ink.pv-on{background:var(--paper);color:var(--ink)}
${S} .hl-ph{position:absolute;left:0;top:0;right:0;bottom:172px;border-bottom:3px solid var(--ink);overflow:hidden;background:var(--ink)}
${S} .hl-ph img{left:0;top:0;width:100%;height:100%;transform:scale(1.04);transition:transform .4s;-webkit-user-drag:none}
${S} .hl-ph.sp{background:transparent}
${S} .hl-ph.sp img{object-fit:contain;padding:12px 0;transform:none}
${S} .hl-card:hover .hl-ph img,${S} .hl-card:focus-visible .hl-ph img{transform:scale(1.1)}
${S} .hl-top{display:flex;justify-content:space-between;gap:16px;font:700 16px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-top span:first-child{opacity:.7}
${S} .hl-nm{font:900 44px/.95 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase;padding-right:52px;min-height:84px;display:flex;align-items:flex-end}
${S} .hl-ar{position:absolute;right:20px;bottom:20px;transition:transform .25s}
${S} .hl-card:hover .hl-ar,${S} .hl-card:focus-visible .hl-ar{transform:translate(5px,-5px);color:var(--lime)}
${S} .hl-card.f-ink:hover .hl-ar,${S} .hl-card.f-ink:focus-visible .hl-ar{color:var(--ink)}
${S} .hl-n{font-size:128px;margin-right:.12em}
${S} .hl-pv{z-index:20;width:${PV.w + 12}px;opacity:0;visibility:hidden;transform:scale(.88);transform-origin:50% 60%;
  transition:opacity .16s,transform .22s cubic-bezier(.2,1.3,.4,1),visibility 0s .22s;box-shadow:1px 1px 0 var(--ink),18px 18px 0 rgba(var(--ink-rgb),.35)}
${S} .hl-pv.show{opacity:1;visibility:inherit;transform:none;transition:opacity .16s,transform .22s cubic-bezier(.2,1.3,.4,1)}
${S} .hl-pv .body img{left:0;top:0;width:100%;height:100%}
${S} .hl-pv .body img.sprite{object-fit:contain;background:var(--paper)}
${S} .hl-pv .pv-cap{display:flex;flex-direction:column;gap:12px;padding:20px 16px 16px}
${S} .hl-pv .pv-cat{font:700 16px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:rgba(var(--ink-rgb),.7)}
${S} .hl-pv .pv-nm{font:900 64px/.92 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase;color:var(--ink)}
${S} .hl-pv .pv-go{font:400 20px/1 var(--pixel);letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}${PORTRAIT ? `
${S} .hl-n{font-size:104px}
${S} .hl-card{padding:0 22px 20px;gap:10px}
${S} .hl-ph{bottom:184px}
${S} .hl-top{font-size:24px;letter-spacing:.08em}
${S} .hl-nm{font-size:48px;padding-right:44px;min-height:92px}
${S} .hl-ar{right:18px;bottom:22px}
${S} .hl-pv .pv-cat{font-size:28px}
${S} .hl-pv .pv-nm{font-size:80px}
${S} .hl-pv .pv-go{font-size:28px}` : ""}
</style>
      <div class="hl-eb" style="left:${G.eb[0]}px;top:${G.eb[1]}px">${esc(ACT_HL)} · Race day</div>
      <div class="hl-lab hl-tag" style="${G.tag}"><span class="hl-dot"></span>${esc(C.organizer.date)}</div>
      <h2 class="big hl-head abs" style="left:${X0}px;top:${G.head[0]}px;font-size:${G.head[1]}px;white-space:nowrap">${maskLine(`<span class="pixel hl-n">00</span><span class="ol">Reasons to run</span>`)}</h2>
      <div class="hl-rule abs" style="left:${X0}px;top:${G.rule[0]}px;width:${G.rule[1]}px;height:3px;background:var(--ink);transform-origin:0 50%"></div>
      ${cards}
      <div class="win hl-pv" aria-hidden="true" style="left:0;top:0">
        <div class="bar"><span class="pv-t"></span></div>
        <div class="body" style="height:${PV.h}px"><img class="photo" alt=""></div>
        <div class="pv-cap"><span class="pv-cat"></span><span class="pv-nm"></span><span class="pv-go">${TOUCH ? "Tap the card to open" : "Click to open"}</span></div>
      </div>`,
    anim(root, tl) {
      const cs = qa(root, ".hl-card"), nEl = q(root, ".hl-n");
      // the intro runs on its own clock once the scene is entered, so one scroll reveals every card (with animation)
      const intro = gsap.timeline({ paused: true });
      intro.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.5, ease: "power3.out" }, 0);
      intro.from(q(root, ".hl-head .mask > span"), { yPercent: 110, duration: 0.7, ease: "expo.out" }, 0.05);
      intro.from(q(root, ".hl-tag"), { opacity: 0, x: 30, duration: 0.5, ease: "power3.out" }, 0.2);
      intro.from(q(root, ".hl-rule"), { scaleX: 0, duration: 0.8, ease: "power3.inOut" }, 0.15);
      const STEP = 0.14;
      cs.forEach((c, i) => {
        const up = i % 2 === 0;
        intro.from(c, { opacity: 0, y: up ? 170 : -170, rotationY: up ? -75 : 75, transformPerspective: 1100,
          duration: 0.8, ease: "power3.out" }, 0.3 + i * STEP);
      });
      count(intro, (v) => { nEl.textContent = pad(Math.min(n, Math.ceil(v - 1e-6))); }, 0, n, 0.3, n * STEP + 0.3);
      // entering the scene (film time crosses 0.02) plays it from the start; leaving backwards resets it for next time
      tl.call(() => intro.restart(), null, 0.02);
      tl.call(() => intro.pause(0), null, 0.005);
      // a fast scroll past the page finishes the intro first, so its tweens never fight the exit fade
      tl.call(() => intro.progress(1), null, 1.14);
      // clear the frame after the rest hold and before main.js's iris (dur - 0.55), so nothing rides above the wipe
      tl.fromTo(qa(root, ".hl-card, .hl-eb, .hl-tag, .hl-head, .hl-rule"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.25, ease: "power2.in", immediateRender: false }, 1.15);
      wirePreview(root, cs, PV);
    },
  };
}

// Preview popup for the reason cards: hover (mouse), keyboard focus or a long press (touch) opens a larger
// Win98 window over the card; a plain click / tap still follows the card's link, a long press never does.
function wirePreview(root, cards, PV) {
  const pv = q(root, ".hl-pv");
  if (!pv) return;
  const img = q(pv, "img"), FRAME_W = SW, FRAME_H = DH, M = 24;
  let current = null, timer = 0, start = null, swallow = false;
  const show = (card) => {
    if (current && current !== card) current.classList.remove("pv-on");
    current = card;
    card.classList.add("pv-on");
    const sprite = card.dataset.sprite === "1";
    img.className = sprite ? "sprite" : "photo";
    if (img.getAttribute("src") !== card.dataset.full) img.src = card.dataset.full;
    q(pv, ".pv-t").textContent = `${card.dataset.name.toLowerCase().replace(/\W+/g, "_")}.jpg`;
    q(pv, ".pv-cat").textContent = card.dataset.cat;
    q(pv, ".pv-nm").textContent = card.dataset.name;
    // centre the window on the card (portrait: on the frame's width), kept inside the frame
    const w = pv.offsetWidth, h = pv.offsetHeight;
    const cx = PORTRAIT ? FRAME_W / 2 : card.offsetLeft + card.offsetWidth / 2, cy = card.offsetTop + card.offsetHeight / 2;
    pv.style.left = `${Math.round(Math.min(Math.max(M, cx - w / 2), FRAME_W - w - M))}px`;
    pv.style.top = `${Math.round(Math.min(Math.max(M, cy - h / 2), FRAME_H - h - M))}px`;
    pv.classList.add("show");
  };
  const hide = (card) => {
    if (card && card !== current) return;
    current?.classList.remove("pv-on");
    current = null;
    pv.classList.remove("show");
  };
  const cancelPress = () => { clearTimeout(timer); timer = 0; start = null; };
  // scrolling moves the film on: drop any open preview so it never lingers into the next frame
  addEventListener("scroll", () => { if (current) hide(); }, { passive: true });
  for (const card of cards) {
    card.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") show(card); });
    card.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(card); });
    card.addEventListener("focus", () => { if (card.matches(":focus-visible")) show(card); });
    card.addEventListener("blur", () => hide(card));
    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      cancelPress();
      swallow = false;
      start = [e.clientX, e.clientY];
      timer = setTimeout(() => { timer = 0; swallow = true; show(card); }, LONG_PRESS_MS);
    });
    card.addEventListener("pointermove", (e) => {
      if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > PRESS_SLOP) cancelPress();
    });
    card.addEventListener("pointerup", () => { cancelPress(); if (swallow) hide(card); });
    card.addEventListener("pointercancel", () => { cancelPress(); swallow = false; hide(card); });
    // the long press already used this touch: do not follow the link, and no native callout menu
    card.addEventListener("click", (e) => { if (swallow) { e.preventDefault(); swallow = false; } });
    card.addEventListener("contextmenu", (e) => { if (e.pointerType === "touch" || e.pointerType === "pen") e.preventDefault(); });
  }
}

/* ---------------- scenes 21/22: showcases ---------------- */
// 22-point seal star filled with the brand gradient
function starSvg(id) {
  const k = 22, pts = [];
  for (let i = 0; i < k * 2; i++) {
    const r = i % 2 ? 83 : 98, a = (Math.PI * i) / k - Math.PI / 2;
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true">${gradDefs(id)}<polygon fill="url(#${id})" points="${pts.join(" ")}"/></svg>`;
}
const badgeHtml = (id, big, small, left, top, size) =>
  `<div class="hl-badge" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px">${starSvg(id)}<div class="hl-bt"><b>${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ""}</div></div>`;

// 90s CRT monitor, drawn in CSS. Beige case plastic is the one exception to the brand palette (the client asked
// for a beige 90s monitor); everything on the screen uses brand colours.
const CRT_CASE = { hi: "#efe8d6", face: "#ddd4bd", shade: "#c2b799", deep: "#968b6d" };
const CRT_STAND = 48;
// bib cards on the screen: left / top (% of the screen), tilt (deg)
const CRT_BIBS = [[4, 40, -5], [30, 24, 2], [56, 44, 6]];

function crtHtml(C, bibs, x, y, W) {
  const H = Math.round(W * 0.78), inset = Math.round(W * 0.08), chin = Math.round(W * 0.16);
  const sw = W - inset * 2, sh = H - inset - chin;
  const names = bibs.map(([, alt]) => alt.split(" ")[0]).join(" · ");
  const imgs = bibs.map(([src, alt], k) => {
    const [l, t, r] = CRT_BIBS[k % CRT_BIBS.length];
    return `<img class="crt-bib" src="${esc(src)}" alt="${esc(alt)}" width="600" height="373" style="left:${l}%;top:${t}%;--r:${r}deg;--k:${k}">`;
  }).join("");
  return `<button class="hl-crt" type="button" aria-expanded="false" aria-label="Race bibs monitor: show the ${esc(names)} race bibs"
      style="left:${x}px;top:${y}px;width:${W}px;height:${H + CRT_STAND}px">
    <span class="crt-neck" style="top:${H - 6}px"></span><span class="crt-base"></span>
    <span class="crt-case" style="height:${H}px">
      <span class="crt-scr" style="left:${inset}px;top:${inset}px;width:${sw}px;height:${sh}px">
        <span class="crt-idle"><span>C:\\TECHRUN&gt; RACE_BIBS.EXE</span><span class="crt-dim">${esc(names)}</span><span>${TOUCH ? "Tap" : "Hover"} to load<i class="crt-cur"></i></span></span>
        <span class="crt-on"><span class="crt-hd">${bibs.length} bibs loaded</span>${imgs}</span>
        <span class="crt-fx"></span>
      </span>
      <span class="crt-chin" style="height:${chin}px"><img class="crt-logo" src="${esc(C.assets.logo.black)}" alt="" style="height:${Math.round(chin * 0.4)}px"><span class="crt-vent"></span><span class="crt-btn"></span><span class="crt-led"></span></span>
    </span>
  </button>`;
}

// the screen shows the bibs while hovered (mouse), keyboard focused, or toggled open by a click / tap
const crtCss = (S) => {
  const on = (sel, decl) => `${S} .hl-crt.open ${sel},${S} .hl-crt:focus-visible ${sel}{${decl}}
@media (hover:hover){${S} .hl-crt:hover ${sel}{${decl}}}`;
  const K = CRT_CASE;
  return `
${S} .hl-crt{position:absolute;z-index:4;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;-webkit-tap-highlight-color:transparent}
${S} .hl-crt:focus-visible{outline:3px solid var(--ink);outline-offset:8px}
${S} .crt-case{position:absolute;left:0;top:0;right:0;border:3px solid var(--ink);border-radius:24px 24px 16px 16px;
  background:linear-gradient(180deg,${K.hi},${K.face} 55%,${K.shade});
  box-shadow:inset 5px 5px 0 rgba(var(--paper-rgb),.6),inset -6px -8px 0 rgba(var(--ink-rgb),.12),0 28px 48px rgba(var(--ink-rgb),.28)}
${S} .crt-scr{position:absolute;overflow:hidden;border-radius:28px / 22px;
  background:radial-gradient(ellipse at 50% 42%,rgba(var(--lime-rgb),.16),rgba(var(--ink-rgb),0) 70%),var(--ink);
  box-shadow:0 0 0 10px ${K.shade},0 0 0 13px var(--ink)}
${S} .crt-idle{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:20px;padding:0 9%;
  font:400 28px/1 var(--pixel);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;color:var(--lime);
  text-shadow:0 0 12px rgba(var(--lime-rgb),.7);transition:opacity .12s}
${S} .crt-dim{opacity:.55}
${S} .crt-cur{display:inline-block;width:.6em;height:1em;margin-left:.3em;vertical-align:-.12em;background:var(--lime);animation:hlCrtBlink 1s steps(1) infinite}
@keyframes hlCrtBlink{50%{opacity:0}}
${S} .crt-on{position:absolute;inset:0;opacity:0;transform:scaleY(.02);transition:transform .2s ease-out,opacity .1s}
${S} .crt-hd{position:absolute;left:6%;top:9%;font:400 24px/1 var(--pixel);letter-spacing:.04em;text-transform:uppercase;color:var(--lime);text-shadow:0 0 12px rgba(var(--lime-rgb),.7)}
${S} .crt-bib{position:absolute;width:40%;height:auto;border-radius:8px;box-shadow:0 12px 24px rgba(var(--ink-rgb),.6);opacity:0;
  transform:translateY(40%) scale(.5);transition:opacity .16s,transform .42s cubic-bezier(.2,1.5,.4,1);transition-delay:calc(.12s + var(--k) * .07s)}
${S} .crt-fx{position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(var(--ink-rgb),.32) 0 2px,rgba(var(--ink-rgb),0) 2px 5px),
    linear-gradient(160deg,rgba(var(--paper-rgb),.14),rgba(var(--paper-rgb),0) 38%),
    radial-gradient(ellipse at 50% 50%,rgba(var(--ink-rgb),0) 58%,rgba(var(--ink-rgb),.7))}
${S} .crt-chin{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:20px;padding:0 8%}
${S} .crt-logo{display:block;width:auto;-webkit-user-drag:none}
${S} .crt-vent{display:block;flex:0 0 26%;height:16px;margin-left:auto;background:repeating-linear-gradient(90deg,${K.deep} 0 6px,rgba(var(--ink-rgb),0) 6px 12px)}
${S} .crt-btn{display:block;width:40px;height:20px;border:3px solid var(--ink);border-radius:6px;background:${K.shade}}
${S} .crt-led{display:block;width:14px;height:14px;border:2px solid var(--ink);border-radius:50%;background:var(--lime);box-shadow:0 0 8px rgba(var(--lime-rgb),.6);transition:box-shadow .2s}
${S} .crt-neck{position:absolute;left:36%;width:28%;height:${Math.round(CRT_STAND * 0.6)}px;border:3px solid var(--ink);border-top:0;background:linear-gradient(180deg,${K.deep},${K.shade})}
${S} .crt-base{position:absolute;left:20%;width:60%;bottom:0;height:${Math.round(CRT_STAND * 0.5)}px;border:3px solid var(--ink);border-radius:14px 14px 6px 6px;background:linear-gradient(180deg,${K.face},${K.shade})}
${on(".crt-idle", "opacity:0")}
${on(".crt-on", "opacity:1;transform:none")}
${on(".crt-bib", "opacity:1;transform:rotate(var(--r))")}
${on(".crt-led", "box-shadow:0 0 6px 4px rgba(var(--lime-rgb),.9)")}
@media (prefers-reduced-motion:reduce){${S} .crt-on,${S} .crt-bib{transition:opacity .15s}${S} .crt-cur{animation:none}}`;
};

const showcaseCss = (S, light) => `${baseCss(S)}
${S} .hl-ghost{position:absolute;font:900 1100px/.8 var(--sans);font-stretch:75%;-webkit-text-fill-color:transparent;-webkit-text-stroke:3px currentColor;opacity:.12;white-space:nowrap}
${S} .hl-ttl{position:absolute;margin:0;font:900 180px/.88 var(--sans);font-stretch:75%;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap}
${S} .hl-acc{${light ? "-webkit-text-fill-color:transparent;-webkit-text-stroke:4px var(--ink)" : "background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent"}}
${S} .hl-pitch{position:absolute;font:600 32px/1.25 var(--sans);letter-spacing:-.005em;width:1000px}
${S} .hl-strikes{position:absolute;display:flex;gap:46px}
${S} .hl-strike{position:relative;display:block;font:900 64px/1 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
${S} .hl-strike i{position:absolute;left:0;right:0;top:100%;height:9px;margin-top:8px;background:var(--grad);transform-origin:0 50%}
${S} .hl-feats{position:absolute;display:flex;gap:18px}
${S} .hl-feats span{border:2px solid currentColor;padding:15px 26px;font:700 24px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-feats span b{color:${light ? "var(--ink)" : "var(--lime)"};margin-right:12px}
${S} .hl-stack{position:absolute;font:700 20px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-links{position:absolute;display:flex;gap:58px}
${S} .hl-links a{display:inline-flex;align-items:center;gap:14px;transition:color .2s,border-color .2s${light ? ";border-color:var(--ink)" : ""}}
${S} .hl-links a:hover,${S} .hl-links a:focus-visible{${light ? "border-bottom-width:5px" : "color:var(--lime)"}}
${S} .hl-win{z-index:3}
${S} .hl-win .body img{left:0;top:0;width:100%;height:100%}
${S} .hl-badge{position:absolute;z-index:5;color:var(--ink)}
${S} .hl-badge svg{position:absolute;inset:0;width:100%;height:100%}
${S} .hl-badge .hl-bt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
${S} .hl-badge b{max-width:150px;font:900 56px/.88 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
${S} .hl-badge small{margin-top:8px;max-width:150px;font:700 16px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase}${PORTRAIT ? `
${S} .hl-ghost{display:none}
${S} .hl-pitch{font-size:36px}
${S} .hl-ttl{font-size:144px}
${S} .hl-stack{width:900px;font-size:28px;line-height:1.35;white-space:normal}
${S} .hl-feats span{font-size:28px}
${S} .hl-badge b{font-size:72px}
${S} .crt-idle{font-size:32px;gap:24px}
${S} .crt-hd{font-size:28px}` : ""}`;

// Layout of a showcase frame. With bibs (s.bibs): desktop has the copy on the left and a collage on the right
// (singlets window, the CRT monitor holding the bibs in front of its corner); portrait stacks title, copy,
// the window with the link beside it, then the monitor, all in one 1080 x 1400 frame (js/stage.js).
function showcaseLayout(s) {
  return s.bibs?.length
    ? lay(
      { x: 110, ghost: [560, 120], eb: 150, ttl: 236, pitch: 600, pitchW: 820, links: 744,
        win: [980, 110, 600, 296], crt: [1230, 420, 600], badge: [1480, 16, 220] },
      { x: 90, ghost: [300, 420], eb: 30, ttl: 76, pitch: 356, pitchW: 900, links: 520, linksX: 660,
        win: [90, 488, 540, 267], crt: [210, 830, 660], badge: null },
    )
    : lay(
      { x: 110, ghost: [560, 120], eb: 110, ttl: 196, pitch: 556, pitchW: 1000, lab: 646, extra: 690, stack: 822, links: 904, win: [1120, 360, 700, 345] },
      { x: 90, ghost: [300, 420], eb: 30, ttl: 76, pitch: 960, pitchW: 900, lab: 1090, extra: 1136, stack: 1250, links: 1330, win: [90, 470, 900, 444] },
    );
}
const winTitle = (s) => `${s.title.join("_").toLowerCase()}.jpg`;

function showcase(C, i) {
  const s = C.showcases[i];
  const slug = `showcase-${i + 1}`, S = scope(slug);
  const light = LIGHT_FIELDS.has(s.field);
  const name = s.title.join(" ");
  const accentOf = (line) => (s.accent && line.toLowerCase() === String(s.accent).toLowerCase() ? "hl-acc" : "");
  const titleHtml = s.title.map((l) => maskLine(esc(l), accentOf(l))).join("");
  const two = !!s.bibs?.length, G = showcaseLayout(s);
  // the bibs frame keeps to title, pitch, poster, monitor and link; the plain frame keeps its feature row
  const extras = two ? null : s.strikes
    ? { lab: "Every angle", html: `<div class="hl-strikes" style="left:${G.x}px;top:${G.extra}px">${s.strikes.map((w) =>
        `<span class="hl-strike"><span class="hl-w">${esc(w)}</span><i></i></span>`).join("")}</div>` }
    : { lab: "One bib per distance", html: `<div class="hl-feats" style="left:${G.x}px;top:${G.extra}px">${(s.features || []).map((w, k) =>
        `<span><b>${pad(k + 1)}</b>${esc(w)}</span>`).join("")}</div>` };
  const links = (s.links || []).map(([label, url]) => `<a ${linkAttrs(url)}>${esc(label)} ${ARROW(20)}</a>`).join("");
  const badge = s.badge || { big: "", small: "" };
  // framed poster: a Win98 window whose body keeps the image's ratio (singlets 1400x691)
  const [WL, WT, BW, BH] = G.win;
  const badgeAt = two ? G.badge : lay([WL - 120, WT - 150, 240], [WL + BW - 130, WT - 110, 220]);
  const DUR = 4.0;
  return {
    slug, name: `Race Kit · ${name}`, act: ACT_KITS, field: s.field, dur: DUR, stars: false,
    turn: null, rest: two ? (TOUCH ? "tap the monitor" : "hover the monitor") : "open the links", restAt: 2.5, shoe: false,
    html: `<style>${showcaseCss(S, light)}${two ? crtCss(S) : ""}</style>
      <div class="hl-ghost" style="left:${G.ghost[0]}px;top:${G.ghost[1]}px">${esc(s.ghost || "")}</div>
      <div class="hl-eb" style="left:${G.x}px;top:${G.eb}px">${esc(ACT_KITS)}</div>
      <h2 class="hl-ttl" style="left:${G.x}px;top:${G.ttl}px">${titleHtml}</h2>
      <div class="hl-pitch" style="left:${G.x}px;top:${G.pitch}px;width:${G.pitchW}px">${maskLine(esc(s.pitch))}</div>
      ${extras ? `<div class="hl-lab dim" style="left:${G.x}px;top:${G.lab}px">${extras.lab}</div>${extras.html}` : ""}
      ${!two && s.stack ? `<div class="hl-stack" style="left:${G.x}px;top:${G.stack}px">${esc(s.stack)}</div>` : ""}
      <div class="links hl-links" style="left:${G.linksX ?? G.x}px;top:${G.links}px">${links}</div>
      <div class="win hl-win" style="left:${WL}px;top:${WT}px;width:${BW + 12}px">
        <div class="bar"><span>${esc(winTitle(s))}</span></div>
        <div class="body" style="height:${BH}px"><img class="photo" src="${esc(photoSrc(C, s.img))}" alt="${esc(C.brand.title)} ${esc(name)} poster"></div>
      </div>
      ${two ? crtHtml(C, s.bibs, ...G.crt) : ""}
      ${badgeAt ? badgeHtml(`hl-g${i}`, badge.big, badge.small, ...badgeAt) : ""}`,
    anim(root, tl) {
      const win = q(root, ".hl-win"), crt = q(root, ".hl-crt"), seal = q(root, ".hl-badge");
      tl.from(q(root, ".hl-ghost"), { opacity: 0, yPercent: 14, duration: 1.2, ease: "power3.out" }, 0);
      tl.fromTo(q(root, ".hl-ghost"), { scale: 1 }, { scale: 1.07, duration: DUR, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.1);
      tl.from(qa(root, ".hl-ttl .mask > span"), { yPercent: 112, duration: 0.85, ease: "expo.out", stagger: 0.12 }, 0.2);
      tl.from(win, { y: 1000, rotation: 12, duration: 1.1, ease: "power3.out" }, 0.2);
      tl.to(win, { rotation: -2.5, duration: DUR - 1.3, ease: "none" }, 1.3);
      if (crt) {
        tl.from(crt, { y: 900, rotation: -8, duration: 1.0, ease: "power3.out" }, 0.45);
        crt.addEventListener("click", () => {
          const open = crt.classList.toggle("open");
          crt.setAttribute("aria-expanded", String(open));
        });
      }
      if (seal) {
        tl.from(seal, { scale: 0, rotation: -140, duration: 0.8, ease: "back.out(1.7)" }, 0.75);
        tl.fromTo(q(seal, "svg"), { rotation: 0 }, { rotation: 300 * (DUR / 4), duration: DUR, ease: "none", immediateRender: false }, 0);
      }
      tl.from(q(root, ".hl-pitch .mask > span"), { yPercent: 110, duration: 0.7, ease: "expo.out" }, 0.8);
      const lab = q(root, ".hl-lab.dim");
      if (lab) tl.from(lab, { opacity: 0, duration: 0.5 }, 1.2);
      qa(root, ".hl-strike").forEach((el, k) => {
        const at = 1.3 + k * 0.28;
        tl.from(el, { yPercent: 100, opacity: 0, duration: 0.5, ease: "power3.out" }, at);
        tl.from(q(el, "i"), { scaleX: 0, duration: 0.45, ease: "power3.inOut" }, at + 0.55);
      });
      qa(root, ".hl-feats span").forEach((el, k) =>
        tl.from(el, { opacity: 0, y: 30, duration: 0.5, ease: "power3.out" }, 1.3 + k * 0.2));
      const stack = q(root, ".hl-stack");
      if (stack) tl.from(stack, { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 1.6);
      tl.from(qa(root, ".hl-links a"), { opacity: 0, y: 20, duration: 0.5, ease: "power3.out", stagger: 0.12 }, 1.4);
    },
  };
}

/* ---------------- scene 23: partners-rest ---------------- */
function ringText(C) {
  const unit = `${C.brand.title} · Become a partner · ${C.organizer.name} · `.toUpperCase();
  return `<svg class="hl-ring" viewBox="0 0 300 300" aria-hidden="true">
    <defs><path id="hl-ring-path" d="M150 150 m-128 0 a128 128 0 1 1 256 0 a128 128 0 1 1 -256 0"/></defs>
    <text fill="${PALETTE.paper}" style="font:700 20px var(--mono);letter-spacing:4px" textLength="796" lengthAdjust="spacing">
      <textPath href="#hl-ring-path">${esc(unit)}</textPath></text></svg>`;
}

function partnersRest(C) {
  const S = scope("partners-rest");
  const list = C.partners, n = list.length;
  const LEFT = (k) => 130 + k * 430;
  const TOP = [500, 560, 480, 540], ROT = [-5, 3, -3, 5];
  const cards = list.map((c, k) => `<a class="cert hl-cert" ${linkAttrs(c.url)} aria-label="${esc(c.issuer)}: ${esc(c.title)}" style="left:${LEFT(k)}px;top:${TOP[k % 4]}px">
      <span class="hl-ct"><span>${esc(c.issuer)}</span><span>${pad(k + 1)}/${pad(n)}</span></span>
      <span><span class="hl-cn">${esc(c.title)}</span><span class="hl-cv">Get in touch ${ARROW(20)}</span></span></a>`).join("");
  const band = Array.from({ length: 8 }, () =>
    `<span>${esc(C.brand.title)}</span><span>${esc(C.brand.tagline)}</span>`).join("");
  return {
    slug: "partners-rest", name: "Partners", act: ACT_PARTNERS, field: "ink", dur: 4.6, stars: true,
    turn: null, rest: "become a partner", restAt: 3.0, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-cert{transition:border-color .2s,box-shadow .2s,background-color .2s}
${S} .hl-cert:hover,${S} .hl-cert:focus-visible{border-color:var(--lime);background:var(--ink);box-shadow:0 0 0 2px var(--lime),0 24px 60px rgba(var(--lime-rgb),.25)}
${S} .hl-ct{display:flex;justify-content:space-between;font:700 16px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;padding-left:10px}
${S} .hl-ct span:first-child{color:var(--lime)}
${S} .hl-cn{display:block;font:900 44px/.98 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase;padding-left:10px}
${S} .hl-cv{display:flex;align-items:center;gap:10px;margin-top:14px;padding-left:10px;font:700 16px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--lime)}
${S} .hl-acc{color:var(--lime)}
${S} .hl-seal{position:absolute;width:300px;height:300px}
${S} .hl-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
${S} .hl-logo{left:68px;top:68px;width:164px;height:164px;object-fit:contain}
${S} .band{top:884px}
${S} .band .hl-tape{display:flex;gap:120px}
</style>
      <div class="hl-eb" style="left:100px;top:100px">${esc(ACT_PARTNERS)}</div>
      <h2 class="big hl-head abs" style="left:100px;top:160px;font-size:168px;white-space:nowrap">${maskLine(`Run with us<span class="hl-acc">.</span>`)}</h2>
      <div class="hl-lab dim hl-hint" style="left:100px;top:410px"><span class="live"></span>${pad(n)} partner slots · click a card to get in touch</div>
      <div class="hl-seal" style="left:1500px;top:80px">${ringText(C)}<img class="photo hl-logo" src="${esc(C.assets.logo.gradient)}" alt="${esc(C.brand.title)} logo"></div>
      ${cards}
      <div class="band" data-bleed aria-hidden="true"><span class="hl-tape">${band}</span></div>`,
    anim(root, tl) {
      tl.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.05);
      tl.from(q(root, ".hl-head .mask > span"), { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0.15);
      tl.from(q(root, ".hl-hint"), { opacity: 0, duration: 0.6 }, 1.6);
      tl.from(q(root, ".hl-seal"), { scale: 0, rotation: -140, duration: 0.8, ease: "back.out(1.7)" }, 0.5);
      tl.fromTo(q(root, ".hl-ring"), { rotation: 0 }, { rotation: 260, duration: 4.6, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".band"), { yPercent: 120, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.9);
      tl.fromTo(q(root, ".hl-tape"), { x: 0 }, { x: -900, duration: 4.6, ease: "none", immediateRender: false }, 0);
      qa(root, ".hl-cert").forEach((el, k) => {
        const l = LEFT(k);
        tl.fromTo(el, { x: 770 - l, y: 90, rotation: 0, opacity: 0, transformPerspective: 1000 },
          { x: 0, y: 0, rotation: ROT[k % 4], opacity: 1, duration: 1.0, ease: "power3.out", immediateRender: true }, 0.6 + k * 0.2);
      });
    },
  };
}

/* ---------------- scene 24: blast ---------------- */
function blast(C) {
  const S = scope("blast");
  const ct = C.contact, L = C.location;
  const words = String(ct.headline).split(" ");
  const last = words.pop();
  // portrait breaks the headline onto two lines so it fits the narrow frame
  const headline = PORTRAIT
    ? `${maskLine(esc(words.join(" ")))}${maskLine(`<span class="ol">${esc(last)}</span>`)}`
    : maskLine(`${esc(words.join(" "))} <span class="ol">${esc(last)}</span>`);
  const G = lay(
    { x: 100, eb: 92, mega: 140, win: [1420, 150], rows: 380, rowsW: 1720, photos: 750, foot: 902 },
    { x: 90, eb: 30, mega: 76, win: [580, 300], rows: 548, rowsW: 900, photos: 1100, foot: 1262 },
  );
  const rows = ct.links.map((l) => `<a class="hl-row" ${linkAttrs(l.url)}>
      <span class="hl-rl">${esc(l.label)}</span><span class="hl-rv">${esc(l.value)}</span>${ARROW(34)}</a>`).join("");
  return {
    slug: "blast", name: "Let's run", act: ACT_REGISTER, field: "ink", dur: 5.0, stars: false,
    turn: [0.2, "lime"], rest: null, restAt: null, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-wrap .hl-eb{color:inherit}
${S} .hl-row{display:grid;grid-template-columns:300px 1fr 70px;align-items:center;height:84px;padding:0 24px;color:inherit;text-decoration:none;
  border-top:2px solid currentColor;transition:background-color .2s,color .2s,padding .25s}
${S} .hl-row:last-child{border-bottom:2px solid currentColor}
${S} .hl-row:hover,${S} .hl-row:focus-visible{background:var(--ink);color:var(--paper);padding-left:46px}
${S} .hl-rl{font:700 20px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase;opacity:.8}
${S} .hl-rv{font:900 48px/1 var(--sans);font-stretch:75%;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap}
${S} .hl-row svg{justify-self:end;transition:transform .25s,color .2s}
${S} .hl-row:hover svg,${S} .hl-row:focus-visible svg{transform:translate(6px,-6px);color:var(--lime)}
${S} a.hl-photos{position:absolute;display:inline-flex;align-items:center;gap:18px;height:88px;padding:0 44px;border-radius:999px;
  background:var(--ink);color:var(--paper);text-decoration:none;font:900 36px/1 var(--sans);font-stretch:75%;letter-spacing:.02em;text-transform:uppercase;
  white-space:nowrap;box-shadow:0 0 0 rgba(var(--ink-rgb),0);transition:translate .25s,box-shadow .25s}
${S} a.hl-photos:hover,${S} a.hl-photos:focus-visible{translate:0 -4px !important;box-shadow:0 16px 32px rgba(var(--ink-rgb),.35),0 6px 0 rgba(var(--ink-rgb),.25)}
${S} .hl-cover{z-index:3}
${S} .hl-ban{display:flex;align-items:center;gap:20px;padding:0 24px;background:var(--ink);color:var(--paper)}
${S} .hl-ban img{position:static;width:112px;height:auto;flex:none}
${S} .hl-ban-t{display:flex;flex-direction:column;line-height:1}
${S} .hl-ban-t b{font-size:40px;font-weight:400;line-height:.9}
${S} .hl-ban-t i{font:700 20px/1 var(--sans);font-style:normal;letter-spacing:.5em;margin:8px -.5em 0 0}
${S} .hl-ban-t small{margin-top:12px;font:400 12px/1.2 var(--mono);letter-spacing:.08em;color:var(--lime)}${PORTRAIT ? `
${S} .hl-row{grid-template-columns:1fr 50px;grid-template-rows:auto auto;row-gap:12px;height:130px;align-content:center}
${S} .hl-rl{grid-row:1;font-size:28px}
${S} .hl-rv{grid-row:2;font-size:52px}
${S} .hl-row svg{grid-column:2;grid-row:1 / span 2}
${S} a.hl-photos{height:104px;padding:0 52px;font-size:40px}
${S} .hl-foot{flex-direction:column;gap:14px;white-space:normal;font-size:24px !important;line-height:1.35}` : ""}
</style>
      <div class="iris hl-iris" style="width:2600px;height:2600px;margin:-1300px 0 0 -1300px;background:var(--lime);z-index:0"></div>
      <div class="hl-wrap" style="position:absolute;inset:0;z-index:2;color:var(--paper)">
        <div class="hl-eb" style="left:${G.x}px;top:${G.eb}px"><span class="hl-dot"></span>${esc(ACT_REGISTER)} · ${esc(C.organizer.date)}</div>
        <h2 class="mega hl-mega abs" style="left:${G.x - 6}px;top:${G.mega}px;white-space:nowrap">${headline}</h2>
        <div class="win hl-cover" style="left:${G.win[0]}px;top:${G.win[1]}px;width:412px">
          <div class="bar"><span>techrun_2027.jpg</span></div>
          <div class="body hl-ban" style="height:148px" role="img" aria-label="${esc(C.brand.title)}: ${esc(C.brand.tagline)}">
            <img src="${esc(C.assets.logo.gradient)}" alt="">
            <div class="hl-ban-t"><b class="pixel">TECHRUN</b><i>2027</i><small>${esc(C.brand.tagline)}</small></div>
          </div>
        </div>
        <div class="hl-rows abs" style="left:${G.x}px;top:${G.rows}px;width:${G.rowsW}px">${rows}</div>
        <a class="hl-photos" ${linkAttrs(C.photos.url)} style="left:${G.x}px;top:${G.photos}px"><span>${esc(C.photos.label)}</span>${ARROW(28)}</a>
        <div class="hl-foot hl-lab" style="left:${G.x}px;right:${G.x}px;top:${G.foot}px;display:flex;justify-content:space-between;gap:40px;letter-spacing:.16em;font-size:16px">
          <span>${esc(ct.footer)}</span>
          <span>${esc(L.city)} · ${esc(L.venue)}</span>
        </div>
      </div>`,
    anim(root, tl) {
      const wrap = q(root, ".hl-wrap");
      tl.fromTo(q(root, ".hl-iris"), { scale: 0.001 }, { scale: 1, duration: 0.5, ease: "power3.out", immediateRender: true }, 0);
      tl.set(wrap, { color: PALETTE.paper }, 0);
      tl.set(wrap, { color: PALETTE.ink }, 0.2);
      tl.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.45);
      tl.from(qa(root, ".hl-mega .mask > span"), { yPercent: 115, duration: 0.95, ease: "expo.out" }, 0.4);
      tl.from(q(root, ".hl-cover"), { y: 260, rotation: 8, opacity: 0, duration: 0.9, ease: "power3.out" }, 0.75);
      tl.to(q(root, ".hl-cover"), { rotation: 2, duration: 3.3, ease: "none" }, 1.65);
      qa(root, ".hl-row").forEach((el, k) =>
        tl.from(el, { opacity: 0, x: -70, duration: 0.6, ease: "power3.out" }, 0.9 + k * 0.12));
      tl.from(q(root, ".hl-photos"), { opacity: 0, y: 30, duration: 0.6, ease: "back.out(1.6)" }, 1.45);
      tl.from(q(root, ".hl-foot"), { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, 1.7);
    },
  };
}

export function scenes(C, P) {
  // film order: race kit (03), then the highlights (04)
  return [showcase(C, 0), highlightsRest(C), showcase(C, 1), partnersRest(C), blast(C)];
}
