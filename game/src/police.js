// Police: wanted heat, patrol cruisers that become pursuers, and officers
// on foot for close scenes. Heat rises with crime and falls while unseen;
// stars follow heat. Pursuit is simple steering toward the player's
// position with a speed that grows with the star count, and light bars
// flash whenever a unit is active.

import { TUNING, WORLD, groundHeight } from './config.js';
import { makeCar, driveStep } from './vehicles.js';
import { makeFigure, poseFigure } from './characters.js';
import { angDiff, clamp } from './random.js';

const THREE = window.THREE;

export function createPolice(scene, rng) {
  const units = [];     // { car, phase }
  const officers = [];  // { fig, car }
  let heat = 0;
  let stars = 0;
  let seen = false;

  function spawnUnitAt(x, z, heading) {
    const car = makeCar(0xf2f2f2, { cls: 'police', kind: 'police' });
    car.group.position.set(x, groundHeight(x, z), z);
    car.heading = heading;
    car.group.rotation.y = heading;
    scene.add(car.group);
    const unit = { car, phase: rng() * 6 };
    units.push(unit);
    return unit;
  }

  function spawnOfficer(x, z, carRef) {
    const fig = makeFigure({
      skin: 0xe0ac7e, shirt: 0x1d3fbf, pants: 0x141c3a,
      hat: 'police', gear: 0x22242a, weapon: true,
    });
    fig.group.position.set(x, groundHeight(x, z), z);
    fig.baseY = groundHeight(x, z);
    scene.add(fig.group);
    const off = { fig, car: carRef || null };
    officers.push(off);
    return off;
  }

  // Put an officer of this unit on foot at (x, z), standing guard.
  function setOfficerOut(unit, x, z) {
    const off = spawnOfficer(x, z, unit ? unit.car : null);
    return off;
  }

  function desiredUnits() {
    return stars === 0 ? 0 : Math.min(2 + stars, 6);
  }

  function addHeat(n) {
    heat = clamp(heat + n, 0, TUNING.starHeat * 5);
  }

  function update(dt, time, playerPos, playerInCar) {
    stars = Math.floor(heat / TUNING.starHeat);
    seen = false;
    // Spawn or retire cruisers to match the wanted level.
    while (units.length < desiredUnits()) {
      const a = rng() * Math.PI * 2;
      const d = 55 + rng() * 25;
      const x = clamp(playerPos.x + Math.cos(a) * d, -WORLD.extent, WORLD.extent);
      const z = clamp(playerPos.z + Math.sin(a) * d, -WORLD.extent, WORLD.extent);
      spawnUnitAt(x, z, a);
    }
    while (units.length > desiredUnits()) {
      const u = units.pop();
      scene.remove(u.car.group);
    }
    for (const unit of units) {
      const car = unit.car;
      const p = car.group.position;
      const dx = playerPos.x - p.x;
      const dz = playerPos.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 70) seen = true;
      const want = Math.atan2(dx, dz);
      const steer = clamp(angDiff(car.heading, want) * 1.6, -1, 1);
      const topSpeed = 15 + stars * 2.2;
      const drive = dist > 6 ? 1 : 0.2;
      const prevSpeed = car.speed;
      driveStep(car, dt, drive, steer);
      car.speed = Math.min(car.speed, topSpeed);
      if (Math.abs(car.speed) < Math.abs(prevSpeed) - 4) car.speed = prevSpeed - 4 * Math.sign(prevSpeed);
      // Flashing light bar.
      if (car.lights) {
        const on = Math.sin(time * 10 + unit.phase) > 0;
        car.lights.red.visible = on;
        car.lights.blue.visible = !on;
      }
      // Ramming distance: contact shoves and hurts (combat reads proximity).
      unit.touching = dist < 4.2;
    }
    for (const off of officers) poseFigure(off.fig, time, 0);
    if (seen) heat = clamp(heat + TUNING.heatSeen * dt * 4, 0, TUNING.starHeat * 5);
    else heat = Math.max(0, heat - TUNING.heatDecay * dt);
    stars = Math.floor(heat / TUNING.starHeat);
  }

  return {
    units, officers, spawnUnitAt, spawnOfficer, setOfficerOut, addHeat, update,
    get heat() { return heat; },
    set heat(v) { heat = clamp(v, 0, TUNING.starHeat * 5); },
    get stars() { return Math.floor(heat / TUNING.starHeat); },
    set stars(v) { heat = v * TUNING.starHeat + 1; },
    get seen() { return seen; },
    set seen(v) { seen = v; },
  };
}
