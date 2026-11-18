// combat.js — fists and a pistol. It works out what an attack hits and hands
// back an event; what the hit *means* (damage, witnesses, heat) is decided by
// the caller in main.js, using the helpers on the ped and car objects.

const FIST_RANGE = 2.1;
const FIST_ARC = 0.65;
export const FIST_DAMAGE = 16;
export const SHOT_PED_DAMAGE = 34;
export const SHOT_CAR_DAMAGE = 12;

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}

function rayBox(ox, oy, oz, dx, dy, dz, c) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    [ox, dx, c.minX, c.maxX],
    [oy, dy, 0, 48],
    [oz, dz, c.minZ, c.maxZ],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

export function createCombat(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }),
  );
  scene.add(flash);
  let tracerLife = 0;
  let flashLife = 0;

  function showShot(from, to) {
    const p = tracerGeo.attributes.position;
    p.setXYZ(0, from.x, from.y, from.z);
    p.setXYZ(1, to.x, to.y, to.z);
    p.needsUpdate = true;
    tracerLife = 0.07;
    flash.position.copy(from);
    flashLife = 0.045;
  }

  return {
    // origin: the shooter's position; aim: a normalised 3D direction
    attack({ weapon, origin, aim, peds, cars, world }) {
      if (weapon === 'fists') {
        let bestPed = null;
        let bestD = FIST_RANGE;
        for (const ped of peds) {
          if (ped.state === 'down') continue;
          const dx = ped.pos.x - origin.x;
          const dz = ped.pos.z - origin.z;
          const d = Math.hypot(dx, dz);
          if (d > bestD) continue;
          const dot = (dx * aim.x + dz * aim.z) / (d || 1);
          if (dot > Math.cos(FIST_ARC)) { bestPed = ped; bestD = d; }
        }
        if (bestPed) return { type: 'punch', ped: bestPed };
        for (const car of cars) {
          const d = Math.hypot(car.pos.x - origin.x, car.pos.z - origin.z);
          if (d < 3.1) return { type: 'punchCar', car };
        }
        return { type: 'swing' };
      }

      // pistol: nearest of ped / car / building / ground along the ray
      const o = { x: origin.x, y: origin.y, z: origin.z };
      let bestT = 130;
      let hit = { type: 'shot', hit: 'none' };
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const t = raySphere(o.x, o.y, o.z, aim.x, aim.y, aim.z, ped.pos.x, 1.1, ped.pos.z, 0.62);
        if (t > 0 && t < bestT) { bestT = t; hit = { type: 'shot', hit: 'ped', ped }; }
      }
      for (const car of cars) {
        const t = raySphere(o.x, o.y, o.z, aim.x, aim.y, aim.z, car.pos.x, 0.75, car.pos.z, 2.35);
        if (t > 0 && t < bestT) { bestT = t; hit = { type: 'shot', hit: 'car', car }; }
      }
      for (const c of world.colliders) {
        const t = rayBox(o.x, o.y, o.z, aim.x, aim.y, aim.z, c);
        if (t > 0 && t < bestT) { bestT = t; hit = { type: 'shot', hit: 'world' }; }
      }
      if (aim.y < -0.001) {
        const t = -o.y / aim.y;
        if (t > 0 && t < bestT) { bestT = t; hit = { type: 'shot', hit: 'world' }; }
      }
      const end = {
        x: o.x + aim.x * bestT,
        y: o.y + aim.y * bestT,
        z: o.z + aim.z * bestT,
      };
      hit.point = end;
      const muzzle = {
        x: origin.x + aim.x * 0.55,
        y: origin.y - 0.12,
        z: origin.z + aim.z * 0.55,
      };
      showShot(muzzle, end);
      return hit;
    },

    update(dt) {
      if (tracerLife > 0) {
        tracerLife -= dt;
        tracerMat.opacity = Math.max(0, tracerLife / 0.07) * 0.9;
      }
      if (flashLife > 0) {
        flashLife -= dt;
        flash.material.opacity = Math.max(0, flashLife / 0.045);
        flash.scale.setScalar(1 + (0.045 - flashLife) * 14);
      }
    },
  };
}
