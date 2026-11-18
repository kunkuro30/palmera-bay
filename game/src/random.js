// random.js — a tiny seeded RNG so the city, traffic and screenshot scenes are
// identical on every load with the same seed (the screenshot staging needs it).

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}
