// The screenshot scenes behind ?shot=chase|downtown|drive|heist (with &seed=N). Each one
// stages the real game — the player's car, police units, the HUD state — then advances
// traffic, pedestrians and lightbars for a fixed number of frames while a per-scene
// camera holds the composition, so the frame is what play really looks like and the
// same seed always gives the same frame.
import { LOCKUP, MISSION2_CAR } from './config.js';
import { makeCar } from './vehicles.js';

const THREE = window.THREE;

function flashLights(G) {
  for (const unit of G.police.units) {
    if (!unit.car.lights) continue;
    const on = Math.sin(G.time * 9 + unit.phase) > 0;
    unit.car.lights.red.visible = on;
    unit.car.lights.blue.visible = !on;
  }
}

function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.37;
  for (const w of car.wheels) w.rotation.x += spin;
}

function setCam(G, x, y, z, lx, ly, lz) {
  G.camera.position.set(x, y, z);
  G.camera.lookAt(lx, ly, lz);
}

function ambient(G, dt) {
  G.vehicles.update(dt);
  G.pedsSys.update(dt);
  flashLights(G);
}

function chase(G) {
  const scene = G.scene;
  // The cover wants a touch more light than live play: lift the exposure for this scene.
  G.renderer.toneMappingExposure = 1.34;
  const car = makeCar(0xd42427, { cls: 'sport', kind: 'mission' });
  car.group.position.set(-4, 0, 48);
  car.heading = Math.PI;
  car.group.rotation.y = Math.PI;
  car.speed = 15.3;
  scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.player.group.visible = false;
  const u1 = G.police.spawnUnitAt(-4, 39.5, Math.PI);
  const u2 = G.police.spawnUnitAt(-2.4, 48, Math.PI);
  u1.car.speed = 15.3;
  u2.car.speed = 15.3;
  G.police.heat = 250;
  G.police.stars = 3;
  G.police.seen = true;
  G.save.cash = 570;
  G.missions.setObjectiveOverride({
    x: LOCKUP.x, z: LOCKUP.z, letter: 'D',
    label: 'JOB 2 — HOT GOODS · Deliver the car to the east lockup',
  });
  return {
    frame(dt) {
      const p = car.group.position;
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.z += Math.cos(car.heading) * car.speed * dt;
      spinWheels(car, dt);
      const back = (unit, off, lat) => {
        // The chase heads north (-z), so the cruisers hold station behind at +z.
        unit.car.group.position.set(p.x + lat, 0, p.z + off);
        spinWheels(unit.car, dt);
      };
      back(u1, 8.5, 0.4);
      back(u2, 14.5, -2.6);
      ambient(G, dt);
      setCam(G, p.x - 3.8, 6.2, p.z + 27.5, p.x + 0.2, 0.9, p.z - 12);
    },
  };
}

function downtown(G) {
  const scene = G.scene;
  const player = G.player;
  player.group.position.set(2.8, 0, 30);
  player.facing = Math.PI;
  player.group.rotation.y = Math.PI;
  G.camYaw = Math.PI;
  const car = makeCar(0xd42427, { cls: 'sport', kind: 'parked' });
  car.group.position.set(MISSION2_CAR.x, 0, MISSION2_CAR.z);
  car.heading = Math.PI;
  car.group.rotation.y = Math.PI;
  scene.add(car.group);
  G.cars.push(car);
  G.missions.setObjectiveOverride({
    x: MISSION2_CAR.x, z: MISSION2_CAR.z, letter: 'C',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  G.missions.showMarker(MISSION2_CAR.x, MISSION2_CAR.z, 'C');
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 2.8, 2.7, 37.2, 2.8, 1.5, 24);
    },
  };
}

function drive(G) {
  const scene = G.scene;
  const car = makeCar(0x1f8a8c, { cls: 'coupe', kind: 'mission' });
  car.group.position.set(-58, 0, 195);
  car.heading = Math.PI / 2;
  car.group.rotation.y = Math.PI / 2;
  car.speed = 20;
  scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.player.group.visible = false;
  return {
    frame(dt) {
      const p = car.group.position;
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.z += Math.cos(car.heading) * car.speed * dt;
      spinWheels(car, dt);
      ambient(G, dt);
      setCam(G, p.x + 11.5, 2.7, p.z - 7.5, p.x - 3, 0.9, p.z + 1.5);
    },
  };
}

function heist(G) {
  const scene = G.scene;
  const player = G.player;
  player.group.position.set(-60, 0, 182);
  player.facing = Math.PI;
  player.group.rotation.y = Math.PI;
  const caseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.34, 0.4),
    new THREE.MeshLambertMaterial({ color: 0xd8a920, emissive: 0x5a4300 }),
  );
  caseMesh.position.set(0.4, 1.0, 0.25);
  player.group.add(caseMesh);
  const u1 = G.police.spawnUnitAt(-64.5, 175.5, Math.PI * 0.9);
  const u2 = G.police.spawnUnitAt(-55, 174.5, Math.PI * 1.1);
  const o1 = G.police.setOfficerOut(u1, -63, 179);
  const o2 = G.police.setOfficerOut(u2, -56.5, 178.5);
  o1.group.rotation.y = Math.atan2(-60 - -63, 182 - 179);
  o2.group.rotation.y = Math.atan2(-60 - -56.5, 182 - 178.5);
  G.police.heat = 350;
  G.police.stars = 4;
  G.police.seen = true;
  G.save.cash = 845;
  G.missions.setObjectiveOverride({ x: null, z: null, letter: '', label: 'BAY HEIST · Lose the police!' });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -63.5, 2.9, 163, -59.5, 1.1, 180);
    },
  };
}

export function stageShot(name, G) {
  if (name === 'downtown') return downtown(G);
  if (name === 'drive') return drive(G);
  if (name === 'heist') return heist(G);
  return chase(G);
}
