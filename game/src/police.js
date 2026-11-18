// police.js — the Palmera Bay PD: the wanted heat that rises when crimes are
// seen and cools when they are not, the cruisers that spawn to match the
// star count, the pursuit driving, and the BUSTED timer when they box the
// player in. This is the game's one deep system: everything feeds it.

import { WANTED, CITY } from './config.js';
import { makeRng } from './random.js';
import { makeCar, driveCar } from './vehicles.js';
import { avenuePositions } from './world.js';

export function createPolice(scene, seed, world, hooks) {
  const rng = makeRng(seed ^ 0xc091);
  const avenues = avenuePositions();
  const units = [];
  const police = {
    heat: 0, stars: 0, bustedTimer: 0, busted: false, seen: false,
  };

  police.addHeat = (amount) => {
    police.heat = Math.min(1, police.heat + amount);
  };
  police.clearHeat = () => { police.heat = 0; police.bustedTimer = 0; police.busted = false; };

  function starsFor(heat) {
    let s = 0;
    for (let i = 0; i < WANTED.stars.length; i++) if (heat >= WANTED.stars[i]) s = i;
    return s;
  }

  function spawnUnit(playerPos) {
    // appear on an avenue a block or two away, never on top of the player
    for (let tries = 0; tries < 8; tries++) {
      const a = avenues[Math.floor(rng() * avenues.length)];
      const alongZ = rng() < 0.5;
      const along = Math.max(-CITY.half, Math.min(CITY.half, (alongZ ? playerPos.z : playerPos.x) + (rng() < 0.5 ? -95 : 95)));
      const x = alongZ ? a : along;
      const z = alongZ ? along : a;
      if (Math.hypot(x - playerPos.x, z - playerPos.z) < 55) continue;
      const unit = makeCar(scene, rng, { color: 0xffffff, police: true, x, z, heading: 0, driver: 'police' });
      unit.targetSpeed = 15;
      units.push(unit);
      return;
    }
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    units.splice(units.indexOf(unit), 1);
  }

  let flash = 0;
  police.update = (dt, playerPos, playerSpeed, playerInCar) => {
    // --- who can see the player right now? ------------------------------
    police.seen = false;
    for (const u of units) {
      if (Math.hypot(u.pos.x - playerPos.x, u.pos.z - playerPos.z) < 52) { police.seen = true; break; }
    }
    if (police.seen && police.heat > 0) police.heat = Math.min(1, police.heat + WANTED.seenBuildPerSecond * dt * police.stars);
    if (!police.seen) police.heat = Math.max(0, police.heat - WANTED.decayPerSecond * dt * (police.stars >= 4 ? 0.45 : 1));
    police.stars = starsFor(police.heat);

    // --- fleet size follows the stars ------------------------------------
    const wanted = WANTED.policePerStar[police.stars];
    if (units.length < wanted) spawnUnit(playerPos);
    else if (units.length > wanted) {
      // the farthest unit gives up first
      let far = null, farD = -1;
      for (const u of units) {
        const d = Math.hypot(u.pos.x - playerPos.x, u.pos.z - playerPos.z);
        if (d > farD) { farD = d; far = u; }
      }
      if (far && farD > 30) removeUnit(far);
    }
    hooks.siren(units.length > 0 && police.stars > 0);

    // --- pursuit ----------------------------------------------------------
    flash += dt * 7;
    let boxing = 0;
    for (const u of units) {
      const dx = playerPos.x - u.pos.x, dz = playerPos.z - u.pos.z;
      const dist = Math.hypot(dx, dz);
      // aim a little ahead of a moving player, straight at a slow one
      const lead = Math.min(0.7, dist / 60);
      const tx = playerPos.x, tz = playerPos.z;
      const targetHeading = Math.atan2(tx - u.pos.x, tz - u.pos.z);
      let dh = targetHeading - u.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const throttle = dist > 7 ? 1 : dist > 3.4 ? 0.25 : -0.4;
      driveCar(u, { throttle, steer: Math.max(-1, Math.min(1, dh * 1.9)), brake: false, handbrake: Math.abs(dh) > 2.2 }, dt, world);
      u.mesh.userData.barR.material.color.setHSL(0, 1, Math.sin(flash) > 0 ? 0.55 : 0.25);
      u.mesh.userData.barB.material.color.setHSL(0.66, 1, Math.sin(flash) > 0 ? 0.25 : 0.55);
      if (dist < 7.5) boxing++;
    }

    // --- BUSTED: boxed in and barely moving, with a unit right there ------
    const slowEnough = playerInCar ? playerSpeed < 1.6 : playerSpeed < 2.2;
    if (police.stars > 0 && boxing > 0 && slowEnough) {
      police.bustedTimer += dt;
      if (police.bustedTimer >= WANTED.bustedSeconds) police.busted = true;
    } else {
      police.bustedTimer = Math.max(0, police.bustedTimer - dt * 1.6);
    }
    return police;
  };

  police.units = units;
  police.reset = () => { while (units.length) removeUnit(units[0]); police.clearHeat(); };
  return police;
}
