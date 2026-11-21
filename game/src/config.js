// Palmera Bay — an island city with a Los-Santos-shaped layout: one organic
// island ringed by sea on every side, the city grid in the SOUTH (downtown
// towers, shop row, clinic), the tourist beach and pier on the south shore,
// Palmera Intl airport on a reclaimed plateau at the south-west edge, and a
// wild north — rolling hills, one big mountain, a dry desert in the
// north-east and a lake in the north-centre. A coastal highway loops the
// island and a freeway cuts north through the desert. This module holds the
// shared map maths (coastline, terrain height, walkable ground height) so
// the renderer, the AI and the minimap all agree on the same island.

function clampN(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerpN(a, b, t) { return a + (b - a) * t; }
function angDiffN(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function gauss(t) { return Math.exp(-t * t); }
function smooth(t) { t = clampN(t, 0, 1); return t * t * (3 - 2 * t); }

export const WORLD = {
  extent: 300,            // playable half-size in metres (the island plus a swim margin)
  centre: { x: 0, z: -20 },
  avenues: [-150, -100, -50, 0, 50, 100, 140],   // city north-south roads (x), south city only
  streets: [35, 80, 125],                        // city east-west roads (z)
  oceanDrive: 168,        // the boulevard between the city blocks and the shop row
  roadHalf: 8,            // half width of a road
  lane: 4,                // lane offset from a road centre line
  city: { x0: -172, x1: 162, z0: 14, z1: 196 },  // flattened, concreted city rect
  airport: { x0: -262, x1: -118, z0: 42, z1: 206 }, // reclaimed plateau rect
  shopsZ: 180,            // shop fronts face the beach along this line
  promenadeZ: 192.5,      // boardwalk between the shops and the sand
  park: { x0: 56, x1: 120, z0: 44, z1: 88 },
  ferris: { x: -84, z: 206 },
  carousel: { x: -42, z: 208 },
  pier: { x: 8, z0: 194, z1: 250 },
  statue: { x: -112, z: 206 },
  lockup: { x: 196, z: 96 },        // Job 2 delivery garage on the east coast road
  hideout: { x: 88, z: 64 },        // Job 3 drop point inside the park
  missionCar: { x: -56, z: 22 },    // Job 2 marked sports car, north end of downtown
  lake: { x: 58, z: -138, r: 40, waterR: 34, waterY: 0.55 },
  mountain: { x: -70, z: -155 },
};

// Coastline radius (metres from the island centre) for a compass direction.
// Broad southern shore for the city, a bumped peninsula in the south-west
// where the airport plateau reaches out, organic wobble everywhere else.
export function coastRadius(theta) {
  let r = 240
    + 26 * Math.sin(2 * theta - 0.6)
    + 14 * Math.sin(3 * theta + 2.2)
    + 8 * Math.sin(6 * theta + 0.7);
  r += 40 * gauss(angDiffN(theta, 2.43) / 0.40);   // airport peninsula, south-west
  return r;
}

const HILLS = [
  [-130, -110, 15, 44], [140, -120, 10, 36], [-180, -40, 8, 38],
  [110, -185, 9, 40], [-95, 55, 5, 30],
];

function rectWeight(x, z, r, feather) {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  const d = Math.hypot(dx, dz);
  if (d <= 0) return 1;
  return smooth(1 - d / feather);
}

// Terrain height (metres) at any point: beach lip at the coast, gentle
// inland rise, the northern hills and mountain, the lake basin, flat pads
// under the city and the airport, and a seabed falloff outside the coast.
export function heightAt(x, z) {
  const dx = x - WORLD.centre.x;
  const dz = z - WORLD.centre.z;
  const d = Math.hypot(dx, dz);
  const th = Math.atan2(dz, dx);
  const R = coastRadius(th);
  const inland = clampN((R - d) / 30, 0, 1);
  let h = 0.35 + inland * 1.7;
  for (const [hx, hz, hh, hr] of HILLS) {
    const dd = (x - hx) * (x - hx) + (z - hz) * (z - hz);
    h += hh * Math.exp(-dd / (2 * hr * hr));
  }
  const dm = (x - WORLD.mountain.x) ** 2 + (z - WORLD.mountain.z) ** 2;
  h += 60 * Math.exp(-dm / (2 * 48 * 48));                    // the big mountain
  const ds = (x + 120) ** 2 + (z + 120) ** 2;
  h += 24 * Math.exp(-ds / (2 * 30 * 30));                    // its shoulder peak
  const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  h -= 3.2 * Math.exp(-(dl * dl) / (2 * 62 * 62));            // lake basin
  h -= 7 * Math.exp(-(dl * dl) / (2 * 34 * 34));              // lake dip
  h = lerpN(h, -0.9, smooth((36 - dl) / 16) * 0.9);           // firm lake bed
  h = lerpN(h, 0.6, rectWeight(x, z, WORLD.city, 14));        // city pad
  h = lerpN(h, 0.6, rectWeight(x, z, WORLD.airport, 8));      // airport plateau
  if (d > R) h = Math.min(h, 0.3 - (d - R) * 0.10);           // seabed
  return h;
}

// Is this point on a city sidewalk strip (the raised concrete beside a road)?
export function onSidewalk(x, z) {
  const c = WORLD.city;
  if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) return false;
  const lines = WORLD.streets.concat([WORLD.oceanDrive]);
  for (const a of WORLD.avenues) if (Math.abs(x - a) <= WORLD.roadHalf + 0.2 && z > 16 && z < 198) return false;
  for (const s of lines) if (Math.abs(z - s) <= WORLD.roadHalf + 0.2 && x > -170 && x < 160) return false;
  for (const a of WORLD.avenues) {
    if (Math.abs(Math.abs(x - a) - (WORLD.roadHalf + 1.3)) < 1.35 && z > 18 && z < 196) return true;
  }
  for (const s of lines) {
    if (Math.abs(Math.abs(z - s) - (WORLD.roadHalf + 1.3)) < 1.35 && x > -168 && x < 158) return true;
  }
  return false;
}

export const SEA_LEVEL = 0.1;   // the sea plane's Y in world.js

// Point-in-water test built from the SAME maths that draws the island:
// a point is in water when it lies beyond the coast curve (or inside the
// lake disc) AND the terrain there is below the water surface. Returns the
// water depth in metres, or -1 on dry land. Swimmer spawns must pass this
// with a depth of 0.4–1.2 — the textbook fix for "swimming on land".
export function waterDepthAt(x, z) {
  const dl = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
  if (dl < WORLD.lake.waterR) return WORLD.lake.waterY - heightAt(x, z);
  const dx = x - WORLD.centre.x;
  const dz = z - WORLD.centre.z;
  const d = Math.hypot(dx, dz);
  if (d > coastRadius(Math.atan2(dz, dx))) return SEA_LEVEL - heightAt(x, z);
  return -1;
}

// The height a walker/driver actually stands on: terrain, lifted onto the
// pier deck, the lake dock, or a sidewalk where those apply.
export function groundHeight(x, z) {
  let h = heightAt(x, z);
  const p = WORLD.pier;
  if (x > p.x - 3.5 && x < p.x + 3.5 && z > p.z0 - 1 && z < p.z1) h = Math.max(h, 1.05);
  else if (x > 46 && x < 54 && z > -119 && z < -102) h = Math.max(h, 0.85);
  else if (onSidewalk(x, z)) h += 0.14;
  return h;
}

// The coastal highway loop: a ring road just inside the coastline, closing
// through Ocean Drive across the city front. Shared by the road builder,
// the highway traffic and the minimap so all three draw the same loop.
let loopCache = null;
export function highwayLoopPoints() {
  if (loopCache) return loopCache;
  const pts = [];
  for (let th = 2.65; th < Math.PI * 2 + 0.55; th += 0.09) {
    const r = coastRadius(th) - 17;
    pts.push({ x: WORLD.centre.x + r * Math.cos(th), z: WORLD.centre.z + r * Math.sin(th) });
  }
  pts.push({ x: 172, z: 150 }, { x: 152, z: 168 }, { x: -152, z: 168 }, { x: -172, z: 150 });
  loopCache = pts;
  return pts;
}

// The north freeway: out of downtown, east of the lake, through the desert
// to the north coast loop.
export const FREEWAY_PTS = [
  { x: 50, z: 20 }, { x: 58, z: -30 }, { x: 74, z: -78 },
  { x: 94, z: -122 }, { x: 96, z: -162 }, { x: 82, z: -198 },
];

// BUILD 7: the row is now eight DISTINCT food & drink types (seafood/
// sushi, taco, bakery & donut, coffee, ice-cream, burger, noodle bar,
// pizzeria) plus the gift shop — each with its own facade tint, band
// colour and roof prop (world.js). Positions and keeper spots unchanged.
export const SHOPS = [
  { x: -108, kind: 'sushi',    label: 'SUSHI BAY',    color: 0x2e86c8, facade: 0xf3e9d2, keeper: 0x2e86c8 },
  { x: -88,  kind: 'taco',     label: 'TACO PALM',    color: 0xe4572e, facade: 0xf7dcc0, keeper: 0xe4572e },
  { x: -68,  kind: 'donuts',   label: 'DONUT BAY',    color: 0xff6fa5, facade: 0xfdeef4, keeper: 0xff8fb8 },
  { x: -48,  kind: 'coffee',   label: 'KAVA COFFEE',  color: 0x5a3825, facade: 0xe9dcc8, keeper: 0x6e4a2f },
  { x: 28,   kind: 'icecream', label: 'SCOOPS',       color: 0x63c7e6, facade: 0xeaf7fb, keeper: 0x9fe0f5 },
  { x: 48,   kind: 'burger',   label: 'PALM BURGER',  color: 0xf2b134, facade: 0xfdf3d8, keeper: 0xffd23e },
  { x: 68,   kind: 'noodle',   label: 'NOODLE BAY',   color: 0xd42a2a, facade: 0xfbe9e4, keeper: 0xff6b5e },
  { x: 88,   kind: 'pizza',    label: 'PIZZA PALM',   color: 0x37b24d, facade: 0xeef7e6, keeper: 0x5ecb6e },
  { x: 108,  kind: 'souvenir', label: 'BAY GIFTS',    color: 0xe4572e, facade: 0xf7f0dd, keeper: 0xff8a5c },
];

export const PALETTE = {
  sky: 0x93d2f0,
  fog: 0xd8e8ee,
  sand: 0xf2d492,
  water: 0x1f9bb8,
  waterDeep: 0x14748f,
  asphalt: 0x3c4148,
  sidewalk: 0xb9bdc2,
  boardwalk: 0xb0814d,
  grass: 0x6fbf5a,
  desert: 0xd9b380,
  rock: 0x8d8578,
  buildingTones: [0xf5e6c8, 0xe8d8b0, 0xd9e4ec, 0xf2c9a0, 0xcfd8dc, 0xf7f0dd, 0xe6b8a2, 0xbcd3e8],
  skin: [0xf2c79b, 0xe0ac7e, 0xc68863, 0x9c6644, 0x7a4b2a, 0xffdbac],
  shirts: [0xef476f, 0xffd23e, 0x06d6a0, 0x118ab2, 0x9b5de5, 0xf15bb5, 0x00bbf9, 0xfb8b24, 0x8ac926, 0xff5964],
  pants: [0x2b2d42, 0x3a506b, 0x5c374c, 0x386641, 0x6a4c93, 0x8d6e63, 0x274156],
};

export const TUNING = {
  walkSpeed: 5.2,
  runSpeed: 8.6,
  carAccel: 16,
  carBrake: 26,
  carDrag: 0.55,
  heatDecay: 3.2,       // heat points per second while no police see the player
  heatSeen: 6,          // heat points per second while a unit sees the player
  starHeat: 60,         // heat points per wanted star
};
