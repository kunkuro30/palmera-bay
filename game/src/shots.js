// The deterministic screenshot scenes behind ?shot=<name>&seed=N. The four
// submission scenes are chase (cover), beach, city and mission — mission is
// staged as a third-person SHOOTOUT: over-the-shoulder aim, crosshair up,
// gangsters ahead. Extra scenes (crowd, downtown, airport, wanted5,
// complete, takemission, driving) feed the user gallery only.
// The MC — orange jacket, white tee, red shoes, one consistent identity —
// is VISIBLE in every submission frame: driving the convertible in chase
// and city, standing on the beach, aiming in the shootout. Characters are
// staged mid-action, never as mannequins. Each scene stages the real game
// — player, police, crowd, HUD state — then advances the world a fixed
// number of steps behind a held camera, so the frame is what play really
// looks like and the same seed always gives the same frame.

import { WORLD, groundHeight } from './config.js';
import { makeCar, spinWheels } from './vehicles.js';
import { makeFigure } from './characters.js';

const THREE = window.THREE;

function gy(x, z) { return groundHeight(x, z); }

function setCam(G, x, y, z, lx, ly, lz) {
  G.camera.position.set(x, y, z);
  G.camera.lookAt(lx, ly, lz);
}

function placeFig(fig, x, z, ry) {
  const y = gy(x, z);
  fig.group.position.set(x, y, z);
  fig.baseY = y;
  if (ry !== undefined) fig.group.rotation.y = ry;
  return fig;
}

function placeCar(car, x, z, h) {
  car.group.position.set(x, gy(x, z), z);
  car.heading = h;
  car.group.rotation.y = h;
}

// Seat the MC in a convertible: hips on the seat, legs bent forward, both
// hands up on the wheel — he reads instantly as the driver from behind.
function seat(fig, car) {
  const p = car.group.position;
  const h = car.heading;
  fig.group.position.set(p.x - Math.sin(h) * 0.1, p.y + 0.52, p.z - Math.cos(h) * 0.1);
  fig.group.rotation.y = h;
  fig.parts.legL.rotation.x = -1.5;
  fig.parts.legR.rotation.x = -1.5;
  fig.parts.armL.rotation.x = -0.95;
  fig.parts.armR.rotation.x = -0.95;
  fig.parts.torso.rotation.x = 0.06;
}

function flashLights(G) {
  for (const unit of G.police.units) {
    if (!unit.car.lights) continue;
    const on = Math.sin(G.time * 10 + unit.phase) > 0;
    unit.car.lights.red.visible = on;
    unit.car.lights.blue.visible = !on;
  }
}

function ambient(G, dt) {
  G.traffic.update(dt, G.time);
  G.crowd.update(dt, G.time);
  flashLights(G);
}

// 1 — COVER: a three-star pursuit down the avenue, the MC at the wheel of
// the red convertible, mission objective on the banner.
function chase(G) {
  G.renderer.toneMappingExposure = 1.3;
  const car = makeCar(0xd42427, { cls: 'sport', kind: 'mission', openTop: true });
  placeCar(car, -54, 130, Math.PI);
  car.speed = 15;
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  const u1 = G.police.spawnUnitAt(-55.2, 139, Math.PI);
  const u2 = G.police.spawnUnitAt(-51.4, 145, Math.PI);
  u1.car.speed = 15; u2.car.speed = 15;
  G.police.heat = 190;
  G.save.cash = 570;
  G.missions.setObjectiveOverride({
    x: WORLD.lockup.x, z: WORLD.lockup.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Deliver the car to the east lockup',
  });
  return {
    frame(dt) {
      const p = car.group.position;
      p.z += Math.cos(car.heading) * car.speed * dt;
      p.y = gy(p.x, p.z);
      spinWheels(car, dt);
      u1.car.group.position.set(p.x - 1.2, gy(p.x - 1.2, p.z + 9), p.z + 9);
      spinWheels(u1.car, dt);
      u2.car.group.position.set(p.x + 2.6, gy(p.x + 2.6, p.z + 15), p.z + 15);
      spinWheels(u2.car, dt);
      seat(G.player.fig, car);
      ambient(G, dt);
      setCam(G, p.x - 4.2, p.y + 5.4, p.z + 24, p.x + 0.4, p.y + 1.2, p.z - 14);
    },
  };
}

// 2 — BEACH: the living south shore — the MC on the sand, volleyball and
// sunbathers around, statue and wheel behind, the shop row, downtown
// towers and the mountain stacked up the island behind them.
function beach(G) {
  G.renderer.toneMappingExposure = 1.28;
  placeFig(G.player.fig, 15, 226, 2.75);
  G.player.facing = 2.75;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 24, 4.6, 240, -30, 2.3, 190);
    },
  };
}

// 3 — CITY: the MC driving the yellow cabrio taxi through downtown,
// traffic all around, towers overhead.
function city(G) {
  G.renderer.toneMappingExposure = 1.26;
  const car = makeCar(0xffd23e, { cls: 'taxi', kind: 'mission', openTop: true });
  placeCar(car, -54, 128, Math.PI);
  car.speed = 13;
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  const ahead = makeCar(0x2b50c8, { cls: 'sedan', kind: 'mission' });
  placeCar(ahead, -54, 96, Math.PI);
  ahead.speed = 11;
  G.scene.add(ahead.group);
  const oncoming = makeCar(0xf2f2f2, { cls: 'van', kind: 'mission' });
  placeCar(oncoming, -46, 58, 0);
  oncoming.speed = 10;
  G.scene.add(oncoming.group);
  G.save.cash = 240;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      const p = car.group.position;
      p.z += Math.cos(car.heading) * car.speed * dt;
      p.y = gy(p.x, p.z);
      spinWheels(car, dt);
      ahead.group.position.z += Math.cos(ahead.heading) * ahead.speed * dt;
      ahead.group.position.y = gy(ahead.group.position.x, ahead.group.position.z);
      spinWheels(ahead, dt);
      oncoming.group.position.z += Math.cos(oncoming.heading) * oncoming.speed * dt;
      oncoming.group.position.y = gy(oncoming.group.position.x, oncoming.group.position.z);
      spinWheels(oncoming, dt);
      seat(G.player.fig, car);
      ambient(G, dt);
      setCam(G, p.x - 4.6, p.y + 5.2, p.z + 20, p.x + 0.4, p.y + 1.1, p.z - 16);
    },
  };
}

// 4 — SHOOTOUT (submission #4 + gallery): TPS gunfight on the promenade,
// staged CLOSE — the MC fills the right of the frame, aiming over the
// shoulder with the crosshair up, at two gangsters guarding the heist
// case (one returning fire, one down), an officer running in, a cruiser
// behind. A tracer is frozen mid-flight.
function mission(G) {
  G.renderer.toneMappingExposure = 1.28;
  const player = G.player;
  placeFig(player.fig, -92.5, 188.5, -1.5);
  player.facing = -1.5;
  player.aiming = true;
  G.forceCrosshair = true;
  if (player.fig.parts.weapon) player.fig.parts.weapon.visible = true;
  player.fig.parts.armR.rotation.x = -1.35;
  player.fig.parts.armL.rotation.x = -0.85;
  player.fig.parts.armL.rotation.z = 0.35;
  // Gangsters: black jackets, gold chains, shades.
  const g1 = makeFigure({
    skin: 0x9c6644, shirt: 0x17181c, pants: 0x1c1e24, shoes: 0x111111,
    chain: true, shades: true, weapon: true, hat: 'hair', hatColor: 0x14100c,
  });
  placeFig(g1, -106, 189.5, 1.47);
  G.scene.add(g1.group);
  g1.still = true;
  G.crowd.figures.push(g1);
  const g2 = makeFigure({
    skin: 0x7a4b2a, shirt: 0x17181c, pants: 0x2b2d42, shoes: 0x111111,
    chain: true, shades: true, hat: 'hair', hatColor: 0x14100c,
  });
  placeFig(g2, -109.5, 193, 1.2);
  g2.down = 999;
  G.scene.add(g2.group);
  g2.still = true;
  G.crowd.figures.push(g2);
  // The heist case the gangsters are guarding.
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.44),
    new THREE.MeshLambertMaterial({ color: 0xd8a920, flatShading: true, emissive: 0x4a3600 }));
  caseMesh.position.set(-107.5, gy(-107.5, 187.5) + 0.55, 187.5);
  caseMesh.castShadow = true;
  G.scene.add(caseMesh);
  // A cruiser arriving on Ocean Drive and its officer RUNNING in, mid-stride.
  const u1 = G.police.spawnUnitAt(-118, 172, 0.9);
  const off = G.police.setOfficerOut(u1, -110, 180);
  off.fig.group.rotation.y = 0.64;
  off.fig.parts.legL.rotation.x = 0.65;
  off.fig.parts.legR.rotation.x = -0.55;
  off.fig.parts.armL.rotation.x = -0.7;
  off.fig.parts.armR.rotation.x = 0.5;
  off.fig.parts.torso.rotation.x = 0.18;
  G.police.heat = 190;
  G.save.cash = 845;
  G.missions.setObjectiveOverride({
    x: -108, z: WORLD.shopsZ + 7, letter: 'C',
    label: 'JOB 3 — BAY HEIST · Lift the case at FRESH FISH',
  });
  // Frozen tracer + muzzle flash from the MC's gun to the standing gangster.
  const baseY = gy(-92.5, 188.5);
  const gunTip = new THREE.Vector3(-93.55, baseY + 1.45, 188.58);
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([gunTip, new THREE.Vector3(-106, baseY + 1.35, 189.5)]);
  G.scene.add(new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8 })));
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  flash.position.copy(gunTip);
  G.scene.add(flash);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -88.6, baseY + 2.05, 190.6, -106, baseY + 1.05, 189.3);
    },
  };
}

// G1 — CROWD: the west promenade at its busiest — the clinic and its
// doctor + nurse, the fish shop and its keeper, shoppers streaming past,
// the MC in the middle of it. The whole living strip in one frame.
function crowd(G) {
  G.renderer.toneMappingExposure = 1.28;
  placeFig(G.player.fig, -115, 192.5, 0.5);
  G.player.facing = 0.5;
  G.save.cash = 320;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -108, 3.2, 200, -130, 1.6, 186);
    },
  };
}

// G2 — DOWNTOWN: on foot on the SIDEWALK in the tower canyon — the raised
// concrete strip runs through the foreground.
function downtown(G) {
  G.renderer.toneMappingExposure = 1.26;
  placeFig(G.player.fig, -40.7, 94, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 480;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -42.5, 2.8, 102, -50, 6.0, 38);
    },
  };
}

// G3 — AIRPORT: the player on the plateau, terminal, tower and jets behind.
function airport(G) {
  G.renderer.toneMappingExposure = 1.27;
  placeFig(G.player.fig, -140, 106, -0.9);
  G.player.facing = -0.9;
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -196, z: 70, letter: 'D',
    label: 'PALMERA INTL AIRPORT · Now boarding',
  });
  G.missions.showMarker(null);   // the beacon would read as a chimney here
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -132, 4.6, 96, -200, 3.6, 124);
    },
  };
}

// G4 — WANTED5: five stars, five cruisers, one very bad day.
function wanted5(G) {
  G.renderer.toneMappingExposure = 1.3;
  const car = makeCar(0xd42427, { cls: 'sport', kind: 'mission' });
  placeCar(car, -54, 128, Math.PI);
  car.speed = 14;
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.player.group.visible = false;
  const offsets = [[-1.2, 9], [2.8, 14], [-4.5, 18], [4.5, 6], [-2.5, -18]];
  const units = offsets.map(([ox, oz]) => {
    const u = G.police.spawnUnitAt(-54 + ox, 128 + oz, Math.PI);
    u.car.speed = 14;
    return u;
  });
  G.police.heat = 300;
  G.save.cash = 1250;
  G.missions.setObjectiveOverride({
    x: WORLD.lockup.x, z: WORLD.lockup.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Deliver the car to the east lockup',
  });
  return {
    frame(dt) {
      const p = car.group.position;
      p.z += Math.cos(car.heading) * car.speed * dt;
      p.y = gy(p.x, p.z);
      spinWheels(car, dt);
      units.forEach((u, i) => {
        u.car.group.position.set(p.x + offsets[i][0], gy(p.x + offsets[i][0], p.z + offsets[i][1]), p.z + offsets[i][1]);
        spinWheels(u.car, dt);
      });
      ambient(G, dt);
      setCam(G, p.x - 4.2, p.y + 5.6, p.z + 26, p.x + 0.4, p.y + 1, p.z - 14);
    },
  };
}

// G5 — COMPLETE: Job 1 done at the end of the pier, toast on screen, the
// whole island city stacked behind.
function complete(G) {
  G.renderer.toneMappingExposure = 1.28;
  // On the pier deck just south of the end kiosk, facing the city.
  placeFig(G.player.fig, WORLD.pier.x, 240, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 150;
  G.hud.toast('JOB 1 DONE · +$150', 600000);
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 13.5, 3.6, 245, 4, 1.9, 216);
    },
  };
}

// G6 — TAKEMISSION: at the pier entrance with your friend, beacon ahead.
function takemission(G) {
  G.renderer.toneMappingExposure = 1.28;
  placeFig(G.player.fig, 13.5, 192.5, -1.85);
  G.player.facing = -1.85;
  // No override: the live Job 1 objective stays on the banner; light its beacon.
  G.missions.showMarker(WORLD.pier.x, WORLD.pier.z1 - 4);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 17.5, 3.2, 183, 5.5, 1.7, 194);
    },
  };
}

export function stageShot(name, G) {
  if (name === 'beach' || name === 'beach2') return beach(G);
  if (name === 'city' || name === 'driving') return city(G);
  if (name === 'mission' || name === 'shootout') return mission(G);
  if (name === 'crowd') return crowd(G);
  if (name === 'downtown') return downtown(G);
  if (name === 'airport') return airport(G);
  if (name === 'wanted5') return wanted5(G);
  if (name === 'complete') return complete(G);
  if (name === 'takemission') return takemission(G);
  return chase(G);
}
