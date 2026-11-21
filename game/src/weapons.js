// GO RIO RIO · weapons.js — the four-slot weapon system and its BAY REP gates.
// BUILD 14 — the multi-weapon system. Four slots: 1 FISTS, 2 PISTOL
// (owned from the start), 3 SMG and 4 RIFLE, the last two bought at
// Palmera Arms and gated by BAY REP (Brisa-style rank locks: SMG needs
// Lv 2, the rifle Lv 3). Keys 1–4 select a slot directly; Q or the
// mouse wheel cycles through OWNED weapons only. The held model swaps
// on the figure's right arm: the build-13 pistol and rifle, plus the
// build-14 SMG, all from characters.js in the same modelling language.
//
// BUILD 15 — magazines and reload. Each gun carries a real magazine
// (PISTOL 12, SMG 30, RIFLE 20); the RESERVE is honestly infinite —
// the HUD chip reads "12 / ∞" and never pretends otherwise. R reloads
// (1.2 s: firing blocked, the camera dips, the mag refills). An empty
// trigger gives a dry click and an R — RELOAD flash. Ammo is session
// state, not saved: a fresh visit starts with full magazines.

import { makeWeapon, makeRifle, makeSmg } from './characters.js';
import { repLevel } from './save.js';

export const WEAPONS = [
  { id: 'fists', slot: 1, name: 'FISTS', bit: 0, dmg: 0, range: 0, cooldown: 0, auto: false, price: 0, repReq: 1, mag: 0 },
  { id: 'pistol', slot: 2, name: 'PISTOL', bit: 1, dmg: 34, range: 60, cooldown: 0.22, auto: false, price: 0, repReq: 1, mag: 12 },
  { id: 'smg', slot: 3, name: 'SMG', bit: 2, dmg: 16, range: 45, cooldown: 0.09, auto: true, price: 900, repReq: 2, mag: 30 },
  { id: 'rifle', slot: 4, name: 'RIFLE', bit: 4, dmg: 55, range: 110, cooldown: 0.55, auto: false, price: 2200, repReq: 3, mag: 20 },
];

export const RELOAD_TIME = 1.2;

const MAKERS = { pistol: makeWeapon, smg: makeSmg, rifle: makeRifle };

export function createWeapons(G) {
  let current = 'pistol';
  let shots = 0;        // lifetime trigger pulls this session (test hook)
  let dryClicks = 0;    // empty-trigger pulls (test hook)
  const ammo = {};      // rounds in the current magazine, per gun
  for (const w of WEAPONS) if (w.mag) ammo[w.id] = w.mag;
  let reloadT = 0;      // seconds left on the running reload (0 = none)

  const def = () => WEAPONS.find((w) => w.id === current);
  const owned = (id) => {
    const w = WEAPONS.find((x) => x.id === id);
    return w.bit === 0 || ((G.save.weapons || 1) & w.bit) !== 0;
  };

  // Swap the model in Rio's right hand. Fists = empty hand. The group
  // sits exactly where makeFigure hung the pistol (grip top at the
  // hand), and parts.weapon keeps pointing at it for combat's muzzle.
  function swapModel() {
    const fig = G.player.fig;
    const arm = fig.parts.armR;
    if (fig.parts.weapon) {
      arm.remove(fig.parts.weapon);
      fig.parts.weapon = null;
    }
    const maker = MAKERS[current];
    if (maker) {
      const w = maker();
      w.position.set(0, -0.615, 0.03);
      w.visible = !!G.player.aiming;
      arm.add(w);
      fig.parts.weapon = w;
    }
  }

  function select(id) {
    if (!owned(id) || id === current) return false;
    current = id;
    reloadT = 0;        // swapping weapons abandons a running reload
    swapModel();
    return true;
  }

  // ---- BUILD 15: magazine + reload ----------------------------------
  // combat.shoot asks before every shot: a round in the mag is spent
  // by the shot itself; an empty mag answers 'dry' (combat clicks and
  // flashes the reload prompt); a running reload answers 'busy'.
  function trySpend() {
    const w = def();
    if (!w.mag) return 'ok';
    if (reloadT > 0) return 'busy';
    if (ammo[w.id] <= 0) { dryClicks += 1; return 'dry'; }
    ammo[w.id] -= 1;
    return 'ok';
  }

  function startReload() {
    const w = def();
    if (!w.mag || reloadT > 0 || ammo[w.id] >= w.mag) return false;
    reloadT = RELOAD_TIME;
    if (G.audio && G.audio.reload) G.audio.reload();
    return true;
  }

  function update(dt) {
    if (reloadT > 0) {
      reloadT -= dt;
      if (reloadT <= 0) {
        reloadT = 0;
        ammo[def().id] = def().mag;
      }
    }
  }

  // The reload camera dip: 0 at the ends, 1 at mid-reload. main.js
  // lowers the on-foot camera by a fraction of this each frame.
  function dip() {
    if (reloadT <= 0) return 0;
    return Math.sin((1 - reloadT / RELOAD_TIME) * Math.PI);
  }

  function selectSlot(n) {
    const w = WEAPONS.find((x) => x.slot === n);
    if (!w) return;
    if (!owned(w.id)) { G.hud.toast(`${w.name} — PALMERA ARMS sells it`); return; }
    select(w.id);
  }

  function cycle(dir) {
    const list = WEAPONS.filter((w) => owned(w.id));
    if (list.length < 2) return;
    let i = list.findIndex((w) => w.id === current);
    i = (i + dir + list.length) % list.length;
    select(list[i].id);
  }

  // The Arms counter calls this (sidejobs.js owns the prompt). Returns
  // 'rep' | 'cash' | 'owned' | 'ok' so the caller words the toast.
  function buy(id) {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w || owned(id)) return 'owned';
    if (repLevel(G.save) < w.repReq) return 'rep';
    if (G.save.cash < w.price) return 'cash';
    G.save.cash -= w.price;
    G.save.weapons = (G.save.weapons || 1) | w.bit;
    G.persist();
    if (w.mag) ammo[w.id] = w.mag;   // a bought gun comes with a full mag
    select(id);
    return 'ok';
  }

  return {
    WEAPONS,
    def, owned, select, selectSlot, cycle, buy,
    trySpend, startReload, update, dip,
    ammoOf(id) { return ammo[id] || 0; },
    get current() { return current; },
    get shots() { return shots; },
    get dryClicks() { return dryClicks; },
    get reloading() { return reloadT > 0; },
    noteShot() { shots += 1; },
  };
}
