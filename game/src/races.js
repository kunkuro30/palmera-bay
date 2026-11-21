// GO RIO RIO · races.js — the two street races and their checkpoint rings.
// BUILD 14 — street races. Two routes with glowing checkpoint rings
// in the beacon language (flat ring + light column, orange for races):
//   RACE 1 · OCEAN SPRINT — a start grid on Ocean Drive, six rings
//     east along the coast road. Open to everyone.
//   RACE 2 · ISLAND LOOP — from the coastal highway near the airport,
//     ten rings around the whole loop back to the start. BAY REP Lv 2.
// Flow: drive onto the pad, stop, T — a 3-2-1 countdown holds the car
// (G.raceLock) — then the rings light one at a time, the prompt pill
// carries the timer, the distance and a direction arrow, and the
// minimap shows the active ring in orange. Payout bands scale with
// the measured route length (gold ≈ a clean 16 m/s run); finishing
// pays RESPECT +20 either way. Best times persist. Traffic stays live;
// racing alone never draws police heat. Stray more than 120 m from
// the active ring for over 10 s and the race is abandoned.

import { WORLD, groundHeight, highwayLoopPoints } from './config.js';
import { repLevel, earnRespect } from './save.js';
import { angDiff } from './random.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const ARROWS = ['▲', '⬈', '➡', '⬊', '▼', '⬋', '⬅', '⬉'];
function arrowFor(rel) {
  // rel > 0 = the target sits to the driver's left (heading grows
  // from south toward east in this world's frame).
  const idx = Math.round(rel / (Math.PI / 4));
  const table = { 0: '▲', 1: '⬉', 2: '⬅', 3: '⬋', 4: '▼', '-1': '⬈', '-2': '➡', '-3': '⬊', '-4': '▼' };
  return table[idx] || '▲';
}

function buildRoutes() {
  const od = WORLD.oceanDrive;
  const r1 = {
    id: 1, name: 'OCEAN SPRINT', repReq: 1, bestKey: 'raceBest1',
    pad: { x: -128, z: od },
    cps: [[-110, od], [-70, od], [-30, od], [10, od], [58, od], [90, od]],
  };
  const pts = highwayLoopPoints();
  const start = pts[3];
  const idx = [8, 13, 18, 23, 28, 33, 38, 43, 48];
  const r2 = {
    id: 2, name: 'ISLAND LOOP', repReq: 2, bestKey: 'raceBest2',
    pad: { x: start.x, z: start.z },
    cps: idx.map((i) => { const p = pts[i % pts.length]; return [p.x, p.z]; }),
  };
  r2.cps.push([start.x, start.z]);   // the loop closes where it opened
  for (const r of [r1, r2]) {
    let len = 0;
    let prev = r.pad;
    for (const [x, z] of r.cps) { len += Math.hypot(x - prev.x, z - prev.z); prev = { x, z }; }
    r.length = len;
    // Honest bands from the measured length: gold is a clean fast run
    // (~16 m/s average), silver ~12, bronze ~9; any finish pays base.
    r.bands = [
      { name: 'GOLD', max: len / 16, pay: Math.round(len * 1.1 / 10) * 10 },
      { name: 'SILVER', max: len / 12, pay: Math.round(len * 0.75 / 10) * 10 },
      { name: 'BRONZE', max: len / 9, pay: Math.round(len * 0.45 / 10) * 10 },
      { name: 'FINISH', max: Infinity, pay: Math.round(len * 0.22 / 10) * 10 },
    ];
  }
  return [r1, r2];
}

export function createRaces(scene, G) {
  const routes = buildRoutes();
  const samples = scene.userData.groundingSamples || null;
  const group = new THREE.Group();
  group.visible = !G.shotMode;
  scene.add(group);

  for (const r of routes) {
    // Start pad: a flat ring + a chequered start line across the road.
    const gy = groundHeight(r.pad.x, r.pad.z);
    if (samples) samples.push({ label: `race${r.id} start pad`, x: r.pad.x, z: r.pad.z, y: gy, q: 'groundHeight' });
    const pad = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.30, 8, 28), lam(0xffffff, { emissive: 0x555555 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    pad.add(ring);
    const first = r.cps[0];
    const head = Math.atan2(first[0] - r.pad.x, first[1] - r.pad.z);
    for (let i = 0; i < 8; i++) {
      const bx = (i - 3.5) * 1.05;
      const sq = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 1.0),
        lam(i % 2 ? 0x17191e : 0xf2f2f2));
      sq.position.set(bx * Math.cos(head), 0.06, -bx * Math.sin(head));
      pad.add(sq);
    }
    pad.position.set(r.pad.x, gy, r.pad.z);
    group.add(pad);
    r.padGroup = pad;
    // Checkpoint rings, lit one at a time.
    r.rings = r.cps.map(([x, z], i) => {
      const cgy = groundHeight(x, z);
      if (samples) samples.push({ label: `race${r.id} checkpoint ${i + 1}`, x, z, y: cgy, q: 'groundHeight' });
      const g = new THREE.Group();
      const tor = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.28, 8, 26), lam(0xfb8b24, { emissive: 0x7a3c00 }));
      tor.rotation.x = Math.PI / 2;
      tor.position.y = 0.3;
      g.add(tor);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 16, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfb8b24, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false }));
      col.position.y = 8;
      g.add(col);
      g.position.set(x, cgy, z);
      g.visible = false;
      group.add(g);
      return g;
    });
  }

  let mode = 'idle';        // idle | countdown | racing
  let route = null;
  let cpIdx = 0;
  let elapsed = 0;
  let countT = 0;
  let lastCount = 4;
  let farTime = 0;
  let offer = null;         // { route, locked }
  let hadPrompt = false;

  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  function showRing(i) {
    route.rings.forEach((g, j) => { g.visible = j === i; });
  }
  function hideRings() {
    for (const r of routes) r.rings.forEach((g) => { g.visible = false; });
  }

  function endRace() {
    mode = 'idle';
    route = null;
    G.raceLock = false;
    hideRings();
  }

  function finish() {
    const t = elapsed;
    const band = route.bands.find((b) => t <= b.max);
    G.save.cash += band.pay;
    G.save.cashEarned = (G.save.cashEarned || 0) + band.pay;
    const prevBest = G.save[route.bestKey] || 0;
    const isBest = !prevBest || t < prevBest;
    if (isBest) G.save[route.bestKey] = Math.round(t * 10) / 10;
    G.persist();
    earnRespect(G, 20);
    if (G.standing) G.standing.award(route.pad.x, route.pad.z, 8);   // BUILD 15
    G.hud.bigCard('RACE COMPLETE', `${route.name} · ${fmtTime(t)} · ${band.name} +$${band.pay}${isBest ? ' · NEW BEST' : ''}`, 2800);
    G.audio.jingle();
    endRace();
  }

  function cancel(msg) {
    G.hud.toast(msg);
    endRace();
  }

  function computeOffer(p) {
    const car = G.player.car;
    if (!car || Math.abs(car.speed) >= 1) return null;
    for (const r of routes) {
      if (dist(p.x, p.z, r.pad.x, r.pad.z) < 6.5) {
        const locked = repLevel(G.save) < r.repReq;
        return { route: r, locked };
      }
    }
    return null;
  }

  function interact() {
    if (mode !== 'idle' || !offer) return;
    if (offer.locked) { G.hud.toast(`NEEDS BAY REP Lv ${offer.route.repReq}`); return; }
    route = offer.route;
    mode = 'countdown';
    countT = 3.2;
    lastCount = 4;
    cpIdx = 0;
    elapsed = 0;
    farTime = 0;
    G.raceLock = true;
    showRing(0);
  }

  function update(dt) {
    const p = G.playerPos();
    if (mode === 'countdown') {
      countT -= dt;
      const n = Math.ceil(countT);
      if (n !== lastCount && n >= 1) { lastCount = n; G.hud.toast(String(n), 900); G.audio.door(); }
      if (countT <= 0) {
        mode = 'racing';
        G.raceLock = false;
        G.hud.toast('GO!', 900);
        G.audio.jingle();
      }
      G.hud.prompt(`<b>${route.name}</b> — get ready…`);
      hadPrompt = true;
      return;
    }
    if (mode === 'racing') {
      if (!G.player.car) { cancel('RACE ABANDONED — out of the car'); return; }
      elapsed += dt;
      const [cx, cz] = route.cps[cpIdx];
      const d = dist(p.x, p.z, cx, cz);
      route.rings[cpIdx].rotation.y = G.time * 0.8;
      if (d < 5.5) {
        cpIdx += 1;
        G.audio.pickup();
        if (cpIdx >= route.cps.length) { finish(); G.hud.prompt(null); hadPrompt = false; return; }
        showRing(cpIdx);
      } else if (d > 120) {
        farTime += dt;
        if (farTime > 10) { cancel('RACE ABANDONED — too far from the course'); G.hud.prompt(null); hadPrompt = false; return; }
      } else farTime = 0;
      const [nx, nz] = route.cps[cpIdx];
      const nd = Math.round(dist(p.x, p.z, nx, nz));
      const rel = angDiff(G.playerHeading(), Math.atan2(nx - p.x, nz - p.z));
      G.hud.prompt(`<b>${route.name}</b> · CP ${cpIdx + 1}/${route.cps.length} · ${fmtTime(elapsed)} · next ${nd} m ${arrowFor(rel)}`);
      hadPrompt = true;
      return;
    }
    // Idle: the pad offer.
    offer = computeOffer(p);
    if (offer) {
      const r = offer.route;
      const best = G.save[r.bestKey] || 0;
      G.hud.prompt(offer.locked
        ? `${r.name} — street race · needs <b>BAY REP Lv ${r.repReq}</b>`
        : `<b>[T]</b> ${r.name} — street race · ${r.cps.length} checkpoints${best ? ` · best ${fmtTime(best)}` : ''}`);
      hadPrompt = true;
    } else if (hadPrompt) {
      G.hud.prompt(null);
      hadPrompt = false;
    }
  }

  return {
    update, interact,
    get marker() {
      return mode === 'racing' && route ? { x: route.cps[cpIdx][0], z: route.cps[cpIdx][1] } : null;
    },
    state() {
      return { mode, raceId: route ? route.id : 0, cpIdx, cpCount: route ? route.cps.length : 0, elapsed };
    },
    // Gallery staging: light race 1's first ring over its start grid.
    stageForShot() {
      group.visible = true;
      routes[0].rings[0].visible = true;
    },
  };
}
