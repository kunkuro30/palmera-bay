// GO RIO RIO · police.js — wanted heat, patrols, pursuit steering and escalation.
// Police: wanted heat, patrol cruisers that become pursuers, and officers
// on foot for close scenes. Heat rises with crime and falls while unseen;
// stars follow heat. Pursuit is simple steering toward the player's
// position with a speed that grows with the star count, and light bars
// flash whenever a unit is active.
//
// BUILD 15 — escalation, the two systems the top-10 comparison found
// only as title claims elsewhere: at 3+ stars a ROADBLOCK snaps shut
// ahead of a driving player (two cruisers angled across the lane, two
// officers who dive aside as he comes through — the cars are physical
// and can be rammed), and at 4+ stars a HELICOPTER joins with a real
// spotlight: the beam tracks where Rio WAS 0.8 s ago, and while he is
// inside it the heat cannot cool and another cruiser joins the hunt.

import { TUNING, WORLD, groundHeight } from './config.js';
import { makeCar, driveStep } from './vehicles.js';
import { makeFigure, poseFigure } from './characters.js';
import { angDiff, clamp } from './random.js';

const THREE = window.THREE;

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
}
function pbox(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// The police helicopter, in the garrison heli's modelling language
// (capsule body, glass cockpit, boom, skids, spinning rotors) but in
// white-and-blue patrol livery, carrying a searchlight under the nose.
function makePoliceHeli() {
  const g = new THREE.Group();
  const white = lam(0xf2f5f7), blue = lam(0x1d4fd0), dark = lam(0x23272e), glass = lam(0x22303c);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 2.1, 6, 12), white);
  body.rotation.x = Math.PI / 2;
  body.scale.set(0.92, 1, 0.95);
  body.position.y = 1.55;
  g.add(body);
  g.add(pbox(1.6, 0.5, 2.6, blue, 0, 1.28, -0.2));                    // livery band
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), glass);
  cockpit.scale.set(0.88, 0.78, 0.95);
  cockpit.position.set(0, 1.66, 1.05);
  g.add(cockpit);
  g.add(pbox(1.05, 0.45, 1.7, dark, 0, 2.32, -0.3));
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.30, 3.8, 10), white);
  boom.rotation.x = -Math.PI / 2;
  boom.position.set(0, 1.8, -2.85);
  g.add(boom);
  g.add(pbox(0.12, 0.95, 0.65, blue, 0, 2.3, -4.6));
  g.add(pbox(1.3, 0.08, 0.4, blue, 0, 1.95, -4.4));
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.14, 2.3, -4.6);
  tailRotor.add(pbox(0.05, 0.9, 0.14, dark, 0, 0, 0));
  tailRotor.add(pbox(0.05, 0.14, 0.9, dark, 0, 0, 0));
  g.add(tailRotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), dark);
  mast.position.set(0, 2.58, 0.1);
  g.add(mast);
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.82, 0.1);
  rotor.add(pbox(7.4, 0.05, 0.4, lam(0x2c2f26), 0, 0, 0));
  rotor.add(pbox(0.4, 0.05, 7.4, lam(0x2c2f26), 0, 0, 0));
  g.add(rotor);
  const skidGeo = new THREE.CylinderGeometry(0.055, 0.055, 3.1, 8);
  for (const sx of [-0.82, 0.82]) {
    const skid = new THREE.Mesh(skidGeo, dark);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, 0.22, 0);
    g.add(skid);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group: g, rotor, tailRotor };
}

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

  // ---- BUILD 15: the roadblock ---------------------------------------
  let block = null;          // { cars, officers:[{off,home}], x, z }
  let blockTimer = 5;

  function spawnRoadblockAt(cx, cz, axis) {
    clearRoadblock();
    const cars = [];
    const offs = [];
    const spots = axis === 'z'
      ? [{ x: cx - 2.3, z: cz, h: Math.PI / 2 + 0.5 }, { x: cx + 2.3, z: cz, h: Math.PI / 2 - 0.5 }]
      : [{ x: cx, z: cz - 2.3, h: 0.5 }, { x: cx, z: cz + 2.3, h: -0.5 }];
    for (const s of spots) {
      const car = makeCar(0xf2f2f2, { cls: 'police', kind: 'police' });
      car.blockCar = true;
      car.group.position.set(s.x, groundHeight(s.x, s.z), s.z);
      car.heading = s.h;
      car.group.rotation.y = s.h;
      scene.add(car.group);
      cars.push(car);
    }
    const oSpots = axis === 'z'
      ? [{ x: cx - 4.8, z: cz + 1.6 }, { x: cx + 4.8, z: cz - 1.6 }]
      : [{ x: cx + 1.6, z: cz - 4.8 }, { x: cx - 1.6, z: cz + 4.8 }];
    for (const s of oSpots) {
      const off = spawnOfficer(s.x, s.z, null);
      offs.push({ off, home: { x: s.x, z: s.z } });
    }
    block = { cars, officers: offs, x: cx, z: cz };
    return block;
  }

  function clearRoadblock() {
    if (!block) return;
    for (const car of block.cars) scene.remove(car.group);
    for (const { off } of block.officers) {
      scene.remove(off.fig.group);
      const i = officers.indexOf(off);
      if (i >= 0) officers.splice(i, 1);
    }
    block = null;
  }

  // Place a block 58 m ahead of the player, snapped onto his road:
  // avenues run north–south (the block lies across x), streets and
  // Ocean Drive run east–west (across z). Off-grid, the player's own
  // heading decides the axis.
  function spawnRoadblockAhead(playerPos, heading) {
    const ax = playerPos.x + Math.sin(heading) * 58;
    const az = playerPos.z + Math.cos(heading) * 58;
    for (const av of WORLD.avenues) {
      if (Math.abs(ax - av) <= 13) return spawnRoadblockAt(av, az, 'z');
    }
    for (const st of WORLD.streets.concat([WORLD.oceanDrive])) {
      if (Math.abs(az - st) <= 13) return spawnRoadblockAt(ax, st, 'x');
    }
    return spawnRoadblockAt(ax, az, Math.abs(Math.sin(heading)) > Math.abs(Math.cos(heading)) ? 'x' : 'z');
  }

  // ---- BUILD 15: the helicopter ----------------------------------------
  const heliParts = makePoliceHeli();
  const heliGroup = heliParts.group;
  heliGroup.visible = false;
  scene.add(heliGroup);
  const beamTarget = new THREE.Object3D();
  scene.add(beamTarget);
  const spot = new THREE.SpotLight(0xfff3cf, 2.6, 130, 0.40, 0.55, 0);
  spot.position.set(0, 0.6, 0.8);
  heliGroup.add(spot);
  spot.target = beamTarget;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 6.4, 1, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.visible = false;
  scene.add(cone);
  const heli = {
    group: heliGroup, spot, cone, active: false, exposed: false,
    ang: 0, beam: { x: 0, z: 0 }, history: [],
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpV = new THREE.Vector3();

  function aimBeam() {
    const hp = heliGroup.position;
    const bx = heli.beam.x, bz = heli.beam.z;
    const by = groundHeight(bx, bz);
    beamTarget.position.set(bx, by, bz);
    // The cone runs from the lamp to the lit circle: narrow end up.
    tmpV.set(hp.x - bx, hp.y + 0.4 - by, hp.z - bz);
    const len = tmpV.length();
    cone.position.set((hp.x + bx) / 2, (hp.y + 0.4 + by) / 2, (hp.z + bz) / 2);
    cone.scale.set(1, len, 1);
    cone.quaternion.setFromUnitVectors(UP, tmpV.normalize());
    cone.visible = heli.active;
  }

  function updateHeli(dt, playerPos) {
    if (stars >= 4 && !heli.active) {
      heli.active = true;
      heliGroup.visible = true;
      heli.ang = rng() * Math.PI * 2;
      heliGroup.position.set(playerPos.x + 20, groundHeight(playerPos.x, playerPos.z) + 30, playerPos.z);
      heli.beam.x = playerPos.x;
      heli.beam.z = playerPos.z;
      heli.history.length = 0;
    }
    if (!heli.active) { heli.exposed = false; return; }
    if (stars < 4) {
      // Called off: climb away and vanish.
      heliGroup.position.y += dt * 22;
      heli.exposed = false;
      cone.visible = false;
      if (heliGroup.position.y > groundHeight(playerPos.x, playerPos.z) + 70) {
        heli.active = false;
        heliGroup.visible = false;
      }
      return;
    }
    heli.ang += dt * 0.30;
    const gy = groundHeight(playerPos.x, playerPos.z);
    tmpV.set(playerPos.x + Math.cos(heli.ang) * 16, gy + 24, playerPos.z + Math.sin(heli.ang) * 16);
    heliGroup.position.lerp(tmpV, Math.min(1, dt * 1.7));
    heliGroup.lookAt(playerPos.x, heliGroup.position.y - 6, playerPos.z);
    heliParts.rotor.rotation.y += dt * 30;
    heliParts.tailRotor.rotation.x += dt * 40;
    // The beam remembers where Rio stood 0.8 s ago — keep moving and
    // it slides off; stand in it and the heat cannot cool.
    heli.history.push({ t: performance.now() / 1000, x: playerPos.x, z: playerPos.z });
    const cutoff = performance.now() / 1000 - 0.8;
    while (heli.history.length > 2 && heli.history[1].t <= cutoff) heli.history.shift();
    const past = heli.history[0];
    if (past) { heli.beam.x = past.x; heli.beam.z = past.z; }
    heli.exposed = Math.hypot(playerPos.x - heli.beam.x, playerPos.z - heli.beam.z) < 6.5;
    aimBeam();
  }

  // Gallery staging: freeze the heli over a point, beam lit on it.
  function stageHeliAt(x, z, beamX, beamZ) {
    heli.active = true;
    heliGroup.visible = true;
    heliGroup.position.set(x + 13, groundHeight(x, z) + 23, z + 9);
    heliGroup.lookAt(beamX, groundHeight(beamX, beamZ), beamZ);
    heliParts.rotor.rotation.y = 2.2;
    heli.beam.x = beamX;
    heli.beam.z = beamZ;
    heli.exposed = true;
    aimBeam();
  }

  function update(dt, time, playerPos, playerInCar, playerHeading = 0) {
    stars = Math.floor(heat / TUNING.starHeat);
    seen = false;
    updateHeli(dt, playerPos);
    const heliSeen = heli.active && heli.exposed;
    const wantUnits = desiredUnits() + (heliSeen ? 1 : 0);
    // Spawn or retire cruisers to match the wanted level.
    while (units.length < wantUnits) {
      const a = rng() * Math.PI * 2;
      const d = 55 + rng() * 25;
      const x = clamp(playerPos.x + Math.cos(a) * d, -WORLD.extent, WORLD.extent);
      const z = clamp(playerPos.z + Math.sin(a) * d, -WORLD.extent, WORLD.extent);
      spawnUnitAt(x, z, a);
    }
    while (units.length > wantUnits) {
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
      const drive = dist > 6.4 ? 1 : 0.2;
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
      unit.touching = dist < 4.9;
    }
    // ---- the roadblock ----
    if (block) {
      const dx = block.x - playerPos.x, dz = block.z - playerPos.z;
      const distB = Math.hypot(dx, dz);
      const behind = (Math.sin(playerHeading) * dx + Math.cos(playerHeading) * dz) < 0;
      if (stars < 3 || distB > 150 || (behind && distB > 45)) {
        clearRoadblock();
        blockTimer = 6 + rng() * 4;
      }
    }
    if (!block && stars >= 3 && playerInCar) {
      blockTimer -= dt;
      if (blockTimer <= 0) {
        spawnRoadblockAhead(playerPos, playerHeading);
        blockTimer = 7;
      }
    } else if (stars < 3) {
      blockTimer = Math.min(blockTimer, 2.5);
    }
    if (block) {
      for (let i = 0; i < block.cars.length; i++) {
        const car = block.cars[i];
        if (car.lights) {
          const on = Math.sin(time * 10 + i * 2.1) > 0;
          car.lights.red.visible = on;
          car.lights.blue.visible = !on;
        }
        if (car.shove) {
          const s = car.shove;
          car.group.position.x += s.x * s.power * dt;
          car.group.position.z += s.z * s.power * dt;
          car.group.position.y = groundHeight(car.group.position.x, car.group.position.z);
          s.power *= Math.pow(0.12, dt);
          if (s.power < 0.4) car.shove = null;
        }
      }
      // Officers dive clear of a car coming through, then step back.
      for (const { off, home } of block.officers) {
        const fp = off.fig.group.position;
        let tx = home.x, tz = home.z;
        if (playerInCar) {
          const d = Math.hypot(fp.x - playerPos.x, fp.z - playerPos.z);
          if (d < 7.5) {
            const inv = 1 / Math.max(d, 0.6);
            tx = home.x + (fp.x - playerPos.x) * inv * 2.6;
            tz = home.z + (fp.z - playerPos.z) * inv * 2.6;
          }
        }
        fp.x += (tx - fp.x) * Math.min(1, dt * 7);
        fp.z += (tz - fp.z) * Math.min(1, dt * 7);
        fp.y = groundHeight(fp.x, fp.z);
        off.fig.baseY = fp.y;
      }
    }
    for (const off of officers) poseFigure(off.fig, time, 0);
    if (seen || heliSeen) heat = clamp(heat + TUNING.heatSeen * dt * 4, 0, TUNING.starHeat * 5);
    else heat = Math.max(0, heat - TUNING.heatDecay * dt);
    stars = Math.floor(heat / TUNING.starHeat);
  }

  return {
    units, officers, spawnUnitAt, spawnOfficer, setOfficerOut, addHeat, update,
    heli,
    stageHeliAt,
    debugSpawnRoadblock(playerPos, heading) { return spawnRoadblockAhead(playerPos, heading || 0); },
    debugClearRoadblock() { clearRoadblock(); },
    get roadblock() {
      return block ? { x: block.x, z: block.z, cars: block.cars, officers: block.officers.map((o) => o.off) } : null;
    },
    get heat() { return heat; },
    set heat(v) { heat = clamp(v, 0, TUNING.starHeat * 5); },
    get stars() { return Math.floor(heat / TUNING.starHeat); },
    set stars(v) { heat = v * TUNING.starHeat + 1; },
    get seen() { return seen; },
    set seen(v) { seen = v; },
  };
}
