// Scenes 06-10: location, timezone, organizer, distances, distances-rest.
import { pad, q, qa, esc, clamp, count, linkAttrs } from "./util.js";
import { PALETTE, GRADIENT_STOPS, rgba } from "../palette.js";

const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
const INK = PALETTE.ink;
const PAPER = PALETTE.paper;
const LIME = PALETTE.lime;
const CYAN = PALETTE.cyan;
const ACT_ABOUT = "02 · About";
const ACT_DIST = "02 · Distances";

// font-size that keeps `text` inside `width` px. k = advance factor (Tektur 900 @ 75% ≈ 0.58, Tiny5 ≈ 0.72)
const fit = (text, max, width, k = 0.58) =>
  Math.max(44, Math.min(max, Math.floor(width / (Math.max(1, String(text).length) * k))));
const mask = (inner, cls = "", style = "") => `<div class="mask ${cls}" style="${style}"><span>${inner}</span></div>`;
const fmtLat = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? "N" : "S"}`;
const fmtLon = (v) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? "E" : "W"}`;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
// SVG gradient stops from the brand gradient (cyan -> lime -> orange)
const gradStops = () => GRADIENT_STOPS.map((c, i) =>
  `<stop offset="${(i / (GRADIENT_STOPS.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("");

/* ------------------------------------------------------------------ 06 location */
function globeSvg(L, R, MID, city) {
  const venue = String(L.venue || "Venue TBA").toUpperCase();
  return `
    <svg viewBox="0 0 760 760" width="760" height="760" style="overflow:visible">
      <defs><linearGradient id="gl-grad" x1="0" y1="0" x2="1" y2="1">${gradStops()}</linearGradient></defs>
      <circle class="gl-orbit" cx="${MID}" cy="${MID}" r="${R + 24}" fill="none" stroke="url(#gl-grad)" stroke-width="3"
        stroke-dasharray="4 10"/>
      <circle cx="${MID}" cy="${MID}" r="${R}" fill="${rgba("ink", 0.92)}" stroke="${PAPER}" stroke-opacity=".45" stroke-width="2"/>
      <path class="gl-grat" fill="none" stroke="${CYAN}" stroke-opacity=".22" stroke-width="1"/>
      <path class="gl-land" fill="${rgba("lime", 0.14)}" stroke="${LIME}" stroke-opacity=".6" stroke-width="1" stroke-linejoin="round"/>
      <g class="gl-pin" opacity="0" transform="translate(${MID} ${MID})">
        <circle class="gl-ring2" r="18" fill="none" stroke="${LIME}" stroke-width="2" stroke-opacity=".55"/>
        <circle class="gl-ring" r="10" fill="none" stroke="${LIME}" stroke-width="3"/>
        <path class="gl-leader" d="M0 0 L96 -86 L360 -86" pathLength="1" fill="none" stroke="${PAPER}" stroke-width="2"
          stroke-dasharray="1" stroke-dashoffset="1"/>
        <text x="110" y="-104" fill="${PAPER}" style="font-family:var(--mono);font-weight:700" font-size="28"
          letter-spacing="3.5" ${city.length * 20.5 > 250 ? `textLength="250" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(city)}</text>
        <text x="110" y="-50" fill="${LIME}" style="font-family:var(--mono);font-weight:700" font-size="24"
          letter-spacing="3">${esc(venue)}</text>
        <rect x="-7" y="-7" width="14" height="14" fill="${LIME}"/>
      </g>
    </svg>`;
}

function locationScene(C) {
  const L = C.location;
  const R = 330, MID = 380;
  const city = String(L.city).toUpperCase();
  const cityPx = fit(city, 170, 880);
  const countryTop = 300 + Math.round(cityPx * 0.9) + 34;
  const tzShort = String(L.tzLabel || L.tz || "").split("·")[0].trim().toUpperCase();
  const start = { lam: -L.lon - 140, phi: -L.lat * 0.4 - 14 };
  const end = { lam: -L.lon, phi: -L.lat };
  const view = { lam: start.lam, phi: start.phi, pin: 0 };
  const hasGeo = typeof d3 !== "undefined" && !!d3.geoOrthographic && !!d3.geoPath;
  const proj = hasGeo ? d3.geoOrthographic().scale(R).translate([MID, MID]).clipAngle(90).precision(0.6) : null;
  const path = hasGeo ? d3.geoPath(proj) : null;
  const graticule = hasGeo && d3.geoGraticule10 ? d3.geoGraticule10() : null;
  let land = null;
  let refs = null;
  let requested = false;

  function redraw() {
    if (!refs || !proj) return;
    proj.rotate([view.lam, view.phi, 0]);
    if (graticule) refs.grat.setAttribute("d", path(graticule) || "");
    if (land) refs.land.setAttribute("d", path(land) || "");
    const xy = proj([L.lon, L.lat]);
    const near = d3.geoDistance ? d3.geoDistance([L.lon, L.lat], [-view.lam, -view.phi]) < 1.45 : true;
    if (!xy) return;
    refs.pin.setAttribute("transform", `translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`);
    refs.pin.setAttribute("opacity", near ? clamp(view.pin).toFixed(3) : "0");
    refs.leader.setAttribute("stroke-dashoffset", (1 - clamp(view.pin)).toFixed(3));
  }

  function loadWorld() {
    if (requested || typeof fetch !== "function" || typeof topojson === "undefined") return;
    requested = true;
    fetch(WORLD_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("world-atlas " + r.status))))
      .then((data) => {
        land = topojson.feature(data, data.objects.countries);
        redraw();
      })
      // the globe still works without land (graticule + pin), but the failure is reported
      .catch((e) => console.error("world-atlas", e));
  }

  return {
    slug: "location", name: "Location", act: ACT_ABOUT, field: "ink", dur: 3.6,
    stars: true, ammo: 0, turn: null, rest: null, restAt: null, shoe: false,
    html: `
      <div class="abs" style="left:110px;top:238px">${mask(`<span class="eyebrow">Host city</span>`)}</div>
      ${mask(esc(city), "big gl-city", `position:absolute;left:104px;top:300px;font-size:${cityPx}px;white-space:nowrap`)}
      ${mask(esc(String(L.country).toUpperCase()), "mid gl-country", `position:absolute;left:110px;top:${countryTop}px;white-space:nowrap;color:var(--ash)`)}
      <div class="abs gl-rule grad-bg" style="left:110px;top:680px;width:780px;height:3px;transform-origin:0 50%"></div>
      <div class="abs gl-read" style="left:110px;top:722px;width:800px;display:grid;grid-template-columns:1fr 1fr 220px;gap:28px 40px">
        <div><div class="mono dim" style="font-size:18px">Latitude</div>
          <div class="mono" id="gl-lat" style="font-size:34px;margin-top:14px;letter-spacing:.06em">${fmtLat(L.lat)}</div></div>
        <div><div class="mono dim" style="font-size:18px">Longitude</div>
          <div class="mono" id="gl-lon" style="font-size:34px;margin-top:14px;letter-spacing:.06em">${fmtLon(L.lon)}</div></div>
        <div><div class="mono dim" style="font-size:18px">Timezone</div>
          <div class="pixel" style="font-size:40px;line-height:1;margin-top:10px;color:var(--lime);white-space:nowrap">${esc(tzShort)}</div></div>
      </div>
      <div class="abs gl-wrap" style="left:1060px;top:160px;width:760px;height:760px">${globeSvg(L, R, MID, city)}</div>`,
    anim(root, tl) {
      root.classList.add("starry");
      refs = {
        grat: q(root, ".gl-grat"), land: q(root, ".gl-land"), pin: q(root, ".gl-pin"),
        ring: q(root, ".gl-ring"), ring2: q(root, ".gl-ring2"), leader: q(root, ".gl-leader"), orbit: q(root, ".gl-orbit"),
      };
      loadWorld();
      redraw();
      tl.from(qa(root, ".mask > span"), { yPercent: 115, duration: 0.8, ease: "power4.out", stagger: 0.1 }, 0.1);
      tl.from(q(root, ".gl-rule"), { scaleX: 0, duration: 0.9, ease: "power3.inOut" }, 0.5);
      tl.from(q(root, ".gl-read"), { opacity: 0, y: 24, duration: 0.7, ease: "power3.out" }, 0.8);
      tl.from(q(root, ".gl-wrap"), { opacity: 0, scale: 0.82, duration: 1.1, ease: "power3.out" }, 0);
      tl.fromTo(refs.orbit, { rotation: -90, svgOrigin: `${MID} ${MID}` },
        { rotation: 0, svgOrigin: `${MID} ${MID}`, duration: 3.0, ease: "power2.out", immediateRender: false }, 0.1);
      tl.fromTo(view, { lam: start.lam, phi: start.phi }, {
        lam: end.lam, phi: end.phi, duration: 2.7, ease: "power3.out", immediateRender: false, onUpdate: redraw,
      }, 0.2);
      tl.fromTo(view, { pin: 0 }, { pin: 1, duration: 0.6, ease: "power2.out", immediateRender: false, onUpdate: redraw }, 2.0);
      count(tl, (v) => { const e = q(root, "#gl-lat"); if (e) e.textContent = fmtLat(v); }, 0, L.lat, 0.4, 2.4, "power3.out");
      count(tl, (v) => { const e = q(root, "#gl-lon"); if (e) e.textContent = fmtLon(v); }, 0, L.lon, 0.4, 2.4, "power3.out");
    },
    tick(root, st, env) {
      if (!refs) return;
      const k = (env.clock * 0.55) % 1;
      refs.ring.setAttribute("r", (10 + 62 * k).toFixed(1));
      refs.ring.setAttribute("stroke-opacity", ((1 - k) * 0.9).toFixed(3));
    },
  };
}

/* ------------------------------------------------------------------ 07 timezone */
function makeFormatter(tz) {
  const opts = { hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" };
  try { return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: tz }); } catch (e) { return new Intl.DateTimeFormat("en-GB", opts); }
}

function clockSvg(CX, FACE) {
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    ticks += `<line class="tz-t" x1="${CX}" y1="${CX - FACE + 18}" x2="${CX}" y2="${CX - FACE + (major ? 54 : 34)}"
      stroke="${major ? LIME : PAPER}" stroke-width="${major ? 6 : 2}" stroke-opacity="${major ? 1 : 0.5}" transform="rotate(${i * 6} ${CX} ${CX})"/>`;
  }
  let nums = "";
  for (let i = 1; i <= 12; i++) {
    const a = (i * 30 * Math.PI) / 180, r = FACE - 94;
    nums += `<text class="tz-n" x="${(CX + Math.sin(a) * r).toFixed(1)}" y="${(CX - Math.cos(a) * r).toFixed(1)}" fill="${PAPER}"
      style="font-family:var(--pixel)" font-size="34" text-anchor="middle" dominant-baseline="central">${pad(i)}</text>`;
  }
  return `
    <svg viewBox="0 0 700 700" width="700" height="700">
      <defs><linearGradient id="tz-grad" x1="0" y1="0" x2="1" y2="0">${gradStops()}</linearGradient></defs>
      <circle cx="${CX}" cy="${CX}" r="${FACE}" fill="${INK}"/>
      <circle cx="${CX}" cy="${CX}" r="${FACE - 6}" fill="none" stroke="url(#tz-grad)" stroke-width="4"/>
      ${ticks}${nums}
      <g class="tz-h"><line x1="${CX}" y1="${CX + 34}" x2="${CX}" y2="${CX - 168}" stroke="${PAPER}" stroke-width="16" stroke-linecap="square"/></g>
      <g class="tz-m"><line x1="${CX}" y1="${CX + 34}" x2="${CX}" y2="${CX - 250}" stroke="${PAPER}" stroke-width="9" stroke-linecap="square"/></g>
      <g class="tz-s"><line x1="${CX}" y1="${CX + 56}" x2="${CX}" y2="${CX - 292}" stroke="${LIME}" stroke-width="4" stroke-linecap="square"/></g>
      <rect x="${CX - 15}" y="${CX - 15}" width="30" height="30" fill="${LIME}"/><rect x="${CX - 5}" y="${CX - 5}" width="10" height="10" fill="${INK}"/>
    </svg>`;
}

function timezoneScene(C) {
  const L = C.location;
  const CX = 350, FACE = 330;
  const fmt = makeFormatter(L.tz);
  let clk = null;
  return {
    slug: "timezone", name: "Timezone", act: ACT_ABOUT, field: "cyan", dur: 3.0,
    stars: false, ammo: 0, turn: null, rest: null, restAt: null, shoe: false,
    html: `
      <style>
        .scene[data-slug="timezone"] .tz-digits{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
        .scene[data-slug="timezone"] .dim{color:rgba(var(--ink-rgb),.72)}
      </style>
      <div class="abs tz-clock" style="left:150px;top:190px;width:700px;height:700px">${clockSvg(CX, FACE)}</div>
      <div class="abs" style="left:930px;top:214px">${mask(`<span class="eyebrow ink">${esc(L.city)} · local time</span>`)}</div>
      ${mask(`<span id="tz-hm" class="tz-digits">00:00</span>`, "mega", "position:absolute;left:918px;top:262px;font-size:250px;white-space:nowrap")}
      <div class="abs tz-sec" style="left:1480px;top:300px;display:grid;gap:22px">
        <div class="mono dim" style="font-size:20px">Seconds · live</div>
        <div class="pixel tz-digits" id="tz-ss" style="font-size:140px;line-height:.8;min-width:150px">00</div>
      </div>
      <div class="abs tz-rule" style="left:930px;top:610px;width:830px;height:3px;background:var(--ink);transform-origin:0 50%"></div>
      ${mask(esc(L.tzLabel), "mid", "position:absolute;left:926px;top:640px;white-space:nowrap")}
      <div class="abs tz-meta" style="left:930px;top:758px">
        <div class="mono" style="font-size:22px;letter-spacing:.2em">${esc(L.tz)} · ${esc(C.organizer.date)}</div>
        <div class="mono dim" style="font-size:20px;margin-top:14px">${esc(L.city)}, ${esc(L.country)}</div>
      </div>`,
    anim(root, tl) {
      clk = {
        h: q(root, ".tz-h"), m: q(root, ".tz-m"), s: q(root, ".tz-s"),
        hm: q(root, "#tz-hm"), ss: q(root, "#tz-ss"), last: "",
      };
      tl.from(q(root, ".tz-clock"), { scale: 0.7, rotation: -40, opacity: 0, duration: 1.2, ease: "power4.out" }, 0);
      tl.from(qa(root, ".tz-t"), { opacity: 0, duration: 0.2, stagger: 0.012 }, 0.1);
      tl.from(qa(root, ".tz-n"), { opacity: 0, duration: 0.4, stagger: 0.04 }, 0.5);
      tl.from(qa(root, ".mask > span"), { yPercent: 115, duration: 0.8, ease: "power4.out", stagger: 0.12 }, 0.2);
      tl.from(q(root, ".tz-sec"), { opacity: 0, x: 40, duration: 0.7, ease: "power3.out" }, 0.55);
      tl.from(q(root, ".tz-rule"), { scaleX: 0, duration: 0.8, ease: "power3.inOut" }, 0.7);
      tl.from(q(root, ".tz-meta"), { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, 1.0);
    },
    tick(root, st) {
      if (!clk) return;
      const now = new Date();
      const p = {};
      for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
      const nowSec = (+p.hour) * 3600 + (+p.minute) * 60 + (+p.second) + now.getMilliseconds() / 1000;
      const k = easeOutCubic(clamp(st / 1.9));
      const disp = nowSec * k;
      const hh = Math.floor(disp / 3600) % 24, mm = Math.floor(disp / 60) % 60, ss = Math.floor(disp) % 60;
      const key = `${hh}:${mm}:${ss}`;
      if (key !== clk.last) {
        clk.last = key;
        clk.hm.textContent = `${pad(hh)}:${pad(mm)}`;
        clk.ss.textContent = pad(ss);
      }
      // hands: the second hand takes one extra turn during the sweep so it lands on the live second
      const secAngle = ((nowSec % 60) + 60) * 6 * k;
      const rot = (a) => `rotate(${a.toFixed(2)} ${CX} ${CX})`;
      clk.h.setAttribute("transform", rot(((disp / 43200) % 1) * 360));
      clk.m.setAttribute("transform", rot(((disp / 3600) % 1) * 360));
      clk.s.setAttribute("transform", rot(secAngle));
    },
  };
}

/* ------------------------------------------------------------------ 08 organizer */
function organizerScene(C) {
  const O = C.organizer;
  const name = String(O.name).toUpperCase();
  const namePx = fit(name, 210, 860);
  const line = String(O.line).toUpperCase();
  const linePx = fit(line, 60, 860);
  const mission = String(O.mission).toUpperCase();
  const missionPx = fit(mission, 56, 1650);
  const nameTop = 236, lineTop = nameTop + Math.round(namePx * 0.9) + 30;
  const ruleTop = 590;
  const missionTop = ruleTop + 42;
  const placeTop = missionTop + Math.round(missionPx * 0.95) + 30;
  const dateTop = placeTop + 64;
  return {
    slug: "organizer", name: "Organizer", act: ACT_ABOUT, field: "paper", dur: 3.4,
    stars: false, ammo: 0, turn: null, rest: null, restAt: null, shoe: false,
    html: `
      <style>
        .scene[data-slug="organizer"] .og-win{left:1060px;top:224px;width:750px}
        .scene[data-slug="organizer"] .og-win .body{height:276px}
        .scene[data-slug="organizer"] .og-win img{left:0;top:0;width:100%;height:100%}
        .scene[data-slug="organizer"] .og-date{-webkit-text-stroke-color:var(--ink)}
      </style>
      <div class="abs og-bar grad-bg" style="left:90px;top:176px;width:12px;height:${ruleTop - 176}px;transform-origin:50% 0"></div>
      <div class="abs" style="left:140px;top:176px">${mask(`<span class="eyebrow ink">${esc(O.label)}</span>`)}</div>
      <div class="abs mono dim og-ed" style="right:110px;top:176px;font-size:20px;letter-spacing:.3em">${esc(O.edition)}</div>
      ${mask(esc(name), "big", `position:absolute;left:130px;top:${nameTop}px;font-size:${namePx}px;white-space:nowrap`)}
      ${mask(esc(line), "mid", `position:absolute;left:136px;top:${lineTop}px;font-size:${linePx}px;white-space:nowrap`)}
      <div class="win og-win">
        <div class="bar"><span>techrun_2027.jpg</span></div>
        <div class="body"><img class="photo" src="${esc(C.assets.covers.halftone)}" alt="TechRun 2027 halftone wordmark"></div>
      </div>
      <div class="abs og-rule" style="left:140px;top:${ruleTop}px;width:1690px;height:3px;background:var(--ink);transform-origin:0 50%"></div>
      ${mask(esc(mission), "mid", `position:absolute;left:136px;top:${missionTop}px;font-size:${missionPx}px;white-space:nowrap`)}
      <div class="abs mono dim og-place" style="left:140px;top:${placeTop}px;font-size:22px;letter-spacing:.24em">${esc(C.brand.title)} · ${esc(C.location.city)}, ${esc(C.location.country)}</div>
      ${mask(esc(String(O.date).toUpperCase()), "big ol og-date", `position:absolute;left:130px;top:${dateTop}px;white-space:nowrap;padding:.06em .1em .06em .02em`)}`,
    anim(root, tl) {
      tl.from(q(root, ".og-bar"), { scaleY: 0, duration: 1.0, ease: "power4.inOut" }, 0);
      tl.from(qa(root, ".mask > span"), { yPercent: 115, duration: 0.9, ease: "power4.out", stagger: 0.14 }, 0.2);
      tl.from(q(root, ".og-ed"), { opacity: 0, duration: 0.6 }, 0.4);
      tl.from(q(root, ".og-win"), { opacity: 0, scale: 0.86, y: 30, duration: 0.7, ease: "back.out(1.6)" }, 0.55);
      tl.from(q(root, ".og-win img"), { scale: 1.12, duration: 2.2, ease: "power2.out" }, 0.55);
      tl.from(q(root, ".og-rule"), { scaleX: 0, duration: 1.0, ease: "power3.inOut" }, 0.7);
      tl.from(q(root, ".og-place"), { opacity: 0, x: -30, duration: 0.7, ease: "power3.out" }, 1.3);
      tl.from(q(root, ".og-date"), { x: 90, duration: 1.4, ease: "power3.out" }, 1.2);
    },
  };
}

/* ------------------------------------------------------------------ 09 distances */
const FLOOD_R = 1300;
const floodClip = (r) => `circle(${Math.max(0, r).toFixed(1)}px at 960px 540px)`;
// One full-stage text layer; the scene stacks an ink copy and a paper copy (clipped to the flood).
const distancesText = (sub, color, eyeStyle, z, cls = "", clip = "") => `
  <div class="abs ${cls}" style="left:0;top:0;width:1920px;height:1080px;z-index:${z};pointer-events:none;color:${color}${clip ? `;clip-path:${clip}` : ""}">
    <div class="abs ds-eye" style="left:100px;top:300px">${mask(`<span class="eyebrow ink" style="${eyeStyle}">Race categories</span>`)}</div>
    <div class="abs" style="left:90px;top:362px;width:1740px;overflow:hidden">
      <h2 class="mega ds-mega" style="font-size:350px;white-space:nowrap;color:inherit"><span class="ds-slide" style="display:block">DISTANCES</span></h2>
    </div>
    <div class="abs mono ds-sub" style="left:104px;top:712px;font-size:24px">${esc(sub)}</div>
  </div>`;

function distancesScene(C) {
  const cats = C.categories;
  const sub = `${pad(cats.length)} categories · ${cats.map((c) => c.name).join(" · ")}`;
  return {
    slug: "distances", name: "Distances", act: ACT_DIST, field: "lime", dur: 2.0,
    stars: false, ammo: 1, turn: [1.45, "ink"], rest: null, restAt: null, shoe: false,
    html: `
      <div class="abs ds-flood" style="left:50%;top:50%;width:${FLOOD_R * 2}px;height:${FLOOD_R * 2}px;margin:-${FLOOD_R}px 0 0 -${FLOOD_R}px;border-radius:50%;background:var(--ink);z-index:1"></div>
      ${distancesText(sub, "var(--ink)", "", 2)}
      ${distancesText(sub, "var(--paper)", "color:var(--lime)", 3, "ds-inv", floodClip(0))}`,
    anim(root, tl) {
      tl.from(qa(root, ".ds-slide"), { xPercent: 110, duration: 0.85, ease: "power4.out" }, 0);
      tl.to(qa(root, ".ds-slide"), { x: -50, duration: 1.4, ease: "none" }, 0.85);
      tl.from(qa(root, ".ds-eye .mask > span"), { yPercent: 115, duration: 0.6, ease: "power3.out" }, 0.25);
      tl.from(qa(root, ".ds-sub"), { opacity: 0, y: 20, duration: 0.5, ease: "power3.out" }, 0.5);
      // iris to ink; a paper copy of the text, clipped to the same circle, reveals with it
      const flood = { r: 0 };
      const inv = q(root, ".ds-inv");
      tl.fromTo(q(root, ".ds-flood"), { scale: 0 }, { scale: 1, duration: 0.55, ease: "power3.inOut" }, 1.05);
      tl.fromTo(flood, { r: 0 }, {
        r: FLOOD_R, duration: 0.55, ease: "power3.inOut", immediateRender: false,
        onUpdate: () => { if (inv) inv.style.clipPath = floodClip(flood.r); },
      }, 1.05);
    },
  };
}

/* ------------------------------------------------------------------ 10 distances-rest */
const RUNNER_KEYS = ["cyber", "hoodie", "cap"];
const S = '.scene[data-slug="distances-rest"]';
const restCss = (ROW) => `
  <style>
    ${S} .dr{position:absolute;left:90px;width:1740px;height:${ROW}px;display:grid;
      grid-template-columns:70px 210px 1fr 440px 230px 56px;align-items:center;padding:0 22px 0 24px;
      color:var(--paper);text-decoration:none;transition:background-color .25s,color .25s}
    ${S} .dr:hover,${S} .dr:focus-visible{background:var(--lime);color:var(--ink)}
    ${S} .dr-i{font-size:22px;opacity:.9}
    ${S} .dr-run{position:relative;width:192px;height:192px}
    ${S} .dr-run img{left:0;top:0;width:192px;height:192px;transition:opacity .15s}
    ${S} .dr-run .run{opacity:0}
    ${S} .dr:hover .dr-run img,${S} .dr:focus-visible .dr-run img{filter:drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink)) drop-shadow(0 2px 0 var(--ink)) drop-shadow(0 -2px 0 var(--ink))}
    ${S} .dr:hover .dr-run .walk,${S} .dr:focus-visible .dr-run .walk{opacity:0}
    ${S} .dr:hover .dr-run .run,${S} .dr:focus-visible .dr-run .run{opacity:1}
    ${S} .dr-name span{font:900 150px/.9 var(--sans);font-stretch:75%;letter-spacing:-.03em;white-space:nowrap}
    ${S} .dr-meta{display:grid;gap:14px}
    ${S} .dr-meta b{font:700 26px/1.1 var(--mono);letter-spacing:.14em;text-transform:uppercase}
    ${S} .dr-meta i{font:600 20px/1.2 var(--mono);font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:var(--ash);transition:color .25s}
    ${S} .dr:hover .dr-meta i,${S} .dr:focus-visible .dr-meta i{color:var(--ink)}
    ${S} .dr-bib{display:grid;gap:8px}
    ${S} .dr-bib small{font:600 18px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;opacity:.88}
    ${S} .dr-bib .pixel{font-size:48px;line-height:1}
    ${S} .dr-arrow{justify-self:end;transition:transform .25s}
    ${S} .dr:hover .dr-arrow,${S} .dr:focus-visible .dr-arrow{transform:translate(6px,-6px)}
  </style>`;

function categoryRow(C, c, i, ROW, TOP) {
  const R = C.assets.runners[RUNNER_KEYS[i % RUNNER_KEYS.length]];
  return `
    <a class="dr" ${linkAttrs(c.url)} aria-label="Register for the ${esc(c.name)} ${esc(c.label)}" style="top:${TOP + i * ROW}px">
      <span class="mono dr-i">${pad(i + 1)}</span>
      <span class="dr-run">
        <img class="sprite walk" src="${esc(R.walk)}" alt="">
        <img class="sprite run" src="${esc(R.run)}" alt="">
      </span>
      <span class="mask dr-name"><span>${esc(c.name)}</span></span>
      <span class="dr-meta"><b>${esc(c.label)}</b><i>${esc(c.note)}</i></span>
      <span class="dr-bib"><small>Bib no.</small><span class="pixel">${esc(c.bib)}</span></span>
      <svg class="dr-arrow" viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="currentColor" stroke-width="3"
        stroke-linecap="square"><path d="M6 26 L26 6 M10 6 H26 V22"/></svg>
    </a>`;
}

function distancesRestScene(C) {
  const cats = C.categories.slice(0, 3);
  const ROW = 230, TOP = 196;
  const rows = cats.map((c, i) => categoryRow(C, c, i, ROW, TOP)).join("");
  const lines = Array.from({ length: cats.length + 1 }, (_, i) =>
    `<div class="abs dr-line" style="left:90px;top:${TOP + i * ROW}px;width:1740px;height:2px;background:var(--paper);opacity:.35;transform-origin:0 50%"></div>`).join("");
  return {
    slug: "distances-rest", name: "Categories", act: ACT_DIST, field: "ink", dur: 3.0,
    stars: true, ammo: 1, turn: null, rest: "pick your distance", restAt: 1.7, shoe: false,
    html: `
      ${restCss(ROW)}
      <div class="abs" style="left:100px;top:112px">${mask(`<span class="eyebrow">Distances</span>`)}</div>
      <div class="abs mono dim dr-count" style="right:100px;top:116px;font-size:20px">${pad(cats.length)} categories · ${esc(C.brand.title)}</div>
      ${lines}${rows}`,
    anim(root, tl) {
      root.classList.add("starry");
      tl.from(q(root, ".eyebrow"), { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 0);
      tl.from(q(root, ".dr-count"), { opacity: 0, duration: 0.6 }, 0.2);
      tl.from(qa(root, ".dr-line"), { scaleX: 0, duration: 0.8, ease: "power3.inOut", stagger: 0.1 }, 0.2);
      tl.from(qa(root, ".dr-name > span"), { yPercent: 115, duration: 0.8, ease: "power4.out", stagger: 0.12 }, 0.35);
      tl.from(qa(root, ".dr-run"), { opacity: 0, x: -60, duration: 0.7, ease: "power3.out", stagger: 0.12 }, 0.4);
      tl.from(qa(root, ".dr-i, .dr-meta, .dr-bib"), { opacity: 0, y: 18, duration: 0.6, ease: "power3.out", stagger: 0.03 }, 0.6);
      tl.from(qa(root, ".dr-arrow"), { opacity: 0, duration: 0.5, ease: "power2.out", stagger: 0.1 }, 0.8);
    },
  };
}

export function scenes(C, P) {
  return [locationScene(C), timezoneScene(C), organizerScene(C), distancesScene(C), distancesRestScene(C)];
}
