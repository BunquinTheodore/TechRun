// Procedural low-poly running shoe rendered with three.js. Side view along +x (toe right, heel left).
// Parts are built from THREE.Shape side profiles extruded across the width (bevelled), then tapered so the
// shoe narrows toward the collar and the toe tip.
import * as THREE from "three";
import { HEX } from "./palette.js";

export const PARTS = ["toe", "laces", "upper", "heel", "midsole", "outsole"];

const STAGE_W = 1920, STAGE_H = 1080;

// Exploded-view offsets (model units), chosen so no two parts overlap at ex = 1.
const EXPLODE = {
  toe: [1.5, 0.35, 0], laces: [0.15, 1.45, 0], upper: [0, 0.5, 0],
  heel: [-1.5, 0.35, 0], midsole: [0, -0.8, 0], outsole: [0, -1.6, 0],
};

// ---------------------------------------------------------------- colours (all derived from the palette)
const C3 = (hex) => new THREE.Color(hex);
const shade = (t) => C3(HEX.ink).lerp(C3(HEX.paper), t); // 0 = ink, 1 = paper
const STOPS = [C3(HEX.cyan), C3(HEX.lime), C3(HEX.orange)];
// brand gradient sampled at u in 0..1 (heel cyan -> lime -> toe orange)
function gradAt(u, out = new THREE.Color()) {
  const k = THREE.MathUtils.clamp(u, 0, 1) * 2, i = Math.min(1, Math.floor(k));
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], k - i);
}

// ---------------------------------------------------------------- side profile
const X_HEEL = -3.45, X_TOE = 3.55;
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// ground line: flat under the forefoot/midfoot, toe spring at the front, heel rocker at the back
const base = (x) => -1.25 + (x > 1.9 ? 0.2 * (x - 1.9) ** 2 : 0) + (x < -2.55 ? 0.32 * (-2.55 - x) ** 2 : 0);
const SOLE_T = 0.2;
const soleTop = (x) => base(x) + SOLE_T;
// midsole stack: tall at the heel, thinner at the toe
const midTop = (x) => soleTop(x) + 0.55 + 0.5 * (1 - smooth(-3.4, 3.4, x));
// upper top line (collar at the heel, dip, throat, instep slope, rounded toe box)
const TOP_PTS = [
  [-3.4, 1.55], [-3.25, 1.74], [-2.85, 1.62], [-2.3, 1.3], [-1.75, 1.36], [-1.25, 1.55], [-0.6, 1.4],
  [0.2, 1.18], [1.0, 0.94], [1.8, 0.7], [2.45, 0.48], [2.95, 0.3], [3.3, 0.12], [3.5, -0.06], [3.56, -0.2],
];
const topSpline = new THREE.SplineCurve(TOP_PTS.map(([x, y]) => new THREE.Vector2(x, y)));
const TOP_LUT = topSpline.getSpacedPoints(400);
function topY(x) {
  for (let i = 1; i < TOP_LUT.length; i++) {
    const a = TOP_LUT[i - 1], b = TOP_LUT[i];
    if (x <= b.x) return a.y + (b.y - a.y) * ((x - a.x) / Math.max(1e-6, b.x - a.x));
  }
  return TOP_LUT[TOP_LUT.length - 1].y;
}
const upBot = (x) => midTop(x) - 0.06;
const slopeAt = (f, x) => Math.atan2(f(x + 0.02) - f(x - 0.02), 0.04);

// shape bounded below by bot(x) and above by top(x) over [x0, x1]
function bandShape(x0, x1, top, bot, n = 40) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; i ? s.lineTo(x, bot(x)) : s.moveTo(x, bot(x)); }
  for (let i = n; i >= 0; i--) { const x = x0 + ((x1 - x0) * i) / n; s.lineTo(x, top(x)); }
  s.closePath();
  return s;
}
function polyShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

// Extrude a side profile across the width (z), centred on z = 0, then taper with fz(x, y) in 0..1.
function extrude(shape, width, bevel = 0.05, fz = null, curveSegments = 12) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  if (fz) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * fz(p.getX(i), p.getY(i)));
  }
  g.computeVertexNormals();
  return g;
}
// upper taper: narrower toward the collar and at the very front / back
const upperTaper = (x, y) => (1 - 0.42 * smooth(-0.3, 1.9, y)) * (1 - 0.45 * smooth(2.5, 3.6, x)) * (1 - 0.25 * smooth(-3.0, -3.5, x));
const soleTaper = (x) => (1 - 0.3 * smooth(2.7, 3.7, x)) * (1 - 0.22 * smooth(-2.9, -3.6, x));
const UPPER_W = 1.3, SOLE_W = 1.46;

// colour every vertex of `g` along x with the brand gradient
function paintGradient(g, x0 = X_HEEL, x1 = X_TOE) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { gradAt((p.getX(i) - x0) / (x1 - x0), c); c.toArray(col, i * 3); }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

// a box of size (l, h, w) centred at (x, y, 0), rotated by angle a about z
function slab(l, h, w, x, y, a = 0) {
  const g = new THREE.BoxGeometry(l, h, w);
  g.rotateZ(a);
  g.translate(x, y, 0);
  return g;
}

// ---------------------------------------------------------------- part builders
// add(geo, materialKey, edges?) -> mesh. Material keys: body, panel, accent, lime, grad, rubber, eyelet.
const X_TOE_SEAM = 1.75, X_HEEL_SEAM = -2.35;

function buildToe(add) {
  add(extrude(bandShape(X_TOE_SEAM, X_TOE, topY, upBot), UPPER_W, 0.06, upperTaper), "panel");
  // rubber toe bumper wrapping the tip
  const bump = bandShape(2.75, X_TOE + 0.02, (x) => Math.min(topY(x) + 0.02, upBot(x) + 0.36), (x) => upBot(x) - 0.01);
  add(extrude(bump, UPPER_W + 0.06, 0.04, upperTaper), "body");
  // gradient speed stripe across the toe box
  const stripe = polyShape([[2.0, 0.05], [2.25, 0.05], [2.75, 0.42], [2.5, 0.42]]);
  add(extrude(stripe, UPPER_W + 0.05, 0.015, upperTaper), "grad", false);
}

function buildLaces(add) {
  // tongue: rises above the collar at the throat
  const tongue = polyShape([[-1.55, 1.25], [-1.62, 1.78], [-1.48, 2.02], [-1.12, 2.0], [-0.85, 1.6], [-0.4, 1.32], [-0.9, 1.2]]);
  add(extrude(tongue, 0.72, 0.06), "panel");
  // eyestay strip along the instep + lace bars + eyelets
  const xs = [-1.05, -0.62, -0.19, 0.24, 0.67, 1.1];
  const stay = bandShape(-1.25, 1.35, (x) => topY(x) + 0.03, (x) => topY(x) - 0.2, 30);
  add(extrude(stay, UPPER_W * 0.62, 0.03), "body");
  for (const x of xs) {
    const a = slopeAt(topY, x), y = topY(x);
    add(slab(0.11, 0.08, UPPER_W * 0.66, x, y + 0.06, a), "lime");
    for (const side of [-1, 1]) {
      const ring = new THREE.TorusGeometry(0.06, 0.02, 6, 12);
      ring.translate(x + 0.02, y - 0.1, side * UPPER_W * 0.315);
      add(ring, "eyelet", false);
    }
  }
  // bow loops at the throat
  for (const [r, rot] of [[0.2, 0.5], [0.17, -0.35]]) {
    const loop = new THREE.TorusGeometry(r, 0.035, 6, 18, Math.PI * 1.3);
    loop.rotateZ(rot);
    loop.translate(-1.02 + Math.sin(rot) * 0.15, topY(-1.02) + 0.22, 0.12);
    add(loop, "lime", false);
  }
}

function buildUpper(add) {
  add(extrude(bandShape(X_HEEL_SEAM, X_TOE_SEAM, topY, upBot, 50), UPPER_W, 0.06, upperTaper), "body");
  // two brand slashes on the quarter panel (cyan + lime), like the TR mark
  const slash = (x0, w) => polyShape([[x0, -0.05], [x0 + w, -0.05], [x0 + w + 0.9, 0.95], [x0 + 0.9, 0.95]]);
  add(extrude(slash(-1.6, 0.34), UPPER_W + 0.06, 0.015, upperTaper), "grad", false);
  add(extrude(slash(-1.05, 0.2), UPPER_W + 0.06, 0.015, upperTaper), "accent", false);
  // mesh vents (dark slots) near the toe seam
  for (let i = 0; i < 3; i++) {
    const x = 0.75 + i * 0.28;
    add(extrude(polyShape([[x, 0.02], [x + 0.12, 0.02], [x + 0.32, 0.5], [x + 0.2, 0.5]]), UPPER_W + 0.04, 0.01, upperTaper), "rubber", false);
  }
}

function buildHeel(add) {
  add(extrude(bandShape(X_HEEL - 0.02, X_HEEL_SEAM, topY, upBot, 24), UPPER_W + 0.04, 0.07, upperTaper), "panel");
  // external heel clip (counter) in gradient
  const clip = bandShape(X_HEEL - 0.04, -2.7, (x) => upBot(x) + 0.62 - 0.25 * smooth(-3.4, -2.7, x), (x) => upBot(x) - 0.02, 16);
  add(extrude(clip, UPPER_W + 0.1, 0.03, upperTaper), "grad");
  // pull tab
  const tab = polyShape([[-3.42, 1.45], [-3.5, 2.02], [-3.3, 2.08], [-3.18, 1.62]]);
  add(extrude(tab, 0.34, 0.03), "accent");
}

function buildMidsole(add) {
  add(extrude(bandShape(X_HEEL - 0.05, X_TOE + 0.05, midTop, soleTop, 60), SOLE_W, 0.08, soleTaper), "body");
  // gradient band riding the midsole side wall, plus a thin lime pinstripe
  const band = bandShape(-3.2, 3.25, (x) => soleTop(x) + 0.42 + 0.22 * (1 - smooth(-3.2, 3.2, x)), (x) => soleTop(x) + 0.2, 60);
  add(extrude(band, SOLE_W + 0.04, 0.012, soleTaper), "grad", false);
  const pin = bandShape(-3.1, 3.1, (x) => midTop(x) - 0.12, (x) => midTop(x) - 0.17, 60);
  add(extrude(pin, SOLE_W + 0.04, 0.008, soleTaper), "lime", false);
}

function buildOutsole(add) {
  add(extrude(bandShape(X_HEEL - 0.02, X_TOE + 0.02, soleTop, base, 60), SOLE_W - 0.02, 0.05, soleTaper), "rubber");
  // tread lugs following the ground curve
  for (let x = -3.15; x <= 3.25; x += 0.36) {
    const a = slopeAt(base, x), w = (SOLE_W - 0.12) * soleTaper(x);
    const nx = -Math.sin(a), ny = Math.cos(a); // outward normal points down: subtract
    add(slab(0.2, 0.1, w, x - nx * 0.03, base(x) - ny * 0.03, a), "lug");
  }
}

const BUILDERS = { toe: buildToe, laces: buildLaces, upper: buildUpper, heel: buildHeel, midsole: buildMidsole, outsole: buildOutsole };

// assembled bounding-box centre of each part (model units), computed from the geometry itself
export const PART_CENTER = (() => {
  const out = {}, box = new THREE.Box3(), all = new THREE.Box3();
  for (const name of PARTS) {
    all.makeEmpty();
    BUILDERS[name]((geo) => { geo.computeBoundingBox(); box.copy(geo.boundingBox); all.union(box); geo.dispose(); });
    const c = all.getCenter(new THREE.Vector3());
    out[name] = [+c.x.toFixed(3), +c.y.toFixed(3)];
  }
  return out;
})();

function makeMaterials() {
  const std = (color, roughness = 0.62, metalness = 0.08, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    body: std(shade(0.1), 0.66),
    panel: std(shade(0.17), 0.58),
    rubber: std(shade(0.05), 0.85),
    lug: std(shade(0.24), 0.8),
    lime: std(C3(HEX.lime), 0.45, 0.02),
    accent: std(C3(HEX.orange), 0.45, 0.02),
    grad: std(C3(HEX.paper), 0.42, 0.05, { vertexColors: true }),
    eyelet: std(shade(0.8), 0.3, 0.7),
  };
}

// ---------------------------------------------------------------- environment (soft boxes for sheen)
function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: shade(0.03), side: THREE.BackSide })));
  const panel = (w, h, pos, color, k) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(k), side: THREE.DoubleSide }));
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(22, 5, [0, 14, 6], C3(HEX.paper), 4);
  panel(3, 14, [-14, 2, 5], C3(HEX.cyan), 2.2);
  panel(3, 12, [13, 0, -8], C3(HEX.lime), 2.4);
  panel(18, 2, [0, -10, 4], C3(HEX.paper), 0.6);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

// ---------------------------------------------------------------- mount
export async function mountShoe(canvas, state, opts = {}) {
  const interactive = opts.interactive !== false;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(HEX.ink, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const applyPixelRatio = (n) => {
    renderer.setPixelRatio(THREE.MathUtils.clamp(Number(n) || 1, 0.5, 3));
    renderer.setSize(STAGE_W, STAGE_H, false);
  };
  applyPixelRatio(opts.pixelRatio || 1);

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(30, STAGE_W / STAGE_H, 0.1, 60);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  // lights live outside the root so they do not rotate with the shoe
  const key = new THREE.DirectionalLight(C3(HEX.paper), 2.2);
  key.position.set(-5, 7, 8);
  const back = new THREE.DirectionalLight(C3(HEX.cyan), 1.1);
  back.position.set(6, 2, -6);
  const cursorLight = new THREE.PointLight(C3(HEX.lime), 10, 0, 2);
  cursorLight.position.set(0, 0, 3.5);
  scene.add(key, back, cursorLight, new THREE.AmbientLight(C3(HEX.paper), 0.18));

  const root = new THREE.Group();
  scene.add(root);
  const edgeMat = new THREE.LineBasicMaterial({ color: HEX.paper, transparent: true, opacity: 0.42 });
  const partsByName = {};
  const meshes = [];
  const tmpBox = new THREE.Box3();
  const tmpCentre = new THREE.Vector3();

  for (const name of PARTS) {
    const outer = new THREE.Group();
    outer.name = name;
    const content = new THREE.Group();
    outer.add(content);
    const mats = makeMaterials(); // per part, so a highlight only lights this part
    const add = (geo, key, edges = true) => {
      if (key === "grad") paintGradient(geo);
      const mesh = new THREE.Mesh(geo, mats[key]);
      mesh.userData.part = name;
      if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
      content.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    BUILDERS[name](add);
    // re-centre: outer sits at the part's bbox centre so scale pulses and explode act about it
    content.updateMatrixWorld(true);
    tmpBox.setFromObject(content).getCenter(tmpCentre);
    content.position.copy(tmpCentre).multiplyScalar(-1);
    outer.position.copy(tmpCentre);
    root.add(outer);
    partsByName[name] = {
      group: outer, base: tmpCentre.clone(), dir: new THREE.Vector3(...EXPLODE[name]),
      materials: Object.values(mats),
    };
  }

  // ---- state application (allocation free)
  let swayX = 0, swayY = 0, lastT = 0, highlighted = null, visible = true;
  const PULSE_RATE = 6;
  const LIME = C3(HEX.lime), BLACK = C3(HEX.ink);

  function sync() {
    const ex = THREE.MathUtils.clamp(state.ex || 0, 0, 1);
    root.position.set(state.px || 0, state.py || 0, state.pz || 0);
    root.rotation.set((state.rx || 0) + swayX, (state.ry || 0) + swayY, state.rz || 0);
    root.scale.setScalar(state.s === undefined ? 1 : state.s);
    const pulse = 0.5 + 0.5 * Math.sin(lastT * PULSE_RATE);
    for (let i = 0; i < PARTS.length; i++) {
      const name = PARTS[i];
      const p = partsByName[name];
      p.group.position.copy(p.base).addScaledVector(p.dir, ex);
      if (name === highlighted) {
        p.group.scale.setScalar(1 + 0.03 * pulse);
        for (const m of p.materials) m.emissiveIntensity = 0.1 + 0.16 * pulse;
      }
    }
    root.updateMatrixWorld(true);
  }

  function clearHighlight(name) {
    const p = partsByName[name];
    if (!p) return;
    p.group.scale.setScalar(1);
    for (const m of p.materials) { m.emissive.copy(BLACK); m.emissiveIntensity = 1; }
  }

  const ndc = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ray = new THREE.Vector2();

  const api = {
    render(o = {}) {
      if (!visible) return;
      if (o.sway) { swayX = o.sway[0] || 0; swayY = o.sway[1] || 0; }
      if (typeof o.t === "number") lastT = o.t;
      if (o.light) cursorLight.position.set(o.light[0] * 8, -o.light[1] * 4.5, 3.5);
      sync();
      renderer.render(scene, camera);
    },

    pick(clientX, clientY) {
      if (!interactive || !visible) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;
      sync();
      ray.set(nx, ny);
      raycaster.setFromCamera(ray, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit ? hit.object.userData.part : null;
    },

    project(partName) {
      const p = partsByName[partName];
      if (!p) return null;
      sync();
      p.group.getWorldPosition(ndc); // outer group origin == the part's bounding-box centre
      ndc.project(camera);
      if (!(ndc.z > -1 && ndc.z < 1)) return null;
      return [(ndc.x * 0.5 + 0.5) * STAGE_W, (-ndc.y * 0.5 + 0.5) * STAGE_H];
    },

    highlight(partName) {
      const next = partsByName[partName] ? partName : null;
      if (next === highlighted) return;
      clearHighlight(highlighted);
      highlighted = next;
      if (next) for (const m of partsByName[next].materials) m.emissive.copy(LIME);
    },

    setVisible(v) {
      visible = !!v;
      canvas.style.visibility = visible ? "" : "hidden";
    },

    setPixelRatio(n) { applyPixelRatio(n); },
  };

  // compile shaders up front so the first visible frame does not hitch
  sync();
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  return api;
}
