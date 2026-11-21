// GO RIO RIO · standing.js — per-district standing points and their percentages.
// BUILD 15 — district standing. The top-3 games wear their territory
// percentages on the map; Palmera Bay now earns its own. Story jobs,
// courier deliveries, race finishes and stunt jumps bank standing
// points in the district where they happen (districts.js decides the
// district): 40 points is a full 100 % on the honest scale — a couple
// of evenings of work in one neighbourhood, not a lifetime. Crossing
// 50 % and 100 % pays a one-time RESPECT bonus (+30 / +60) with a
// toast, tracked by a bitmask in the save so it can never pay twice.
// The pause MAP prints the % beside every district name.

import { DISTRICTS, districtAt } from './districts.js';
import { earnRespect } from './save.js';

export const STANDING_CAP = 40;   // points for 100 %

const keyOf = (id) => 'dst' + id[0].toUpperCase() + id.slice(1);

export function createStanding(G) {
  function points(id) {
    return G.save[keyOf(id)] || 0;
  }
  function percent(id) {
    return Math.min(100, Math.floor((points(id) / STANDING_CAP) * 100));
  }

  // Bank `pts` in the district containing (x, z). Returns the district
  // (or null out in the wilds, where no district claims the spot).
  function award(x, z, pts) {
    const d = districtAt(x, z);
    if (!d) return null;
    const key = keyOf(d.id);
    const before = percent(d.id);
    G.save[key] = (G.save[key] || 0) + pts;
    const after = percent(d.id);
    const di = DISTRICTS.findIndex((dd) => dd.id === d.id);
    for (const [thresh, bit, bonus] of [[50, di * 2, 30], [100, di * 2 + 1, 60]]) {
      if (before < thresh && after >= thresh && !((G.save.dstBonus || 0) & (1 << bit))) {
        G.save.dstBonus = (G.save.dstBonus || 0) | (1 << bit);
        G.persist();
        earnRespect(G, bonus);
        G.hud.toast(`DISTRICT STANDING — ${d.name} ${thresh}% · +${bonus} RESPECT`);
      }
    }
    G.persist();
    return d;
  }

  return { award, points, percent, keyOf };
}
