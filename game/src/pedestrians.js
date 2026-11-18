// pedestrians.js — the people of Palmera Bay: they stroll the sidewalks and
// the sand, run from trouble, and fall down when trouble finds them.

import { CITY, AVENUES } from './config.js';
import { range, pick } from './random.js';

const SHIRTS = [0xd95f6e, 0x3f6fb5, 0xe8c84a, 0x53b06a, 0xe8e4da, 0x8a5fb0, 0x3fb0a8, 0xd97f2e];
const SKINS = [0xd9a06b, 0xa06a42, 0x7a4a2c, 0xe8b88a];

export function makeFigure(shirt, pants = 0x2a2d38, skin = 0xd9a06b) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });

  function limb(mat, w, h, d) {
    const pivot = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    box.position.y = -h / 2;
    box.castShadow = true;
    pivot.add(box);
    return pivot;
  }
  const legL = limb(pantsMat, 0.17, 0.78, 0.19);
  legL.position.set(-0.11, 0.78, 0);
  const legR = limb(pantsMat, 0.17, 0.78, 0.19);
  legR.position.set(0.11, 0.78, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirtMat);
  torso.position.y = 1.09;
  torso.castShadow = true;
  const armL = limb(shirtMat, 0.13, 0.6, 0.15);
  armL.position.set(-0.31, 1.36, 0);
  const armR = limb(shirtMat, 0.13, 0.6, 0.15);
  armR.position.set(0.31, 1.36, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skinMat);
  head.position.y = 1.58;
  head.castShadow = true;
  group.add(legL, legR, torso, armL, armR, head);
  return { group, legL, legR, armL, armR };
}

export function swingLimbs(fig, phase, amount) {
  const s = Math.sin(phase) * amount;
  fig.legL.rotation.x = s;
  fig.legR.rotation.x = -s;
  fig.armL.rotation.x = -s * 0.8;
  fig.armR.rotation.x = s * 0.8;
}

export function createPeds(scene, rng, world) {
  const peds = [];

  function sidewalkSpot() {
    const a = pick(rng, AVENUES);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) return { axis: 'z', line: a + side * 8.6, along: range(rng, -165, 165) };
    return { axis: 'x', line: a + side * 8.6, along: range(rng, -165, 165) };
  }

  function placeOnPath(ped) {
    const p = ped.path;
    if (p.axis === 'z') ped.pos.set(p.line, 0, p.along);
    else ped.pos.set(p.along, 0, p.line);
  }

  for (let i = 0; i < 26; i++) {
    const fig = makeFigure(pick(rng, SHIRTS), pick(rng, [0x2a2d38, 0x4a3a2c, 0x35424f, 0x6e2f35]), pick(rng, SKINS));
    scene.add(fig.group);
    const ped = {
      fig,
      mesh: fig.group,
      pos: fig.group.position,
      heading: range(rng, 0, Math.PI * 2),
      speed: 0,
      walkSpeed: range(rng, 1.5, 2.4),
      hp: 30,
      state: 'walk',
      timer: 0,
      phase: range(rng, 0, 6),
      path: null,
      beach: i >= 20,
      target: null,
    };
    if (ped.beach) {
      ped.pos.set(range(rng, -240, 240), 0, range(rng, 208, 262));
      ped.target = { x: range(rng, -240, 240), z: range(rng, 208, 262) };
    } else {
      ped.path = sidewalkSpot();
      ped.path.dir = rng() < 0.5 ? 1 : -1;
      placeOnPath(ped);
    }
    peds.push(ped);
  }

  function respawn(ped) {
    ped.hp = 30;
    ped.state = 'walk';
    ped.mesh.rotation.x = 0;
    if (ped.beach) {
      ped.pos.set(range(rng, -240, 240), 0, range(rng, 208, 262));
      ped.target = { x: range(rng, -240, 240), z: range(rng, 208, 262) };
    } else {
      ped.path = sidewalkSpot();
      ped.path.dir = rng() < 0.5 ? 1 : -1;
      placeOnPath(ped);
    }
  }

  function knockDown(ped) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.timer = 7;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
  }

  function damagePed(ped, dmg, fromX, fromZ) {
    if (ped.state === 'down') return false;
    ped.hp -= dmg;
    if (ped.hp <= 0) {
      knockDown(ped);
      return true;
    }
    ped.state = 'flee';
    ped.timer = range(rng, 2.5, 4);
    ped.fleeFrom = { x: fromX, z: fromZ };
    return false;
  }

  function scare(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.timer = range(rng, 2.2, 3.6);
        ped.fleeFrom = { x, z };
      }
    }
  }

  function standingNear(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.pos.x - x, ped.pos.z - z) < radius) return true;
    }
    return false;
  }

  function update(dt) {
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.mesh.position.y = 0;
          respawn(ped);
        }
        continue;
      }
      let mx = 0;
      let mz = 0;
      let speed = ped.walkSpeed;
      if (ped.state === 'flee') {
        ped.timer -= dt;
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const len = Math.hypot(dx, dz) || 1;
        mx = dx / len;
        mz = dz / len;
        speed = 5.6;
        if (ped.timer <= 0) {
          ped.state = 'walk';
          if (!ped.beach) {
            // resume strolling on the nearest sidewalk line to where we stopped
            const spot = sidewalkSpot();
            ped.path = spot;
            if (spot.axis === 'z') ped.pos.x = spot.line;
            else ped.pos.z = spot.line;
          }
        }
      } else if (ped.beach) {
        const dx = ped.target.x - ped.pos.x;
        const dz = ped.target.z - ped.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) ped.target = { x: range(rng, -240, 240), z: range(rng, 208, 262) };
        else { mx = dx / d; mz = dz / d; }
      } else {
        const p = ped.path;
        if (p.axis === 'z') { mz = p.dir; p.along = ped.pos.z; }
        else { mx = p.dir; p.along = ped.pos.x; }
        if (p.along > 172) p.dir = -1;
        if (p.along < -172) p.dir = 1;
      }
      ped.pos.x += mx * speed * dt;
      ped.pos.z += mz * speed * dt;
      ped.pos.x = Math.max(-262, Math.min(262, ped.pos.x));
      ped.pos.z = Math.max(-190, Math.min(272, ped.pos.z));
      world.collideCircle(ped.pos, 0.4);
      if (mx !== 0 || mz !== 0) {
        const want = Math.atan2(mx, mz);
        let d = want - ped.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        ped.heading += d * Math.min(1, dt * 8);
        ped.phase += dt * speed * 3.2;
        swingLimbs(ped.fig, ped.phase, ped.state === 'flee' ? 0.85 : 0.55);
      } else {
        swingLimbs(ped.fig, 0, 0);
      }
      ped.mesh.rotation.y = ped.heading;
      ped.speed = (mx !== 0 || mz !== 0) ? speed : 0;
    }
  }

  return { peds, update, scare, damagePed, knockDown, standingNear };
}
