// Loads the four scene modules in film order (01-24). A module that fails to load or build is skipped
// (logged), so one broken file never blanks the whole film.
const FILES = ["./boot.js", "./about.js", "./kit.js", "./highlights.js"];
const mods = await Promise.all(FILES.map((f) => import(f).catch((e) => { console.error("scene module", f, e); return null; })));

export function buildAll(C, P) {
  return mods.flatMap((m, i) => {
    if (!m) return [];
    try { return m.scenes(C, P); } catch (e) { console.error("scene build", FILES[i], e); return []; }
  });
}
