// Scenes 01-05: biometric-scan, access-granted, collapse-to-the-dot, name, word-burst.
import { pad, q, qa, esc, decode, count, linkAttrs } from "./util.js";
import { PORTRAIT, SW, SH, lay } from "../stage.js";

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- 01 runner check-in: fingerprint scan ----------
const FP_RINGS = 24;
function fingerprintPaths() {
  const cx = 280, cy = 350, out = [];
  for (let i = 0; i < FP_RINGS; i++) {
    const rx = 14 + i * 10.6, ry = 20 + i * 13.2;
    const gap0 = hash(i * 3.1) * Math.PI * 2, gapLen = 0.3 + hash(i * 5.7) * 0.9;
    const span = Math.PI * 2 - gapLen, steps = 96;
    let d = "";
    for (let k = 0; k <= steps; k++) {
      const a = gap0 + gapLen + (span * k) / steps;
      const w = 1 + 0.035 * Math.sin(a * 3 + i) + 0.02 * Math.sin(a * 7 - i * 2);
      const x = cx + rx * Math.cos(a) * w;
      const y = cy + ry * Math.sin(a) * w * (Math.sin(a) > 0 ? 0.94 : 1);
      d += (k ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    out.push(`<path d="${d}" pathLength="1" stroke-dasharray="1" />`);
  }
  return out.join("");
}

const SCAN_TOP = lay(190, 420), SCAN_H = 660;
const FP_L = lay(680, 260);                 // fingerprint box left (560 x 700)
const BS_FS = lay(20, 30);                  // readout type size

function biometricHtml(C) {
  const paths = fingerprintPaths();
  const brk = (l, t, bw) => `<i class="bs-br" style="left:${l}px;top:${t}px;border-width:${bw}"></i>`;
  const S = '.scene[data-slug="biometric-scan"]';
  const M = lay(130, 90);
  return `
<style>
  ${S} .bs-br { position:absolute; width:64px; height:64px; border:0 solid var(--paper); opacity:.75; }
  ${S} .bs-mono { position:absolute; font:600 ${BS_FS}px/1.5 var(--mono); letter-spacing:.22em; text-transform:uppercase; color:var(--ash); white-space:nowrap; }
  ${S} .bs-mono b { color:var(--paper); font-weight:700; }
  ${S} .bs-ticks { position:absolute; width:26px; height:${SCAN_H}px; top:${SCAN_TOP}px;
    background:repeating-linear-gradient(to bottom, rgba(var(--paper-rgb),.38) 0 2px, transparent 2px 14px); transform-origin:50% 0; }
  ${S} .bs-fp path { fill:none; stroke-width:3; stroke-linecap:butt; }
  ${S} .bs-st { position:absolute; top:0; right:0; white-space:nowrap; }
  ${S} .bs-px { position:absolute; width:18px; height:18px; }
</style>
<div class="eyebrow abs bs-eye" style="left:${M}px;top:${lay(128, 110)}px">Runner check-in</div>
<div class="bs-mono abs bs-l1" style="left:${M}px;top:${lay(186, 180)}px">Runner ID <b>001</b><br>${esc(C.brand.title)}<br>Sensor 500 dpi</div>
<div class="bs-mono abs bs-r1" style="right:${M}px;top:${lay(128, 180)}px;text-align:right">Check-in <b>01 / 05</b><br>Timing chip <b>linked</b></div>

<div class="bs-ticks bs-t" style="left:${FP_L - 60}px"></div>
<div class="bs-ticks bs-t" style="left:${FP_L + 594}px"></div>
${brk(FP_L - 40, SCAN_TOP - 40, "3px 0 0 3px")}${brk(FP_L + 536, SCAN_TOP - 40, "3px 3px 0 0")}${brk(FP_L - 40, SCAN_TOP + 676, "0 0 3px 3px")}${brk(FP_L + 536, SCAN_TOP + 676, "0 3px 3px 0")}
<i class="bs-px" style="left:${FP_L + 558}px;top:${SCAN_TOP - 40}px;background:var(--cyan)"></i>
<i class="bs-px" style="left:${FP_L + 576}px;top:${SCAN_TOP - 22}px;background:var(--lime)"></i>
<i class="bs-px" style="left:${FP_L - 18}px;top:${SCAN_TOP + 704}px;background:var(--orange)"></i>

<svg class="abs bs-fp" style="left:${FP_L}px;top:${SCAN_TOP}px;filter:drop-shadow(0 0 7px rgba(var(--lime-rgb),.55))" width="560" height="700" viewBox="0 0 560 700">
  <defs>
    <clipPath id="bsFpShape"><ellipse cx="280" cy="350" rx="272" ry="338"/></clipPath>
    <clipPath id="bsClip"><rect class="bs-clip" x="0" y="0" width="560" height="0"/></clipPath>
  </defs>
  <g clip-path="url(#bsFpShape)">
    <g class="fpb" style="stroke:rgba(var(--paper-rgb),.26)">${paths}</g>
    <g clip-path="url(#bsClip)"><g class="fpr" style="stroke:var(--lime)">${paths}</g></g>
  </g>
</svg>
<div class="scanline bs-scan" style="top:${SCAN_TOP}px${PORTRAIT ? `;left:${FP_L - 20}px;right:auto;width:600px` : ""}"></div>

<div class="abs bs-num" style="left:${M}px;top:${lay(740, 1330)}px;display:flex;align-items:flex-end;gap:14px">
  <div class="mono" style="position:absolute;left:0;top:${lay(-40, -50)}px;font-size:${lay(18, 28)}px;color:var(--ash);white-space:nowrap">Check-in progress</div>
  <span class="pixel bs-val" style="font-size:190px;line-height:.82">00</span>
  <span class="pixel" style="font-size:72px;line-height:.9;color:var(--lime)">%</span>
</div>

<div class="bs-mono abs bs-r2" style="right:${M}px;top:${lay(690, 1540)}px;text-align:right;line-height:1.9">
  Stride <b>mapped</b><br>
  Ridges <b class="bs-min">000</b><br>
  <span style="position:relative;display:inline-block;min-width:${lay(330, 420)}px;height:${lay(38, 57)}px">
    <span class="bs-st bs-s1">Status <b style="color:var(--lime)">scanning</b></span>
    <span class="bs-st bs-s2">Status <b style="color:var(--lime)">cleared</b></span>
  </span>
</div>`;
}

function biometricAnim(root, tl) {
  const rect = q(root, ".bs-clip");
  const scan = q(root, ".bs-scan");
  const val = q(root, ".bs-val");
  const minu = q(root, ".bs-min");

  tl.from(qa(root, ".bs-eye, .bs-l1, .bs-r1"), { opacity: 0, x: -24, duration: 0.5, ease: "power3.out", stagger: 0.08 }, 0.05);
  tl.from(qa(root, ".bs-br"), { opacity: 0, scale: 1.4, duration: 0.5, ease: "power3.out", stagger: 0.05 }, 0.05);
  tl.from(qa(root, ".bs-px"), { scale: 0, duration: 0.25, ease: "steps(3)", stagger: 0.12 }, 0.3);
  tl.from(qa(root, ".bs-t"), { scaleY: 0, duration: 0.7, ease: "power3.out" }, 0.15);
  tl.from(qa(root, ".fpb path"), { strokeDashoffset: 1, duration: 0.9, ease: "power2.out", stagger: 0.035 }, 0.1);
  tl.from(qa(root, ".fpr path"), { strokeDashoffset: 1, duration: 0.9, ease: "power2.out", stagger: 0.035 }, 0.1);

  // scan sweep: lime reveal clip and the scanline travel together
  tl.fromTo(rect, { attr: { height: 0 } }, { attr: { height: SCAN_H }, duration: 2, ease: "power1.inOut", immediateRender: false }, 0.3);
  tl.fromTo(scan, { y: 0 }, { y: SCAN_H, duration: 2, ease: "power1.inOut" }, 0.3);
  tl.fromTo(scan, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" }, 0.3);

  tl.from(q(root, ".bs-num"), { opacity: 0, y: 30, duration: 0.5, ease: "power3.out" }, 0.1);
  count(tl, (v) => { val.textContent = pad(Math.round(v)); }, 0, 97, 0.15, 2.15, "power2.out");
  count(tl, (v) => { val.textContent = v >= 99.5 ? "100" : pad(Math.round(v)); }, 97, 100, 2.3, 0.1);

  tl.from(q(root, ".bs-r2"), { opacity: 0, x: 24, duration: 0.5, ease: "power3.out" }, 0.5);
  count(tl, (v) => { minu.textContent = pad(Math.round(v), 3); }, 0, 142, 0.3, 1.9, "power1.out");
  tl.fromTo(q(root, ".bs-s2"), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 2.0);
  tl.fromTo(q(root, ".bs-s1"), { opacity: 1 }, { opacity: 0, duration: 0.01, immediateRender: false }, 2.0);
}

// ---------- 02 / 03 shared "READY / SET." block ----------
const READY = "READY", SET = "SET.";
const CX = SW / 2, CY = SH / 2;                // frame centre
const RB_X = lay(200, 60);                     // corner brackets inset from the sides
const RB_FS = lay(250, 220);                   // READY / SET type size
function readyBlock(p) {
  const br = (l, t, bw) => `<i class="${p}br" style="position:absolute;left:${l}px;top:${t}px;width:64px;height:64px;border:0 solid var(--lime);border-width:${bw}"></i>`;
  const line = `position:absolute;left:0;width:${SW}px;text-align:center;white-space:nowrap;font-size:${RB_FS}px;line-height:.82`;
  const top = CY - lay(320, 290), bot = CY + lay(296, 270), right = SW - RB_X - 64;
  return `
<div class="${p}grp" style="position:absolute;inset:0;transform-origin:${CX}px ${CY}px">
  ${br(RB_X, top, "4px 0 0 4px")}${br(right, top, "4px 4px 0 0")}${br(RB_X, bot, "0 0 4px 4px")}${br(right, bot, "0 4px 4px 0")}
  <div class="eyebrow ${p}eye" style="position:absolute;left:0;width:${SW}px;justify-content:center;top:${CY - lay(278, 250)}px">Runner cleared</div>
  <div class="pixel ${p}l1" style="${line};top:${CY - Math.round(RB_FS * 0.824)}px">${READY}</div>
  <div class="pixel ${p}l2" style="${line};top:${CY}px;color:var(--lime)">${SET}</div>
  <div class="grad-bg ${p}bar" style="position:absolute;left:${CX - lay(300, 240)}px;width:${lay(600, 480)}px;top:${CY + lay(260, 232)}px;height:6px;transform-origin:0 50%"></div>
  <div class="mono ${p}foot" style="position:absolute;left:0;width:${SW}px;text-align:center;top:${CY + lay(296, 266)}px;font-size:${lay(18, 26)}px;color:var(--ash)">Check-in complete &nbsp;·&nbsp; start line open</div>
  <i class="${p}line" style="position:absolute;left:${lay(160, 60)}px;width:${SW - 2 * lay(160, 60)}px;top:${CY - 1}px;height:3px;background:var(--lime);box-shadow:0 0 22px var(--lime),0 0 50px var(--lime);opacity:0"></i>
</div>`;
}

function accessHtml() {
  return readyBlock("ag-") + `<div class="ag-flash" style="position:absolute;inset:0;background:var(--lime);opacity:0;z-index:9"></div>`;
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
<div class="mono cd-cap" style="position:absolute;left:0;width:${SW}px;text-align:center;top:${CY + 90}px;font-size:${lay(18, 28)}px;color:var(--ash)">Start line &nbsp;·&nbsp; KM 0</div>`;
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

// ---------- 04 name (hero on lime): the "first page" with every key detail and the register button ----------
const NAME_FS = lay(270, 300);  // TECH / RUN (Tektur 900 condensed)
const YEAR_FS = lay(204, 226);  // 2027 (Tiny5), sized to sit under TECH
const PERIOD_EM = 0.2;          // full stop, relative to YEAR_FS
// hero layout: desktop keeps the type left, register block centred, legs top right; portrait stacks
// type, register block and copy, with the legs striding in at the bottom right beside the copy
const NM = lay(
  { m: 130, markX: 112, markY: 78, mark: 96, metaX: 214, metaY: 110, metaFs: 20, ruleY: 166, ruleW: 760, blockY: 236,
    legs: [1000, -70, 1000], ctaX: 750, ctaY: 384, ctaW: 420, chipFs: 40, chipW: 112, regH: 108, regFs: 44, noteFs: 16,
    titleX: 1240, titleY: 716, titleW: 590, tagFs: 40, botY: 900 },
  { m: 90, markX: 90, markY: 70, mark: 84, metaX: 190, metaY: 98, metaFs: 26, ruleY: 172, ruleW: 900, blockY: 240,
    legs: [540, 1440, 640], ctaX: 90, ctaY: 1010, ctaW: 900, chipFs: 52, chipW: 170, regH: 132, regFs: 56, noteFs: 24,
    titleX: 90, titleY: 1450, titleW: 560, tagFs: 44, botY: 1700 },
);
const REG_W = lay(420, 640);
// pixel bits around the runner's feet (stage px for the desktop legs, size, colour token); re-mapped onto the portrait legs
const PIXELS = [
  [1236, 548, 30, "ink"], [1198, 590, 20, "cyan"], [1290, 610, 16, "orange"], [1520, 548, 14, "ink"],
  [1716, 470, 28, "ink"], [1768, 430, 18, "orange"], [1668, 516, 14, "cyan"], [1800, 520, 12, "ink"],
  [1420, 600, 20, "ink"], [1460, 566, 12, "cyan"],
].map(([x, y, sz, c]) => {
  const [lx, ly, lw] = NM.legs, k = lw / 1000;
  return [Math.round(lx + (x - 1000) * k), Math.round(ly + (y + 70) * k), Math.max(10, Math.round(sz * lay(1, 0.9))), c];
});

function nameHtml(C) {
  const B = C.brand, L = B.lines, A = C.assets, O = C.organizer, R = C.register;
  const S = '.scene[data-slug="name"]';
  const px = PIXELS.map(([x, y, s, c]) => `<i class="nm-px" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:var(--${c})"></i>`).join("");
  const dist = C.categories.map((c) => `<a class="nm-d" ${linkAttrs(c.url)} aria-label="Register for the ${esc(c.name)} ${esc(c.label)}">${esc(c.name)}</a>`).join("");
  return `
<style>
  ${S} .nm-meta { position:absolute; font:600 ${NM.metaFs}px/1.6 var(--mono); letter-spacing:.22em; text-transform:uppercase; color:var(--ink); white-space:nowrap; }
  ${S} .nm-tech { font-size:${NAME_FS}px; line-height:.84; }
  ${S} .nm-year { font-size:${YEAR_FS}px; line-height:.8; letter-spacing:.06em; margin-left:-.02em; }
  ${S} .nm-row { display:flex; align-items:flex-end; }
  ${S} .nm-pw { position:relative; display:inline-block; width:${PERIOD_EM}em; height:${PERIOD_EM}em; margin-left:.02em; margin-bottom:.02em; font-size:${YEAR_FS}px; }
  ${S} .nm-pw .iris { width:3400px; height:3400px; background:var(--ink); z-index:30; margin:0; border-radius:0; }
  ${S} .nm-px { position:absolute; z-index:3; }
  ${S} .nm-legs { position:absolute; left:${NM.legs[0]}px; top:${NM.legs[1]}px; width:${NM.legs[2]}px; height:auto; z-index:2; mix-blend-mode:multiply; }
  ${S} .nm-cta { position:absolute; left:${NM.ctaX}px; top:${NM.ctaY}px; width:${NM.ctaW}px; z-index:6; display:grid; justify-items:center; gap:${lay(22, 28)}px; text-align:center; }
  ${S} .nm-cta .eyebrow { color:var(--ink); }
  ${S} .nm-dists { display:flex; gap:${lay(12, 20)}px; }
  ${S} a.nm-d { font:400 ${NM.chipFs}px/1 var(--pixel); color:var(--ink); text-decoration:none; border:3px solid var(--ink); padding:14px 20px 10px; min-width:${NM.chipW}px;
    transition:background-color .2s, color .2s; }
  ${S} a.nm-d:hover, ${S} a.nm-d:focus-visible { background:var(--ink); color:var(--lime); }
  ${S} a.nm-reg { position:relative; display:flex; align-items:center; justify-content:center; gap:18px; width:${REG_W}px; height:${NM.regH}px;
    background:var(--ink); color:var(--lime); text-decoration:none; font:900 ${NM.regFs}px/1 var(--sans); font-stretch:75%; letter-spacing:.02em;
    text-transform:uppercase; box-shadow:0 18px 40px rgba(var(--ink-rgb),.28); transition:color .2s, transform .2s; }
  ${S} a.nm-reg::after { content:""; position:absolute; left:0; right:0; bottom:0; height:8px; background:var(--grad); }
  ${S} a.nm-reg::before { content:""; position:absolute; inset:0; background:var(--grad); opacity:0; transition:opacity .2s; }
  ${S} a.nm-reg:hover, ${S} a.nm-reg:focus-visible { color:var(--ink); transform:translateY(-3px); }
  ${S} a.nm-reg:hover::before, ${S} a.nm-reg:focus-visible::before { opacity:1; }
  ${S} a.nm-reg span, ${S} a.nm-reg svg { position:relative; }
  ${S} .nm-title .eyebrow { font-size:${lay(20, 26)}px; letter-spacing:${lay(".34em", ".26em")}; }
  ${S} .nm-note { margin-top:8px; white-space:nowrap; font:600 ${NM.noteFs}px/1.4 var(--mono); letter-spacing:.2em; text-transform:uppercase; color:rgba(var(--ink-rgb),.72); }
</style>
<img class="nm-mark" src="${esc(A.markSolid)}" alt="" width="${NM.mark}" height="${NM.mark}" style="position:absolute;left:${NM.markX}px;top:${NM.markY}px;width:${NM.mark}px;height:${NM.mark}px">
<div class="nm-meta nm-top" style="left:${NM.metaX}px;top:${NM.metaY}px">${esc(O.label)} ${esc(B.org)}</div>
<i class="nm-rule" style="position:absolute;left:${NM.m}px;width:${NM.ruleW}px;top:${NM.ruleY}px;height:3px;background:var(--ink);transform-origin:0 50%"></i>

<img class="nm-legs" data-bleed src="${esc(A.runnerLegs)}" alt="" width="1000" height="666">
${px}

<div class="nm-block" style="position:absolute;left:${NM.m}px;top:${NM.blockY}px;z-index:5;transform-origin:0 100%">
  <div class="mega nm-tech"><span class="mask nm-m"><span>${esc(L[0])}</span></span></div>
  <div class="mega nm-tech"><span class="mask nm-m"><span>${esc(L[1])}</span></span></div>
  <div class="nm-row" style="margin-top:22px">
    <div class="pixel nm-year"><span class="mask nm-m"><span>${esc(L[2])}</span></span></div>
    <span class="nm-pw"><i class="iris nm-iris" style="left:50%;top:50%"></i></span>
  </div>
</div>

<div class="nm-cta">
  <div class="eyebrow nm-c">Pick your distance</div>
  <div class="nm-dists nm-c">${dist}</div>
  <a class="nm-reg nm-c" ${linkAttrs(R.url)} aria-label="${esc(R.label)}: ${esc(B.title)}"><span>${esc(R.label)}</span>
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M8 6h10v10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg></a>
  <div class="nm-note nm-c">${esc(R.note)}</div>
</div>

<div class="nm-title" style="position:absolute;left:${NM.titleX}px;top:${NM.titleY}px;width:${NM.titleW}px;z-index:4">
  <div class="eyebrow">${esc(O.line)}</div>
  <p style="margin:24px 0 0;font:600 ${NM.tagFs}px/1.18 var(--sans);color:var(--ink)">${esc(B.tagline)}</p>
</div>
<div class="nm-meta nm-bot" style="left:${NM.titleX}px;top:${NM.botY}px;white-space:normal;width:${NM.titleW}px">${esc(C.location.city)}, ${esc(C.location.country)}<br>${esc(C.location.venue)} &nbsp;·&nbsp; ${esc(O.date)}</div>`;
}

function nameAnim(root, tl) {
  const fsW = (YEAR_FS * PERIOD_EM) / 3400; // iris scale that matches the full stop
  const iris = q(root, ".nm-iris");
  tl.set(iris, { xPercent: -50, yPercent: -50 }, 0);
  tl.from(q(root, ".nm-rule"), { scaleX: 0, duration: 0.8, ease: "power4.out" }, 0.1);
  tl.from(q(root, ".nm-mark"), { opacity: 0, x: -20, duration: 0.5, ease: "power3.out" }, 0.1);
  tl.from(qa(root, ".nm-top"), { opacity: 0, y: -14, duration: 0.5, ease: "power3.out" }, 0.15);
  tl.from(qa(root, ".nm-m > span"), { yPercent: 118, duration: 0.8, ease: "power4.out", stagger: 0.14 }, 0.0);
  // runner strides in from the right, pixels pop around the feet
  tl.from(q(root, ".nm-legs"), { x: 260, opacity: 0, duration: 1.0, ease: "power4.out" }, 0.1);
  tl.from(qa(root, ".nm-px"), { scale: 0, duration: 0.2, ease: "steps(2)", stagger: 0.04 }, 0.55);
  // register block rises in the middle of the frame, ready by the landing rest (1.5s)
  tl.from(qa(root, ".nm-c"), { opacity: 0, y: 26, duration: 0.5, ease: "power3.out", stagger: 0.08 }, 0.6);
  tl.from(q(root, ".nm-title"), { opacity: 0, x: 40, duration: 0.6, ease: "power3.out" }, 0.7);
  tl.from(q(root, ".nm-bot"), { opacity: 0, y: 16, duration: 0.5, ease: "power3.out" }, 0.85);
  // full stop pops in, then (post rest) swells to flood the frame in ink
  tl.fromTo(iris, { scale: 0 }, { scale: fsW, duration: 0.35, ease: "back.out(3)" }, 0.9);
  tl.fromTo(q(root, ".nm-block"), { scale: 1 }, { scale: 1.035, duration: 1.0, ease: "sine.inOut", immediateRender: false }, 1.55);
  tl.fromTo(q(root, ".nm-legs"), { x: 0 }, { x: -60, duration: 1.4, ease: "sine.inOut", immediateRender: false }, 1.55);
  tl.fromTo(iris, { scale: fsW }, { scale: 1, duration: 0.85, ease: "power3.in", immediateRender: false }, 2.5);
  // the register block sits above the type's stacking context, so it leaves with the flood (and stops taking clicks)
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
  return Math.min(WB_MAX_FS, Math.floor(WB_LIVE_W / (WB_GLYPH_EM * longest + WB_STOP_EM)));
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
  const base = { stars: false, ammo: 0, turn: null, rest: null, restAt: null, shoe: false };
  return [
    { ...base, slug: "biometric-scan", name: "Runner check-in", act: "00 · Check-in", field: "ink", dur: 2.4, html: biometricHtml(C), anim: biometricAnim },
    { ...base, slug: "access-granted", name: "Ready, set", act: "00 · Check-in", field: "ink", dur: 1.2, html: accessHtml(), anim: accessAnim },
    { ...base, slug: "collapse-to-the-dot", name: "Collapse to the dot", act: "00 · Check-in", field: "ink", dur: 1.8, stars: true, html: collapseHtml(), anim: collapseAnim },
    {
      ...base, slug: "name", name: C.brand.title, act: "01 · TechRun", field: "lime", dur: 3.4,
      turn: [3.1, "ink"], rest: "scroll to enter", restAt: 1.5, html: nameHtml(C), anim: nameAnim,
    },
    { ...base, slug: "word-burst", name: "Word burst", act: "01 · TechRun", field: "quad", dur: 2.0, html: burstHtml(C), anim: burstAnim },
  ];
}
