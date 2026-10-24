// Stage geometry. Portrait screens (phones, tablets held upright) get a 1080x1920 frame with its own scene
// layouts; everything else plays the 1920x1080 film. The mode is fixed at load (main.js reloads if it flips).
export const PORTRAIT_QUERY = "(max-aspect-ratio: 4/5)";
export const PORTRAIT = matchMedia(PORTRAIT_QUERY).matches;
export const SW = PORTRAIT ? 1080 : 1920;
export const SH = PORTRAIT ? 1920 : 1080;
// pick the desktop or the portrait value
export const lay = (desk, port) => (PORTRAIT ? port : desk);
