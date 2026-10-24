// Shared helpers for scene modules.

export const pad = (n, w = 2) => String(n).padStart(w, "0");
export const q = (root, sel) => root.querySelector(sel);
export const qa = (root, sel) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// href attributes for a content link: mailto opens in place, web links open a new tab
export const linkAttrs = (url) => (/^mailto:/.test(url) ? `href="${esc(url)}"` : `href="${esc(url)}" target="_blank" rel="noopener"`);
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&/<>+=";

// Scramble-decode `text` into `el` over [at, at+dur] of timeline `tl`. Deterministic, so it scrubs both ways.
export function decode(tl, el, text, at = 0, dur = 0.6) {
  const o = { p: 0 };
  tl.fromTo(o, { p: 0 }, {
    p: 1, duration: dur, ease: "none", immediateRender: false,
    onUpdate() {
      const n = text.length, step = Math.floor(o.p * 24);
      let out = "";
      for (let i = 0; i < n; i++) {
        const c = text[i];
        out += c === " " || o.p >= (i + 1) / n ? c : GLYPHS[Math.floor(hash(i * 7 + step) * GLYPHS.length)];
      }
      el.textContent = out;
    },
  }, at);
  tl.set(el, {}, at); // keeps the timeline's start honest
}

// Tween a number from a to b and call fn(value) on every render (scrub-safe counter).
export function count(tl, fn, from, to, at, dur, ease = "none") {
  const o = { v: from };
  tl.fromTo(o, { v: from }, { v: to, duration: dur, ease, immediateRender: false, onUpdate: () => fn(o.v) }, at);
}

// Shoe pose tracker. All shoe scenes share one poser (made in main.js), built in scene order, so each pose
// tween starts exactly where the previous one ended.  The FIRST call in every shoe scene must use at = 0.
export const IDLE_POSE = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1, ex: 0 };
export function makePoser(state) {
  let last = { ...IDLE_POSE, px: -16 };
  return {
    // tween the shoe from wherever the previous call left it to `to` (partial pose ok)
    pose(tl, at, dur, to, ease = "power3.inOut") {
      const from = { ...last }, full = { ...last, ...to };
      tl.fromTo(state, from, { ...full, duration: Math.max(dur, 0.001), ease, immediateRender: false }, at);
      last = full;
      return full;
    },
    get last() { return { ...last }; },
  };
}
