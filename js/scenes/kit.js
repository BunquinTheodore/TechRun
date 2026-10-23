// Scenes 11-19: the Arsenal. Gun scenes: arsenal, exploded, six part close-ups, loaded rest.
import { PART_CENTER, PARTS } from "../gun.js";
import { esc, pad, q, qa } from "./util.js";

const IN = "power3.out", OUT = "power3.in";
const FALLBACK_CENTER = {
  suppressor: [4.3, 0.55], barrel: [2.6, 0.55], slide: [0.3, 0.65], frame: [-0.1, 0.15], sights: [0.3, 1.05], grip: [-1.5, -0.9],
};
const SLUGS = {
  suppressor: "suppressor-ai-ml", barrel: "barrel-backend", slide: "slide-frameworks",
  frame: "frame-languages", sights: "sights-tools", grip: "grip-creative",
};
const ORDER = PARTS && PARTS.length === 6 ? PARTS : ["suppressor", "barrel", "slide", "frame", "sights", "grip"];

// Camera framings. mode "R": text on the right, gun enters from the left edge. "B": gun band low, text above.
// "L": text on the left, gun hangs off the right edge. sx/sy are where the part centre lands, in gun units.
const VIEW = {
  suppressor: { mode: "R", sx: -3.1, sy: -0.1, s: 2.6, ry: -0.1 },
  barrel: { mode: "B", sx: 1.2, sy: -1.75, s: 2.3, ry: -0.1 },
  slide: { mode: "B", sx: 0.2, sy: -1.9, s: 2.2, ry: -0.1 },
  frame: { mode: "B", sx: -0.6, sy: -2.35, s: 2.2, ry: -0.1 },
  sights: { mode: "B", sx: -0.4, sy: -1.5, s: 2.3, ry: -0.1 },
  grip: { mode: "L", sx: 3.4, sy: -1.9, s: 2.2, ry: -0.1 },
};
// text blocks by mode: eyebrow, name (outline), group title, skills grid
const TEXT = {
  B: { ex: 110, ey: 100, nx: 110, ny: 140, nfs: 112, gx: 110, gy: 262, gfs: 128, kx: 1050, ky: 128 },
  R: { ex: 1060, ey: 300, nx: 1060, ny: 350, nfs: 104, gx: 1060, gy: 470, gfs: 150, kx: 1060, ky: 690 },
  L: { ex: 110, ey: 300, nx: 110, ny: 350, nfs: 104, gx: 110, gy: 470, gfs: 150, kx: 110, ky: 690 },
};

const CSS = `<style>
.ax-sk{position:absolute;margin:0;padding:0;list-style:none;display:grid;grid-auto-flow:column;
  grid-template-rows:repeat(var(--rows),56px);grid-auto-columns:360px;column-gap:30px}
.ax-sk li{display:flex;align-items:center;gap:16px;font:700 24px/1 var(--mono);letter-spacing:.1em;
  text-transform:uppercase;color:var(--bone);white-space:nowrap}
.ax-sk li i{flex:none;width:10px;height:26px;border:2px solid rgba(237,237,237,.5);border-radius:3px 3px 1px 1px}
.ax-sk li.p{color:var(--red)}
.ax-sk li.p i{background:var(--red);border-color:var(--red);box-shadow:0 0 10px var(--red)}
.scene .tag3{left:0;top:0;will-change:transform}
.scene .tag3::after{height:var(--lead,64px)}
.scene .tag3.dn::after{top:auto;bottom:100%}
.scene .tag3.rt::after{left:auto;right:0}
.scene .tag3::before{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:var(--red);
  left:-4px;top:calc(100% + var(--lead,64px) - 5px)}
.scene .tag3.dn::before{top:auto;bottom:calc(100% + var(--lead,64px) - 5px)}
.scene .tag3.rt::before{left:auto;right:-4px}
.scene .ax-chip{position:absolute;width:250px;height:52px;display:flex;align-items:center;justify-content:space-between;
  padding:0 18px;border:2px solid rgba(237,237,237,.55);background:rgba(5,5,5,.72);color:var(--bone);
  font:700 16px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase}
.scene .ax-chip span:first-child{color:var(--red);transition:color .2s}
.scene .ax-chip.on span:first-child{color:var(--bone)}
</style>`;

// pose that lands part `name` (assembled centre) at screen (sx, sy) in gun units, scale s
function framePart(name, sx, sy, s, extra = {}) {
  const [cx, cy] = (PART_CENTER && PART_CENTER[name]) || FALLBACK_CENTER[name];
  return { px: sx - cx * s, py: sy - cy * s, s, rx: 0, rz: 0, ex: 0, ...extra };
}

const rise = (tl, el, at, dur = 0.6) => tl.fromTo(el, { yPercent: 110 }, { yPercent: 0, duration: dur, ease: "power4.out" }, at);
const drop = (tl, el, at, dur = 0.3) =>
  tl.fromTo(el, { yPercent: 0 }, { yPercent: -110, duration: dur, ease: OUT, immediateRender: false }, at);

function skillRows(C, part) {
  const s = C.skills[part];
  return s.items.map((t, i) => `<li class="${s.primary.includes(i) ? "p" : ""}"><i></i><span>${esc(t)}</span></li>`).join("");
}

function partScene(C, P, part, idx) {
  const s = C.skills[part], v = VIEW[part], T = TEXT[v.mode];
  const rows = Math.ceil(s.items.length / 2);
  const dur = 2.5;
  const html = `${CSS}
    <div class="eyebrow abs ax-eb" style="left:${T.ex}px;top:${T.ey}px">Part ${pad(idx + 1)} / 06</div>
    <div class="mask abs" style="left:${T.nx}px;top:${T.ny}px"><span class="big ol ax-nm" style="font-size:${T.nfs}px;white-space:nowrap">${esc(s.part)}</span></div>
    <div class="mask abs" style="left:${T.gx}px;top:${T.gy}px"><span class="big ax-gp" style="font-size:${T.gfs}px;white-space:nowrap">${esc(s.group)}</span></div>
    <ul class="ax-sk" style="left:${T.kx}px;top:${T.ky}px;--rows:${rows}">${skillRows(C, part)}</ul>`;
  return {
    slug: SLUGS[part], name: `${s.part} · ${s.group}`, act: "04 · Arsenal", field: "ink", dur,
    stars: true, ammo: [2, 2, 2, 3, 3, 3][idx], turn: null, rest: null, restAt: null, gun: true, html,
    anim(root, tl) {
      root.classList.add("starry");
      P.pose(tl, 0, 0.95, framePart(part, v.sx, v.sy, v.s, { ry: v.ry }), "power3.inOut");
      const eb = q(root, ".ax-eb"), nm = q(root, ".ax-nm"), gp = q(root, ".ax-gp"), lis = qa(root, ".ax-sk li");
      tl.fromTo(eb, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.2);
      rise(tl, nm, 0.3, 0.6);
      rise(tl, gp, 0.45, 0.6);
      tl.fromTo(lis, { opacity: 0, x: -28 }, { opacity: 1, x: 0, duration: 0.35, ease: IN, stagger: 0.075 }, 0.75);
      // exit
      tl.fromTo(eb, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, dur - 0.3);
      drop(tl, nm, dur - 0.35);
      drop(tl, gp, dur - 0.3);
      tl.fromTo(lis, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, dur - 0.3);
    },
    tick(root, st, env) {
      const g = env && env.gun;
      if (g && g.highlight) g.highlight(part);
    },
  };
}

export function scenes(C, P) {
  const total = ORDER.reduce((n, k) => n + C.skills[k].items.length, 0);

  // ---- 11 arsenal ----
  const arsenal = {
    slug: "arsenal", name: "Arsenal", act: "04 · Arsenal", field: "red", dur: 2.0, stars: false, ammo: 1,
    turn: [1.75, "bone"], rest: null, restAt: null, gun: true,
    html: `
      <div class="iris abs ax-flood" style="z-index:1;left:1050px;top:720px;width:2800px;height:2800px;margin:-1400px 0 0 -1400px;background:var(--bone)"></div>
      <div class="eyebrow abs ax-a-eb" style="z-index:2;left:110px;top:100px">The arsenal</div>
      <div class="mask abs" style="z-index:2;left:104px;top:150px"><h1 class="mega ax-a-title" style="color:var(--bone)"><span>ARSENAL.</span></h1></div>
      <div class="abs mono ax-a-sub" style="z-index:2;right:110px;top:100px;text-align:right;font-size:20px;line-height:1.7">
        ${pad(ORDER.length)} parts<br>${pad(total)} skills</div>`,
    anim(root, tl) {
      P.pose(tl, 0, 0.001, {});
      P.pose(tl, 0.1, 1.6, { px: -1.05, py: -1.28, s: 1.05, rx: 0.05, ry: -0.2, rz: 0, ex: 0 }, "power3.out");
      const title = q(root, ".ax-a-title"), span = q(root, ".ax-a-title > span");
      tl.fromTo(q(root, ".ax-a-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.15);
      rise(tl, span, 0.2, 0.7);
      tl.fromTo(q(root, ".ax-a-sub"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, ease: IN }, 0.5);
      // flood: bone circle swells from the gun, text flips to ink once it is covered
      tl.fromTo(q(root, ".ax-flood"), { scale: 0.01 }, { scale: 1, duration: 0.25, ease: "power2.in", immediateRender: false }, 1.75);
      tl.set(title, { color: "#050505" }, 1.9);
    },
    tick(root, st, env) {
      const g = env && env.gun;
      if (g && g.highlight) g.highlight(null);
    },
  };

  // ---- 12 exploded ----
  const TAGS = [
    ["suppressor", "up", "l", 70], ["barrel", "dn", "l", 70], ["slide", "up", "r", 70],
    ["sights", "up", "l", 150], ["frame", "dn", "l", 70], ["grip", "dn", "r", 130],
  ];
  let tagCache = null;
  const exploded = {
    slug: "exploded", name: "Exploded", act: "04 · Arsenal", field: "bone", dur: 3.0, stars: false, ammo: 1,
    turn: null, rest: null, restAt: null, gun: true,
    html: `${CSS}
      <div class="eyebrow ink abs ax-x-eb" style="left:110px;top:100px">Exploded view</div>
      <div class="mask abs" style="left:110px;top:150px"><span class="mid ax-x-l1" style="font-size:64px">Six parts.</span></div>
      <div class="mask abs" style="left:110px;top:218px"><span class="mid ol ax-x-l2" style="font-size:64px">One weapon.</span></div>
      ${TAGS.map(([p, dir, anchor, lead]) => {
        const n = ORDER.indexOf(p) + 1;
        return `<div class="tag3 ${dir}${anchor === "r" ? " rt" : ""}" data-part="${p}" style="--lead:${lead}px;opacity:0">` +
          `<b>${pad(n)}</b>${esc(C.skills[p].part)}</div>`;
      }).join("")}`,
    anim(root, tl) {
      P.pose(tl, 0, 0.001, {});
      P.pose(tl, 0.05, 1.3, { px: -1.3, py: -0.2, s: 0.88, rx: 0.08, ry: -0.3, rz: 0, ex: 1 }, "power3.inOut");
      P.pose(tl, 1.4, 1.5, { rx: 0.04, ry: -0.12 }, "sine.inOut");
      tl.fromTo(q(root, ".ax-x-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.1);
      rise(tl, q(root, ".ax-x-l1"), 0.15, 0.6);
      rise(tl, q(root, ".ax-x-l2"), 0.28, 0.6);
      const tags = qa(root, ".tag3");
      tl.fromTo(tags, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: IN, stagger: 0.09 }, 1.1);
      tl.fromTo(tags, { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, 2.7);
      tl.fromTo(q(root, ".ax-x-eb"), { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, 2.7);
      drop(tl, q(root, ".ax-x-l1"), 2.65);
      drop(tl, q(root, ".ax-x-l2"), 2.7);
    },
    tick(root, st, env) {
      const g = env && env.gun;
      if (!g) return;
      if (g.highlight) g.highlight(null);
      if (!tagCache) tagCache = qa(root, ".tag3").map((el) => ({ el, part: el.dataset.part, w: 0, h: 0 }));
      for (const t of tagCache) {
        const pt = g.project(t.part);
        if (!pt || pt[0] < 60 || pt[0] > 1860 || pt[1] < 60 || pt[1] > 1020) { t.el.style.visibility = "hidden"; continue; }
        t.el.style.visibility = "";
        if (!t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; }
        const up = t.el.classList.contains("up"), right = t.el.classList.contains("rt");
        const lead = parseFloat(t.el.style.getPropertyValue("--lead")) || 64;
        const x = right ? pt[0] - t.w : pt[0];
        const y = up ? pt[1] - lead - t.h : pt[1] + lead;
        t.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      }
    },
  };

  // ---- 13-18 part close-ups ----
  const partScenes = ORDER.map((p, i) => partScene(C, P, p, i));

  // ---- 19 loaded-rest ----
  const chips = ORDER.map((p, i) => {
    const x = 1296 + (i % 2) * 264, y = 800 + Math.floor(i / 2) * 64;
    return `<div class="chip ax-chip" role="button" tabindex="0" data-part="${p}" style="left:${x}px;top:${y}px">` +
      `<span>${pad(i + 1)}</span><span>${esc(C.skills[p].part)}</span></div>`;
  }).join("");
  const loaded = {
    slug: "loaded-rest", name: "Loaded", act: "04 · Arsenal", field: "ink", dur: 4.0, stars: true, ammo: 3,
    turn: null, rest: "hover a part to see its skills", restAt: 1.15, gun: true,
    html: `${CSS}
      <div class="eyebrow abs ax-l-eb" style="left:110px;top:100px">Magazine full · ${pad(ORDER.length)} / ${pad(ORDER.length)} parts</div>
      <div class="mask abs" style="left:104px;top:790px"><h2 class="mega ax-l-title" style="font-size:230px"><span>LOADED.</span></h2></div>
      <div class="abs mono ax-l-hint" style="left:1296px;top:752px;font-size:16px;color:var(--ash)"><span class="live"></span>Hover a part to see its skills</div>
      ${chips}`,
    anim(root, tl) {
      root.classList.add("starry");
      P.pose(tl, 0, 1.0, { px: -1.95, py: 1.02, s: 1.3, rx: 0.06, ry: -0.25, rz: 0, ex: 0 }, "power3.inOut");
      P.pose(tl, 3.3, 0.65, { px: 16, ry: -0.5 }, OUT);
      const span = q(root, ".ax-l-title > span"), cs = qa(root, ".chip");
      tl.fromTo(q(root, ".ax-l-eb"), { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.4, ease: IN }, 0.3);
      rise(tl, span, 0.35, 0.7);
      tl.fromTo(cs, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: IN, stagger: 0.07 }, 0.65);
      tl.fromTo(q(root, ".ax-l-hint"), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: IN }, 0.95);
      // exit with the gun
      drop(tl, span, 3.35, 0.35);
      tl.fromTo(cs, { opacity: 1 }, { opacity: 0, duration: 0.3, immediateRender: false }, 3.4);
      tl.fromTo(q(root, ".ax-l-hint"), { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, 3.35);
      tl.fromTo(q(root, ".ax-l-eb"), { opacity: 1 }, { opacity: 0, duration: 0.25, immediateRender: false }, 3.4);
    },
    tick(root, st, env) {
      // clear the last close-up's glow on arrival; after that hover highlighting belongs to main.js
      const g = env && env.gun;
      if (st < 0.5 && g && g.highlight) g.highlight(null);
    },
  };

  return [arsenal, exploded, ...partScenes, loaded];
}
