// Pedestrians: capsule people who stroll the sidewalks, turn at corners, scatter when
// there is gunfire, and dive out of the way of fast cars. A hit pedestrian falls and
// fades; a replacement strolls in far away, so the city never empties.
import { AVENUES, COAST_Z, PED_COUNT } from './config.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

const SHIRTS = [0xe8641e, 0x2e8bc2, 0xe8e3d8, 0x37b24d, 0xd6336c, 0xf2c94c, 0x845ef7, 0x22b8cf, 0xfa5252, 0x94d82d];
const SKIN = [0xe8b08a, 0xc68642, 0x8d5524, 0xf1c27d];
const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.82, 4, 10);
const headGeo = new THREE.SphereGeometry(0.19, 10, 8);

/** One person. shirt/skin colours can be forced (police officers wear navy). */
export function makePerson(rng, shirt = null, pants = null) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: shirt ?? pick(rng, SHIRTS) });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.74;
  const legMat = new THREE.MeshLambertMaterial({ color: pants ?? 0x2f3542 });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.42, 8), legMat);
  legs.position.y = 0.21;
  const headMat = new THREE.MeshLambertMaterial({ color: pick(rng, SKIN) });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.66;
  group.add(body, legs, head);
  return { group, mats: [bodyMat, legMat, headMat] };
}

function sidewalkLines() {
  const lines = [];
  for (const a of AVENUES) {
    lines.push({ axis: 'z', at: a - 9.3 }, { axis: 'z', at: a + 9.3 });
    lines.push({ axis: 'x', at: a - 9.3 }, { axis: 'x', at: a + 9.3 });
  }
  lines.push({ axis: 'x', at: COAST_Z - 9.3 }, { axis: 'x', at: COAST_Z + 9.3 });
  return lines;
}

export function createPedestrians(scene, rng, G) {
  const lines = sidewalkLines();
  const peds = [];
  G.peds = peds;

  function place(ped, farFrom) {
    for (let tries = 0; tries < 12; tries += 1) {
      const line = pick(rng, lines);
      ped.axis = line.axis;
      ped.at = line.at;
      ped.dir = rng() < 0.5 ? 1 : -1;
      ped.along = range(rng, -195, 195);
      const x = ped.axis === 'z' ? ped.at : ped.along;
      const z = ped.axis === 'z' ? ped.along : ped.at;
      if (farFrom && Math.hypot(x - farFrom.x, z - farFrom.z) < 80) continue;
      ped.group.position.set(x, 0, z);
      return;
    }
  }

  for (let i = 0; i < PED_COUNT; i += 1) {
    const { group, mats } = makePerson(rng);
    const ped = {
      group, mats, hp: 60, alive: true, mode: 'walk',
      axis: 'z', at: 0, dir: 1, along: 0, speed: range(rng, 1.1, 2),
      phase: rng() * 6, fleeT: 0, fleeFrom: { x: 0, z: 0 }, deadT: 0,
      dodgeT: 0, dodgeX: 0, dodgeZ: 0, turnCool: 0,
    };
    place(ped, null);
    scene.add(group);
    peds.push(ped);
  }

  function kill(ped) {
    ped.alive = false;
    ped.deadT = 0;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.12;
    for (const m of ped.mats) m.transparent = true;
  }

  return {
    peds,
    kill,
    panic(x, z, radius) {
      for (const ped of peds) {
        if (!ped.alive) continue;
        const p = ped.group.position;
        if (Math.hypot(p.x - x, p.z - z) < radius) {
          ped.mode = 'flee';
          ped.fleeFrom = { x, z };
          ped.fleeT = range(rng, 2, 3.5);
        }
      }
    },
    update(dt) {
      const playerCar = G.player.car;
      for (const ped of peds) {
        const p = ped.group.position;
        if (!ped.alive) {
          ped.deadT += dt;
          if (ped.deadT > 3) {
            const fade = Math.max(0, 1 - (ped.deadT - 3) / 3);
            for (const m of ped.mats) m.opacity = fade;
          }
          if (ped.deadT > 6.5) {
            ped.alive = true;
            ped.hp = 60;
            ped.mode = 'walk';
            ped.group.rotation.x = 0;
            ped.group.position.y = 0;
            for (const m of ped.mats) { m.opacity = 1; m.transparent = false; }
            place(ped, G.player.pos());
          }
          continue;
        }
        let mx = 0;
        let mz = 0;
        let speed = ped.speed;
        if (ped.mode === 'flee') {
          ped.fleeT -= dt;
          const dx = p.x - ped.fleeFrom.x;
          const dz = p.z - ped.fleeFrom.z;
          const d = Math.hypot(dx, dz) || 1;
          mx = dx / d;
          mz = dz / d;
          speed = 5.2;
          if (ped.fleeT <= 0) {
            ped.mode = 'walk';
            // Rejoin the nearest sidewalk line.
            let best = null;
            for (const line of lines) {
              const dist = line.axis === 'z' ? Math.abs(p.x - line.at) : Math.abs(p.z - line.at);
              if (!best || dist < best.dist) best = { line, dist };
            }
            ped.axis = best.line.axis;
            ped.at = best.line.at;
            ped.along = ped.axis === 'z' ? p.z : p.x;
            ped.dir = rng() < 0.5 ? 1 : -1;
          }
        } else if (ped.dodgeT > 0) {
          ped.dodgeT -= dt;
          mx = ped.dodgeX;
          mz = ped.dodgeZ;
          speed = 6.5;
        } else {
          // Dodge a fast car bearing down.
          let dodged = false;
          const threats = playerCar ? [playerCar] : [];
          for (const car of G.cars) if (car.kind === 'traffic') threats.push(car);
          for (const car of threats) {
            if (Math.abs(car.speed) < 6) continue;
            const cp = car.group.position;
            const dx = p.x - cp.x;
            const dz = p.z - cp.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 6.5) continue;
            const fx = Math.sin(car.heading);
            const fz = Math.cos(car.heading);
            if (dx * fx + dz * fz < -1) continue; // car already past
            const side = dx * fz - dz * fx >= 0 ? 1 : -1;
            ped.dodgeX = fz * side;
            ped.dodgeZ = -fx * side;
            ped.dodgeT = 0.45;
            dodged = true;
            break;
          }
          if (!dodged) {
            const prevAlong = ped.along;
            ped.along += ped.dir * speed * dt;
            if (ped.along > 205) ped.dir = -1;
            if (ped.along < -205) ped.dir = 1;
            ped.turnCool -= dt;
            for (const c of AVENUES) {
              const crossed = (prevAlong - c) * (ped.along - c) < 0;
              if (crossed && ped.turnCool <= 0 && rng() < 0.3) {
                // Turn onto a sidewalk of the crossing road (its lines sit at c +/- 9.3).
                const want = ped.axis === 'z' ? 'x' : 'z';
                const options = lines.filter((l) => l.axis === want
                  && (Math.abs(l.at - (c - 9.3)) < 0.6 || Math.abs(l.at - (c + 9.3)) < 0.6));
                if (options.length) {
                  const line = pick(rng, options);
                  ped.axis = line.axis;
                  ped.at = line.at;
                  ped.along = want === 'x' ? p.x : p.z;
                  ped.dir = rng() < 0.5 ? 1 : -1;
                  ped.turnCool = 2;
                }
                break;
              }
            }
            if (ped.axis === 'z') p.set(ped.at, 0, ped.along);
            else p.set(ped.along, 0, ped.at);
            ped.group.rotation.y = ped.axis === 'z' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            ped.phase += dt * speed * 3.6;
            p.y = Math.abs(Math.sin(ped.phase)) * 0.05;
            continue;
          }
        }
        // Free movement (flee / dodge): apply and collide with buildings.
        p.x += mx * speed * dt;
        p.z += mz * speed * dt;
        p.x = Math.max(-212, Math.min(212, p.x));
        p.z = Math.max(-212, Math.min(256, p.z));
        G.pushOut(p, 0.5);
        ped.group.rotation.y = Math.atan2(mx, mz);
        ped.phase += dt * speed * 3.6;
        p.y = Math.abs(Math.sin(ped.phase)) * 0.05;
      }
    },
  };
}
