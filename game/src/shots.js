// shots.js — deterministic screenshot staging behind ?shot=<name>&seed=<n>.
// Each scene places the real actors, then steps the real systems (driving,
// traffic, pedestrians, HUD) in fixed 1/60 steps, so the frame the shutter
// catches is the game itself, staged — never a mock-up.

import { createCar, driveCar, steerToward, forwardOf } from './vehicles.js';

function flashBars(car, t) {
  if (!car.mesh.userData.barR) return;
  const phase = Math.floor(t * 5.5) % 2 === 0;
  car.mesh.userData.barR.material.color.setHex(phase ? 0xff2d20 : 0x5c130e);
  car.mesh.userData.barB.material.color.setHex(phase ? 0x123a8a : 0x2d6bff);
}

function trafficBlips(traffic, extraPolice = []) {
  const blips = traffic.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, police: false }));
  for (const c of extraPolice) blips.push({ x: c.pos.x, z: c.pos.z, police: true, heading: c.heading });
  return blips;
}

export function stageCamera(name, camera) {
  camera.position.set(120, 42, 335);
  camera.lookAt(0, 12, 0);
}

export function stageActionShot(name, api) {
  const { scene, camera, world, traffic, peds, player, hud } = api;
  let t = 0;

  if (name === 'chase') {
    const car = traffic.sports;
    car.parked = false;
    car.driver = 'player';
    car.pos.set(55.3, 0, 78);
    car.heading = Math.PI;
    car.vel.x = 0;
    car.vel.z = -15;
    car.mesh.rotation.y = car.heading;
    for (const other of traffic.cars) {
      if (other !== car && Math.abs(other.pos.x - 53) < 9 && other.pos.z > 0 && other.pos.z < 130) {
        other.pos.x -= 200;
      }
    }
    const cops = [];
    for (const [x, z] of [[55.3, 88], [50.8, 97]]) {
      const cop = createCar(scene, 0xffffff, { police: true });
      cop.driver = 'police';
      cop.pos.set(x, 0, z);
      cop.heading = Math.PI;
      cop.vel.z = -16;
      cop.mesh.rotation.y = cop.heading;
      cops.push(cop);
    }
    player.driving = car;
    player.mesh.visible = false;
    hud.showBanner('<b>JOB 2 — HOT GOODS</b> — deliver the car to the <b>east lockup</b>. Lose them or outrun them.', 999);
    return {
      step(dt) {
        t += dt;
        driveCar(car, { throttle: 0.55, steer: Math.sin(t * 0.7) * 0.05, brake: false, handbrake: false }, dt, world);
        for (const cop of cops) {
          driveCar(cop, { throttle: 1, steer: steerToward(cop, car.pos.x, car.pos.z, 1.5), brake: false, handbrake: false }, dt, world);
          flashBars(cop, t);
        }
        traffic.update(dt);
        peds.update(dt);
        world.update(dt);
        const f = forwardOf(car.heading);
        camera.position.set(
          car.pos.x - f.x * 17 + -Math.cos(car.heading) * 4.6,
          5.4,
          car.pos.z - f.z * 17 + Math.sin(car.heading) * 4.6,
        );
        camera.lookAt(car.pos.x + f.x * 10, 1.2, car.pos.z + f.z * 10);
        hud.update({
          money: 570, health: 88, stars: 3, hour: 17.85,
          speedKmh: car.speed * 3.6,
          player: { x: car.pos.x, z: car.pos.z, heading: car.heading },
          markers: [{ x: 128, z: 66, color: '#ffd94a' }],
          blips: trafficBlips(traffic, cops),
          seenByPolice: true, searching: false,
        }, dt);
      },
    };
  }

  if (name === 'downtown') {
    player.pos.set(2.8, 0, 34);
    player.heading = Math.PI;
    player.mesh.rotation.y = Math.PI;
    hud.showBanner('<b>JOB 1 — FIRST RUN</b> — take the package to the <b>Sol Tower drop</b>, downtown.', 999);
    return {
      step(dt) {
        t += dt;
        player.updateOnFoot(dt, { x: 0, z: -1 }, false, world);
        traffic.update(dt);
        peds.update(dt);
        world.update(dt);
        camera.position.set(player.pos.x, 3.1, player.pos.z + 7);
        camera.lookAt(player.pos.x - 1.5, 1.6, player.pos.z - 6);
        hud.update({
          money: 370, health: 100, stars: 0, hour: 17.8,
          speedKmh: null,
          player: { x: player.pos.x, z: player.pos.z, heading: player.heading },
          markers: [{ x: 10, z: -14, color: '#ffd94a' }],
          blips: trafficBlips(traffic),
          seenByPolice: false, searching: false,
        }, dt);
      },
    };
  }

  if (name === 'drive') {
    const car = traffic.parked.find((c) => !c.isSports) || traffic.parked[0];
    car.parked = false;
    car.driver = 'player';
    car.pos.set(-71, 0, 189.7);
    car.heading = Math.PI / 2;
    car.vel.x = 16;
    car.vel.z = 0;
    car.mesh.rotation.y = car.heading;
    player.driving = car;
    player.mesh.visible = false;
    hud.showBanner('<b>DISPATCH</b> — fare waiting across town. Deliver and get paid.', 999);
    return {
      step(dt) {
        t += dt;
        driveCar(car, { throttle: 0.4, steer: 0, brake: false, handbrake: false }, dt, world);
        traffic.update(dt);
        peds.update(dt);
        world.update(dt);
        const f = forwardOf(car.heading);
        camera.position.set(
          car.pos.x + f.x * 7 - -Math.cos(car.heading) * 4.2,
          2.4,
          car.pos.z + f.z * 7 - Math.sin(car.heading) * 4.2,
        );
        camera.lookAt(car.pos.x, 1.1, car.pos.z);
        hud.update({
          money: 445, health: 100, stars: 0, hour: 17.9,
          speedKmh: car.speed * 3.6,
          player: { x: car.pos.x, z: car.pos.z, heading: car.heading },
          markers: [{ x: 160, z: -20, color: '#54c8ff' }],
          blips: trafficBlips(traffic),
          seenByPolice: false, searching: false,
        }, dt);
      },
    };
  }

  if (name === 'heist') {
    player.pos.set(160, 0, 228);
    player.heading = -Math.PI / 2;
    player.mesh.rotation.y = player.heading;
    const cops = [];
    for (const [x, z, h] of [[129, 221, Math.PI / 2 - 0.55], [130, 236, Math.PI / 2 + 0.65]]) {
      const cop = createCar(scene, 0xffffff, { police: true });
      cop.driver = 'police';
      cop.pos.set(x, 0, z);
      cop.heading = h;
      cop.mesh.rotation.y = h;
      cops.push(cop);
    }
    hud.showBanner('<b>JOB 3 — HARBOUR HEIST</b> — get the money to <b>Marina\'s kiosk</b>. Half the bay will chase you.', 999);
    return {
      step(dt) {
        t += dt;
        player.updateOnFoot(dt, { x: -1, z: 0 }, true, world);
        for (const cop of cops) flashBars(cop, t);
        traffic.update(dt);
        peds.update(dt);
        world.update(dt);
        camera.position.set(player.pos.x + 7.5, 3.0, player.pos.z);
        camera.lookAt(player.pos.x - 8, 1.4, player.pos.z);
        hud.update({
          money: 1150, health: 76, stars: 4, hour: 17.95,
          speedKmh: null,
          player: { x: player.pos.x, z: player.pos.z, heading: player.heading },
          markers: [{ x: -55, z: 208, color: '#ffd94a' }],
          blips: trafficBlips(traffic, cops),
          seenByPolice: true, searching: false,
        }, dt);
      },
    };
  }

  return null;
}
