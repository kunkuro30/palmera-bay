// A small seeded random number generator (mulberry32): the same seed gives the same city,
// which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max]. */
export function intRange(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/** Pick one element of an array. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** Clamp v into [min, max]. */
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

/** Shortest-arc interpolation between two angles. */
export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}
