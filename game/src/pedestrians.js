// pedestrians.js — the people of Palmera Bay. They stroll the sidewalks and
// the beach, chat in pairs, and run screaming from fast cars, gunfire and
// flying fists. Simple two-box bodies with a swing in their step.

import { CITY } from './config.js';
import { makeRng, pick, range } from './random.js';
import { avenuePositions, collideCircle, COAST_ROAD_Z } from './world.js';

const SHIRTS = [0xff6b6b, 0xffd93d, 0x6bcbff, 0x95e06c, 0xff9ff3, 0xf8f4ec, 0xff9f43, 0x54a0ff];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function makePedMesh(shirt) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2e3242 }));
  legs.scale.set(0.42, 0.75, 0.26); legs.position.y = 0.38;
  const torso = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: shirt }));
  torso.scale.set(0.52, 0.68, 0.3); torso.position.y = 1.1; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
  head.position.y = 1.68;
  g.add(legs); g.add(torso); g.add(head);
  g.userData.legs = legs; g.userData.torso = torso;
  return g;
}

export function createPeds(scene, seed) {
  const rng = makeRng(seed ^ 0x9ed5);
  const avenues = avenuePositions();
  const peds = [];
  function spawn() {
    const onBeach = rng() < 0.22;
    const avenue = pick(rng, avenues);
    const side = rng() < 0.5 ? -1 : 1;
    const along = range(rng, -CITY.half, CITY.half);
    const mesh = makePedMesh(pick(rng, SHIRTS));
    const x = onBeach ? range(rng, -CITY.half, CITY.half) : avenue + side * (CITY.roadWidth / 2 + 2.8);
    const z = onBeach ? CITY.half + range(rng, 26, 70) : along;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, health: 30, down: 0, flee: 0, phase: rng() * 9,
      heading: rng() < 0.5 ? 0 : Math.PI, speed: range(rng, 1.1, 1.7),
      axis: onBeach ? 'x' : 'z', get pos() { return mesh.position; },
    });
  }
  for (let i = 0; i < 26; i++) spawn();

  // Scare every ped within radius of a point: they run directly away.
  function scare(x, z, radius) {
    for (const p of peds) {
      if (p.down > 0) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius) {
        p.flee = range(rng, 1.6, 2.8);
        p.heading = Math.atan2(p.pos.x - x, p.pos.z - z);
      }
    }
  }

  function update(dt, world, fastCars) {
    for (const p of peds) {
      if (p.down > 0) {
        p.down -= dt;
        if (p.down <= 0) { // get up somewhere quieter and walk on
          p.health = 30;
          p.mesh.rotation.x = 0;
          p.pos.x += range(rng, -30, 30); p.pos.z += range(rng, -10, 30);
        }
        continue;
      }
      // a fast car close by is a threat worth running from
      for (const c of fastCars) {
        if (Math.abs(c.speed) > 7 && Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < 6.5) {
          scare(p.pos.x + (p.pos.x - c.pos.x), p.pos.z + (p.pos.z - c.pos.z), 1);
          p.flee = 1.4;
        }
      }
      const speed = p.flee > 0 ? 4.6 : p.speed;
      if (p.flee > 0) p.flee -= dt;
      else if (p.axis === 'z') p.heading = Math.sin(p.phase * 0.11) > 0 ? 0 : Math.PI;
      else p.heading = Math.sin(p.phase * 0.09) > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.phase += dt * (p.flee > 0 ? 2.4 : 1);
      p.pos.x += Math.sin(p.heading) * speed * dt;
      p.pos.z += Math.cos(p.heading) * speed * dt;
      collideCircle(world, p.pos, 0.4);
      if (Math.abs(p.pos.x) > CITY.half + 60) p.pos.x = Math.sign(p.pos.x) * (CITY.half + 40);
      p.mesh.rotation.y = p.heading;
      const swing = Math.sin(p.phase * 6) * 0.16;
      p.mesh.userData.legs.rotation.x = swing;
      p.mesh.userData.torso.rotation.x = -swing * 0.5;
      p.mesh.position.y = Math.abs(Math.sin(p.phase * 6)) * 0.04;
    }
  }
  return { peds, scare, update };
}
