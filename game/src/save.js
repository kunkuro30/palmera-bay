// GO RIO RIO · save.js — localStorage persistence for cash, jobs, stats and RESPECT.
// localStorage persistence: cash, jobs finished and the career stat
// counters (build 12) survive a reload. Storage can be unavailable
// (private windows) — failures are swallowed and the save then lasts
// only for the visit.
//
// BUILD 14: RESPECT — the bay's second progression number — plus
// weapon ownership (a bitmask: 1 pistol, 2 SMG, 4 rifle), the last
// radio station and the two race best times (seconds, 0 = none yet).
//
// BUILD 15: the day counter and the rest-shifted clock offset, the
// Palmera Heights safehouse flag, the Comet's upgrade levels (engine /
// armour / nitro owned), and district standing — one points counter
// per district plus a bitmask of the 50 % / 100 % bonuses already paid.

const KEY = 'palmera-bay-reborn.save';

const FIELDS = ['cash', 'jobsDone', 'cashEarned', 'carsDriven', 'carsStolen',
  'copsEvaded', 'distance', 'shells', 'playTime', 'carsSold', 'shellBits',
  'respect', 'weapons', 'radioStation', 'raceBest1', 'raceBest2',
  'day', 'clockOff', 'houseOwned', 'upgEngine', 'upgArmor', 'upgNitro',
  'dstAirport', 'dstGarrison', 'dstHeights', 'dstOcean', 'dstDowntown',
  'dstNorth', 'dstBonus'];

export function loadSave() {
  const save = {
    cash: 0, jobsDone: 0, cashEarned: 0, carsDriven: 0, carsStolen: 0,
    copsEvaded: 0, distance: 0, shells: 0, playTime: 0, carsSold: 0, shellBits: 0,
    respect: 0, weapons: 1, radioStation: 0, raceBest1: 0, raceBest2: 0,
    day: 1, clockOff: 0, houseOwned: 0, upgEngine: 0, upgArmor: 0, upgNitro: 0,
    dstAirport: 0, dstGarrison: 0, dstHeights: 0, dstOcean: 0, dstDowntown: 0,
    dstNorth: 0, dstBonus: 0,
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const f of FIELDS) if (Number.isFinite(parsed[f])) save[f] = parsed[f];
      // Migration (build 14): a pre-RESPECT save has no respect field.
      // Seed it from finished jobs — 25 per job, exactly what a story
      // job pays now — so a returning player's rank carries over.
      if (!Number.isFinite(parsed.respect)) save.respect = (save.jobsDone || 0) * 25;
      if (!(save.weapons & 1)) save.weapons |= 1;   // the pistol is always owned
    }
  } catch { /* keep defaults */ }
  // DEFECT FIX (M-4): clamp insane-but-finite values — a corrupted or
  // hand-edited save must not produce negative cash, DAY 0, or a story
  // counter past the finale. (Non-finite values already fell back to
  // the defaults in the copy loop above.)
  const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(v)));
  save.cash = clampInt(save.cash, 0, 999999);
  save.jobsDone = clampInt(save.jobsDone, 0, 8);
  save.respect = Math.max(0, Math.floor(save.respect));
  save.day = Math.max(1, Math.floor(save.day));
  save.shells = clampInt(save.shells, 0, 15);        // fifteen golden shells exist
  save.upgEngine = clampInt(save.upgEngine, 0, 3);   // three garage levels each
  save.upgArmor = clampInt(save.upgArmor, 0, 3);
  save.upgNitro = clampInt(save.upgNitro, 0, 1);
  save.houseOwned = clampInt(save.houseOwned, 0, 1);
  for (const f of ['cashEarned', 'carsDriven', 'carsStolen', 'copsEvaded',
    'distance', 'playTime', 'carsSold', 'raceBest1', 'raceBest2',
    'dstAirport', 'dstGarrison', 'dstHeights', 'dstOcean', 'dstDowntown',
    'dstNorth', 'dstBonus']) {
    if (save[f] < 0) save[f] = 0;   // counters and standing points never go negative
  }
  return save;
}

export function persistSave(save) {
  try {
    const out = {};
    for (const f of FIELDS) out[f] = Math.round((save[f] || 0) * 10) / 10;
    out.cash = save.cash;
    out.jobsDone = save.jobsDone;
    window.localStorage.setItem(KEY, JSON.stringify(out));
  } catch { /* visit-only save */ }
}

// BAY REP level (build 14): derived from RESPECT — one level per 100
// respect banked. RESPECT is reputation, never spent; it gates the
// Palmera Arms rack (SMG at Lv 2, rifle at Lv 3) and the Island Loop.
export function repLevel(save) {
  return 1 + Math.floor((save.respect || 0) / 100);
}

// The single respect tap: every earner in the game routes through
// here so the counter, the level and the save can never drift apart.
export function earnRespect(G, n) {
  const before = repLevel(G.save);
  G.save.respect = (G.save.respect || 0) + n;
  G.persist();
  const after = repLevel(G.save);
  if (after > before && G.hud) G.hud.toast(`BAY REP Lv ${after} — the bay knows your name`);
  return G.save.respect;
}
