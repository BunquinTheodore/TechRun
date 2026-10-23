// Procedural low-poly suppressed pistol rendered with three.js. Side view along +x (muzzle right).
import * as THREE from "three";

export const PARTS = ["suppressor", "barrel", "slide", "frame", "sights", "grip"];
export const PART_CENTER = {
  suppressor: [4.3, 0.55], barrel: [2.6, 0.55], slide: [0.3, 0.65],
  frame: [-0.1, 0.15], sights: [0.3, 1.05], grip: [-1.5, -0.9],
};

const STAGE_W = 1920, STAGE_H = 1080;
const BONE = 0xededed, RED = 0xff0f0f;
const GRIP_TILT = THREE.MathUtils.degToRad(12);

// Exploded-view offsets (model units), chosen so no two parts overlap at ex = 1.
const EXPLODE = {
  suppressor: [2.6, 0.6, 0], barrel: [1.4, 1.5, 0], slide: [0, 0.9, 0],
  frame: [0, -0.2, 0], sights: [0, 1.75, 0], grip: [-0.8, -1.3, 0],
};

// ---------------------------------------------------------------- geometry helpers
function boxGeo(x0, x1, y0, y1, hz) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, hz * 2);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  return g;
}
// cylinder along +x from x0 to x1 at height y
function tubeGeo(r, x0, x1, y, seg = 28) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, seg, 1);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, 0);
  return g;
}

function makeMaterials() {
  const m = (color, metalness, roughness) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  return {
    suppressor: m(0x26282b, 0.9, 0.34),
    barrel: m(0x4b4e54, 0.95, 0.28),
    slide: m(0x30343a, 0.88, 0.32),
    frame: m(0x1b1c1f, 0.55, 0.58),
    sights: m(0x101112, 0.7, 0.4),
    grip: m(0x151618, 0.35, 0.72),
    port: new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.2, roughness: 0.9 }),
    tip: new THREE.MeshBasicMaterial({ color: RED }),
    hole: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  };
}

// ---------------------------------------------------------------- part builders
// Each builder fills `g` with meshes in absolute assembled coordinates. `add(geo, material)` also adds bone edges.
function buildSuppressor(add, mat) {
  add(tubeGeo(0.34, 3.0, 5.6, 0.55, 32), mat.suppressor);
  add(tubeGeo(0.375, 5.45, 5.6, 0.55, 32), mat.suppressor); // front cap
  add(tubeGeo(0.375, 3.0, 3.15, 0.55, 32), mat.suppressor); // rear collar
  for (let i = 0; i < 4; i++) add(tubeGeo(0.355, 3.6 + i * 0.5, 3.68 + i * 0.5, 0.55, 32), mat.suppressor); // baffle bands
  const hole = new THREE.CircleGeometry(0.13, 20);
  hole.rotateY(Math.PI / 2);
  hole.translate(5.605, 0.55, 0);
  add(hole, mat.hole, false);
}

function buildBarrel(add, mat) {
  add(tubeGeo(0.15, 1.8, 3.4, 0.55, 20), mat.barrel);
  add(tubeGeo(0.19, 2.6, 2.8, 0.55, 20), mat.barrel); // locking ring
}

function buildSlide(add, mat) {
  add(boxGeo(-2.0, 2.6, 0.35, 0.95, 0.3), mat.slide);
  add(boxGeo(-0.1, 0.85, 0.58, 0.9, 0.304), mat.port, false); // ejection port, both sides
  for (let i = 0; i < 5; i++) { // rear serrations
    const x = -1.9 + i * 0.15;
    add(boxGeo(x, x + 0.06, 0.4, 0.9, 0.318), mat.slide, false);
  }
  add(boxGeo(2.0, 2.6, 0.9, 0.95, 0.12), mat.slide); // top rib
}

function buildFrame(add, mat) {
  add(boxGeo(-1.8, 2.0, 0, 0.35, 0.27), mat.frame);
  add(boxGeo(-0.75, -0.6, -0.5, 0, 0.2), mat.frame); // trigger guard rear
  add(boxGeo(0.8, 0.95, -0.5, 0, 0.2), mat.frame); // trigger guard front
  add(boxGeo(-0.75, 0.95, -0.5, -0.36, 0.2), mat.frame); // trigger guard bottom
  const trigger = boxGeo(-0.1, 0.04, -0.34, 0, 0.07);
  trigger.rotateZ(-0.22);
  trigger.translate(-0.2, 0, 0);
  add(trigger, mat.slide);
  add(boxGeo(1.1, 1.9, 0.35, 0.4, 0.2), mat.frame); // accessory rail
}

function buildSights(add, mat) {
  add(boxGeo(2.28, 2.52, 0.95, 1.2, 0.07), mat.sights); // front post
  add(boxGeo(2.28, 2.52, 1.14, 1.2, 0.072), mat.tip, false); // red tip
  add(boxGeo(-1.92, -1.6, 0.95, 1.18, 0.1), mat.sights); // rear base
  add(boxGeo(-1.92, -1.6, 1.0, 1.2, 0.3), mat.sights); // rear blade, full width
  add(boxGeo(-1.8, -1.72, 1.02, 1.2, 0.045), mat.port, false); // notch
}

function buildGrip(add, mat) {
  // modelled upright with its top-centre at the origin, then tilted about that pivot
  const upright = (x0, x1, y0, y1, hz) => {
    const g = boxGeo(x0, x1, y0, y1, hz);
    g.rotateZ(-GRIP_TILT);
    g.translate(-1.3, 0.1, 0);
    return g;
  };
  add(upright(-0.5, 0.5, -1.7, 0, 0.3), mat.grip);
  add(upright(-0.56, 0.56, -1.86, -1.7, 0.33), mat.frame); // magazine base plate
  for (let i = 0; i < 4; i++) add(upright(-0.52, 0.52, -0.5 - i * 0.28, -0.4 - i * 0.28, 0.315), mat.grip, false); // texture bands
}

const BUILDERS = {
  suppressor: buildSuppressor, barrel: buildBarrel, slide: buildSlide,
  frame: buildFrame, sights: buildSights, grip: buildGrip,
};

// ---------------------------------------------------------------- environment (soft boxes for metal reflections)
function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0x08080a, side: THREE.BackSide })));
  const panel = (w, h, pos, r, g, b) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(r, g, b), side: THREE.DoubleSide }));
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(22, 5, [0, 14, 6], 5, 5, 5);      // top softbox
  panel(3, 14, [-14, 2, 5], 3, 3, 3.2);   // left strip
  panel(3, 12, [13, 0, -8], 4, 0.15, 0.1); // red rim strip
  panel(18, 2, [0, -10, 4], 0.7, 0.7, 0.72); // floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

// ---------------------------------------------------------------- mount
export async function mountShoe(canvas, state, opts = {}) {
  const interactive = opts.interactive !== false;
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const applyPixelRatio = (n) => {
    renderer.setPixelRatio(THREE.MathUtils.clamp(Number(n) || 1, 0.5, 3));
    renderer.setSize(STAGE_W, STAGE_H, false);
  };
  applyPixelRatio(opts.pixelRatio || 1);

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 1; // honoured by newer builds, harmless on 0.160

  const camera = new THREE.PerspectiveCamera(30, STAGE_W / STAGE_H, 0.1, 60);
  camera.position.set(0, 0, 14);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  // lights live outside the root so they do not rotate with the gun
  const key = new THREE.DirectionalLight(0xf2efe9, 2.0);
  key.position.set(-5, 7, 8);
  const back = new THREE.DirectionalLight(RED, 1.2);
  back.position.set(6, 2, -6);
  const cursorLight = new THREE.PointLight(RED, 70, 0, 2);
  cursorLight.position.set(0, 0, 3.5);
  scene.add(key, back, cursorLight, new THREE.AmbientLight(0xffffff, 0.12));

  // ---- the gun
  const root = new THREE.Group();
  scene.add(root);
  const mats = makeMaterials();
  const edgeMat = new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: 0.5 });
  const partsByName = {};
  const meshes = [];
  const tmpBox = new THREE.Box3();
  const tmpCentre = new THREE.Vector3();

  for (const name of PARTS) {
    const outer = new THREE.Group();
    outer.name = name;
    const content = new THREE.Group();
    outer.add(content);
    const add = (geo, material, edges = true) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.userData.part = name;
      if (edges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat));
      content.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
    BUILDERS[name](add, mats);
    // re-centre: outer sits at the part's bbox centre so scale pulses and explode act about it
    content.updateMatrixWorld(true);
    tmpBox.setFromObject(content).getCenter(tmpCentre);
    content.position.copy(tmpCentre).multiplyScalar(-1);
    outer.position.copy(tmpCentre);
    root.add(outer);
    partsByName[name] = {
      group: outer,
      base: tmpCentre.clone(),
      dir: new THREE.Vector3(...EXPLODE[name]),
      material: mats[name],
    };
  }

  // ---- state application (allocation free)
  let swayX = 0, swayY = 0, lastT = 0, highlighted = null, visible = true;
  const PULSE_RATE = 6;

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
        p.material.emissiveIntensity = 0.3 + 0.35 * pulse;
      }
    }
    root.updateMatrixWorld(true);
  }

  function clearHighlight(name) {
    const p = partsByName[name];
    if (!p) return;
    p.group.scale.setScalar(1);
    p.material.emissive.setHex(0x000000);
    p.material.emissiveIntensity = 1;
  }

  // ---- public api
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
      // outer group origin == the part's bounding-box centre
      p.group.getWorldPosition(ndc);
      ndc.project(camera);
      if (!(ndc.z > -1 && ndc.z < 1)) return null;
      return [(ndc.x * 0.5 + 0.5) * STAGE_W, (-ndc.y * 0.5 + 0.5) * STAGE_H];
    },

    highlight(partName) {
      const next = partsByName[partName] ? partName : null;
      if (next === highlighted) return;
      clearHighlight(highlighted);
      highlighted = next;
      if (next) partsByName[next].material.emissive.setHex(RED);
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
