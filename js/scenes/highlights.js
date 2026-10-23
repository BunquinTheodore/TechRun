// Scenes 20-24: deployed-rest, showcase-1, showcase-2, credentials-rest, blast.
import { pad, q, qa, esc, count } from "./util.js";

const ARROW = (px = 34) =>
  `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square" aria-hidden="true"><path d="M5 19L19 5M8 5h11v11"/></svg>`;

// shared inline styles (all classes prefixed pj-)
const CSS = `<style>
.pj-eb{position:absolute;display:flex;align-items:center;gap:19px;font:700 20px/1 var(--mono);letter-spacing:.34em;text-transform:uppercase;color:var(--red);white-space:nowrap}
.pj-eb::before{content:"";width:56px;height:2px;background:currentColor}
.red .pj-eb{color:var(--ink)}
.pj-acc{color:var(--red)} .red .pj-acc{color:var(--ink)}
.pj-lab{position:absolute;font:700 20px/1 var(--mono);letter-spacing:.3em;text-transform:uppercase;white-space:nowrap}
.pj-live{display:inline-block;width:14px;height:14px;border-radius:50%;background:currentColor;margin-right:14px;vertical-align:1px}

/* project grid */
.pj-card{position:absolute;display:flex;flex-direction:column;justify-content:space-between;padding:26px 28px;border:3px solid var(--ink);
  text-decoration:none;transition:background-color .2s,color .2s,box-shadow .2s}
.pj-card.f-ink{background:var(--ink);color:var(--bone)}
.pj-card.f-bone{background:var(--bone);color:var(--ink)}
.pj-card.f-red{background:transparent;color:var(--ink)}
.pj-card:hover,.pj-card:focus-visible{background:var(--ink);color:var(--bone);box-shadow:10px 10px 0 rgba(5,5,5,.55)}
.pj-card.f-ink:hover,.pj-card.f-ink:focus-visible{background:var(--bone);color:var(--ink)}
.pj-card .pj-top{display:flex;justify-content:space-between;font:700 18px/1 var(--mono);letter-spacing:.18em;text-transform:uppercase}
.pj-card .pj-top span:first-child{opacity:.6}
.pj-card .pj-nm{font:900 46px/.95 var(--sans);letter-spacing:-.03em;text-transform:uppercase;padding-right:56px}
.pj-card .pj-ar{position:absolute;right:24px;bottom:24px;color:var(--red);transition:transform .25s}
.pj-card.f-red .pj-ar{color:var(--ink)}
.pj-card.f-red:hover .pj-ar,.pj-card.f-red:focus-visible .pj-ar{color:var(--red)}
.pj-card:hover .pj-ar{transform:translate(5px,-5px)}

/* showcase */
.pj-ghost{position:absolute;font:900 1100px/.8 var(--sans);-webkit-text-fill-color:transparent;-webkit-text-stroke:3px currentColor;opacity:.14;white-space:nowrap}
.pj-ttl{position:absolute;margin:0;font:900 180px/.88 var(--sans);letter-spacing:-.045em;text-transform:uppercase}
.pj-pitch{position:absolute;font:600 34px/1.25 var(--sans);letter-spacing:-.01em;width:1020px}
.pj-strikes{position:absolute;display:flex;gap:46px}
.pj-strike{position:relative;display:block;font:900 64px/1 var(--sans);letter-spacing:-.03em;text-transform:uppercase}
.pj-strike i{position:absolute;left:-6px;right:-6px;top:52%;height:9px;margin-top:-4px;background:var(--red);transform-origin:0 50%}
.red .pj-strike i{background:var(--ink)}
.pj-feats{position:absolute;display:flex;gap:18px}
.pj-feats span{border:2px solid currentColor;padding:15px 26px;font:700 22px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
.pj-feats span b{color:var(--red);margin-right:12px}
.red .pj-feats span b{color:var(--ink)}
.pj-stack{position:absolute;font:700 22px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;white-space:nowrap}
.pj-links{position:absolute;display:flex;gap:58px}
.pj-links a{display:inline-flex;align-items:center;gap:14px;transition:color .2s,border-color .2s}
.pj-links a:hover{color:var(--red);border-color:currentColor}
.red .pj-links a:hover{color:var(--bone)}

/* badge star */
.pj-badge{position:absolute;color:var(--ink)}
.red .pj-badge{color:var(--bone)}
.pj-badge svg{position:absolute;inset:0;width:100%;height:100%;fill:var(--red)}
.red .pj-badge svg{fill:var(--ink)}
.pj-badge .pj-bt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.pj-badge b{font:900 76px/.9 var(--sans);letter-spacing:-.04em;text-transform:uppercase}
.pj-badge small{margin-top:8px;max-width:150px;font:700 16px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase}

/* phone app screen */
.pj-scr{position:absolute;inset:0;padding:26px 26px 0;display:flex;flex-direction:column;color:inherit}
.pj-sb{display:flex;justify-content:space-between;font:700 17px/1 var(--mono);letter-spacing:.1em;height:36px;padding:0 6px}
.pj-pl{margin-top:14px;font:700 16px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase;opacity:.6}
.pj-pn{margin-top:10px;font:900 40px/1.05 var(--sans);letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap;height:48px}
.pj-hero{margin-top:18px;height:200px;border-radius:28px;background:var(--red);color:var(--ink);position:relative;overflow:hidden}
.pj-hero b{position:absolute;right:18px;bottom:-34px;font:900 230px/1 var(--sans);letter-spacing:-.05em}
.pj-hero span{position:absolute;left:22px;top:20px;font:700 16px/1 var(--mono);letter-spacing:.22em}
.pj-bars{margin-top:18px;height:120px;display:flex;align-items:flex-end;gap:12px}
.pj-bars i{flex:1;background:currentColor;opacity:.85;transform-origin:50% 100%}
.pj-bars i:nth-child(3n){background:var(--red);opacity:1}
.pj-rws{margin-top:18px;display:grid;gap:10px}
.pj-rws div{height:64px;border:2px solid currentColor;border-radius:18px;display:flex;align-items:center;gap:16px;padding:0 16px;opacity:.9}
.pj-rws em{width:30px;height:30px;border-radius:50%;background:var(--red)}
.pj-rws u{display:block;height:9px;border-radius:5px;background:currentColor;opacity:.3;margin:5px 0;text-decoration:none}
.pj-rws u:first-child{width:150px}.pj-rws u:last-child{width:92px}
.pj-nav{position:absolute;left:26px;right:26px;bottom:26px;height:62px;border-radius:31px;border:2px solid currentColor;display:flex;justify-content:space-around;align-items:center}
.pj-nav i{width:20px;height:20px;border-radius:50%;border:2px solid currentColor;opacity:.55}
.pj-nav i.on{background:var(--red);border-color:var(--red);opacity:1}

/* credentials */
.pj-cert{transition:border-color .2s,box-shadow .2s,background-color .2s}
.pj-cert:hover,.pj-cert:focus-visible{border-color:var(--red);background:#120303;box-shadow:0 0 0 2px var(--red),0 24px 60px rgba(255,15,15,.28)}
.pj-cert .pj-ct{display:flex;justify-content:space-between;font:700 18px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;padding-left:10px}
.pj-cert .pj-ct span:first-child{color:var(--red)}
.pj-cert .pj-cn{font:900 38px/.98 var(--sans);letter-spacing:-.03em;text-transform:uppercase;padding-left:10px}
.pj-cert .pj-cv{display:flex;align-items:center;gap:10px;margin-top:14px;padding-left:10px;font:700 17px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--red)}

/* blast */
.pj-blast .pj-eb{color:inherit}
.pj-row{display:grid;grid-template-columns:300px 1fr 70px;align-items:center;height:84px;padding:0 24px;color:inherit;text-decoration:none;
  border-top:2px solid currentColor;transition:background-color .2s,color .2s,padding .25s}
.pj-row:last-child{border-bottom:2px solid currentColor}
.pj-row:hover,.pj-row:focus-visible{background:var(--ink);color:var(--bone);padding-left:46px}
.pj-row .pj-rl{font:700 20px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase;opacity:.75}
.pj-row .pj-rv{font:900 44px/1 var(--sans);letter-spacing:-.03em;text-transform:uppercase;white-space:nowrap}
.pj-row svg{justify-self:end;transition:transform .25s,color .2s}
.pj-row:hover svg,.pj-row:focus-visible svg{transform:translate(6px,-6px);color:var(--red)}
</style>`;

// 22-point seal star as an SVG polygon
function starSvg() {
  const n = 22, pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 83 : 98, a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(100 + r * Math.cos(a)).toFixed(1)},${(100 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><polygon points="${pts.join(" ")}"/></svg>`;
}
const badgeHtml = (big, small, left, top, size) =>
  `<div class="pj-badge" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px">${starSvg()}<div class="pj-bt"><b>${esc(big)}</b><small>${esc(small)}</small></div></div>`;

const linkAttrs = (url) => (/^mailto:/.test(url) ? `href="${esc(url)}"` : `href="${esc(url)}" target="_blank" rel="noopener"`);
const maskLine = (inner, cls = "") => `<span class="mask"><span class="${cls}">${inner}</span></span>`;

/* ---------------- scene 20: deployed-rest ---------------- */
function deployed(C) {
  const list = C.projects, n = list.length;
  const COLS = 4, GAP = 40, X0 = 100, W = 400, Y0 = 380, YEND = 960;
  const rows = Math.ceil(n / COLS), H = Math.floor((YEND - Y0 - GAP * (rows - 1)) / rows);
  const cards = list.map((p, i) => {
    const l = X0 + (i % COLS) * (W + GAP), t = Y0 + Math.floor(i / COLS) * (H + GAP);
    return `<a class="pj-card f-${esc(p.field || "ink")}" ${linkAttrs(p.url)} style="left:${l}px;top:${t}px;width:${W}px;height:${H}px">
      <div class="pj-top"><span>${pad(i + 1)}</span><span>${esc(p.category)}</span></div>
      <div class="pj-nm">${esc(p.name)}</div>
      <span class="pj-ar">${ARROW(40)}</span></a>`;
  }).join("");
  return {
    slug: "deployed-rest", name: "Deployed", act: "05 · Projects", field: "red", dur: 7.0, stars: false, ammo: 3,
    turn: null, rest: "click a project to open it", restAt: 6.27, gun: false,
    html: `${CSS}
      <div class="pj-eb" style="left:100px;top:96px">05 · Projects · Deployed</div>
      <div class="pj-lab pj-livetag" style="right:100px;top:100px"><span class="pj-live"></span>All live</div>
      <h2 class="big pj-head abs" style="left:100px;top:146px;font-size:136px;white-space:nowrap">${maskLine(`<span class="pj-n">00</span> <span class="ol">and counting</span>`)}</h2>
      <div class="pj-rule abs" style="left:100px;top:326px;width:1720px;height:3px;background:var(--ink);transform-origin:0 50%"></div>
      ${cards}`,
    anim(root, tl) {
      const cs = qa(root, ".pj-card"), nEl = q(root, ".pj-n");
      tl.from(q(root, ".pj-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.05);
      tl.from(q(root, ".pj-head .mask > span"), { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0.1);
      tl.from(q(root, ".pj-livetag"), { opacity: 0, x: 30, duration: 0.6, ease: "power3.out" }, 0.4);
      tl.from(q(root, ".pj-rule"), { scaleX: 0, duration: 1.1, ease: "power3.inOut" }, 0.3);
      cs.forEach((c, i) => {
        const up = i % 2 === 0;
        tl.from(c, { opacity: 0, y: up ? 170 : -170, rotationY: up ? -75 : 75, transformPerspective: 1100,
          duration: 0.95, ease: "power3.out" }, 0.5 + i * 0.55);
      });
      count(tl, (v) => { nEl.textContent = pad(Math.min(n, Math.ceil(v - 1e-6))); }, 0, n, 0.5, n * 0.55);
    },
  };
}

/* ---------------- scenes 21/22: showcases ---------------- */
function phoneHtml(s, cat) {
  const bars = [0.42, 0.68, 0.5, 0.86, 0.6, 0.95, 0.74];
  const row = `<div><em></em><span><u></u><u></u></span></div>`;
  return `<div class="pj-scr">
    <div class="pj-sb"><span>9:41</span><span>5G ▮▮▮</span></div>
    <div class="pj-pl">${esc(cat)}</div>
    <div class="pj-pn">${esc(s.title.join(" "))}</div>
    <div class="pj-hero"><span>● LIVE</span><b>${esc(s.ghost || s.title[0][0])}</b></div>
    <div class="pj-bars">${bars.map((h) => `<i style="height:${Math.round(h * 100)}%"></i>`).join("")}</div>
    <div class="pj-rws">${row}${row}${row}</div>
    <div class="pj-nav"><i class="on"></i><i></i><i></i><i></i></div>
  </div>`;
}

function showcase(C, i) {
  const s = C.showcases[i];
  const slug = `showcase-${i + 1}`;
  const name = s.title.join(" ");
  const proj = C.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const cat = proj ? proj.category : s.stack.split("·")[0].trim();
  const accentOf = (line) => (s.accent && line.toLowerCase() === String(s.accent).toLowerCase() ? "pj-acc" : "");
  const titleHtml = s.title.map((l) => maskLine(esc(l), accentOf(l))).join("");
  const extras = s.strikes
    ? { lab: "Struck from the build", html: `<div class="pj-strikes" style="left:110px;top:688px">${s.strikes.map((w) =>
        `<span class="pj-strike"><span class="pj-w">${esc(w)}</span><i></i></span>`).join("")}</div>` }
    : { lab: "Core features", html: `<div class="pj-feats" style="left:110px;top:680px">${(s.features || []).map((w, k) =>
        `<span><b>${pad(k + 1)}</b>${esc(w)}</span>`).join("")}</div>` };
  const links = (s.links || []).map(([label, url]) =>
    `<a ${linkAttrs(url)}>${esc(label)} ${ARROW(20)}</a>`).join("");
  const badge = s.badge || { big: "", small: "" };
  return {
    slug, name: `Showcase · ${name}`, act: "06 · Showcases", field: s.field, dur: 4.0, stars: false, ammo: 3,
    turn: null, rest: "open the links", restAt: 2.5, gun: false,
    html: `${CSS}
      <div class="pj-ghost" style="left:520px;top:120px">${esc(s.ghost || "")}</div>
      <div class="pj-eb" style="left:110px;top:110px">Showcase ${pad(i + 1)} · ${esc(cat)}</div>
      <h2 class="pj-ttl" style="left:110px;top:196px">${titleHtml}</h2>
      <div class="pj-pitch" style="left:110px;top:556px">${maskLine(esc(s.pitch))}</div>
      <div class="pj-lab dim" style="left:110px;top:640px">${extras.lab}</div>
      ${extras.html}
      <div class="pj-stack" style="left:110px;top:812px"><span class="dim">Stack / </span>${esc(s.stack)}</div>
      <div class="links pj-links" style="left:110px;top:900px">${links}</div>
      <div class="phone" style="left:1300px;top:100px">${phoneHtml(s, cat)}</div>
      ${badgeHtml(badge.big, badge.small, 1052, 56, 240)}`,
    anim(root, tl, env) {
      tl.from(q(root, ".pj-ghost"), { opacity: 0, yPercent: 14, duration: 1.2, ease: "power3.out" }, 0);
      tl.fromTo(q(root, ".pj-ghost"), { scale: 1 }, { scale: 1.07, duration: 4, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".pj-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.1);
      tl.from(qa(root, ".pj-ttl .mask > span"), { yPercent: 112, duration: 0.85, ease: "expo.out", stagger: 0.12 }, 0.2);
      tl.from(q(root, ".phone"), { y: 1000, rotation: 12, duration: 1.1, ease: "power3.out" }, 0.2);
      tl.to(q(root, ".phone"), { rotation: -2.5, duration: 3.2, ease: "none" }, 1.3);
      tl.from(q(root, ".pj-badge"), { scale: 0, rotation: -140, duration: 0.8, ease: "back.out(1.7)" }, 0.75);
      tl.fromTo(q(root, ".pj-badge svg"), { rotation: 0 }, { rotation: 300, duration: 4, ease: "none", immediateRender: false }, 0);
      tl.from(q(root, ".pj-pitch .mask > span"), { yPercent: 110, duration: 0.7, ease: "expo.out" }, 0.95);
      tl.from(q(root, ".pj-lab.dim"), { opacity: 0, duration: 0.5 }, 1.2);
      qa(root, ".pj-strike").forEach((el, k) => {
        const at = 1.3 + k * 0.28;
        tl.from(el, { yPercent: 100, opacity: 0, duration: 0.5, ease: "power3.out" }, at);
        tl.from(q(el, "i"), { scaleX: 0, duration: 0.45, ease: "power3.inOut" }, at + 0.55);
        tl.to(q(el, ".pj-w"), { opacity: 0.5, duration: 0.3 }, at + 0.7);
      });
      qa(root, ".pj-feats span").forEach((el, k) =>
        tl.from(el, { opacity: 0, y: 30, duration: 0.5, ease: "power3.out" }, 1.3 + k * 0.2));
      tl.from(q(root, ".pj-stack"), { opacity: 0, x: -30, duration: 0.6, ease: "power3.out" }, 1.9);
      tl.from(qa(root, ".pj-links a"), { opacity: 0, y: 20, duration: 0.5, ease: "power3.out", stagger: 0.12 }, 2.1);
      tl.from(qa(root, ".pj-bars i"), { scaleY: 0, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 1.0);
      tl.from(qa(root, ".pj-rws div"), { opacity: 0, x: 30, duration: 0.5, ease: "power3.out", stagger: 0.1 }, 1.3);
    },
  };
}

/* ---------------- scene 23: credentials-rest ---------------- */
function credentials(C) {
  const certs = C.certs, n = certs.length;
  const LEFT = (k) => 130 + k * 430;
  const TOP = [510, 570, 490, 550], ROT = [-5, 3, -3, 5];
  const cards = certs.map((c, k) => `<a class="cert pj-cert" ${linkAttrs(c.url)} style="left:${LEFT(k)}px;top:${TOP[k % 4]}px">
      <div class="pj-ct"><span>${esc(c.issuer)}</span><span>${pad(k + 1)}/${pad(n)}</span></div>
      <div><div class="pj-cn">${esc(c.title)}</div><div class="pj-cv">Verify ${ARROW(20)}</div></div></a>`).join("");
  return {
    slug: "credentials-rest", name: "Credentials", act: "07 · Credentials", field: "ink", dur: 4.6, stars: true, ammo: 3,
    turn: null, rest: "click a card to verify", restAt: 3.0, gun: false,
    html: `${CSS}
      <div class="pj-eb" style="left:100px;top:100px">07 · Credentials</div>
      <h2 class="big pj-head abs" style="left:100px;top:160px;font-size:170px">${maskLine(`Certified<span class="pj-acc">.</span>`)}</h2>
      <div class="pj-lab dim pj-hint" style="left:100px;top:420px"><span class="pj-live" style="background:var(--red)"></span>Click a card to verify</div>
      ${badgeHtml(String(pad(n)), "Verified credentials", 1500, 90, 290)}
      ${cards}`,
    anim(root, tl) {
      root.classList.add("starry");
      tl.from(q(root, ".pj-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.05);
      tl.from(q(root, ".pj-head .mask > span"), { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0.15);
      tl.from(q(root, ".pj-hint"), { opacity: 0, duration: 0.6 }, 1.6);
      tl.from(q(root, ".pj-badge"), { scale: 0, rotation: -140, duration: 0.8, ease: "back.out(1.7)" }, 0.5);
      tl.fromTo(q(root, ".pj-badge svg"), { rotation: 0 }, { rotation: 260, duration: 4.6, ease: "none", immediateRender: false }, 0);
      qa(root, ".pj-cert").forEach((el, k) => {
        const l = LEFT(k);
        tl.fromTo(el, { x: 770 - l, y: 90, rotation: 0, opacity: 0, transformPerspective: 1000 },
          { x: 0, y: 0, rotation: ROT[k % 4], opacity: 1, duration: 1.0, ease: "power3.out", immediateRender: true }, 0.6 + k * 0.2);
      });
    },
  };
}

/* ---------------- scene 24: blast ---------------- */
function blast(C) {
  const ct = C.contact;
  const words = String(ct.headline).split(" ");
  const last = words.pop();
  const headline = `${esc(words.join(" "))} <span class="ol">${esc(last)}</span>`;
  const rows = ct.links.map((l) => `<a class="pj-row" ${linkAttrs(l.url)}>
      <span class="pj-rl">${esc(l.label)}</span><span class="pj-rv">${esc(l.value)}</span>${ARROW(34)}</a>`).join("");
  return {
    slug: "blast", name: "Blast", act: "08 · Contact", field: "ink", dur: 5.0, stars: false, ammo: 3,
    turn: [0.2, "red"], rest: null, restAt: null, gun: false,
    html: `${CSS}
      <div class="iris pj-iris" style="width:2600px;height:2600px;margin:-1300px 0 0 -1300px;background:var(--red);z-index:0"></div>
      <div class="pj-blast pj-wrap" style="position:absolute;inset:0;z-index:2;color:#ededed">
        <div class="pj-eb" style="left:100px;top:92px"><span class="pj-live"></span>08 · Contact · Open for work</div>
        <h2 class="mega pj-mega abs" style="left:94px;top:140px;white-space:nowrap">${maskLine(headline)}</h2>
        <div class="pj-rows abs" style="left:100px;top:430px;width:1720px">${rows}</div>
        <div class="pj-foot pj-lab" style="left:100px;right:100px;top:940px;display:flex;justify-content:space-between;opacity:.8">
          <span>&copy; 2026 ${esc(C.person.first)} ${esc(C.person.last)}</span>
          <span>${esc(C.person.title)} &middot; ${esc(C.location.city)}</span>
        </div>
      </div>`,
    anim(root, tl) {
      const wrap = q(root, ".pj-wrap");
      tl.fromTo(q(root, ".pj-iris"), { scale: 0.001 }, { scale: 1, duration: 0.5, ease: "power3.out", immediateRender: true }, 0);
      tl.set(wrap, { color: "#ededed" }, 0);
      tl.set(wrap, { color: "#050505" }, 0.2);
      tl.from(q(root, ".pj-eb"), { opacity: 0, x: -40, duration: 0.6, ease: "power3.out" }, 0.45);
      tl.from(q(root, ".pj-mega .mask > span"), { yPercent: 115, duration: 0.95, ease: "expo.out" }, 0.4);
      qa(root, ".pj-row").forEach((el, k) =>
        tl.from(el, { opacity: 0, x: -70, duration: 0.6, ease: "power3.out" }, 0.9 + k * 0.12));
      tl.from(q(root, ".pj-foot"), { opacity: 0, y: 20, duration: 0.6, ease: "power3.out" }, 1.7);
    },
  };
}

export function scenes(C, P) {
  return [deployed(C), showcase(C, 0), showcase(C, 1), credentials(C), blast(C)];
}
