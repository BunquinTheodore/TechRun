// Scenes 01-04: access-granted, collapse-to-the-dot, name, word-burst.
import { pad, q, qa, esc, decode, linkAttrs } from "./util.js";
import { PORTRAIT, SW, DH, lay } from "../stage.js";

// ---------- 02 / 03 shared "READY / SET." block ----------
const READY = "READY", SET = "SET.";
const CX = SW / 2, CY = DH / 2;                // frame centre
const RB_X = lay(200, 60);                     // corner brackets inset from the sides
// READY / SET type size: portrait fills the frame width inside the 90px side margins (Tiny5 READY runs ~3.1em)
const RB_FS = lay(248, 288);
const RB_H = Math.round(RB_FS * 0.824);        // one READY / SET line
// vertical offsets from the frame centre (desktop keeps its original rhythm; portrait follows the bigger type)
const RB = lay(
  { top: 320, eye: 278, bar: 260, foot: 296, bot: 296 },
  { top: RB_H + 104, eye: RB_H + 64, bar: RB_H + 24, foot: RB_H + 60, bot: RB_H + 64 },
);
function readyBlock(p) {
  const br = (l, t, bw) => `<i class="${p}br" style="position:absolute;left:${l}px;top:${t}px;width:64px;height:64px;border:0 solid var(--lime);border-width:${bw}"></i>`;
  const line = `position:absolute;left:0;width:${SW}px;text-align:center;white-space:nowrap;font-size:${RB_FS}px;line-height:.82`;
  const top = CY - RB.top, bot = CY + RB.bot, right = SW - RB_X - 64;
  return `
<div class="${p}grp" style="position:absolute;inset:0;transform-origin:${CX}px ${CY}px">
  ${br(RB_X, top, "4px 0 0 4px")}${br(right, top, "4px 4px 0 0")}${br(RB_X, bot, "0 0 4px 4px")}${br(right, bot, "0 4px 4px 0")}
  <div class="eyebrow ${p}eye" style="position:absolute;left:0;width:${SW}px;justify-content:center;top:${CY - RB.eye}px;font-size:${lay(20, 28)}px">Runner cleared</div>
  <div class="pixel ${p}l1" style="${line};top:${CY - RB_H}px">${READY}</div>
  <div class="pixel ${p}l2" style="${line};top:${CY}px;color:var(--lime)">${SET}</div>
  <div class="grad-bg ${p}bar" style="position:absolute;left:${CX - lay(300, 240)}px;width:${lay(600, 480)}px;top:${CY + RB.bar}px;height:6px;transform-origin:0 50%"></div>
  <div class="mono ${p}foot" style="position:absolute;left:0;width:${SW}px;text-align:center;top:${CY + RB.foot}px;font-size:${lay(20, 28)}px;color:var(--ash)">Check-in complete &nbsp;·&nbsp; start line open</div>
  <i class="${p}line" style="position:absolute;left:${lay(160, 60)}px;width:${SW - 2 * lay(160, 60)}px;top:${CY - 1}px;height:3px;background:var(--lime);box-shadow:0 0 22px var(--lime),0 0 50px var(--lime);opacity:0"></i>
</div>`;
}

function accessHtml() {
  return readyBlock("ag-") + `<div class="ag-flash" style="position:absolute;left:0;right:0;top:-800px;bottom:-800px;background:var(--lime);opacity:0;z-index:9"></div>`;
}

function accessAnim(root, tl) {
  tl.fromTo(q(root, ".ag-flash"), { opacity: 0.5 }, { opacity: 0, duration: 0.35, ease: "power2.out" }, 0);
  tl.from(qa(root, ".ag-br"), { opacity: 0, scale: 1.8, duration: 0.45, ease: "power4.out", transformOrigin: "50% 50%" }, 0);
  const eye = q(root, ".ag-eye"), l1 = q(root, ".ag-l1"), l2 = q(root, ".ag-l2");
  for (const [el, t, at, dur] of [[eye, "RUNNER CLEARED", 0.05, 0.45], [l1, READY, 0.1, 0.45], [l2, SET, 0.3, 0.5]]) {
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.01 }, at);
    decode(tl, el, t, at, dur);
  }
  tl.from(q(root, ".ag-bar"), { scaleX: 0, duration: 0.6, ease: "power3.out" }, 0.4);
  tl.from(q(root, ".ag-foot"), { opacity: 0, y: 14, duration: 0.4, ease: "power3.out" }, 0.7);
}

function collapseHtml() {
  return readyBlock("cd-") + `
<i class="cd-r1" style="position:absolute;left:${CX - 42}px;top:${CY - 42}px;width:84px;height:84px;border-radius:50%;border:2px solid var(--lime)"></i>
<i class="cd-r2" style="position:absolute;left:${CX - 42}px;top:${CY - 42}px;width:84px;height:84px;border-radius:50%;border:2px solid var(--cyan)"></i>
<i class="cd-hx" style="position:absolute;left:${CX - 200}px;width:400px;top:${CY - 1}px;height:1px;background:rgba(var(--paper-rgb),.45)"></i>
<i class="cd-vx" style="position:absolute;top:${CY - 200}px;height:400px;left:${CX - 1}px;width:1px;background:rgba(var(--paper-rgb),.45)"></i>
<i class="cd-dot" style="position:absolute;left:${CX - 12}px;top:${CY - 12}px;width:24px;height:24px;border-radius:50%;background:var(--lime);box-shadow:0 0 27px var(--lime),0 0 70px rgba(var(--lime-rgb),.65);z-index:12"></i>
<div class="mono cd-cap" style="position:absolute;left:0;width:${SW}px;text-align:center;top:${CY + 90}px;font-size:${lay(20, 28)}px;color:var(--ash)">Start line &nbsp;·&nbsp; KM 0</div>`;
}

function collapseAnim(root, tl) {
  root.classList.add("starry");
  const grp = q(root, ".cd-grp");
  // squash to a line, then the line to a point
  tl.fromTo(q(root, ".cd-line"), { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" }, 0.3);
  tl.fromTo(grp, { scaleY: 1 }, { scaleY: 0.012, duration: 0.5, ease: "power3.in" }, 0);
  tl.fromTo(grp, { scaleX: 1 }, { scaleX: 0, duration: 0.42, ease: "power3.in", immediateRender: false }, 0.5);
  tl.fromTo(grp, { opacity: 1 }, { opacity: 0, duration: 0.05, immediateRender: false }, 0.9);

  const dot = q(root, ".cd-dot");
  tl.fromTo(dot, { scale: 0 }, { scale: 1.9, duration: 0.14, ease: "power2.out" }, 0.84);
  tl.fromTo(dot, { scale: 1.9 }, { scale: 1, duration: 0.3, ease: "power2.inOut", immediateRender: false }, 0.98);
  tl.fromTo(q(root, ".cd-r1"), { scale: 0.1, opacity: 0.9 }, { scale: 9, opacity: 0, duration: 0.8, ease: "power2.out" }, 0.9);
  tl.fromTo(q(root, ".cd-r2"), { scale: 0.1, opacity: 0.6 }, { scale: 6, opacity: 0, duration: 0.7, ease: "power2.out" }, 1.1);
  tl.from(q(root, ".cd-hx"), { scaleX: 0, duration: 0.5, ease: "power3.out" }, 1.1);
  tl.from(q(root, ".cd-vx"), { scaleY: 0, duration: 0.5, ease: "power3.out" }, 1.1);
  tl.from(q(root, ".cd-cap"), { opacity: 0, y: 12, duration: 0.4, ease: "power3.out" }, 1.25);
}

// ---------- 04 name (hero on lime): the "first page" with every key detail and the waitlist button ----------
// brand wordmark: TECH / RUN in Tiny5 (pixel), 2027 in Tektur spaced wide
const NAME_FS = lay(272, 204);   // TECH / RUN (Tiny5); portrait sets TECHRUN on one line
const YEAR_FS = lay(196, 168);   // 2027 (Tektur), about as wide as TECH on desktop
const YEAR_LS = lay(0.3, 0.5);   // 2027 letter spacing (em)
const LOGO_RATIO = 363 / 193;    // C.assets.logo.black is 363 x 193
// desktop: a two column grid inside the 130px margins. Wordmark left; one right column (x SIDE.x, as tall as the
// wordmark) holds tagline, waitlist and details, with the runner under the rule above it. Portrait centres one column.
const NM = lay(
  { m: 130, logoX: 130, logoY: 58, logoH: 76, metaX: 300, metaY: 80, metaFs: 20, ruleY: 166, ruleW: 1660, blockY: 236,
    runX: 1622, runY: 184, runS: 168, ctaX: 940, ctaY: 420, ctaW: 420, regH: 108, regFs: 40, noteFs: 16, partnerH: 56,
    titleX: 1240, titleY: 716, titleW: 590, eyeFs: 20, tagFs: 40, botY: 900, botFs: 20 },
  { m: 90, logoX: 465, logoY: 40, logoH: 80, metaX: 0, metaY: 144, metaFs: 24, ruleY: 212, ruleW: 900, blockY: 404,
    runX: 468, runY: 224, runS: 144, ctaX: 90, ctaY: 800, ctaW: 900, regH: 120, regFs: 52, noteFs: 24, partnerH: 56,
    titleX: 90, titleY: 1136, titleW: 900, eyeFs: 28, tagFs: 40, botY: 1284, botFs: 24 },
);
const REG_W = lay(560, 640);
// desktop right column: spans the wordmark block (top of TECH to the foot of 2027)
const SIDE = { x: 1230, w: 560, top: 360, bottom: 880 };

// main hero button: the waitlist dialog until REGISTER_URL is set in content.js, then the registration link
const ARROW = `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>`;
function heroCta(R, WL, B) {
  if (R.live) {
    return `<a class="nm-reg nm-c" ${linkAttrs(R.url)} aria-label="${esc(R.label)}: ${esc(B.title)}"><span>${esc(R.label)}</span>${ARROW}</a>
  <div class="nm-note nm-c">${esc(R.note)}</div>`;
  }
  return `<button type="button" class="nm-reg nm-c" data-waitlist="${esc(WL.source)}" aria-haspopup="dialog" aria-label="${esc(WL.label)}: ${esc(B.title)}"><span>${esc(WL.label)}</span>${ARROW}</button>
  <div class="nm-note nm-c">${esc(WL.note)}</div>`;
}

const word = (t) => `<span class="mask nm-m"><span>${esc(t)}</span></span>`;

function nameHtml(C) {
  const B = C.brand, L = B.lines, A = C.assets, O = C.organizer, R = C.register, WL = C.waitlist;
  const S = '.scene[data-slug="name"]';
  const logoW = Math.round(NM.logoH * LOGO_RATIO);
  const align = PORTRAIT ? "center" : "left";
  const flexAlign = PORTRAIT ? "center" : "flex-start";
  // portrait sets the wordmark as one word (TECHRUN) so the column keeps room to breathe
  const tech = PORTRAIT
    ? `<div class="pixel nm-tech nm-one">${word(L[0])}${word(L[1])}</div>`
    : `<div class="pixel nm-tech">${word(L[0])}</div><div class="pixel nm-tech">${word(L[1])}</div>`;
  const metaPos = PORTRAIT ? `;width:${SW}px;text-align:center` : "";
  const blockPos = PORTRAIT ? `left:0;width:${SW}px;transform-origin:50% 100%` : `left:${NM.m}px;transform-origin:0 100%`;
  return `
<style>
  ${S} .nm-meta { position:absolute; font:600 ${NM.metaFs}px/1.6 var(--mono); letter-spacing:.22em; text-transform:uppercase; color:var(--ink); white-space:nowrap; }
  ${S} .nm-tech { font-size:${NAME_FS}px; line-height:.84; letter-spacing:.02em; }
  ${S} .nm-one { display:flex; justify-content:center; }
  ${S} .nm-year { font:700 ${YEAR_FS}px/.8 var(--sans); letter-spacing:${YEAR_LS}em; margin-right:-${YEAR_LS}em; }
  ${S} .nm-row { display:flex; align-items:flex-end; justify-content:${flexAlign}; }
  ${S} .nm-pw { position:relative; display:inline-block; width:0; height:.4em; font-size:${YEAR_FS}px; }
  ${S} .nm-pw .iris { width:3400px; height:3400px; background:var(--ink); z-index:30; margin:0; border-radius:0; }
  ${S} .nm-run { position:absolute; left:${NM.runX}px; top:${NM.runY}px; width:${NM.runS}px; height:${NM.runS}px; z-index:2; image-rendering:pixelated; }
  ${S} .nm-cta { position:absolute; left:${NM.ctaX}px; top:${NM.ctaY}px; width:${NM.ctaW}px; z-index:6; display:grid; justify-items:center; gap:${lay(20, 24)}px; text-align:center; }
  ${S} .nm-reg { position:relative; display:flex; border:0; padding:0; white-space:nowrap; align-items:center; justify-content:center; gap:18px; width:${REG_W}px; height:${NM.regH}px;
    background:var(--ink); color:var(--lime); text-decoration:none; font:900 ${NM.regFs}px/1 var(--sans); font-stretch:75%; letter-spacing:.02em;
    text-transform:uppercase; box-shadow:0 18px 40px rgba(var(--ink-rgb),.28); transition:color .2s, top .2s; top:0; }
  ${S} .nm-reg::after { content:""; position:absolute; left:0; right:0; bottom:0; height:8px; background:var(--grad); }
  ${S} .nm-reg::before { content:""; position:absolute; inset:0; background:var(--grad); opacity:0; transition:opacity .2s; }
  ${S} .nm-reg:hover, ${S} .nm-reg:focus-visible { color:var(--ink); top:-4px; } /* lift via top: a CSS transform transition fights the GSAP entrance (left the button 26px low) */
  ${S} .nm-reg:hover::before, ${S} .nm-reg:focus-visible::before { opacity:1; }
  ${S} .nm-reg span, ${S} .nm-reg svg { position:relative; }
  ${S} .nm-title { text-align:${align}; }
  ${S} .nm-title .eyebrow { font-size:${NM.eyeFs}px; letter-spacing:${lay(".34em", ".26em")}; justify-content:${flexAlign}; }
  ${S} .nm-partner { display:block; height:${NM.partnerH}px; width:auto; margin-top:${lay(4, 8)}px; }
  ${S} .nm-note { margin-top:8px; white-space:nowrap; font:600 ${NM.noteFs}px/1.4 var(--mono); letter-spacing:.2em; text-transform:uppercase; color:rgba(var(--ink-rgb),.72); }
${PORTRAIT ? "" : `
  ${S} .nm-side { display:flex; flex-direction:column; justify-content:space-between; }
  ${S} .nm-tag { margin:20px 0 0; font:600 48px/1.16 var(--sans); color:var(--ink); }
  ${S} .nm-side .nm-cta { position:static; width:auto; display:grid; justify-items:start; gap:24px; text-align:left; }
  ${S} .nm-side .nm-note { margin-top:0; }
  ${S} .nm-bot { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; padding-top:24px; border-top:3px solid var(--ink); }
  ${S} .nm-side .nm-meta { position:static; white-space:normal; font-size:20px; line-height:1.6; }
  ${S} .nm-side .nm-partner { margin:0; height:48px; }`}
</style>
<img class="nm-mark" src="${esc(A.logo.black)}" alt="${esc(B.name)}" width="${logoW}" height="${NM.logoH}" style="position:absolute;left:${NM.logoX}px;top:${NM.logoY}px;width:${logoW}px;height:${NM.logoH}px">
<div class="nm-meta nm-top" style="left:${NM.metaX}px;top:${NM.metaY}px${metaPos}">${esc(O.label)} ${esc(B.org)}</div>
<i class="nm-rule" style="position:absolute;left:${NM.m}px;width:${NM.ruleW}px;top:${NM.ruleY}px;height:3px;background:var(--ink);transform-origin:${lay("0", "50%")} 50%"></i>

<img class="nm-run" src="${esc(A.runnerStatic.cyber)}" alt="" width="256" height="256">

<div class="nm-block" style="position:absolute;${blockPos};top:${NM.blockY}px;z-index:5">
  ${tech}
  <div class="nm-row" style="margin-top:${lay(24, 28)}px">
    <div class="nm-year">${word(L[2])}</div>
    <span class="nm-pw"><i class="iris nm-iris" style="left:0;top:50%"></i></span>
  </div>
</div>

${PORTRAIT ? `<div class="nm-cta">
  ${heroCta(R, WL, B)}
  <img class="nm-partner nm-c" src="${esc(A.irunph)}" alt="iRunPH" width="439" height="160">
</div>

<div class="nm-title" style="position:absolute;left:${NM.titleX}px;top:${NM.titleY}px;width:${NM.titleW}px;z-index:4">
  <div class="eyebrow">${esc(O.line)}</div>
  <p style="margin:${lay(24, 20)}px 0 0;font:600 ${NM.tagFs}px/1.2 var(--sans);color:var(--ink)">${esc(B.tagline)}</p>
</div>
<div class="nm-meta nm-bot" style="left:${NM.titleX}px;top:${NM.botY}px;white-space:normal;width:${NM.titleW}px;text-align:${align};font-size:${NM.botFs}px;line-height:1.6">${esc(C.location.city)}, ${esc(C.location.country)}<br>${esc(C.location.venue)} &nbsp;·&nbsp; ${esc(O.date)}</div>` : `<div class="nm-side" style="position:absolute;left:${SIDE.x}px;top:${SIDE.top}px;width:${SIDE.w}px;height:${SIDE.bottom - SIDE.top}px;z-index:6">
  <div class="nm-title">
    <div class="eyebrow">${esc(O.line)}</div>
    <p class="nm-tag">${esc(B.tagline)}</p>
  </div>
  <div class="nm-cta">
    ${heroCta(R, WL, B)}
  </div>
  <div class="nm-bot">
    <div class="nm-meta nm-loc">${esc(C.location.city)}, ${esc(C.location.country)}<br>${esc(C.location.venue)} &nbsp;·&nbsp; ${esc(O.date)}</div>
    <img class="nm-partner nm-c" src="${esc(A.irunph)}" alt="iRunPH" width="439" height="160">
  </div>
</div>`}`;
}

function nameAnim(root, tl) {
  const iris = q(root, ".nm-iris");
  const run = q(root, ".nm-run");
  // the iris stays hidden until the flood: no visible full stop after 2027
  tl.set(iris, { xPercent: -50, yPercent: -50, scale: 0 }, 0);
  tl.from(q(root, ".nm-rule"), { scaleX: 0, duration: 0.8, ease: "power4.out" }, 0.1);
  tl.from(q(root, ".nm-mark"), { opacity: 0, x: lay(-20, 0), y: lay(0, -16), duration: 0.5, ease: "power3.out" }, 0.1);
  tl.from(qa(root, ".nm-top"), { opacity: 0, y: -14, duration: 0.5, ease: "power3.out" }, 0.15);
  tl.from(qa(root, ".nm-m > span"), { yPercent: 118, duration: 0.8, ease: "power4.out", stagger: 0.14 }, 0.0);
  // the pixel runner dashes in along the rule from the left
  tl.from(run, { x: lay(-900, -520), opacity: 0, duration: 1.0, ease: "power4.out" }, 0.15);
  // waitlist block rises in the middle of the frame, ready by the landing rest (1.5s)
  tl.from(qa(root, ".nm-c"), { opacity: 0, y: 26, duration: 0.5, ease: "power3.out", stagger: 0.08 }, 0.6);
  tl.from(q(root, ".nm-title"), { opacity: 0, x: lay(40, 0), y: lay(0, 20), duration: 0.6, ease: "power3.out" }, 0.7);
  tl.from(q(root, ".nm-bot"), { opacity: 0, y: 16, duration: 0.5, ease: "power3.out" }, 0.85);
  tl.fromTo(q(root, ".nm-block"), { scale: 1 }, { scale: 1.035, duration: 1.0, ease: "sine.inOut", immediateRender: false }, 1.55);
  tl.fromTo(run, { x: 0 }, { x: lay(60, 40), duration: 1.4, ease: "sine.inOut", immediateRender: false }, 1.55);
  // post rest: the ink flood grows from a point at the end of 2027
  tl.fromTo(iris, { scale: 0 }, { scale: 1, duration: 0.85, ease: "power3.in", immediateRender: false }, 2.5);
  // the waitlist block sits above the type's stacking context, so it leaves with the flood (and stops taking clicks)
  tl.fromTo(q(root, ".nm-cta"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.35, ease: "power2.in", immediateRender: false }, 2.6);
}

// ---------- 05 word burst ----------
const CELLS = [
  { x: 0, y: 0, bg: "var(--cyan)", org: "100% 100%" },
  { x: 960, y: 0, bg: "var(--lime)", org: "0% 100%" },
  { x: 0, y: 540, bg: "var(--orange)", org: "100% 0%" },
  { x: 960, y: 540, bg: "var(--paper)", org: "0% 0%" },
];

// Tektur 900 @75% runs ~0.62em per glyph; keep the longest word (plus its
// square stop) inside the 780px live area of a 960px cell (90px margins).
const WB_MAX_FS = 164, WB_LIVE_W = 740, WB_GLYPH_EM = 0.62, WB_STOP_EM = 0.2;
const wordFs = (words) => {
  const longest = Math.max(...words.map((w) => w.length));
  return Math.min(WB_MAX_FS, Math.floor(WB_LIVE_W / (WB_GLYPH_EM * longest + WB_STOP_EM) / 4) * 4);
};

function burstHtml(C) {
  const words = C.words.slice(0, 4);
  const fs = wordFs(words);
  return words.map((w, i) => {
    const c = CELLS[i];
    return `
<div class="wb-cell" style="position:absolute;left:${c.x}px;top:${c.y}px;width:960px;height:540px;overflow:hidden;background:${c.bg};color:var(--ink);transform-origin:${c.org}">
  <div class="mono" style="position:absolute;left:90px;top:90px;font-size:20px">${pad(i + 1)} / ${pad(words.length)}</div>
  <div class="pixel" style="position:absolute;right:90px;top:64px;font-size:200px;line-height:.8;opacity:.16">${pad(i + 1)}</div>
  <div class="wb-word" style="position:absolute;left:90px;bottom:86px;font:900 ${fs}px/.9 var(--sans);font-stretch:75%;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap;transform-origin:0 100%">${esc(w)}<i style="display:inline-block;width:.15em;height:.15em;background:var(--ink);margin-left:.05em"></i></div>
</div>`;
  }).join("");
}

function burstAnim(root, tl) {
  const cells = qa(root, ".wb-cell"), words = qa(root, ".wb-word");
  cells.forEach((cell, i) => {
    const at = i * 0.3;
    tl.from(cell, { scale: 0, duration: 0.4, ease: "power3.out" }, at);
    tl.from(words[i], { scale: 1.9, opacity: 0, duration: 0.4, ease: "power4.out" }, at + 0.16);
  });
  // everything pulls back to the centre point, leaving ink
  tl.fromTo(cells, { scale: 1 }, { scale: 0, duration: 0.32, ease: "power3.in", stagger: 0.04, immediateRender: false }, 1.5);
}

// ---------- export ----------
export function scenes(C) {
  const base = { stars: false, turn: null, rest: null, restAt: null, shoe: false };
  return [
    { ...base, slug: "access-granted", name: "Ready, set", act: "00 · Check-in", field: "ink", dur: 1.2, html: accessHtml(), anim: accessAnim },
    { ...base, slug: "collapse-to-the-dot", name: "Collapse to the dot", act: "00 · Check-in", field: "ink", dur: 1.8, stars: true, html: collapseHtml(), anim: collapseAnim },
    {
      ...base, slug: "name", name: C.brand.title, act: "01 · TechRun", field: "lime", dur: 3.4,
      turn: [3.1, "ink"], rest: "scroll to enter", restAt: 1.5, html: nameHtml(C), anim: nameAnim,
    },
    { ...base, slug: "word-burst", name: "Word burst", act: "01 · TechRun", field: "quad", dur: 2.0, html: burstHtml(C), anim: burstAnim },
  ];
}
