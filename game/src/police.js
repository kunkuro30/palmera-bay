// police.js — the bay's law: heat becomes stars, stars become cruisers, and
// cruisers become a bust if they pin you at walking pace for long enough.

import { WANTED, AVENUES, CITY } from './config.js';
import { createCar, driveCar, steerToward } from './vehicles.js';
import { pick, range } from './random.js';

export function createPolice(scene, rng, world, hooks) {
  let heat = 0;
  let stars = 0;
  let bustedTimer = 0;
  let spawnTimer = 0;
  let sirenOn = false;
  let seenNow = false;
  let t = 0;
  const units = [];

  // the roadblock: two cruisers angled across the player's avenue
  let block = null;
  let blockTimer = 6;

  function clearBlock() {
    if (!block) return;
    for (const c of block.cars) scene.remove(c.mesh);
    block = null;
  }

  function placeBlock(ctx) {
    // only on a north-south avenue (or the coast road) with room ahead
    let avenue = null;
    for (const a of AVENUES) if (Math.abs(ctx.x - a) < 10) avenue = a;
    const fz = Math.cos(ctx.heading || 0);
    if (avenue === null || Math.abs(fz) < 0.5) { blockTimer = 5; return; }
    const dirZ = fz > 0 ? 1 : -1;
    const bz = ctx.z + dirZ * range(rng, 45, 60);
    if (bz < -175 || bz > 178) { blockTimer = 5; return; }
    const cars = [];
    for (const [off, ang] of [[-2.1, 0.61], [2.1, -0.61]]) {
      const c = createCar(scene, 0xffffff, { police: true });
      c.driver = 'police';
      c.isBlock = true;
      c.pos.set(avenue + off, 0, bz + off * 0.8);
      c.heading = Math.PI / 2 + ang;
      c.mesh.rotation.y = c.heading;
      cars.push(c);
    }
    block = { cars, x: avenue, z: bz };
    blockTimer = 14;
  }

  function starsFor(h) {
    let s = 0;
    for (const th of WANTED.thresholds) if (h >= th) s++;
    return Math.min(5, s);
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    const i = units.indexOf(unit);
    if (i >= 0) units.splice(i, 1);
  }

  function spawnUnit(tx, tz) {
    for (let tries = 0; tries < 8; tries++) {
      const a = pick(rng, AVENUES);
      const vertical = rng() < 0.65;
      let x;
      let z;
      if (vertical) {
        x = a;
        z = Math.max(-178, Math.min(178, tz + (rng() < 0.5 ? -1 : 1) * range(rng, WANTED.spawnDistance, 95)));
      } else {
        z = a;
        x = Math.max(-178, Math.min(178, tx + (rng() < 0.5 ? -1 : 1) * range(rng, WANTED.spawnDistance, 95)));
      }
      if (Math.hypot(x - tx, z - tz) < WANTED.spawnDistance) continue;
      const unit = createCar(scene, 0xffffff, { police: true });
      unit.driver = 'police';
      unit.pos.set(x, 0, z);
      unit.heading = Math.atan2(tx - x, tz - z);
      unit.mesh.rotation.y = unit.heading;
      units.push(unit);
      return;
    }
  }

  const police = {
    get heat() { return heat; },
    get stars() { return stars; },
    get seen() { return seenNow; },
    get bustedTimer() { return bustedTimer; },
    units,
    roadblockCars() { return block ? block.cars : []; },

    addHeat(n) {
      heat = Math.max(0, Math.min(1, heat + n));
    },
    setHeat(v) {
      heat = Math.max(heat, Math.min(1, v));
    },
    clearHeat() {
      heat = 0;
      bustedTimer = 0;
      clearBlock();
      while (units.length) removeUnit(units[0]);
    },
    reset() {
      this.clearHeat();
    },
    nearestDistance(x, z) {
      let best = Infinity;
      for (const u of units) best = Math.min(best, Math.hypot(u.pos.x - x, u.pos.z - z));
      return best;
    },

    // ctx: where the player is (foot or car), how fast, and whether a crime
    // is happening right now in view
    update(dt, ctx) {
      t += dt;
      stars = starsFor(heat);
      const seen = units.some((u) => Math.hypot(u.pos.x - ctx.x, u.pos.z - ctx.z) < 58);
      seenNow = seen;
      if (stars > 0) {
        if (seen) {
          heat = Math.min(1, heat + WANTED.buildWhenSeen * dt * (ctx.crime ? 1 : 0.3));
        } else {
          heat = Math.max(0, heat - WANTED.decayByStar[stars] * dt);
        }
        stars = starsFor(heat);
      }

      const desired = WANTED.policePerStar[stars];
      spawnTimer -= dt;
      if (units.length < desired && spawnTimer <= 0) {
        spawnUnit(ctx.x, ctx.z);
        spawnTimer = 0.45;
      }
      if (units.length > desired) {
        let far = null;
        let farD = -1;
        for (const u of units) {
          const d = Math.hypot(u.pos.x - ctx.x, u.pos.z - ctx.z);
          if (d > farD) { farD = d; far = u; }
        }
        if (far && (farD > WANTED.despawnDistance || stars === 0)) removeUnit(far);
      }

      const flashPhase = Math.floor(t * 5.5) % 2 === 0;
      for (const u of units) {
        const d = Math.hypot(ctx.x - u.pos.x, ctx.z - u.pos.z);
        let throttle = 1;
        if (d < 5) throttle = -0.4;
        else if (d < 9 && !ctx.inCar) throttle = 0.22;
        else if (d < 16) throttle = 0.55;
        driveCar(u, {
          throttle,
          steer: steerToward(u, ctx.x, ctx.z, 1.5),
          brake: d < 3.6,
          handbrake: false,
        }, dt, world);
        if (u.mesh.userData.barR) {
          u.mesh.userData.barR.material.color.setHex(flashPhase ? 0xff2d20 : 0x5c130e);
          u.mesh.userData.barB.material.color.setHex(flashPhase ? 0x123a8a : 0x2d6bff);
        }
      }

      // roadblocks: at 3+ stars the bay tries to close the avenue ahead
      if (stars >= 3) {
        blockTimer -= dt;
        if (!block && blockTimer <= 0 && ctx.inCar) placeBlock(ctx);
      } else if (block) {
        clearBlock();
      }
      if (block) {
        for (const c of block.cars) {
          if (c.mesh.userData.barR) {
            c.mesh.userData.barR.material.color.setHex(flashPhase ? 0xff2d20 : 0x5c130e);
            c.mesh.userData.barB.material.color.setHex(flashPhase ? 0x123a8a : 0x2d6bff);
          }
          const dx = ctx.pos.x - c.pos.x;
          const dz = ctx.pos.z - c.pos.z;
          const dist = Math.hypot(dx, dz);
          const minD = ctx.inCar ? 3.1 : 2.4;
          if (dist > 0.01 && dist < minD) {
            const push = (minD - dist) / dist;
            ctx.pos.x += dx * push;
            ctx.pos.z += dz * push;
            if (ctx.car) { ctx.car.vel.x *= 0.4; ctx.car.vel.z *= 0.4; }
          }
        }
        if (Math.hypot(ctx.x - block.x, ctx.z - block.z) > 95) clearBlock();
      }

      if (ctx.speed < 1.25 && units.some((u) => Math.hypot(u.pos.x - ctx.x, u.pos.z - ctx.z) < WANTED.bustedRange)) {
        bustedTimer += dt;
        if (bustedTimer >= WANTED.bustedSeconds) {
          bustedTimer = 0;
          hooks.onBusted();
        }
      } else {
        bustedTimer = Math.max(0, bustedTimer - dt * 1.6);
      }

      const wantSiren = stars >= 1 && units.length > 0;
      if (wantSiren !== sirenOn) {
        sirenOn = wantSiren;
        hooks.siren(wantSiren);
      }
    },
  };

  return police;
}
