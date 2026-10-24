// Scenes 20-24: highlights-rest, showcase-1, showcase-2, partners-rest, blast.
import { pad, q, qa, esc, count, linkAttrs } from "./util.js";
import { PALETTE, GRADIENT_STOPS, LIGHT_FIELDS } from "../palette.js";
import { PORTRAIT, lay } from "../stage.js";

const ACT_HL = "03 · Highlights";
const ACT_KITS = "04 · Race Kit";
const ACT_PARTNERS = "07 · Partners";
const ACT_REGISTER = "05 · Register";
// runner GIF: the feet sit ~8% above the bottom of the 512px frame
const FEET = 0.9;

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
${S} .hl-eb{font-size:30px}
${S} .hl-lab{font-size:26px}` : ""}`;

/* ---------------- scene 20: highlights-rest ---------------- */
function highlightsRest(C) {
  const S = scope("highlights-rest");
  const list = C.highlights, n = list.length;
  // desktop: header over a 4x2 grid; portrait: stacked header over a 2x4 grid
  const G = lay(
    { cols: 4, gap: 40, x: 100, w: 400, y0: 336, yEnd: 976, eb: [100, 96], tag: "right:100px;top:100px", head: [146, 136], rule: [300, 1720] },
    { cols: 2, gap: 40, x: 90, w: 430, y0: 392, yEnd: 1850, eb: [90, 100], tag: "left:90px;top:150px", head: [206, 112], rule: [350, 900] },
  );
  const { cols: COLS, gap: GAP, x: X0, w: W, y0: Y0, yEnd: YEND } = G;
  const rows = Math.ceil(n / COLS), H = Math.floor((YEND - Y0 - GAP * (rows - 1)) / rows);
  const cards = list.map((p, i) => {
    const l = X0 + (i % COLS) * (W + GAP), t = Y0 + Math.floor(i / COLS) * (H + GAP);
    const src = photoSrc(C, p.img), sprite = p.sprite || isSprite(src);
    return `<a class="hl-card f-${esc(p.field || "ink")}" ${linkAttrs(p.url)} aria-label="${esc(p.name)}: ${esc(p.category)}"
        style="left:${l}px;top:${t}px;width:${W}px;height:${H}px">
      <span class="hl-ph${sprite ? " sp" : ""}"><img class="${sprite ? "sprite" : "photo"}" src="${esc(src)}" alt=""></span>
      <span class="hl-top"><span>${pad(i + 1)}</span><span>${esc(p.category)}</span></span>
      <span class="hl-nm">${esc(p.name)}</span>
      <span class="hl-ar">${ARROW(36)}</span></a>`;
  }).join("");
  return {
    slug: "highlights-rest", name: "Highlights", act: ACT_HL, field: "cyan", dur: 7.0, stars: false, ammo: 3,
    turn: null, rest: "click a highlight to ask about it", restAt: 6.27, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-card{position:absolute;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;padding:0 24px 22px;border:3px solid var(--ink);
  text-decoration:none;overflow:hidden;transition:background-color .2s,color .2s,box-shadow .2s}
${S} .hl-card.f-ink{background:var(--ink);color:var(--paper)}
${S} .hl-card.f-paper{background:var(--paper);color:var(--ink)}
${S} .hl-card.f-lime{background:var(--lime);color:var(--ink)}
${S} .hl-card.f-orange{background:var(--orange);color:var(--ink)}
${S} .hl-card.f-cyan{background:transparent;color:var(--ink)}
${S} .hl-card:hover,${S} .hl-card:focus-visible{background:var(--ink);color:var(--paper);box-shadow:10px 10px 0 rgba(var(--ink-rgb),.55)}
${S} .hl-card.f-ink:hover,${S} .hl-card.f-ink:focus-visible{background:var(--paper);color:var(--ink)}
${S} .hl-ph{position:absolute;left:0;top:0;right:0;height:132px;border-bottom:3px solid var(--ink);overflow:hidden;background:var(--ink)}
${S} .hl-ph img{left:0;top:0;width:100%;height:100%;transform:scale(1.08);transition:transform .4s}
${S} .hl-ph.sp{background:transparent}
${S} .hl-ph.sp img{object-fit:contain;padding:12px 0;transform:none}
${S} .hl-card:hover .hl-ph img,${S} .hl-card:focus-visible .hl-ph img{transform:scale(1.15)}
${S} .hl-top{display:flex;justify-content:space-between;gap:16px;font:700 17px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-top span:first-child{opacity:.7}
${S} .hl-nm{font:900 42px/.95 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase;padding-right:52px;min-height:80px;display:flex;align-items:flex-end}
${S} .hl-ar{position:absolute;right:20px;bottom:20px;transition:transform .25s}
${S} .hl-card:hover .hl-ar,${S} .hl-card:focus-visible .hl-ar{transform:translate(5px,-5px);color:var(--lime)}
${S} .hl-card.f-ink:hover .hl-ar,${S} .hl-card.f-ink:focus-visible .hl-ar{color:var(--ink)}
${S} .hl-n{font-size:128px;margin-right:.12em}${PORTRAIT ? `
${S} .hl-n{font-size:104px}
${S} .hl-card{padding:0 22px 22px}
${S} .hl-ph{height:150px}
${S} .hl-top{font-size:26px;letter-spacing:.08em}
${S} .hl-nm{font-size:48px;padding-right:44px;min-height:92px}
${S} .hl-ar{right:18px;bottom:22px}` : ""}
</style>
      <div class="hl-eb" style="left:${G.eb[0]}px;top:${G.eb[1]}px">${esc(ACT_HL)} · Race day</div>
      <div class="hl-lab hl-tag" style="${G.tag}"><span class="hl-dot"></span>${esc(C.organizer.date)}</div>
      <h2 class="big hl-head abs" style="left:${X0}px;top:${G.head[0]}px;font-size:${G.head[1]}px;white-space:nowrap">${maskLine(`<span class="pixel hl-n">00</span><span class="ol">Reasons to run</span>`)}</h2>
      <div class="hl-rule abs" style="left:${X0}px;top:${G.rule[0]}px;width:${G.rule[1]}px;height:3px;background:var(--ink);transform-origin:0 50%"></div>
      ${cards}`,
    anim(root, tl) {
      const cs = qa(root, ".hl-card"), nEl = q(root, ".hl-n");
      tl.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.05);
      tl.from(q(root, ".hl-head .mask > span"), { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0.1);
      tl.from(q(root, ".hl-tag"), { opacity: 0, x: 30, duration: 0.6, ease: "power3.out" }, 0.4);
      tl.from(q(root, ".hl-rule"), { scaleX: 0, duration: 1.1, ease: "power3.inOut" }, 0.3);
      cs.forEach((c, i) => {
        const up = i % 2 === 0;
        tl.from(c, { opacity: 0, y: up ? 170 : -170, rotationY: up ? -75 : 75, transformPerspective: 1100,
          duration: 0.95, ease: "power3.out" }, 0.5 + i * 0.55);
      });
      count(tl, (v) => { nEl.textContent = pad(Math.min(n, Math.ceil(v - 1e-6))); }, 0, n, 0.5, n * 0.55);
      // clear the frame just after the rest (6.27) and before main.js's iris (6.45), so nothing rides above the wipe
      tl.fromTo(qa(root, ".hl-card, .hl-eb, .hl-tag, .hl-head, .hl-rule"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.25, ease: "power2.in", immediateRender: false }, 6.3);
    },
  };
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
  `<div class="hl-badge" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px">${starSvg(id)}<div class="hl-bt"><b>${esc(big)}</b><small>${esc(small)}</small></div></div>`;

const showcaseCss = (S, light) => `${baseCss(S)}
${S} .hl-ghost{position:absolute;font:900 1100px/.8 var(--sans);font-stretch:75%;-webkit-text-fill-color:transparent;-webkit-text-stroke:3px currentColor;opacity:.12;white-space:nowrap}
${S} .hl-ttl{position:absolute;margin:0;font:900 180px/.88 var(--sans);font-stretch:75%;letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap}
${S} .hl-acc{${light ? "-webkit-text-fill-color:transparent;-webkit-text-stroke:4px var(--ink)" : "background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent"}}
${S} .hl-pitch{position:absolute;font:600 30px/1.25 var(--sans);letter-spacing:-.005em;width:1000px}
${S} .hl-strikes{position:absolute;display:flex;gap:46px}
${S} .hl-strike{position:relative;display:block;font:900 64px/1 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
${S} .hl-strike i{position:absolute;left:0;right:0;top:100%;height:9px;margin-top:8px;background:var(--grad);transform-origin:0 50%}
${S} .hl-feats{position:absolute;display:flex;gap:18px}
${S} .hl-feats span{border:2px solid currentColor;padding:15px 26px;font:700 22px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-feats span b{color:${light ? "var(--ink)" : "var(--lime)"};margin-right:12px}
${S} .hl-stack{position:absolute;font:700 21px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
${S} .hl-links{position:absolute;display:flex;gap:58px}
${S} .hl-links a{display:inline-flex;align-items:center;gap:14px;transition:color .2s,border-color .2s${light ? ";border-color:var(--ink)" : ""}}
${S} .hl-links a:hover,${S} .hl-links a:focus-visible{${light ? "border-bottom-width:5px" : "color:var(--lime)"}}
${S} .hl-win{z-index:3}
${S} .hl-win .bar span{padding-left:${WIN_BAR_PAD}px}
${S} .hl-bib{position:absolute;z-index:3;height:auto;border-radius:10px;box-shadow:0 18px 40px rgba(var(--ink-rgb),.3)}
${S} .hl-win .body img{left:0;top:0;width:100%;height:100%}
${S} .hl-clip{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block}
${S} .hl-run{z-index:4;width:192px;height:192px}
${S} .hl-badge{position:absolute;z-index:5;color:var(--ink)}
${S} .hl-badge svg{position:absolute;inset:0;width:100%;height:100%}
${S} .hl-badge .hl-bt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
${S} .hl-badge b{font:900 76px/.9 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase}
${S} .hl-badge small{margin-top:8px;max-width:150px;font:700 15px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase}${PORTRAIT ? `
${S} .hl-ghost{display:none}
${S} .hl-pitch{font-size:38px}
${S} .hl-stack{width:900px;font-size:26px;line-height:1.35;white-space:normal}
${S} .hl-feats span{font-size:28px}
${S} .hl-badge b{font-size:70px}` : ""}`;

// Layout of a showcase frame. desktop: copy left, posters right; portrait: title, posters, then copy.
// With bibs (s.bibs) the poster shrinks and the bib cards fan out in a row under it.
function showcaseLayout(s) {
  return s.bibs?.length
    ? lay(
      { x: 110, ghost: [560, 120], eb: 110, ttl: 196, pitch: 556, pitchW: 1000, lab: 646, extra: 690, stack: 822, links: 904,
        win: [1060, 230, 560, 276], bibs: { x: [1030, 1290, 1550], y: [612, 646, 620], w: 250 } },
      { x: 90, ghost: [300, 420], eb: 100, ttl: 150, pitch: 1390, pitchW: 900, lab: 1530, extra: 1576, stack: 1696, links: 1796,
        win: [90, 658, 760, 375], bibs: { x: [90, 395, 700], y: [1120, 1146, 1124], w: 290 } },
    )
    : lay(
      { x: 110, ghost: [560, 120], eb: 110, ttl: 196, pitch: 556, pitchW: 1000, lab: 646, extra: 690, stack: 822, links: 904, win: [1120, 360, 700, 345] },
      { x: 90, ghost: [300, 420], eb: 110, ttl: 170, pitch: 1300, pitchW: 900, lab: 1430, extra: 1476, stack: 1610, links: 1730, win: [90, 730, 900, 444] },
    );
}
const WIN_BAR_PAD = lay(120, 10);   // .hl-win title inset (clears the badge on desktop)
const winTitle = (s) => `${s.title.join("_").toLowerCase()}.jpg`;

function showcase(C, i) {
  const s = C.showcases[i];
  const slug = `showcase-${i + 1}`, S = scope(slug);
  const light = LIGHT_FIELDS.has(s.field);
  const name = s.title.join(" ");
  const accentOf = (line) => (s.accent && line.toLowerCase() === String(s.accent).toLowerCase() ? "hl-acc" : "");
  const titleHtml = s.title.map((l) => maskLine(esc(l), accentOf(l))).join("");
  const two = !!s.bibs?.length, G = showcaseLayout(s);
  const extras = s.strikes
    ? { lab: "Every angle", html: `<div class="hl-strikes" style="left:${G.x}px;top:${G.extra}px">${s.strikes.map((w) =>
        `<span class="hl-strike"><span class="hl-w">${esc(w)}</span><i></i></span>`).join("")}</div>` }
    : { lab: "One bib per distance", html: `<div class="hl-feats" style="left:${G.x}px;top:${G.extra}px">${(s.features || []).map((w, k) =>
        `<span><b>${pad(k + 1)}</b>${esc(w)}</span>`).join("")}</div>` };
  const links = (s.links || []).map(([label, url]) => `<a ${linkAttrs(url)}>${esc(label)} ${ARROW(20)}</a>`).join("");
  const badge = s.badge || { big: "", small: "" };
  const runner = C.assets.runners[s.runner] || C.assets.runners.cyber;
  // framed poster: a Win98 window whose body keeps the image's ratio (singlets 1400x691)
  const [WL, WT, BW, BH] = G.win;
  // badge: desktop overlaps the poster's top-left corner, portrait its top-right (clear of the runner)
  const badgeAt = lay([WL - 120, WT - 150, 240], [WL + BW - 130, WT - 110, 220]);
  const runL = lay(WL + BW - 230, WL + 40);
  // with a clip (s.clip) the scene runs longer: once the frame has built, the poster crossfades into the clip,
  // which scrubs with the scroll inside the window; the rest comes after it, on the finished frame
  const DUR = s.clip ? CLIP.dur : 4.0;
  return {
    slug, name: `Race Kit · ${name}`, act: ACT_KITS, field: s.field, dur: DUR, stars: false, ammo: 3,
    turn: null, rest: "open the links", restAt: s.clip ? CLIP.restAt : 2.5, shoe: false,
    html: `<style>${showcaseCss(S, light)}</style>
      <div class="hl-ghost" style="left:${G.ghost[0]}px;top:${G.ghost[1]}px">${esc(s.ghost || "")}</div>
      <div class="hl-eb" style="left:${G.x}px;top:${G.eb}px">${esc(ACT_KITS)}</div>
      <h2 class="hl-ttl" style="left:${G.x}px;top:${G.ttl}px">${titleHtml}</h2>
      <div class="hl-pitch" style="left:${G.x}px;top:${G.pitch}px;width:${G.pitchW}px">${maskLine(esc(s.pitch))}</div>
      <div class="hl-lab dim" style="left:${G.x}px;top:${G.lab}px">${extras.lab}</div>
      ${extras.html}
      <div class="hl-stack" style="left:${G.x}px;top:${G.stack}px"><span class="dim">Info / </span>${esc(s.stack)}</div>
      <div class="links hl-links" style="left:${G.x}px;top:${G.links}px">${links}</div>
      <div class="win hl-win" style="left:${WL}px;top:${WT}px;width:${BW + 12}px">
        <div class="bar"><span>${esc(winTitle(s))}</span></div>
        <div class="body" style="height:${BH}px">${s.clip ? `<video class="hl-clip" src="${esc(s.clip.src)}" data-scrub muted playsinline
          preload="none" aria-label="${esc(s.clip.alt)}"></video>` : ""}<img class="photo" src="${esc(photoSrc(C, s.img))}" alt="${esc(C.brand.title)} ${esc(name)} poster"></div>
      </div>
      ${two ? s.bibs.map(([src, alt], k) => `<img class="hl-bib" src="${esc(src)}" alt="${esc(alt)}" width="600" height="375"
        style="left:${G.bibs.x[k]}px;top:${G.bibs.y[k]}px;width:${G.bibs.w}px">`).join("") : ""}
      <img class="sprite hl-run" src="${esc(runner.run)}" alt="" width="192" height="192" loading="lazy" style="left:${runL}px;top:${WT + 4 - Math.round(192 * FEET)}px">
      ${badgeHtml(`hl-g${i}`, badge.big, badge.small, ...badgeAt)}`,
    anim(root, tl) {
      const win = q(root, ".hl-win"), run = q(root, ".hl-run");
      tl.from(q(root, ".hl-ghost"), { opacity: 0, yPercent: 14, duration: 1.2, ease: "power3.out" }, 0);
      tl.fromTo(q(root, ".hl-ghost"), { scale: 1 }, { scale: 1.07, duration: DUR, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".hl-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.1);
      tl.from(qa(root, ".hl-ttl .mask > span"), { yPercent: 112, duration: 0.85, ease: "expo.out", stagger: 0.12 }, 0.2);
      tl.from(win, { y: 1000, rotation: 12, duration: 1.1, ease: "power3.out" }, 0.2);
      const drift = DUR - 1.3, tilt = -2.5;
      tl.to(win, { rotation: tilt, duration: drift, ease: "none" }, 1.3);
      // bibs deal in one after another and settle at alternating tilts
      qa(root, ".hl-bib").forEach((el, k) => {
        const tilt = [-4, 3, -2][k % 3];
        tl.fromTo(el, { y: 700, rotation: tilt * 4, opacity: 0 }, { y: 0, rotation: tilt, opacity: 1, duration: 0.9, ease: "power3.out", immediateRender: true }, 0.5 + k * 0.15);
      });
      // the runner jogs in along the top of the window and rides its tilt
      tl.fromTo(run, { x: -420, y: 1000, rotation: 12 }, { x: -420, y: 0, rotation: 0, duration: 1.1, ease: "power3.out", immediateRender: true }, 0.2);
      tl.to(run, { x: 0, y: -8, rotation: tilt, duration: drift, ease: "none" }, 1.3);
      tl.from(q(root, ".hl-badge"), { scale: 0, rotation: -140, duration: 0.8, ease: "back.out(1.7)" }, 0.75);
      tl.fromTo(q(root, ".hl-badge svg"), { rotation: 0 }, { rotation: 300 * (DUR / 4), duration: DUR, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".hl-pitch .mask > span"), { yPercent: 110, duration: 0.7, ease: "expo.out" }, 0.95);
      tl.from(q(root, ".hl-lab.dim"), { opacity: 0, duration: 0.5 }, 1.2);
      qa(root, ".hl-strike").forEach((el, k) => {
        const at = 1.3 + k * 0.28;
        tl.from(el, { yPercent: 100, opacity: 0, duration: 0.5, ease: "power3.out" }, at);
        tl.from(q(el, "i"), { scaleX: 0, duration: 0.45, ease: "power3.inOut" }, at + 0.55);
      });
      qa(root, ".hl-feats span").forEach((el, k) =>
        tl.from(el, { opacity: 0, y: 30, duration: 0.5, ease: "power3.out" }, 1.3 + k * 0.2));
      tl.from(q(root, ".hl-stack"), { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 1.9);
      tl.from(qa(root, ".hl-links a"), { opacity: 0, y: 20, duration: 0.5, ease: "power3.out", stagger: 0.12 }, 2.1);
      if (s.clip) {
        const scrub = videoScrubber(q(root, ".hl-clip")), p = { v: 0 };
        tl.fromTo(q(win, "img"), { autoAlpha: 1 }, { autoAlpha: 0, duration: CLIP.fade[1], ease: "power1.inOut", immediateRender: false }, CLIP.fade[0]);
        // scrolling back before the clip renders this at v = 0, which parks the clip on its first frame
        tl.fromTo(p, { v: 0 }, { v: 1, duration: CLIP.scrub[1], ease: "none", immediateRender: false, onUpdate: () => scrub(p.v) }, CLIP.scrub[0]);
      }
    },
  };
}

// Showcase clip timing (scene seconds): poster fades into the clip, the clip scrubs, then the rest; the iris to
// the next scene starts at dur - 0.55, after the rest.
const CLIP = { fade: [2.7, 0.4], scrub: [2.8, 3.2], restAt: 6.15, dur: 7.0 };

// Seek a paused video to fraction p of its length; one seek in flight at a time, the latest request wins.
function videoScrubber(video) {
  const STUCK_MS = 400;            // give up on a seek that never reports back
  let want = 0, busyAt = 0;
  const go = () => {
    const d = video.duration;
    if (!d || video.readyState < 1) return;
    const t = Math.min(d - 0.04, Math.max(0, want * d));
    if (Math.abs(video.currentTime - t) < 0.02) return;
    busyAt = performance.now();
    video.currentTime = t;
  };
  video.addEventListener("seeked", () => { busyAt = 0; go(); });
  video.addEventListener("loadedmetadata", go);
  video.addEventListener("loadeddata", go);
  video.addEventListener("pause", go);   // after main.js's priming play/pause, return to the scrubbed frame
  return (p) => {
    want = p;
    if (!busyAt || performance.now() - busyAt > STUCK_MS) go();
  };
}

/* ---------------- scene 23: partners-rest ---------------- */
function ringText(C) {
  const unit = `${C.brand.title} · Become a partner · ${C.organizer.name} · `.toUpperCase();
  return `<svg class="hl-ring" viewBox="0 0 300 300" aria-hidden="true">
    <defs><path id="hl-ring-path" d="M150 150 m-128 0 a128 128 0 1 1 256 0 a128 128 0 1 1 -256 0"/></defs>
    <text fill="${PALETTE.paper}" style="font:700 19px var(--mono);letter-spacing:4.2px" textLength="796" lengthAdjust="spacing">
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
    slug: "partners-rest", name: "Partners", act: ACT_PARTNERS, field: "ink", dur: 4.6, stars: true, ammo: 3,
    turn: null, rest: "become a partner", restAt: 3.0, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-cert{transition:border-color .2s,box-shadow .2s,background-color .2s}
${S} .hl-cert:hover,${S} .hl-cert:focus-visible{border-color:var(--lime);background:var(--ink);box-shadow:0 0 0 2px var(--lime),0 24px 60px rgba(var(--lime-rgb),.25)}
${S} .hl-ct{display:flex;justify-content:space-between;font:700 17px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase;padding-left:10px}
${S} .hl-ct span:first-child{color:var(--lime)}
${S} .hl-cn{display:block;font:900 42px/.98 var(--sans);font-stretch:75%;letter-spacing:-.02em;text-transform:uppercase;padding-left:10px}
${S} .hl-cv{display:flex;align-items:center;gap:10px;margin-top:14px;padding-left:10px;font:700 17px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--lime)}
${S} .hl-acc{color:var(--lime)}
${S} .hl-seal{position:absolute;width:300px;height:300px}
${S} .hl-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
${S} .hl-logo{left:68px;top:68px;width:164px;height:164px;object-fit:contain}
${S} .band{top:884px}
${S} .band .hl-tape{display:flex;gap:120px}
</style>
      <div class="hl-eb" style="left:100px;top:100px">${esc(ACT_PARTNERS)}</div>
      <h2 class="big hl-head abs" style="left:100px;top:160px;font-size:170px;white-space:nowrap">${maskLine(`Run with us<span class="hl-acc">.</span>`)}</h2>
      <div class="hl-lab dim hl-hint" style="left:100px;top:410px"><span class="live"></span>${pad(n)} partner slots · click a card to get in touch</div>
      <div class="hl-seal" style="left:1500px;top:80px">${ringText(C)}<img class="photo hl-logo" src="${esc(C.assets.logoRing)}" alt="${esc(C.brand.title)} logo"></div>
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
    { x: 100, eb: 92, mega: 140, win: [1420, 150], rows: 380, rowsW: 1720, sprintY: 884, foot: 902 },
    { x: 90, eb: 110, mega: 170, win: [580, 400], rows: 680, rowsW: 900, sprintY: 1473, foot: 1510 },
  );
  const rows = ct.links.map((l) => `<a class="hl-row" ${linkAttrs(l.url)}>
      <span class="hl-rl">${esc(l.label)}</span><span class="hl-rv">${esc(l.value)}</span>${ARROW(34)}</a>`).join("");
  const sprinter = C.assets.runners.cap;
  return {
    slug: "blast", name: "Let's run", act: ACT_REGISTER, field: "ink", dur: 5.0, stars: false, ammo: 3,
    turn: [0.2, "lime"], rest: null, restAt: null, shoe: false,
    html: `<style>${baseCss(S)}
${S} .hl-wrap .hl-eb{color:inherit}
${S} .hl-row{display:grid;grid-template-columns:300px 1fr 70px;align-items:center;height:84px;padding:0 24px;color:inherit;text-decoration:none;
  border-top:2px solid currentColor;transition:background-color .2s,color .2s,padding .25s}
${S} .hl-row:last-child{border-bottom:2px solid currentColor}
${S} .hl-row:hover,${S} .hl-row:focus-visible{background:var(--ink);color:var(--paper);padding-left:46px}
${S} .hl-rl{font:700 20px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase;opacity:.8}
${S} .hl-rv{font:900 46px/1 var(--sans);font-stretch:75%;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap}
${S} .hl-row svg{justify-self:end;transition:transform .25s,color .2s}
${S} .hl-row:hover svg,${S} .hl-row:focus-visible svg{transform:translate(6px,-6px);color:var(--lime)}
${S} .hl-cover{z-index:3}
${S} .hl-cover .body img{left:0;top:0;width:100%;height:100%}
${S} .hl-sprint{z-index:4;width:192px;height:192px}${PORTRAIT ? `
${S} .hl-row{grid-template-columns:1fr 50px;grid-template-rows:auto auto;row-gap:14px;height:150px;align-content:center}
${S} .hl-rl{grid-row:1;font-size:26px}
${S} .hl-rv{grid-row:2;font-size:52px}
${S} .hl-row svg{grid-column:2;grid-row:1 / span 2}
${S} .hl-foot{flex-direction:column;gap:14px;white-space:normal;font-size:22px !important;line-height:1.35}` : ""}
</style>
      <div class="iris hl-iris" style="width:2600px;height:2600px;margin:-1300px 0 0 -1300px;background:var(--lime);z-index:0"></div>
      <div class="hl-wrap" style="position:absolute;inset:0;z-index:2;color:var(--paper)">
        <div class="hl-eb" style="left:${G.x}px;top:${G.eb}px"><span class="hl-dot"></span>${esc(ACT_REGISTER)} · ${esc(C.organizer.date)}</div>
        <h2 class="mega hl-mega abs" style="left:${G.x - 6}px;top:${G.mega}px;white-space:nowrap">${headline}</h2>
        <div class="win hl-cover" style="left:${G.win[0]}px;top:${G.win[1]}px;width:412px">
          <div class="bar"><span>techrun_2027.jpg</span></div>
          <div class="body" style="height:148px"><img class="photo" src="${esc(C.assets.covers.dark)}" alt="${esc(C.brand.title)} banner: ${esc(C.brand.tagline)}"></div>
        </div>
        <div class="hl-rows abs" style="left:${G.x}px;top:${G.rows}px;width:${G.rowsW}px">${rows}</div>
        <img class="sprite hl-sprint" data-bleed src="${esc(sprinter.run)}" alt="" width="192" height="192" loading="lazy" style="left:-200px;top:${G.sprintY - Math.round(192 * FEET)}px">
        <div class="hl-foot hl-lab" style="left:${G.x}px;right:${G.x}px;top:${G.foot}px;display:flex;justify-content:space-between;gap:40px;letter-spacing:.16em;font-size:17px">
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
      tl.fromTo(q(root, ".hl-sprint"), { x: 0 }, { x: lay(2350, 1500), duration: 3.0, ease: "none", immediateRender: true }, 1.6);
      tl.from(q(root, ".hl-foot"), { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, 1.7);
    },
  };
}

export function scenes(C, P) {
  return [highlightsRest(C), showcase(C, 0), showcase(C, 1), partnersRest(C), blast(C)];
}
