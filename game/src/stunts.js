// BUILD 15 — stunt jumps. Five ramps on grounded spots around the
// bay (a beach dune, the airport service road, the garrison dirt
// road, a downtown street, a desert rise on the freeway). Hit one
// fast enough, pointed the right way, and the car leaves the ground:
// player.js flies the ballistic arc (this module only calls the
// launch and judges the landing). Airborne a full second and down on
// the wheels again = STUNT JUMP: $150 + 8 RESPECT the first time per
// ramp per session, $25 for repeats, and standing points for the
// ramp's district either way.

import { groundHeight } from './config.js';
import { earnRespect } from './save.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}

export const RAMPS = [
  { name: 'BEACH DUNE', x: -150, z: 214, h: Math.PI },              // north, onto Ocean Drive
  { name: 'APRON RAMP', x: -168, z: 124, h: Math.PI / 2 },          // east, across the apron
  { name: 'GARRISON RISE', x: 128, z: -30, h: Math.PI / 2 },        // east, along the dirt road
  { name: 'DOWNTOWN LIP', x: 140, z: 125, h: -Math.PI / 2 },        // west, down street 125
  { name: 'DESERT RISE', x: 95, z: -138, h: Math.PI },              // north, up the freeway
];

export function createStunts(scene, G) {
  const samples = scene.userData.groundingSamples || null;
  const paid = new Set();   // ramps that already paid full price this session

  for (const [i, r] of RAMPS.entries()) {
    const gy = groundHeight(r.x, r.z);
    if (samples) samples.push({ label: `stunt ramp ${i + 1}`, x: r.x, z: r.z, y: gy, q: 'groundHeight' });
    const g = new THREE.Group();
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 4.6), lam(0x3c4148));
    wedge.rotation.x = -0.24;               // the +z end rides high: the lip
    wedge.position.y = 0.02;
    wedge.castShadow = true;
    g.add(wedge);
    for (const sx of [-1.55, 1.55]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.74, 4.6), lam(0xf2b134));
      stripe.rotation.x = -0.24;
      stripe.position.set(sx, 0.03, 0);
      g.add(stripe);
    }
    g.position.set(r.x, gy, r.z);
    g.rotation.y = r.h;
    scene.add(g);
    r.group = g;
  }

  function update(dt) {
    const car = G.player.car;
    if (!car || car.air || car.wrecked) return;
    if (car.speed < 10.5) return;
    const p = car.group.position;
    const cf = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
    for (const [i, r] of RAMPS.entries()) {
      const fx = Math.sin(r.h), fz = Math.cos(r.h);
      if (cf.x * fx + cf.z * fz < 0.55) continue;             // wrong way
      const dx = p.x - r.x, dz = p.z - r.z;
      const along = dx * fx + dz * fz;
      const lateral = dx * fz - dz * fx;
      if (along > 0.8 && along < 3.1 && Math.abs(lateral) < 1.9) {
        car.air = { vy: 5.5 + car.speed * 0.26, t: 0, y: p.y + 0.55, ramp: i };
        G.audio.whoosh();
        return;
      }
    }
  }

  // player.js calls this the step the wheels touch down again.
  function onLand(car, airTime, rampIdx) {
    if (airTime < 1.0) return;
    const r = RAMPS[rampIdx];
    if (!paid.has(rampIdx)) {
      paid.add(rampIdx);
      G.save.cash += 150;
      G.save.cashEarned = (G.save.cashEarned || 0) + 150;
      G.persist();
      earnRespect(G, 8);
      G.hud.toast(`STUNT JUMP — ${r.name} · +$150 · +8 RESPECT`);
    } else {
      G.save.cash += 25;
      G.save.cashEarned = (G.save.cashEarned || 0) + 25;
      G.persist();
      G.hud.toast(`STUNT JUMP — ${r.name} · +$25`);
    }
    if (G.standing) G.standing.award(r.x, r.z, 5);
    G.audio.jingle();
  }

  return { update, onLand, ramps: RAMPS };
}
