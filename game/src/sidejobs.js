// GO RIO RIO · sidejobs.js — golden shells, courier work, deliveries and shop purchases.
// BUILD 13 — depth systems: the fifteen golden shells, repeatable
// courier work off the kiosk row, car delivery at Palmera Motors, and
// the shop purchases (Palmera Arms armour, food-shop meals, Motors
// repair). A parallel, lightweight system beside the story engine in
// missions.js: it never touches the story beacon or objective card —
// offers ride the HUD prompt pill (T to accept), deliveries get their
// own small teal beacon, and everything paid or collected persists
// through the save.

import { WORLD, SHOPS, groundHeight } from './config.js';
import { makeRng } from './random.js';
import { earnRespect, repLevel } from './save.js';
import { nextUpgrade, buyUpgrade } from './upgrades.js';

// BUILD 15: the safehouse door (the west-row Heights house at z 45 —
// its door faces the street at x ≈ 178) and the apartment's price.
const HOUSE_DOOR = { x: 178.6, z: 45 };
const HOUSE_PRICE = 5000;
export const COMET_PAD = { x: 180.2, z: 45 };

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}

// The fifteen shells: beach, pier, lake, summit, desert, garrison,
// apron, park, plaza, wheel, hospital, Heights, lockup, east shore.
const SHELL_SPOTS = [
  [-100, 216], [5.2, 230], [30, -96], [50, -116], [-70, -155],
  [150, -165], [125, -44], [-180, 170], [88, 60], [-112, 208],
  [-84, 214], [-116, 193], [182, 48], [193, 104], [172, 150],
];

const KIOSKS = [
  { x: -56, z: 192.2, label: 'HOTDOGS' },
  { x: 48, z: 192.2, label: 'DONUTS' },
  { x: 113, z: 192.2, label: 'COLD DRINKS' },
];

// Courier destinations: every shop front, the hotels, the civic
// buildings — anywhere with a keeper who signs for a parcel.
const TARGETS = [
  ...SHOPS.map((s) => ({ name: s.label, x: s.x, z: 187 })),
  { name: 'HOTEL CORAL', x: 146, z: 63.75 },
  { name: 'HOTEL AZURE', x: 146, z: 96.25 },
  { name: 'HOTEL PALMS', x: 146, z: 142.5 },
  { name: 'PALMERA GENERAL', x: -116, z: 190 },
  { name: 'PALMERA PD', x: 120, z: 89 },
  { name: 'PALMERA FD', x: 75, z: 27.5 },
  { name: 'PALMERA MOTORS', x: 120, z: 150 },
  { name: 'PALMERA ARMS', x: -117.5, z: 148.5 },
  { name: 'THE LOCKUP', x: 193, z: 96 },
  { name: 'THE GARRISON GATE', x: 104, z: -30 },
];

const CAR_VALUES = { sport: 400, truck: 300, van: 250, taxi: 200, sedan: 150 };

export function createSidejobs(scene, G) {
  const rng13 = makeRng(20261122);
  const samples = scene.userData.groundingSamples || null;
  if (samples) samples.push({ label: 'safehouse door', x: HOUSE_DOOR.x, z: HOUSE_DOOR.z, y: groundHeight(HOUSE_DOOR.x, HOUSE_DOOR.z), q: 'groundHeight' });

  // ---- Golden shells -------------------------------------------------
  const shellGroup = new THREE.Group();
  shellGroup.visible = !G.shotMode;
  scene.add(shellGroup);
  const shells = SHELL_SPOTS.map(([x, z], i) => {
    const gy = groundHeight(x, z);
    if (samples) samples.push({ label: 'golden shell ' + (i + 1), x, z, y: gy, q: 'groundHeight' });
    const g = new THREE.Group();
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.20, 0.085, 48, 8),
      lam(0xffc93e, { emissive: 0x6a4a00 }));
    knot.castShadow = true;
    g.add(knot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.75 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.30;
    g.add(ring);
    g.position.set(x, gy + 0.38, z);
    g.visible = ((G.save.shellBits || 0) & (1 << i)) === 0;
    shellGroup.add(g);
    return { g, x, z, baseY: gy + 0.38, i };
  });
  G.animated.push({
    update(t) {
      if (!shellGroup.visible) return;
      for (const s of shells) {
        if (!s.g.visible) continue;
        s.g.rotation.y = t * 1.3 + s.i * 1.7;
        s.g.position.y = s.baseY + Math.sin(t * 2 + s.i * 2.1) * 0.07;
      }
    },
  });

  function collectShell(s) {
    s.g.visible = false;
    G.save.shellBits = (G.save.shellBits || 0) | (1 << s.i);
    let n = 0;
    for (let i = 0; i < SHELL_SPOTS.length; i++) if (G.save.shellBits & (1 << i)) n++;
    G.save.shells = n;
    G.persist();
    G.hud.toast(`GOLDEN SHELL ${n}/15`);
    earnRespect(G, 4);   // BUILD 14: shells pay a little respect too
    G.audio.jingle();
  }

  // ---- Courier beacon (own marker — the story beacon is missions') --
  const beacon = new THREE.Group();
  {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 20, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x37e0c8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 10;
    beacon.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.18, 8, 20), lam(0x37e0c8, { emissive: 0x0a4a40 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    beacon.add(ring);
    beacon.visible = false;
    scene.add(beacon);
  }

  // ---- State ----------------------------------------------------------
  let offer = null;          // the prompt's current actionable offer
  let delivery = null;       // { target, pay, timeLeft }
  let nextOfferAt = 0;

  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  function payCash(amount) {
    G.save.cash += amount;
    G.save.cashEarned = (G.save.cashEarned || 0) + amount;
    G.persist();
  }

  function startDelivery(kiosk) {
    let target = TARGETS[Math.floor(rng13() * TARGETS.length)];
    if (dist(kiosk.x, kiosk.z, target.x, target.z) < 60) {
      target = TARGETS[(TARGETS.indexOf(target) + 5) % TARGETS.length];
    }
    const d = dist(kiosk.x, kiosk.z, target.x, target.z);
    const pay = Math.round(Math.min(150, Math.max(75, 70 + d * 0.22)));
    delivery = { target, pay, timeLeft: d / 7 + 50 };
    beacon.position.set(target.x, groundHeight(target.x, target.z), target.z);
    beacon.visible = true;
    G.hud.toast(`COURIER — parcel for ${target.name} · $${pay}`);
  }

  function endDelivery(ok) {
    beacon.visible = false;
    if (ok) {
      payCash(delivery.pay);
      G.hud.toast(`DELIVERED · +$${delivery.pay}`);
      earnRespect(G, 6);   // BUILD 14
      if (G.standing) G.standing.award(delivery.target.x, delivery.target.z, 6);   // BUILD 15
      G.audio.jingle();
    } else {
      G.hud.toast('DELIVERY FAILED — too slow');
    }
    delivery = null;
    nextOfferAt = G.time + 15;
  }

  // ---- Offers ----------------------------------------------------------
  function computeOffer(p) {
    const car = G.player.car;
    if (car) {
      const onPad = Math.abs(p.x - 120) < 9.5 && Math.abs(p.z - 153.7) < 5;
      if (onPad && Math.abs(car.speed) < 1) {
        if (G.missions.isJobCar(car)) {
          return { kind: 'note', text: 'PALMERA MOTORS — the row needs that car. Not for sale.' };
        }
        if (car.isComet) {
          return { kind: 'note', text: 'PALMERA MOTORS — the Comet is Rio\'s own. Not for sale.' };
        }
        const value = CAR_VALUES[car.cls] || 120;
        return { kind: 'sell', car, value, text: `<b>[T]</b> Sell this ${car.cls} to PALMERA MOTORS — <b>$${value}</b>` };
      }
      // BUILD 15: the garage fits the Comet at the forecourt — one
      // upgrade at a time (engine, then armour, then the nitro kit);
      // once it is fully built the bay falls back to the $60 wash.
      if (dist(p.x, p.z, 120, 148) < 11) {
        if (car.isComet) {
          const up = nextUpgrade(G);
          if (up) {
            const label = up.kind === 'nitro' ? 'NITRO KIT' : `${up.kind.toUpperCase()} Lv ${up.level}`;
            return { kind: 'upgrade', up, text: `<b>[T]</b> PALMERA MOTORS — fit the Comet: ${label} — <b>$${up.price.toLocaleString('en-US')}</b>` };
          }
          return { kind: 'note', text: 'PALMERA MOTORS — the Comet is fully built. Nothing left to fit.' };
        }
        return { kind: 'repair', text: '<b>[T]</b> PALMERA MOTORS — repair &amp; wash — <b>$60</b>' };
      }
      return null;
    }
    // BUILD 15: the Heights safehouse — buy the apartment at its door,
    // then rest there: full heal, the clock jumps to 08:00 next day,
    // a cool head (≤2 stars) is forgotten, and the Comet waits on
    // its pad outside, repaired.
    if (dist(p.x, p.z, HOUSE_DOOR.x, HOUSE_DOOR.z) < 3.4) {
      if (!(G.save.houseOwned || 0)) {
        return { kind: 'buyHouse', text: `<b>[T]</b> PALMERA HEIGHTS — buy the apartment — <b>$${HOUSE_PRICE.toLocaleString('en-US')}</b>` };
      }
      return { kind: 'rest', text: '<b>[T]</b> YOUR APARTMENT — rest · heal · 08:00 tomorrow' };
    }
    // BUILD 14: the Arms display case sells the guns now — SMG first,
    // then the rifle, each behind its BAY REP lock. The armour counter
    // below keeps its own spot by the door.
    if (dist(p.x, p.z, -121.4, 149.5) < 3.2 && G.weapons) {
      const lv = repLevel(G.save);
      if (!G.weapons.owned('smg')) {
        return { kind: 'buyWeapon', id: 'smg', text: lv >= 2
          ? '<b>[T]</b> PALMERA ARMS — SMG — <b>$900</b>'
          : '<b>[T]</b> PALMERA ARMS — SMG — <b>$900</b> · needs BAY REP Lv 2' };
      }
      if (!G.weapons.owned('rifle')) {
        return { kind: 'buyWeapon', id: 'rifle', text: lv >= 3
          ? '<b>[T]</b> PALMERA ARMS — RIFLE — <b>$2,200</b>'
          : '<b>[T]</b> PALMERA ARMS — RIFLE — <b>$2,200</b> · needs BAY REP Lv 3' };
      }
      return { kind: 'note', text: 'PALMERA ARMS — you own the whole rack.' };
    }
    if (dist(p.x, p.z, -117.5, 148.6) < 3.4) {
      const a = G.player.armour || 0;
      if (a >= 100) return { kind: 'note', text: 'PALMERA ARMS — your armour is full.' };
      if (a < 50) return { kind: 'armour50', text: '<b>[T]</b> PALMERA ARMS — armour +50 — <b>$250</b>' };
      return { kind: 'armourFull', text: '<b>[T]</b> PALMERA ARMS — full armour — <b>$450</b>' };
    }
    for (const s of SHOPS) {
      if (s.kind === 'souvenir') continue;
      if (dist(p.x, p.z, s.x, 187.5) < 3.4) {
        return { kind: 'food', shop: s, text: `<b>[T]</b> ${s.label} — a hot meal, +50 HP — <b>$40</b>` };
      }
    }
    if ((G.save.jobsDone || 0) >= 1 && G.time >= nextOfferAt) {
      for (const kiosk of KIOSKS) {
        if (dist(p.x, p.z, kiosk.x, kiosk.z) < 4) {
          return { kind: 'courier', kiosk, text: `<b>[T]</b> ${kiosk.label} — take a courier delivery` };
        }
      }
    }
    return null;
  }

  function interact() {
    if (!offer || offer.kind === 'note') return;
    const o = offer;
    if (o.kind === 'buyWeapon') {
      const w = G.weapons.WEAPONS.find((x) => x.id === o.id);
      const res = G.weapons.buy(o.id);
      if (res === 'rep') G.hud.toast(`NEEDS BAY REP Lv ${w.repReq}`);
      else if (res === 'cash') G.hud.toast('NOT ENOUGH CASH');
      else if (res === 'ok') { G.hud.toast(`${w.name} — YOURS · slot ${w.slot}`); G.audio.jingle(); }
      return;
    }
    if (o.kind === 'upgrade') {
      const res = buyUpgrade(G, o.up.kind);
      if (res === 'cash') { G.hud.toast('NOT ENOUGH CASH'); return; }
      if (res === 'ok') {
        const label = o.up.kind === 'nitro' ? 'NITRO KIT FITTED — hold SHIFT to boost' : `${o.up.kind.toUpperCase()} Lv ${o.up.level} FITTED`;
        G.hud.toast(`PALMERA MOTORS — ${label}`);
        G.audio.jingle();
      }
      return;
    }
    if (o.kind === 'buyHouse') {
      if (G.save.cash < HOUSE_PRICE) { G.hud.toast('NOT ENOUGH CASH'); return; }
      G.save.cash -= HOUSE_PRICE;
      G.save.houseOwned = 1;
      G.persist();
      G.hud.toast('THE APARTMENT IS YOURS — rest here any time');
      G.audio.jingle();
      return;
    }
    if (o.kind === 'rest') {
      G.player.health = 100;
      G.player.armour = 100;
      G.save.day = (G.save.day || 1) + 1;
      // The HUD clock is (09:30 + play time + clockOff): solve the
      // offset that lands the display on 08:00 sharp.
      const now = Math.floor(G.time);
      G.save.clockOff = (((480 - 570 - now) % 1440) + 1440) % 1440;
      if (G.police.stars <= 2) G.police.heat = 0;
      const comet = G.comet;
      if (comet) {
        if (G.wrecks) G.wrecks.repairCar(comet);
        comet.group.position.set(COMET_PAD.x, groundHeight(COMET_PAD.x, COMET_PAD.z), COMET_PAD.z);
        comet.heading = Math.PI / 2;
        comet.group.rotation.y = Math.PI / 2;
        comet.speed = 0;
      }
      G.persist();
      G.hud.toast(`RESTED — DAY ${G.save.day} · 08:00`);
      G.audio.jingle();
      return;
    }
    if (o.kind === 'courier') { startDelivery(o.kiosk); return; }
    if (o.kind === 'sell') {
      const car = o.car;
      G.player.exitCar(true);
      scene.remove(car.group);
      const ix = G.cars.indexOf(car);
      if (ix >= 0) G.cars.splice(ix, 1);
      G.save.carsSold = (G.save.carsSold || 0) + 1;
      payCash(o.value);
      earnRespect(G, 8);   // BUILD 14
      G.hud.toast(`SOLD TO PALMERA MOTORS · +$${o.value}`);
      return;
    }
    if (o.kind === 'repair') {
      if (G.save.cash < 60) { G.hud.toast('NOT ENOUGH CASH'); return; }
      G.save.cash -= 60;
      G.persist();
      G.hud.toast('PALMERA MOTORS — washed, waxed, good as new');
      return;
    }
    if (o.kind === 'armour50' || o.kind === 'armourFull') {
      const price = o.kind === 'armour50' ? 250 : 450;
      if (G.save.cash < price) { G.hud.toast('NOT ENOUGH CASH'); return; }
      G.save.cash -= price;
      G.player.armour = o.kind === 'armour50' ? Math.min(100, (G.player.armour || 0) + 50) : 100;
      G.persist();
      G.hud.toast(o.kind === 'armour50' ? 'ARMOUR +50' : 'FULL ARMOUR');
      return;
    }
    if (o.kind === 'food') {
      if (G.player.health >= 100) { G.hud.toast("You're full — the keeper waves you off"); return; }
      if (G.save.cash < 40) { G.hud.toast('NOT ENOUGH CASH'); return; }
      G.save.cash -= 40;
      G.player.health = Math.min(100, G.player.health + 50);
      G.persist();
      G.hud.toast(`${o.shop.label} — you feel better already`);
    }
  }

  // ---- Per-step update (called from main.js stepWorld) -----------------
  function update(dt) {
    const p = G.playerPos();
    // Shells collect on foot, walking over them.
    if (!G.player.car && shellGroup.visible) {
      for (const s of shells) {
        if (s.g.visible && dist(p.x, p.z, s.x, s.z) < 1.4) collectShell(s);
      }
    }
    if (delivery) {
      delivery.timeLeft -= dt;
      const t = delivery.target;
      if (dist(p.x, p.z, t.x, t.z) < 5.5) { endDelivery(true); }
      else if (delivery.timeLeft <= 0) { endDelivery(false); }
      else {
        beacon.rotation.y = G.time * 0.9;
        const left = Math.max(0, Math.ceil(delivery.timeLeft));
        const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
        G.hud.prompt(`COURIER → ${t.name} · ${mm}:${ss} · <b>$${delivery.pay}</b>`);
      }
      offer = null;
      return;
    }
    offer = computeOffer(p);
    G.hud.prompt(offer ? offer.text : null);
  }

  return { update, interact, shellGroup,
    // BUILD 14: the live courier run, exposed for the functional test.
    get delivery() { return delivery; } };
}
