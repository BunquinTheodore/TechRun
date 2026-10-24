// All copy and data for the site. Values marked TBA are placeholders until the organisers confirm them.
const EMAIL = "techrun.contactus@gmail.com";
const mail = (subject) => `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`;

// Registration link: paste the registration URL here when it is ready. Until then every register button
// falls back to an email asking to be notified when registration opens.
const REGISTER_URL = "";
const register = (subject) => REGISTER_URL || mail(subject);

export const CONTENT = {
  brand: {
    name: "TechRun",
    lines: ["TECH", "RUN", "2027"],      // hero, one word per line
    year: "2027",
    org: "GN Club",
    title: "TechRun 2027",
    tagline: "Move people for a brighter tomorrow.",
    email: EMAIL,
  },
  // images and sprites (paths relative to index.html)
  assets: {
    logoRing: "assets/img/logo-ring.png",   // TR mark in gradient ring, transparent; DARK fields only
    badge: "assets/img/badge-pixel.png",     // pixel-dot gradient ring + white TR mark, transparent; DARK fields only
    mark: "assets/img/tr-mark.png",          // white + gradient TR mark, transparent; DARK fields only
    markInk: "assets/img/mark-ink.png",      // black + gradient TR mark, transparent; LIGHT fields only
    markSolid: "assets/img/mark-solid.webp", // solid black TR mark, transparent; LIGHT fields (lime/cyan/orange)
    halftone: "assets/img/halftone-burst.jpg", // 1000x1000 black/grey halftone burst, white mark (texture, framed use)
    covers: {                                // 851x315 social banners: low-res, ONLY inside a framed element <= 900px wide
      dark: "assets/img/cover-dark.webp",    // black: runner, pixel staircase, wordmark, tagline
      halftone: "assets/img/cover-halftone.jpg", // white halftone with wordmark
    },
    runnerLegs: "assets/img/runner-legs.webp", // b/w runner legs cut-out, transparent
    stairs: "assets/img/pixel-stairs.png",   // gradient pixel staircase, transparent
    splash: "assets/img/splash.png",         // gradient paint splash strip, transparent
    trophy: "assets/img/trophy.png",         // pixel trophy, transparent
    paint: "assets/img/paint-window.png",    // retro paint window
    icons: "assets/img/retro-icons.png",     // collage of Y2K desktop icons
    blob: "assets/img/gradient-blob.jpg",    // soft brand gradient field
    photos: {
      computer: "assets/img/retro-computer.jpg", hills: "assets/img/xp-hills.jpg", runners: "assets/img/runners-80s.jpg",
      paintGuy: "assets/img/paint-guy.jpg", matrix: "assets/img/matrix-kid.jpg", errors: "assets/img/error-windows.jpg",
      tv: "assets/img/tv-store.jpg", bibs: "assets/img/race-bibs.jpg", singlets: "assets/img/singlets.webp",
      sweater: "assets/img/model-sweater.jpg", backpack: "assets/img/backpack.jpg", caps: "assets/img/caps.jpg", crew: "assets/img/crew.jpg",
    },
    // pixel runners, 256x256 transparent animated WebP, 8 frames each (512px GIF masters alongside)
    runners: {
      cyber: { name: "Cyber", walk: "assets/gif/cyber-walk.webp", run: "assets/gif/cyber-run.webp" },
      hoodie: { name: "Hoodie", walk: "assets/gif/hoodie-walk.webp", run: "assets/gif/hoodie-run.webp" },
      cap: { name: "Cap", walk: "assets/gif/cap-walk.webp", run: "assets/gif/cap-run.webp" },
    },
  },
  register: {
    url: register("TechRun 2027 · Notify me when registration opens"),
    live: Boolean(REGISTER_URL),
    label: "Register now",
    note: REGISTER_URL ? "3K · 5K · 10K · Slots are limited" : "Opens soon · Get notified",
  },
  words: ["MOVE", "PEOPLE", "BRIGHTER", "TOMORROW"],
  // venue is TBA; the globe points at the host city
  location: { city: "Metro Manila", country: "Philippines", venue: "Venue TBA", lat: 14.6, lon: 121.0, tz: "Asia/Manila", tzLabel: "GMT+8" },
  organizer: {
    label: "Organized by",
    name: "GN Club",
    line: "A tech-powered fun run",
    mission: "Move people for a brighter tomorrow",
    edition: "Edition 2027",
    date: "Date TBA",
  },
  // race categories (scene: distances)
  categories: [
    { name: "3K", label: "Fun Run", note: "Walk it, jog it, bring the crew", bib: "30001", url: register("TechRun 2027 · 3K registration") },
    { name: "5K", label: "Run", note: "The classic distance", bib: "50001", url: register("TechRun 2027 · 5K registration") },
    { name: "10K", label: "Challenge", note: "For the ones chasing a PR", bib: "10001", url: register("TechRun 2027 · 10K registration") },
  ],
  // one entry per shoe part (shoe.js PARTS); `primary` lists item indexes drawn as highlights
  kit: {
    toe: { part: "Toe", group: "Distances", items: ["3K Fun Run", "5K Run", "10K Challenge"], primary: [0, 1, 2] },
    laces: { part: "Laces", group: "Race Kit", items: ["Official Singlet", "Race Bib", "Timing Chip", "Drawstring Bag"], primary: [0, 1] },
    upper: { part: "Upper", group: "Finish Line", items: ["Finisher Medal", "E-Certificate", "Race Photos", "Loot Bag"], primary: [0] },
    heel: { part: "Heel", group: "Support", items: ["Hydration Stations", "Route Marshals", "Medics on Course", "Bag Drop"], primary: [0, 2] },
    midsole: { part: "Midsole", group: "Tech", items: ["Chip Timing", "Live Results", "Photo Search", "Race-Day Updates"], primary: [0, 1] },
    outsole: { part: "Outsole", group: "Route", items: ["Start Arch", "KM Markers", "Water Points", "Finish Arch"], primary: [0, 3] },
  },
  // race-day highlights (scene: belt of cards); img is a key of assets.photos or a full path
  highlights: [
    { name: "Chip-Timed Results", category: "Tech · Live", field: "ink", img: "computer", url: mail("TechRun 2027 · Results") },
    { name: "Pixel Photo Wall", category: "Expo · Booth", field: "lime", img: "paintGuy", url: mail("TechRun 2027 · Photo wall") },
    { name: "Retro Race Village", category: "Expo · Y2K", field: "paper", img: "tv", url: mail("TechRun 2027 · Race village") },
    { name: "Run Club Pacers", category: "Community", field: "cyan", img: "runners", url: mail("TechRun 2027 · Pacers") },
    { name: "Finisher Medal", category: "Finish · Loot", field: "orange", img: "assets/img/trophy.png", url: mail("TechRun 2027 · Finisher medal") },
    { name: "Hydration Stations", category: "Support", field: "ink", img: "hills", url: mail("TechRun 2027 · Hydration") },
    { name: "Code & Cardio", category: "Talks · Tech", field: "lime", img: "matrix", url: mail("TechRun 2027 · Talks") },
    { name: "Afterparty Stage", category: "Music · Night", field: "paper", img: "crew", url: mail("TechRun 2027 · Afterparty") },
  ],
  // two showcase frames
  showcases: [
    {
      field: "paper", title: ["Official", "Singlets"], accent: "Singlets", ghost: "S",
      pitch: "Breathable race singlets in the full TechRun gradient", strikes: ["Front", "Back", "Side"],
      stack: "Sample categories · Registration TBA", badge: { big: "KIT", small: "Race Kit 2027" },
      img: "singlets", runner: "hoodie",
      // race bib cards fanned out under the poster: [src, alt]
      bibs: [
        ["assets/img/bib-3k.webp", "3K race bib 30001"],
        ["assets/img/bib-5k.webp", "5K race bib 50001"],
        ["assets/img/bib-10k.webp", "10K race bib 10001"],
      ],
      links: [["Ask about kits", mail("TechRun 2027 · Race kit")]],
    },
    {
      field: "ink", title: ["Race", "Bibs"], accent: "Bibs", ghost: "#",
      pitch: "Chip-timed bibs for every distance", features: ["3K", "5K", "10K"],
      stack: "30001 · 50001 · 10001 · Registration TBA", badge: { big: "TBA", small: "Date & venue" },
      img: "bibs", runner: "cap",
      links: [["Get race updates", mail("TechRun 2027 · Race updates")]],
    },
  ],
  // partner slots (scene: partners grid)
  partners: [
    { title: "GN Club", issuer: "Organizer", url: mail("TechRun 2027 · GN Club") },
    { title: "Your Brand Here", issuer: "Title partner", url: mail("TechRun 2027 · Title partnership") },
    { title: "Your Brand Here", issuer: "Tech partner", url: mail("TechRun 2027 · Tech partnership") },
    { title: "Your Brand Here", issuer: "Community partner", url: mail("TechRun 2027 · Community partnership") },
  ],
  contact: {
    headline: "LET'S RUN",
    links: [
      { label: "Email", value: EMAIL, url: `mailto:${EMAIL}` },
      { label: "Register", value: REGISTER_URL ? "Register now" : "Registration TBA", url: register("TechRun 2027 · Notify me when registration opens") },
      { label: "Partner", value: "Sponsor the run", url: mail("TechRun 2027 · Partnership") },
      { label: "Volunteer", value: "Join the crew", url: mail("TechRun 2027 · Volunteer") },
    ],
    footer: "© 2027 TechRun · A GN Club event · Move people for a brighter tomorrow",
  },
};
