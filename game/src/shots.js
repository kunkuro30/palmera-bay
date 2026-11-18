// shots.js — the staged screenshot scenes behind ?shot=<name>&seed=<n>.
// Two families: world-only scenes (city, street, beach) just place the
// camera, and action scenes (chase, downtown, drive, heist) put the real
// actors where the frame needs them and then run the real systems — the
// same physics, traffic, pedestrians and HUD as a live game — for a few
// seconds of fixed-step time. main.js sets window.__shotReady afterwards.

import { COAST_ROAD_Z } from './world.js';
import { makeCar, driveCar } from './vehicles.js';

export function stageCamera(name, camera) {
  if (name === 'street') {
    camera.position.set(-7, 3.4, 118);
    camera.lookAt(-7, 13, -90);
  } else if (name === 'beach') {
    camera.position.set(-70, 7, COAST_ROAD_Z + 95);
    camera.lookAt(50, 12, 120);
  } else { // 'city' and anything else: the wide postcard of the bay
    camera.position.set(98, 31, COAST_ROAD_Z + 128);
    camera.lookAt(-12, 20, -30);
  }
}

function flashBars(unit, t) {
  unit.mesh.userData.barR.material.color.setHSL(0, 1, Math.sin(t * 7) > 0 ? 0.55 : 0.25);
  unit.mesh.userData.barB.material.color.setHSL(0.66, 1, Math.sin(t * 7) > 0 ? 0.25 : 0.55);
}

function baseHud(api, over) {
  api.hud.update({
    money: 350, health: 100, stars: 0, hour: 17.85, speedKmh: null,
    player: { x: api.player.pos.x, z: api.player.pos.z, heading: api.player.heading },
    markers: [], blips: api.traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false })),
    ...over,
  });
}

export function stageActionShot(name, api) {
  const { scene, camera, world, player, traffic, hud, rng } = api;
  let t = 0;

  if (name === 'chase') {
    // THE COVER: the stolen red sports car tears north up a downtown avenue,
    // two cruisers on its tail, three stars up, the lockup marked gold.
    const car = traffic.sports;
    car.parked = false; car.driver = 'player';
    car.pos.set(55.3, 0, 78); car.heading = Math.PI;
    car.vx = 0; car.vz = -15;
    player.driving = car; player.mesh.visible = false;
    // clear the staged avenue: no traffic car may wander into the frame
    for (const other of traffic.cars) {
      if (other !== car && Math.abs(other.pos.x - 53) < 9 && other.pos.z > 0 && other.pos.z < 130) {
        other.pos.x -= 120;
      }
    }
    const cops = [
      makeCar(scene, rng, { color: 0xffffff, police: true, x: 55.6, z: 88, heading: Math.PI, driver: 'police' }),
      makeCar(scene, rng, { color: 0xffffff, police: true, x: 49.8, z: 97, heading: Math.PI, driver: 'police' }),
    ];
    for (const c of cops) { c.vx = 0; c.vz = -16.5; }
    hud.showBanner('<b>JOB 2 — HOT GOODS</b> — deliver the car to the <b>east lockup</b>. Lose them or outrun them.');
    return { step(dt) {
      t += dt;
      driveCar(car, { throttle: 0.78, steer: Math.sin(t * 0.6) * 0.07, brake: false, handbrake: false }, dt, world);
      for (const c of cops) {
        const dh = Math.atan2(car.pos.x - c.pos.x, car.pos.z - c.pos.z) - c.heading;
        let d = dh; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        driveCar(c, { throttle: 1, steer: Math.max(-1, Math.min(1, d * 1.9)), brake: false, handbrake: false }, dt, world);
        flashBars(c, t);
      }
      traffic.update(dt, car.pos);
      api.peds.update(dt, world, [car, ...cops]);
      world.update(dt);
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      const r = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
      camera.position.set(car.pos.x - f.x * 17 + r.x * 4.6, 5.4, car.pos.z - f.z * 17 + r.z * 4.6);
      camera.lookAt(car.pos.x + f.x * 10, 1.2, car.pos.z + f.z * 10);
      baseHud(api, {
        money: 570, health: 88, stars: 3, speedKmh: Math.abs(car.speed) * 3.6,
        player: { x: car.pos.x, z: car.pos.z, heading: car.heading },
        markers: [{ x: 128, z: 66, color: '#ffd94a' }],
        blips: [...cops.map((c) => ({ x: c.pos.x, z: c.pos.z, police: true })),
                ...traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false }))],
      });
    } };
  }

  if (name === 'downtown') {
    // On foot in the downtown grid: traffic passing, people on the sidewalk,
    // the Sol Tower ahead and a delivery to make.
    player.pos.set(2.8, 0, 42); // the east sidewalk of the downtown avenue
    player.heading = Math.PI;
    hud.showBanner('<b>JOB 1 — FIRST RUN</b> — take the package to the <b>Sol Tower drop</b>, downtown.');
    return { step(dt) {
      t += dt;
      player.updateOnFoot(dt, { x: 0, z: -1 }, false, world);
      traffic.update(dt, player.pos);
      api.peds.update(dt, world, []);
      world.update(dt);
      const back = { x: Math.sin(Math.PI), z: Math.cos(Math.PI) };
      camera.position.set(player.pos.x - back.x * 7, 3.1, player.pos.z - back.z * 7);
      camera.lookAt(player.pos.x - 1.5, 1.6, player.pos.z - 6);
      baseHud(api, {
        money: 370, markers: [{ x: 10, z: -14, color: '#ffd94a' }],
      });
    } };
  }

  if (name === 'drive') {
    // Golden-hour cruise on the coast road, the skyline behind the car.
    const car = traffic.parked[0];
    car.parked = false; car.driver = 'player';
    car.pos.set(-46, 0, COAST_ROAD_Z - 2.3); car.heading = Math.PI / 2;
    car.vx = 16; car.vz = 0;
    player.driving = car; player.mesh.visible = false;
    hud.showBanner('<b>DISPATCH</b> — fare waiting across town. Deliver and get paid.');
    return { step(dt) {
      t += dt;
      driveCar(car, { throttle: 0.42, steer: 0, brake: false, handbrake: false }, dt, world);
      traffic.update(dt, car.pos);
      api.peds.update(dt, world, [car]);
      world.update(dt);
      const f = { x: Math.sin(car.heading), z: Math.cos(car.heading) };
      const r = { x: -Math.cos(car.heading), z: Math.sin(car.heading) };
      // from the car's front-left, looking back at it: the bay and the
      // sunset fill the frame behind the car, the skyline over its roof
      camera.position.set(car.pos.x + f.x * 7 - r.x * 6, 2.4, car.pos.z + f.z * 7 - r.z * 6);
      camera.lookAt(car.pos.x - f.x * 2, 1.1, car.pos.z - f.z * 2);
      baseHud(api, {
        money: 445, speedKmh: Math.abs(car.speed) * 3.6,
        player: { x: car.pos.x, z: car.pos.z, heading: car.heading },
        markers: [{ x: 90, z: -140, color: '#54c8ff' }],
      });
    } };
  }

  if (name === 'heist') {
    // The payroll is in hand and the whole bay is coming: four stars, two
    // cruisers rolling onto the sand, and a long run back to Marina's kiosk.
    player.pos.set(158, 0, COAST_ROAD_Z + 50);
    player.heading = -Math.PI / 2;
    const cops = [
      makeCar(scene, rng, { color: 0xffffff, police: true, x: 126, z: COAST_ROAD_Z + 28, heading: Math.PI / 2 + 0.3, driver: 'police' }),
      makeCar(scene, rng, { color: 0xffffff, police: true, x: 134, z: COAST_ROAD_Z + 52, heading: Math.PI / 2 + 0.7, driver: 'police' }),
    ];
    hud.showBanner('<b>JOB 3 — HARBOUR HEIST</b> — get the money to <b>Marina\'s kiosk</b>. Half the bay will chase you.');
    return { step(dt) {
      t += dt;
      player.updateOnFoot(dt, { x: -1, z: 0.15 }, true, world);
      for (const c of cops) flashBars(c, t);
      traffic.update(dt, player.pos);
      api.peds.update(dt, world, []);
      world.update(dt);
      const back = { x: Math.sin(-Math.PI / 2), z: Math.cos(-Math.PI / 2) };
      camera.position.set(player.pos.x - back.x * 7.5, 3.0, player.pos.z - back.z * 7.5);
      camera.lookAt(player.pos.x - 6, 1.5, player.pos.z);
      baseHud(api, {
        money: 1150, health: 76, stars: 4,
        markers: [{ x: -55, z: COAST_ROAD_Z + 16, color: '#ffd94a' }],
        blips: [...cops.map((c) => ({ x: c.pos.x, z: c.pos.z, police: true })),
                ...traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false }))],
      });
    } };
  }

  return null;
}
