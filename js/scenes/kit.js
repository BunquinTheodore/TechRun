// Scenes 11-19: The Kit. Shoe scenes: kit, exploded, six part close-ups, laced rest.
import { PART_CENTER, PARTS } from "../shoe.js";
import { esc, pad, q, qa } from "./util.js";

const IN = "power3.out", OUT = "power3.in";
const ACT = "04 · The Kit";
const SLUGS = {
  toe: "toe-distances", laces: "laces-race-kit", upper: "upper-finish-line",
  heel: "heel-support", midsole: "midsole-tech", outsole: "outsole-route",
};
const ORDER = PARTS;

// Camera framings. mode "R": text on the right, shoe enters from the left edge. "B": shoe band low, text above.
// "L": text on the left, shoe hangs off the right edge. sx/sy: where the part centre lands, in world units.
// rx/ry rotate the shoe (outsole turns its tread to the camera); framePart corrects the centre for them.
const VIEW = {
  toe: { mode: "R", sx: -2.9, sy: -0.35, s: 2.4, ry: -0.12 },
  laces: { mode: "B", sx: 0.1, sy: -1.55, s: 1.7, ry: -0.12 },
  upper: { mode: "B", sx: 0.2, sy: -2.1, s: 1.6, ry: -0.12 },
  heel: { mode: "L", sx: 3.45, sy: -0.15, s: 1.8, ry: 0.14 },
  midsole: { mode: "B", sx: 0.25, sy: -2.25, s: 1.3, ry: -0.18 },
  outsole: { mode: "B", sx: 0.15, sy: -1.75, s: 1.3, rx: -0.62, ry: -0.1 },
};
// text blocks by mode: eyebrow, name (outline), group title, items grid
const TEXT = {
  B: { ex: 110, ey: 100, nx: 110, ny: 140, nfs: 112, gx: 110, gy: 262, gfs: 128, kx: 1050, ky: 128 },
  R: { ex: 1060, ey: 300, nx: 1060, ny: 350, nfs: 104, gx: 1060, gy: 470, gfs: 136, kx: 1060, ky: 690 },
  L: { ex: 110, ey: 300, nx: 110, ny: 350, nfs: 104, gx: 110, gy: 470, gfs: 136, kx: 110, ky: 690 },
};

const css = (slug) => {
  const S = `.scene[data-slug="${slug}"]`;
  return `<style>
${S} .kx-sk{position:absolute;margin:0;padding:0;list-style:none;display:grid;grid-auto-flow:column;
  grid-template-rows:repeat(var(--rows),56px);grid-auto-columns:360px;column-gap:30px}
${S} .kx-sk li{display:flex;align-items:center;gap:16px;font:700 24px/1 var(--mono);letter-spacing:.1em;
  text-transform:uppercase;color:var(--paper);white-space:nowrap}
${S} .kx-sk li i{flex:none;width:12px;height:12px;border:2px solid rgba(var(--paper-rgb),.5)}
${S} .kx-sk li.p{color:var(--lime)}
${S} .kx-sk li.p i{background:var(--lime);border-color:var(--lime);box-shadow:0 0 10px var(--lime)}
${S} .tag3{left:0;top:0;will-change:transform}
${S} .tag3::after{height:var(--lead,64px)}
${S} .tag3.dn::after{top:auto;bottom:100%}
${S} .tag3.rt::after{left:auto;right:0}
${S} .tag3::before{content:"";position:absolute;width:10px;height:10px;background:var(--ink);
  left:-4px;top:calc(100% + var(--lead,64px) - 5px)}
${S} .tag3.dn::before{top:auto;bottom:calc(100% + var(--lead,64px) - 5px)}
${S} .tag3.rt::before{left:auto;right:-4px}
${S} .kx-chip{position:absolute;width:250px;height:52px;display:flex;align-items:center;justify-content:space-between;
  padding:0 18px;border:2px solid rgba(var(--paper-rgb),.55);background:rgba(var(--ink-rgb),.72);color:var(--paper);
  font:700 16px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase}
${S} .kx-chip span:first-child{color:var(--lime);transition:color .2s}
${S} .kx-chip.on span:first-child{color:var(--ink)}
</style>`;
};

// pose that lands part `name` (assembled centre) at screen (sx, sy) in world units, scale s, rotation rx/ry
function framePart(name, v) {
  const [cx, cy] = PART_CENTER[name];
  const rx = v.rx || 0, ry = v.ry || 0;
  return { px: v.sx - cx * Math.cos(ry) * v.s, py: v.sy - cy * Math.cos(rx) * v.s, s: v.s, rx, ry, rz: 0, ex: 0 };
}

const rise = (tl, el, at, dur = 0.6) => tl.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: dur, ease: "power4.out" }, at);
const drop = (tl, el, at, dur = 0.3) =>
  tl.fromTo(el, { yPercent: 0 }, { yPercent: -110, duration: dur, ease: OUT, immediateRender: false }, at);
const fadeOut = (tl, el, at, dur = 0.25) => tl.fromTo(el, { opacity: 1 }, { opacity: 0, duration: dur, immediateRender: false }, at);

function itemRows(k) {
  return k.items.map((t, i) => `<li class="${k.primary.includes(i) ? "p" : ""}"><i></i><span>${esc(t)}</span></li>`).join("");
}

function partScene(C, P, part, idx) {
  const k = C.kit[part], v = VIEW[part], T = TEXT[v.mode], slug = SLUGS[part];
  const rows = Math.ceil(k.items.length / 2);
  const dur = 2.5;
  const html = `${css(slug)}
    <div class="eyebrow abs kx-eb" style="left:${T.ex}px;top:${T.ey}px">Part ${pad(idx + 1)} / ${pad(ORDER.length)}</div>
    <div class="mask abs" style="left:${T.nx}px;top:${T.ny}px"><span class="big ol kx-nm" style="font-size:${T.nfs}px;white-space:nowrap">${esc(k.part)}</span></div>
    <div class="mask abs" style="left:${T.gx}px;top:${T.gy}px"><span class="big kx-gp" style="font-size:${T.gfs}px;white-space:nowrap">${esc(k.group)}</span></div>
    <ul class="kx-sk" style="left:${T.kx}px;top:${T.ky}px;--rows:${rows}">${itemRows(k)}</ul>`;
  return {
    slug, name: `${k.part} · ${k.group}`, act: ACT, field: "ink", dur,
    stars: true, ammo: [2, 2, 2, 3, 3, 3][idx], turn: null, rest: null, restAt: null, shoe: true, html,
    anim(root, tl) {
      root.classList.add("starry");
      P.pose(tl, 0, 0.95, framePart(part, v), "power3.inOut");
      const eb = q(root, ".kx-eb"), nm = q(root, ".kx-nm"), gp = q(root, ".kx-gp"), lis = qa(root, ".kx-sk li");
      tl.fromTo(eb, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.2);
      rise(tl, nm, 0.3, 0.6);
      rise(tl, gp, 0.45, 0.6);
      tl.fromTo(lis, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.35, ease: IN, stagger: 0.075 }, 0.75);
      // exit
      fadeOut(tl, eb, dur - 0.3);
      drop(tl, nm, dur - 0.35);
      drop(tl, gp, dur - 0.3);
      fadeOut(tl, lis, dur - 0.3);
    },
    tick(root, st, env) {
      const g = env && env.shoe;
      if (g && g.highlight) g.highlight(part);
    },
  };
}

export function scenes(C, P) {
  const total = ORDER.reduce((n, p) => n + C.kit[p].items.length, 0);

  // ---- 11 kit ----
  const kit = {
    slug: "kit", name: "The Kit", act: ACT, field: "orange", dur: 2.0, stars: false, ammo: 1,
    turn: [1.75, "paper"], rest: null, restAt: null, shoe: true,
    html: `
      <div class="iris abs kx-flood" style="z-index:1;left:1046px;top:713px;width:2800px;height:2800px;margin:-1400px 0 0 -1400px;background:var(--paper)"></div>
      <div class="eyebrow abs kx-a-eb" style="z-index:2;left:110px;top:100px">The race kit</div>
      <div class="mask abs" style="z-index:2;left:104px;top:150px"><h1 class="mega kx-a-title"><span>THE KIT.</span></h1></div>
      <div class="abs kx-a-sub" style="z-index:2;right:110px;top:96px;text-align:right;line-height:1.05">
        <div class="pixel" style="font-size:44px">${pad(ORDER.length)} parts</div>
        <div class="pixel" style="font-size:44px">${pad(total)} items</div></div>
      <img class="abs kx-a-mark" src="${esc(C.assets.markSolid)}" alt="" style="z-index:2;right:96px;top:216px;width:132px;height:132px">`,
    anim(root, tl) {
      P.pose(tl, 0, 0.001, {});
      P.pose(tl, 0.1, 1.6, { px: 0.55, py: -1.6, s: 1.05, rx: 0.05, ry: -0.2, rz: 0, ex: 0 }, "power3.out");
      const span = q(root, ".kx-a-title > span");
      tl.fromTo(q(root, ".kx-a-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.15);
      rise(tl, span, 0.2, 0.7);
      tl.fromTo(q(root, ".kx-a-sub"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: IN }, 0.5);
      tl.fromTo(q(root, ".kx-a-mark"), { opacity: 0, rotation: -12, scale: 0.8 }, { opacity: 1, rotation: 0, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.6);
      // flood: paper circle swells from the shoe; text is already ink, so it reads on both fields
      tl.fromTo(q(root, ".kx-flood"), { scale: 0.01 }, { scale: 1, duration: 0.25, ease: "power2.in" }, 1.75);
    },
    tick(root, st, env) {
      const g = env && env.shoe;
      if (g && g.highlight) g.highlight(null);
    },
  };

  // ---- 12 exploded ----  [part, leader direction, text anchor, leader length, anchor x offset px]
  const TAGS = [
    ["toe", "up", "r", 70, 0], ["laces", "up", "l", 60, 0], ["upper", "up", "r", 160, -130],
    ["heel", "up", "r", 140, 0], ["midsole", "up", "l", 50, 420], ["outsole", "dn", "r", 30, -420],
  ];
  let tagCache = null;
  const exploded = {
    slug: "exploded", name: "Exploded", act: ACT, field: "paper", dur: 3.0, stars: false, ammo: 1,
    turn: null, rest: null, restAt: null, shoe: true,
    html: `${css("exploded")}
      <div class="eyebrow ink abs kx-x-eb" style="left:110px;top:100px">Exploded view</div>
      <div class="mask abs" style="left:110px;top:150px"><span class="mid kx-x-l1" style="font-size:64px">Six parts.</span></div>
      <div class="mask abs" style="left:110px;top:218px"><span class="mid ol kx-x-l2" style="font-size:64px">One run.</span></div>
      ${TAGS.map(([p, dir, anchor, lead, dx]) => {
        const n = ORDER.indexOf(p) + 1;
        return `<div class="tag3 ${dir}${anchor === "r" ? " rt" : ""}" data-part="${p}" data-dx="${dx}" style="--lead:${lead}px;opacity:0">` +
          `<b>${pad(n)}</b>${esc(C.kit[p].part)}</div>`;
      }).join("")}`,
    anim(root, tl) {
      P.pose(tl, 0, 0.001, {});
      P.pose(tl, 0.05, 1.3, { px: 1.25, py: -0.35, s: 0.82, rx: 0.08, ry: -0.3, rz: 0, ex: 1 }, "power3.inOut");
      P.pose(tl, 1.4, 1.5, { rx: 0.04, ry: -0.12 }, "sine.inOut");
      tl.fromTo(q(root, ".kx-x-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.1);
      rise(tl, q(root, ".kx-x-l1"), 0.15, 0.6);
      rise(tl, q(root, ".kx-x-l2"), 0.28, 0.6);
      const tags = qa(root, ".tag3");
      tl.fromTo(tags, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: IN, stagger: 0.09 }, 1.1);
      fadeOut(tl, tags, 2.7);
      fadeOut(tl, q(root, ".kx-x-eb"), 2.7);
      drop(tl, q(root, ".kx-x-l1"), 2.65);
      drop(tl, q(root, ".kx-x-l2"), 2.7);
    },
    tick(root, st, env) {
      const g = env && env.shoe;
      if (!g) return;
      if (g.highlight) g.highlight(null);
      if (!tagCache) {
        tagCache = qa(root, ".tag3").map((el) => ({
          el, part: el.dataset.part, dx: +el.dataset.dx || 0, w: 0, h: 0,
          up: el.classList.contains("up"), right: el.classList.contains("rt"),
          lead: parseFloat(el.style.getPropertyValue("--lead")) || 64,
        }));
      }
      for (const t of tagCache) {
        const pt = g.project(t.part);
        if (!pt || pt[0] < 60 || pt[0] > 1860 || pt[1] < 60 || pt[1] > 1020) { t.el.style.visibility = "hidden"; continue; }
        t.el.style.visibility = "";
        if (!t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; }
        const ax = pt[0] + t.dx;
        const x = t.right ? ax - t.w : ax;
        const y = t.up ? pt[1] - t.lead - t.h : pt[1] + t.lead;
        t.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      }
    },
  };

  // ---- 13-18 part close-ups ----
  const partScenes = ORDER.map((p, i) => partScene(C, P, p, i));

  // ---- 19 laced-rest ----
  const chips = ORDER.map((p, i) => {
    const x = 1296 + (i % 2) * 264, y = 800 + Math.floor(i / 2) * 64;
    return `<div class="chip kx-chip" role="button" tabindex="0" aria-label="${esc(`${C.kit[p].part}: ${C.kit[p].group}`)}" data-part="${p}" style="left:${x}px;top:${y}px">` +
      `<span>${pad(i + 1)}</span><span>${esc(C.kit[p].part)}</span></div>`;
  }).join("");
  const laced = {
    slug: "laced-rest", name: "Laced Up", act: ACT, field: "ink", dur: 4.0, stars: true, ammo: 3,
    turn: null, rest: "hover a part to see what's inside", restAt: 1.15, shoe: true,
    html: `${css("laced-rest")}
      <div class="eyebrow abs kx-l-eb" style="left:110px;top:100px">Laced up · ${pad(ORDER.length)} / ${pad(ORDER.length)} parts</div>
      <img class="abs kx-l-badge" src="${esc(C.assets.badge)}" alt="" style="right:110px;top:84px;width:150px;height:150px">
      <div class="mask abs" style="left:104px;top:800px"><h2 class="mega kx-l-title" style="font-size:200px"><span>LACED UP.</span></h2></div>
      <div class="abs mono kx-l-hint" style="left:1296px;top:752px;font-size:16px;color:var(--ash)"><span class="live"></span> Hover a part to see what's inside</div>
      ${chips}`,
    anim(root, tl) {
      root.classList.add("starry");
      P.pose(tl, 0, 1.0, { px: 0.25, py: 0.2, s: 1.05, rx: 0.06, ry: -0.25, rz: 0, ex: 0 }, "power3.inOut");
      P.pose(tl, 3.3, 0.65, { px: 16, ry: -0.5 }, OUT);
      const span = q(root, ".kx-l-title > span"), cs = qa(root, ".chip"), badge = q(root, ".kx-l-badge");
      tl.fromTo(q(root, ".kx-l-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.3);
      rise(tl, span, 0.35, 0.7);
      tl.fromTo(cs, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: IN, stagger: 0.07 }, 0.65);
      tl.fromTo(q(root, ".kx-l-hint"), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: IN }, 0.95);
      tl.fromTo(badge, { opacity: 0, scale: 0.6, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: IN }, 0.4);
      tl.fromTo(badge, { rotation: 0 }, { rotation: 120, duration: 2.2, ease: "none", immediateRender: false }, 1.1);
      // exit with the shoe
      drop(tl, span, 3.35, 0.35);
      fadeOut(tl, cs, 3.4, 0.3);
      fadeOut(tl, q(root, ".kx-l-hint"), 3.35);
      fadeOut(tl, q(root, ".kx-l-eb"), 3.4);
      fadeOut(tl, badge, 3.4, 0.3);
    },
    tick(root, st, env) {
      // clear the last close-up's glow on arrival; after that hover highlighting belongs to main.js
      const g = env && env.shoe;
      if (st < 0.5 && g && g.highlight) g.highlight(null);
    },
  };

  return [kit, exploded, ...partScenes, laced];
}
