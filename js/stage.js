// Stage geometry. Portrait screens (phones, tablets held upright) get a 1080-wide frame with its own scene
// layouts; everything else plays the 1920x1080 film. The mode is fixed at load (main.js reloads if it flips).
export const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";
export const PORTRAIT = matchMedia(PORTRAIT_QUERY).matches;
// portrait: viewport px kept clear of the frame for the HUD corners (top) and the runner track (bottom)
export const PORTRAIT_TOP = 40, PORTRAIT_BOTTOM = 136;
// Portrait layouts are drawn on a 1080 x PORTRAIT_DESIGN_H frame. The stage itself is as tall as the phone's
// free area at full width (clamped), and main.js centres the design frame in it, so a phone fills its width
// instead of letterboxing a fixed 9:16 frame at the sides.
const PORTRAIT_DESIGN_H = 1400, PORTRAIT_MAX_H = 1920;
function portraitStageH() {
  const w = innerWidth, avail = innerHeight - PORTRAIT_TOP - PORTRAIT_BOTTOM;
  if (!(w > 0 && avail > 0)) return PORTRAIT_DESIGN_H;
  return Math.min(PORTRAIT_MAX_H, Math.max(PORTRAIT_DESIGN_H, Math.round((1080 * avail) / w)));
}
export const SW = PORTRAIT ? 1080 : 1920;
export const SH = PORTRAIT ? portraitStageH() : 1080;   // stage height
export const DH = PORTRAIT ? PORTRAIT_DESIGN_H : 1080;  // height the scene layouts are designed in
// pick the desktop or the portrait value
export const lay = (desk, port) => (PORTRAIT ? port : desk);
