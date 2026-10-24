// Loads the scene modules in film order. A module that fails to load or build is skipped (logged),
// so one broken file never blanks the whole film.
// kit.js (the 3D shoe section) is out of the short cut; add it back here to restore it.
const FILES = ["./boot.js", "./about.js", "./highlights.js"];
const mods = await Promise.all(FILES.map((f) => import(f).catch((e) => { console.error("scene module", f, e); return null; })));

// Short cut of the film: these scenes are left out (their key details live on the hero). Remove a slug to restore it.
const CUT = new Set([
  "location", "timezone", "organizer", "distances",
  "showcase-2", "partners-rest",
]);

export function buildAll(C, P) {
  return mods.flatMap((m, i) => {
    if (!m) return [];
    try { return m.scenes(C, P).filter((s) => !CUT.has(s.slug)); } catch (e) { console.error("scene build", FILES[i], e); return []; }
  });
}
