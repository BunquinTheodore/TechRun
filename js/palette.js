// Single source of truth for colour in JS. css/style.css mirrors these as custom properties on :root.
// Change a colour here AND in the :root block of style.css; nothing else holds raw colour values.
export const PALETTE = {
  ink: "#000000",
  paper: "#ffffff",
  lime: "#c6f24e",
  cyan: "#33c7e0",
  orange: "#f2b84e",
  ash: "#8c8c8c",
};

// rgb triples for building rgba() strings: rgba(PALETTE_RGB.paper, .5) -> `rgba(${RGB.paper},.5)`
export const RGB = {
  ink: "0,0,0",
  paper: "255,255,255",
  lime: "198,242,78",
  cyan: "51,199,224",
  orange: "242,184,78",
};
export const rgba = (name, a) => `rgba(${RGB[name]},${a})`;

// numeric (0xRRGGBB) versions for three.js
export const HEX = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)]));

// brand gradient, left to right: cyan -> lime -> orange
export const GRADIENT_STOPS = [PALETTE.cyan, PALETTE.lime, PALETTE.orange];
export const GRADIENT = `linear-gradient(90deg, ${GRADIENT_STOPS.join(", ")})`;

// scene fields: background colour of each field. "quad" is an ink root with four coloured cells.
export const FIELD_BG = { ink: PALETTE.ink, lime: PALETTE.lime, cyan: PALETTE.cyan, orange: PALETTE.orange, paper: PALETTE.paper, quad: PALETTE.ink };
// fields drawn with dark (ink) text and a dark HUD
export const LIGHT_FIELDS = new Set(["lime", "cyan", "orange", "paper"]);
