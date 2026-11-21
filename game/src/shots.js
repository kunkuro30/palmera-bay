// GO RIO RIO · shots.js — the deterministic ?shot= scenes behind screenshots and checks.
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

// Seat the MC in a car FROM THE CAR'S SEAT SOCKET (physics standard
// #1/#2): hips at true seat height, legs folded into the footwell, both
// hands on the steering wheel. Build 8: the figure is the real-
// proportioned 1.78 (characters.js FIGURE), so the head box is
// [socket + 1.50, socket + 1.80] with a ±0.13 half-width, and the hip
// pivot sits 0.96 above the figure origin.
// After placing, seat() ASSERTS the result: the seated head box must not
// intersect any of the car's hard frame boxes (rear deck, spoiler, taxi
// sign…), and for open cars the hips must sit below the tub rim, inside
// the tub's span. The verdict lands on car.driverCheck for the
// tools/physics_check.py self-check.
function seat(fig, car) {
  const s = car.seat || { x: 0.42, y: -0.24, z: 0.15 };
  const p = car.group.position;
  const h = car.heading;
  const fx = Math.sin(h), fz = Math.cos(h);       // car forward
  const lx = Math.cos(h), lz = -Math.sin(h);      // car left
  fig.group.position.set(
    p.x + fx * s.z + lx * s.x,
    p.y + s.y,
    p.z + fz * s.z + lz * s.x);
  fig.group.rotation.y = h;
  fig.parts.legL.rotation.x = -1.15;
  fig.parts.legR.rotation.x = -1.15;
  fig.parts.armL.rotation.x = -0.75;
  fig.parts.armR.rotation.x = -0.75;
  fig.parts.torso.rotation.x = 0.06;

  const head = { x: [s.x - 0.13, s.x + 0.13], y: [s.y + 1.50, s.y + 1.80], z: [s.z - 0.13, s.z + 0.13] };
  const hits = [];
  for (const fb of car.frameBoxes || []) {
    if (head.x[0] < fb.x[1] && head.x[1] > fb.x[0] &&
        head.y[0] < fb.y[1] && head.y[1] > fb.y[0] &&
        head.z[0] < fb.z[1] && head.z[1] > fb.z[0]) hits.push(fb.name);
  }
  let ok = hits.length === 0;
  let note = ok ? 'head box clears every frame box' : 'head box intersects: ' + hits.join(', ');
  if (car.tub) {
    const hipY = s.y + 0.96;
    const inTub = head.x[0] > car.tub.x[0] && head.x[1] < car.tub.x[1] &&
                  head.z[0] > car.tub.z[0] - 0.4 && head.z[1] < car.tub.z[1];
    if (!(hipY < car.tub.rimY - 0.15 && hipY > car.tub.floorY - 0.05 && inTub)) {
      ok = false;
      note += '; hip/rim containment failed';
    }
  }
  car.driverCheck = { pass: ok, note };
  console.log(`PHYS seat ${car.cls}: ${ok ? 'PASS' : 'FAIL'} — ${note}`);
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
  G.renderer.toneMappingExposure = 1.18;
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
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, 36, 246, 0.99);   // wading in the shallows, swimmers paddling just offshore
  G.player.facing = 0.99;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      // Build 4: over the water looking back at the strip — swimmers in
      // the foreground sea, the MC big wading at the shoreline, statue,
      // wheel, shops and towers stacked up behind him.
      setCam(G, 54, 3.3, 258, 26, 1.2, 237);
    },
  };
}

// 3 — CITY: the MC driving the yellow cabrio taxi through downtown,
// traffic all around, towers overhead.
function city(G) {
  G.renderer.toneMappingExposure = 1.16;
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
  G.renderer.toneMappingExposure = 1.17;
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
    label: 'JOB 3 — BAY HEIST · Lift the case at SUSHI BAY',
  });
  // Frozen tracer from the MC's gun to the standing gangster.
  // DEFECT FIX (C-7): no static muzzle-flash mesh — the frozen flat
  // yellow sphere read as a sticker disc on the pistol in the shipped
  // shot; the tracer line alone sells the shot. (Live combat keeps
  // its real animated flash in combat.js — untouched.)
  const baseY = gy(-92.5, 188.5);
  const gunTip = new THREE.Vector3(-93.55, baseY + 1.38, 188.58);
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([gunTip, new THREE.Vector3(-106, baseY + 1.12, 189.5)]);
  G.scene.add(new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8 })));
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
  G.renderer.toneMappingExposure = 1.17;
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
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -39.9, 94, Math.PI);   // just off the walker line, still on the sidewalk strip
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

// G3 — AIRPORT: the player on the apron, jets, tanker and tower behind.
// (Build 4: staged ON the plateau — the old city-side viewpoint is now
// behind the filled west-edge blocks.)
function airport(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -196, 112, 2.29);
  G.player.facing = 2.29;
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -196, z: 70, letter: 'D',
    label: 'PALMERA INTL AIRPORT · Now boarding',
  });
  G.missions.showMarker(null);   // the beacon would read as a chimney here
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -178, 4.6, 96, -204, 3.4, 126);
    },
  };
}

// G4 — WANTED5: five stars, five cruisers, one very bad day.
function wanted5(G) {
  G.renderer.toneMappingExposure = 1.18;
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
  G.renderer.toneMappingExposure = 1.17;
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
  G.renderer.toneMappingExposure = 1.17;
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

// G7 — STREET: a downtown crossing alive — zebras on all four corners,
// stop lines, the MC on the sidewalk corner watching traffic brake for
// the red, joggers and pairs streaming past.
function street(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 10.6, 136.5, -2.2);
  G.player.facing = -2.2;
  G.save.cash = 380;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 17, 3.4, 143, -8, 1.6, 116);
    },
  };
}

// G8 — QUEUE: the DONUT BAY queue at arm's length — keeper, two customers
// in line, the ring sign overhead, shoppers streaming past on the strip.
function queue(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, -62.5, 190.5, -2.6);
  G.player.facing = -2.6;
  G.save.cash = 265;
  G.missions.setObjectiveOverride({
    x: -108, z: WORLD.shopsZ + 7, letter: 'C',
    label: 'JOB 3 — BAY HEIST · Lift the case at SUSHI BAY',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -56.5, 2.7, 197.5, -69, 1.7, 185.5);
    },
  };
}

// G9 — GULLS: the south shore from the waterline — swimmers and jetskis in
// the foreground, gulls circling over the sand, the whole strip behind.
function gulls(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, 60, 244, 0.95);
  G.player.facing = 0.95;
  G.save.cash = 410;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 74, 5.5, 254, -10, 7, 214);
    },
  };
}

// G10 — PLANE: the working jet at the start of its takeoff roll, the MC
// watching from the apron, a parked jet and the tower behind.
function plane(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -224, 178, 2.8);
  G.player.facing = 2.8;
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -196, z: 70, letter: 'D',
    label: 'PALMERA INTL AIRPORT · Now boarding',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -215, 3.2, 197, -240, 3, 128);
    },
  };
}

// G11 — PROPORTION (build 8 proof): the MC STANDING beside a parked
// sedan in the avenue lane, camera at human height. The direct answer to
// "the person is bigger than the car": his head sits just above the
// sedan's roofline (figure 1.78 vs roof 1.48, the real-world ratio) and
// the car is clearly the longer, bigger object (4.70 long).
function proportion(G) {
  G.renderer.toneMappingExposure = 1.16;
  const car = makeCar(0x2b50c8, { cls: 'sedan', kind: 'mission' });
  placeCar(car, -54, 118, 0);
  G.scene.add(car.group);
  G.cars.push(car);
  placeFig(G.player.fig, -52.2, 118.9, -Math.PI / 2);
  G.player.facing = -Math.PI / 2;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -46.8, gy(-54, 118) + 1.95, 125.8, -54.6, gy(-54, 118) + 1.15, 117.6);
    },
  };
}

// G12 — AIRPORT FLEET (build 6): the fleet Boeing parked on the south
// apron with the ARFF truck standing by, the working jet and the old
// parked jets behind — the new fleet reading at airport scale.
function airportfleet(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -184, 176, 2.5);
  G.player.facing = 2.5;
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -196, z: 70, letter: 'D',
    label: 'PALMERA INTL AIRPORT · Now boarding',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -170, 4.4, 210, -203, 3.2, 172);
    },
  };
}

// G13 — EMERGENCY (build 6): the fire row on the crew's corner — ladder,
// pumper and rescue trucks on the south edge of street 35, strobes
// blinking, the MC watching from the median. (The fleet ambulance sits
// at Bay Clinic per its placement and reads in the crowd frame.)
function emergency(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 76, 34.5, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'JOB 2 — HOT GOODS · Steal the marked sports car',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 82.5, 3.4, 43, 72, 1.5, 27);
    },
  };
}

// G14 — MOTO (build 6): the three fleet motorcycles parked in a row on
// the boardwalk edge west of the pier entrance, promenade life streaming
// past behind the camera.
function moto(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, -16.2, 191.8, -2.4);
  G.player.facing = -2.4;
  G.save.cash = 285;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -17.4, 2.0, 199, -21.8, 0.9, 189);
    },
  };
}

// G15 — FOOD STREET (build 7): the west end of the shop row — SUSHI
// BAY, TACO PALM, DONUT BAY and KAVA COFFEE, each with its own facade
// tint and roof prop, keepers and queues on the strip.
function foodstreet(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, -80, 190.5, -0.5);
  G.player.facing = -0.5;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: -108, z: WORLD.shopsZ + 7, letter: 'C',
    label: 'JOB 3 — BAY HEIST · Lift the case at SUSHI BAY',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -63, 3.4, 201, -86, 2.2, 181);
    },
  };
}

// G16 — DEALERSHIP (build 7): Palmera Motors — glass showroom with two
// cars inside, three more on the forecourt under their price boards.
function motors(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 120, 159, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 520;
  G.missions.setObjectiveOverride({
    x: 120, z: 141, letter: 'E',
    label: 'PALMERA MOTORS · Cars from $8,999',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 111, 3.8, 165, 123, 2.6, 143);
    },
  };
}

// G17 — WEST SHOPS (build 7): Palmera Moto's glass front with the fleet
// bikes on their platform, and Palmera Arms next door, bars and all.
function westshops(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -125, 152.5, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 430;
  G.missions.setObjectiveOverride({
    x: -125, z: 141, letter: 'E',
    label: 'PALMERA MOTO · PALMERA ARMS · Ocean Drive west',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -125, 3.6, 161, -125, 2.8, 141);
    },
  };
}

// G18 — HOSPITAL (build 7): Palmera General — four storeys, red cross,
// entrance canopy, the fleet ambulance in its marked bay.
function hospital(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -124, 194, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 610;
  G.missions.setObjectiveOverride({
    x: -128, z: WORLD.shopsZ, letter: 'H',
    label: 'PALMERA GENERAL HOSPITAL · Emergency',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -112, 4.2, 200, -131, 5.5, 179);
    },
  };
}

// G19 — POLICE (build 7): Palmera PD headquarters — flag flying, two
// fleet cruisers at the kerb, the MC on the street in front.
function police(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 119, 83.5, 0.15);
  G.player.facing = 0.15;
  G.save.cash = 350;
  G.missions.setObjectiveOverride({
    x: 120, z: 96, letter: 'P',
    label: 'PALMERA PD · Headquarters',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 108.5, 3.4, 77, 121.5, 3.6, 95);
    },
  };
}

// G20 — FIRE STATION (build 7): three bays (the middle one open), the
// hose tower, and the fleet fire row at the kerb in front.
function firestation(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 75, 33.5, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: 75, z: 21, letter: 'F',
    label: 'PALMERA FD · Station 1',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 62, 3.8, 41, 79, 2.6, 20);
    },
  };
}

// G21 — HOUSING (build 7): Palmera Heights — eight varied houses on
// their own street, driveways, fences, parked cars, the coast behind.
function housing(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 186, 62, 2.6);
  G.player.facing = 2.6;
  G.save.cash = 275;
  G.missions.setObjectiveOverride({
    x: 186, z: 56, letter: 'R',
    label: 'PALMERA HEIGHTS · Residential',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 185, 4.6, 76, 194, 1.6, 40);
    },
  };
}

// G22 — KIOSKS (build 7): the donut kiosk at arm's length — vendor
// behind the counter, glass case, promenade life streaming past.
function kiosks(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, 44.5, 193.8, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 290;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 40.5, 2.7, 198.5, 50, 1.5, 189.3);
    },
  };
}

// G23 — MILITARY (build 7, widened build 10): the whole living
// garrison in one wide frame — gate and guard huts left, HQ and the
// parade ground centre, hangar and depot beyond, the helicopter on
// its pad at the right edge.
function military(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 166, -32, -2.35);
  G.player.facing = -2.35;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: 131, z: -50, letter: 'G',
    label: 'PALMERA GARRISON · Restricted area',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 188, 7.5, -2, 138, 1.5, -46);
    },
  };
}

// G25 — GARRISON (build 10): the parade ground close-up — the drill
// formation in two ranks facing the HQ, the garrison flag at the
// corner, floodlights, and the patrol route crossing behind them.
function garrison(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 120.5, -47.8, 2.22);
  G.player.facing = 2.22;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: 131, z: -50, letter: 'G',
    label: 'PALMERA GARRISON · Parade ground',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 112, 9.5, -44.5, 125.5, 3.0, -51.5);
    },
  };
}

// G24 — AIRPORT 2 (build 7): the upgraded terminal face — DEPARTURES
// and ARRIVALS boards, apron lead-in lines and stand signs.
function airport2(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -178, 78, -1.99);
  G.player.facing = -1.99;
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -196, z: 70, letter: 'D',
    label: 'PALMERA INTL AIRPORT · Departures',
  });
  G.missions.showMarker(null);
  return {
    frame(dt) {
      ambient(G, dt);
      // Close three-quarter view of the terminal's signed east face
      // (PALMERA INTL + DEPARTURES/ARRIVALS boards) from the apron's
      // east edge. Fringe city towers on the x=-165 avenue crowd every
      // wider angle, and the west face is blank, so the shot stays in
      // tight on the face itself.
      setCam(G, -170, 6.0, 74, -188, 6.5, 68);
    },
  };
}

// G-CHARACTERS (build 8): the re-rendered cast at street level — the MC
// (orange jacket, red shoes), a police officer, a nurse and a gangster
// standing in a line with a new-design sedan behind them, camera at eye
// height. This is the frame the user judges the character overhaul by:
// real proportions (head ≈ 1/7.5), capsule limbs, smooth heads, roles
// readable at a glance.
function characters(G) {
  G.renderer.toneMappingExposure = 1.17;
  const car = makeCar(0x2b50c8, { cls: 'sedan', kind: 'mission' });
  placeCar(car, -54, 115.5, 0);
  G.scene.add(car.group);
  G.cars.push(car);
  placeFig(G.player.fig, -56.1, 121, 0);
  G.player.facing = 0;
  const officer = makeFigure({
    skin: 0x8a5a3b, shirt: 0x274b73, pants: 0x1d2f45, shoes: 0x14161a,
    hat: 'police', hatColor: 0x1d3a5f, badge: true,
  });
  placeFig(officer, -54.4, 121, 0);
  G.scene.add(officer.group);
  officer.still = true;
  const nurse = makeFigure({
    skin: 0xf2c79b, shirt: 0xf4f7f7, pants: 0xdfe7ea, shoes: 0xffffff,
    hat: 'nurse', hatColor: 0xffffff, hairLong: true,
  });
  placeFig(nurse, -52.7, 121, 0);
  G.scene.add(nurse.group);
  nurse.still = true;
  const gang = makeFigure({
    skin: 0x7a4b2a, shirt: 0x17181c, pants: 0x2b2d42, shoes: 0x111111,
    chain: true, shades: true, hat: 'hair', hatColor: 0x14100c,
  });
  placeFig(gang, -51.0, 121, 0);
  G.scene.add(gang.group);
  gang.still = true;
  G.save.cash = 300;
  G.missions.setObjectiveOverride({
    x: WORLD.missionCar.x, z: WORLD.missionCar.z, letter: 'B',
    label: 'PALMERA BAY · The cast of the bay',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -53.5, gy(-54, 121) + 1.55, 127.6, -53.5, gy(-54, 121) + 1.02, 120.6);
    },
  };
}

// DIALOGUE (build 12, gallery): Rio faces Marco at the pier entrance
// while Marco's opening line runs in the portrait dialogue box — the
// story layer, staged. The line is PINNED (sticky) so it survives the
// staged-frame settle regardless of wall-clock timing.
function dialogue(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, 7.8, 191.8, -2.03);
  G.player.facing = -2.03;
  G.save.cash = 0;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'JOB 1 — BEACH RUN · Reach the end of the pier',
  });
  const line = "Rio! SunCoast Leisure just bought the pier end — private marina, fence, the lot. Run it one more time while it's still ours.";
  return {
    frame(dt) {
      if (G.dialogue) G.dialogue.pin('marco', line);
      ambient(G, dt);
      setCam(G, 14.5, gy(8, 192) + 3.4, 201, 5.0, gy(5, 190) + 1.1, 189.8);
    },
  };
}

// G13 — SHELLS (build 13, gallery only): the MC at the pier end,
// crouched low over the golden shell that hides there — the shell
// group is gameplay-only (hidden in shot mode), so this scene turns
// it back on for its portrait.
function shells(G) {
  G.renderer.toneMappingExposure = 1.16;
  if (G.sidejobs && G.sidejobs.shellGroup) G.sidejobs.shellGroup.visible = true;
  placeFig(G.player.fig, 6.9, 227.4, -0.59);
  G.player.facing = -0.59;
  G.save.cash = 512;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: '',
    label: 'GOLDEN SHELLS · 15 hidden across the bay',
  });
  const baseY = gy(5.2, 230);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 3.9, baseY + 1.05, 225.4, 5.4, baseY + 0.3, 230.1);
    },
  };
}

// G13b — SIDE JOB (build 13, gallery only): the MC at the COLD DRINKS
// kiosk with the courier offer up — the side-job loop's portrait. The
// prompt text is the offer the game itself shows (sidejobs.js).
function sidejob(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 113, 193.6, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 900;
  G.save.jobsDone = 1;
  if (G.hud) G.hud.prompt('<b>[T]</b> COLD DRINKS — take a courier delivery');
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: 'A',
    label: 'SIDE WORK — Courier runs from the kiosk row',
  });
  const baseY = gy(113, 193.6);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 109.3, baseY + 2.3, 201.5, 113.6, baseY + 1.1, 190.5);
    },
  };
}

// G13c — ARMS (build 13, gallery only): the MC aiming at the Palmera
// Arms display window — the new pistol up, the lit case with its two
// rifles and pistol shelf behind the glass, the armour offer showing.
function arms(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -119.3, 151.8, Math.PI);
  G.player.facing = Math.PI;
  G.player.aiming = true;
  G.player.fig.parts.weapon.visible = true;
  G.player.fig.parts.armR.rotation.x = -1.35;
  if (G.hud) G.hud.prompt('<b>[T]</b> PALMERA ARMS — armour +50 — <b>$250</b>');
  G.save.cash = 900;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: '',
    label: 'PALMERA ARMS · Armour, on the counter',
  });
  const baseY = gy(-119.3, 151.8);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -115.6, baseY + 2.0, 155.9, -121.4, baseY + 1.2, 146.0);
    },
  };
}

// G13d — BOATS (build 13, gallery only): from the pier, looking west
// along the shore — a jetski crossing, the harbour ship beyond, gulls
// overhead. The water traffic runs on the animated clock as usual.
function boats(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, 9.5, 236, 0.5);
  G.player.facing = 0.5;
  G.save.cash = 320;
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: '',
    label: 'THE BAY · Boat traffic on the south shore',
  });
  const baseY = gy(9.5, 236);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 13.5, baseY + 2.3, 232.5, -18, 1.0, 260);
    },
  };
}

// G14a — WEAPONS (build 14, gallery only): Rio at the Palmera Arms
// case with the SMG up — the rack behind the glass now holds two
// rifles, the SMG between them and the pistol shelf; the HUD chip
// shows the SMG selected with its slot pips, and the rifle offer is
// on the prompt pill.
function weapons(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -119.3, 151.8, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 5000;
  G.save.respect = 250;
  G.save.weapons = 3;   // pistol + SMG owned, the rifle still on the rack
  G.player.aiming = true;
  if (G.weapons) G.weapons.select('smg');
  if (G.player.fig.parts.weapon) G.player.fig.parts.weapon.visible = true;
  G.player.fig.parts.armR.rotation.x = -1.35;
  if (G.hud) G.hud.prompt('<b>[T]</b> PALMERA ARMS — RIFLE — <b>$2,200</b>');
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: '',
    label: 'PALMERA ARMS · The rack is open — REP permitting',
  });
  const baseY = gy(-119.3, 151.8);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -115.6, baseY + 2.0, 155.9, -121.4, baseY + 1.2, 146.0);
    },
  };
}

// G14b — RACE (build 14, gallery only): Rio's car on the Ocean Sprint
// start grid, the first checkpoint ring lit down Ocean Drive, the
// race line riding the prompt pill.
function race(G) {
  G.renderer.toneMappingExposure = 1.17;
  const car = makeCar(0xd42427, { cls: 'sport', kind: 'mission' });
  placeCar(car, -128, WORLD.oceanDrive, Math.PI / 2);
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.player.group.visible = false;
  if (G.races) G.races.stageForShot();
  if (G.hud) G.hud.prompt('<b>OCEAN SPRINT</b> · CP 1/6 · 0:00.0 · next 18 m ▲');
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -110, z: WORLD.oceanDrive, letter: '',
    label: 'STREET RACE — OCEAN SPRINT · 6 checkpoints',
  });
  G.missions.showMarker(null);   // the gold beacon would stack on CP1's ring
  const baseY = gy(-128, WORLD.oceanDrive);
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -157, baseY + 9.5, 181, -121, baseY + 0.8, 166.6);
    },
  };
}

// G14c — RESPECT (build 14, gallery only): the pause STATS tab with
// the RESPECT ledger — total, next level, the owned rack and both
// race bests on the record.
function respect(G) {
  G.renderer.toneMappingExposure = 1.16;
  placeFig(G.player.fig, -39.9, 94, Math.PI);
  G.player.facing = Math.PI;
  G.save.cash = 3200;
  G.save.cashEarned = 9650;
  G.save.jobsDone = 5;
  G.save.respect = 260;
  G.save.weapons = 7;
  G.save.raceBest1 = 34.2;
  G.save.raceBest2 = 128.5;
  G.save.shells = 9;
  G.save.carsSold = 3;
  G.save.copsEvaded = 4;
  document.getElementById('pause').classList.remove('hidden');
  if (G.pause) G.pause.selectTab('stats');
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -42.5, 2.8, 102, -50, 6.0, 38);
    },
  };
}

// G14d — RADIO (build 14, gallery only): rolling east on Ocean Drive
// with BAY FM on — the station toast hangs over the drive.
function radio(G) {
  G.renderer.toneMappingExposure = 1.17;
  const car = makeCar(0x2b50c8, { cls: 'sedan', kind: 'mission' });
  placeCar(car, -30, WORLD.oceanDrive, Math.PI / 2);
  car.speed = 12;
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.player.group.visible = false;
  G.save.cash = 480;
  G.save.radioStation = 1;
  G.hud.toast('♪ BAY FM — synthwave over the bay', 600000);
  G.missions.setObjectiveOverride({
    x: WORLD.pier.x, z: WORLD.pier.z1 - 4, letter: '',
    label: 'OCEAN DRIVE · BAY FM on the radio',
  });
  return {
    frame(dt) {
      const p = car.group.position;
      p.x += Math.sin(car.heading) * car.speed * dt;
      p.y = gy(p.x, p.z);
      spinWheels(car, dt);
      ambient(G, dt);
      setCam(G, p.x - 11, p.y + 4.4, p.z + 8.5, p.x + 12, p.y + 1.1, p.z - 2);
    },
  };
}

// G15a — ROADBLOCK (build 15, gallery only): three stars on avenue
// 60 — Rio's sedan faces the two cruisers the police threw across
// the road ahead of him, their officers standing clear.
function roadblock(G) {
  G.renderer.toneMappingExposure = 1.17;
  const car = makeCar(0x2e6db4, { cls: 'sedan', kind: 'mission' });
  placeCar(car, 60, 126, Math.PI);
  G.scene.add(car.group);
  G.cars.push(car);
  G.player.car = car;
  G.police.heat = 200;
  G.police.debugSpawnRoadblock({ x: 60, z: 126 }, Math.PI);
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: 60, z: 68, letter: '',
    label: 'WANTED ★★★ — roadblock ahead · ram it or run',
  });
  return {
    frame(dt) {
      seat(G.player.fig, car);
      ambient(G, dt);
      // From just behind the block (avenue-snapped to x 50, z 68),
      // looking back at Rio's car: the cruisers fill the foreground.
      setCam(G, 50, gy(50, 68) + 2.2, 57, 60, gy(60, 126) + 1.2, 120);
    },
  };
}

// G15b — HELI (build 15, gallery only): four stars at golden hour —
// the police helicopter holds its spotlight cone on Rio standing in
// the middle of Ocean Drive.
function heli(G) {
  G.renderer.toneMappingExposure = 1.15;
  G.time = 29280;   // the HUD clock reads 17:30 — the grade warms up
  placeFig(G.player.fig, -96, 150, Math.PI);
  G.player.facing = Math.PI;
  G.police.heat = 260;
  G.police.stageHeliAt(-96, 150, -96, 150);
  G.save.cash = 640;
  G.missions.setObjectiveOverride({
    x: -96, z: 150, letter: '',
    label: 'WANTED ★★★★ — air unit overhead · break the spotlight',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      // From the open west (beach) side so no hotel tower blocks the
      // sightline: the helicopter (staged at x -83, ~23 up, z 159)
      // shares the frame with its cone and Rio in the light pool.
      setCam(G, -112, gy(-96, 150) + 3.0, 168, -92, gy(-96, 150) + 12, 152);
    },
  };
}

// G15c — GARAGE (build 15, gallery only): the Comet on the Palmera
// Motors forecourt with the garage's first fitting on the pill.
function garage(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeCar(G.comet, 120, 152, Math.PI);
  G.player.car = G.comet;
  G.save.cash = 5000;
  G.hud.prompt('<b>[T]</b> PALMERA MOTORS — fit the Comet: ENGINE Lv 1 — <b>$600</b>');
  G.missions.setObjectiveOverride({
    x: 120, z: 148, letter: '',
    label: 'PALMERA MOTORS · The garage fits the Comet — engine, armour, nitro',
  });
  return {
    frame(dt) {
      seat(G.player.fig, G.comet);
      ambient(G, dt);
      setCam(G, 129, gy(120, 152) + 2.8, 163, 119, gy(120, 152) + 1.2, 147);
    },
  };
}

// G15d — EXPLOSION (build 15, gallery only): a sedan on Ocean Drive
// at the frozen moment it goes up — flash, ground ring, first fire.
function explosion(G) {
  G.renderer.toneMappingExposure = 1.17;
  const car = makeCar(0xc23b2e, { cls: 'sedan', kind: 'mission' });
  placeCar(car, -96, 132, Math.PI / 2);
  G.scene.add(car.group);
  G.cars.push(car);
  placeFig(G.player.fig, -90, 139, -2.2);
  G.player.facing = -2.2;
  G.wrecks.damageCar(car, 9999);
  G.missions.setObjectiveOverride({
    x: -96, z: 132, letter: '',
    label: 'OCEAN DRIVE · It went up — keep clear of the fire',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, -88, gy(-96, 132) + 2.4, 141, -96, gy(-96, 132) + 1.0, 132);
    },
  };
}

// G15e — SAFEHOUSE (build 15, gallery only): Rio at his apartment
// door in Palmera Heights, the Comet waiting on its marked pad.
function safehouse(G) {
  G.renderer.toneMappingExposure = 1.17;
  placeFig(G.player.fig, 180.8, 45, -Math.PI / 2);
  G.player.facing = -Math.PI / 2;
  G.hud.prompt('<b>[T]</b> PALMERA HEIGHTS — buy the apartment — <b>$5,000</b>');
  G.missions.setObjectiveOverride({
    x: 180, z: 45, letter: '',
    label: 'PALMERA HEIGHTS · A place of your own — rest, heal, lay low',
  });
  return {
    frame(dt) {
      ambient(G, dt);
      setCam(G, 187, gy(180.8, 45) + 2.2, 52, 178, gy(180.8, 45) + 1.2, 45);
    },
  };
}

export function stageShot(name, G) {
  if (name === 'roadblock') return roadblock(G);
  if (name === 'heli') return heli(G);
  if (name === 'garage') return garage(G);
  if (name === 'explosion') return explosion(G);
  if (name === 'safehouse') return safehouse(G);
  if (name === 'weapons') return weapons(G);
  if (name === 'race') return race(G);
  if (name === 'respect') return respect(G);
  if (name === 'radio') return radio(G);
  if (name === 'shells') return shells(G);
  if (name === 'sidejob') return sidejob(G);
  if (name === 'arms') return arms(G);
  if (name === 'boats') return boats(G);
  if (name === 'beach' || name === 'beach2') return beach(G);
  if (name === 'dialogue') return dialogue(G);
  if (name === 'city' || name === 'driving') return city(G);
  if (name === 'mission' || name === 'shootout') return mission(G);
  if (name === 'crowd') return crowd(G);
  if (name === 'downtown') return downtown(G);
  if (name === 'airport') return airport(G);
  if (name === 'wanted5') return wanted5(G);
  if (name === 'complete') return complete(G);
  if (name === 'takemission') return takemission(G);
  if (name === 'street') return street(G);
  if (name === 'queue') return queue(G);
  if (name === 'gulls') return gulls(G);
  if (name === 'plane') return plane(G);
  if (name === 'proportion') return proportion(G);
  if (name === 'airportfleet') return airportfleet(G);
  if (name === 'emergency') return emergency(G);
  if (name === 'moto') return moto(G);
  if (name === 'foodstreet') return foodstreet(G);
  if (name === 'motors') return motors(G);
  if (name === 'westshops') return westshops(G);
  if (name === 'hospital') return hospital(G);
  if (name === 'police') return police(G);
  if (name === 'firestation') return firestation(G);
  if (name === 'housing') return housing(G);
  if (name === 'kiosks') return kiosks(G);
  if (name === 'military') return military(G);
  if (name === 'garrison') return garrison(G);
  if (name === 'airport2') return airport2(G);
  if (name === 'characters') return characters(G);
  return chase(G);
}
