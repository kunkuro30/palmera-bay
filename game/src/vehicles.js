// Detailed low-poly cars and the traffic system. Bodies are sculpted from
// several angled boxes (sloped hood, cabin glass, bumpers, mirrors), wheels
// spin with speed, taxis get a roof sign, trucks a cargo box, police a light
// bar whose red/blue lamps the police system flashes. Traffic drives the
// avenue/street grid in marked lanes and queues at red lights.

import { WORLD, TUNING, groundHeight, heightAt, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { pick } from './random.js';

const THREE = window.THREE;

function mat(color, emissive = 0x000000) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, emissive });
}
function box(w, h, d, material, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  m.castShadow = true;
  return m;
}

const CAR_COLORS = [0xd42427, 0x1f8a8c, 0xf2f2f2, 0x2b50c8, 0xf28c28, 0x37b24d, 0x845ef7, 0x495057, 0xffd23e, 0x12b5a5];

/**
 * Build one car. cls: 'sedan' | 'sport' | 'taxi' | 'truck' | 'van' | 'police'.
 * The car faces +Z at heading 0. Returns { group, wheels, lights, speed, ... }.
 */
export function makeCar(color, opts = {}) {
  const cls = opts.cls || 'sedan';
  const g = new THREE.Group();
  const body = mat(color);
  const dark = mat(0x22242a);
  const glass = mat(0x9fd8e8, 0x1a3038);
  const chrome = mat(0xd8dde2);

  const isTruck = cls === 'truck';
  const isVan = cls === 'van';
  const L = isTruck ? 5.6 : 4.3;          // length
  const bodyY = isVan ? 0.95 : 0.62;

  if (isTruck) {
    g.add(box(1.9, 1.05, 1.7, body, 0, 0.85, 1.85));            // cab
    g.add(box(1.7, 0.55, 0.9, glass, 0, 1.12, 2.28));          // windshield
    g.add(box(2.0, 1.7, 3.4, mat(0xe8e4da), 0, 1.2, -0.85));    // cargo box
    g.add(box(2.02, 0.18, 3.42, dark, 0, 0.42, -0.85));
  } else if (isVan) {
    g.add(box(1.9, 1.35, L, body, 0, bodyY, 0));
    g.add(box(1.92, 0.5, 1.1, glass, 0, 1.28, 1.35));
    g.add(box(1.92, 0.42, 2.2, glass, 0, 1.24, -0.7));
  } else {
    // Sculpted sedan/sport body: floor pan, sloped hood, trunk deck.
    g.add(box(1.82, 0.5, L, body, 0, 0.58, 0));
    const hood = box(1.7, 0.3, 1.25, body, 0, 0.86, L / 2 - 0.72, -0.16);
    g.add(hood);
    g.add(box(1.7, 0.26, 0.95, body, 0, 0.84, -L / 2 + 0.55, 0.1));
    const cabinZ = cls === 'sport' ? -0.35 : -0.15;
    if (opts.openTop) {
      // Convertible: low glass all round, no roof — the driver shows.
      g.add(box(1.62, 0.34, 1.9, glass, 0, 0.98, cabinZ));
      g.add(box(1.66, 0.3, 0.24, body, 0, 0.92, cabinZ - 1.0));
    } else {
      g.add(box(1.62, 0.55, 1.9, glass, 0, 1.06, cabinZ));
      g.add(box(1.68, 0.1, 1.7, body, 0, 1.36, cabinZ));
    }
    g.add(box(0.16, 0.3, 0.5, body, -0.95, 0.95, cabinZ + 0.7));  // mirrors
    g.add(box(0.16, 0.3, 0.5, body, 0.95, 0.95, cabinZ + 0.7));
    if (cls === 'sport') g.add(box(1.7, 0.09, 0.42, dark, 0, 1.08, -L / 2 + 0.28)); // spoiler
  }
  g.add(box(1.86, 0.22, 0.24, dark, 0, 0.34, L / 2 + 0.02));   // bumpers
  g.add(box(1.86, 0.22, 0.24, dark, 0, 0.34, -L / 2 - 0.02));

  // Headlights and tail lights (emissive so they read at a glance).
  const hl = mat(0xfff6c9, 0x776a20);
  const tl = mat(0xff2d2d, 0x5c0606);
  g.add(box(0.34, 0.16, 0.06, hl, -0.58, 0.68, L / 2 + 0.13));
  g.add(box(0.34, 0.16, 0.06, hl, 0.58, 0.68, L / 2 + 0.13));
  g.add(box(0.34, 0.14, 0.06, tl, -0.58, 0.7, -L / 2 - 0.13));
  g.add(box(0.34, 0.14, 0.06, tl, 0.58, 0.7, -L / 2 - 0.13));

  let lights = null;
  if (cls === 'taxi') {
    if (opts.openTop) {
      // The cabrio taxi carries its sign on two posts over the windscreen.
      g.add(box(0.08, 0.34, 0.08, dark, -0.3, 1.32, 0.62));
      g.add(box(0.08, 0.34, 0.08, dark, 0.3, 1.32, 0.62));
      g.add(box(0.72, 0.24, 0.4, mat(0xfff3b0, 0x554a10), 0, 1.58, 0.62));
    } else {
      g.add(box(0.72, 0.24, 0.4, mat(0xfff3b0, 0x554a10), 0, 1.56, -0.15));
    }
    g.add(box(1.84, 0.2, L * 0.7, mat(0x22242a), 0, 0.42, 0));
  }
  if (cls === 'police') {
    g.add(box(1.84, 0.34, 1.1, mat(0x14161c), 0, 0.6, 0.75));
    g.add(box(1.84, 0.34, 1.1, mat(0x14161c), 0, 0.6, -1.15));
    const red = box(0.5, 0.16, 0.34, mat(0xff2222, 0xaa0000), -0.3, 1.5, -0.15);
    const blue = box(0.5, 0.16, 0.34, mat(0x2255ff, 0x0011aa), 0.3, 1.5, -0.15);
    g.add(box(1.1, 0.08, 0.4, dark, 0, 1.42, -0.15));
    g.add(red); g.add(blue);
    lights = { red, blue };
  }

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8);
  for (const [wx, wz] of [[-0.85, L / 2 - 0.85], [0.85, L / 2 - 0.85], [-0.85, -L / 2 + 0.85], [0.85, -L / 2 + 0.85]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, dark);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, chrome);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre); w.add(hub);
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }

  return {
    group: g, wheels, lights, cls, color,
    speed: 0, heading: 0, kind: opts.kind || 'traffic',
    radius: 2.1, driver: null,
  };
}

export function spinWheels(car, dt) {
  const s = (car.speed * dt) / 0.38;
  for (const w of car.wheels) w.rotation.x += s;
}

// ---- Traffic -------------------------------------------------------------
// Cars run straight along one avenue (NS) or street (EW), in the right-hand
// lane, and wrap around at the world edge. A shared light cycle alternates
// NS and EW green; a car brakes when the light ahead of it is not green.

export function lightPhase(time) {
  const c = time % 16;
  if (c < 6) return { ns: 'green', ew: 'red' };
  if (c < 7.5) return { ns: 'yellow', ew: 'red' };
  if (c < 13.5) return { ns: 'red', ew: 'green' };
  return { ns: 'red', ew: 'yellow' };
}

export function createTraffic(scene, rng, count) {
  const cars = [];
  const routes = [];
  // City routes only: avenues run the city span, streets the city width.
  for (const x of WORLD.avenues) {
    routes.push({ axis: 'z', at: x, dir: 1, min: 20, max: 194 });
    routes.push({ axis: 'z', at: x, dir: -1, min: 20, max: 194 });
  }
  for (const z of WORLD.streets.concat([WORLD.oceanDrive])) {
    routes.push({ axis: 'x', at: z, dir: 1, min: -164, max: 154 });
    routes.push({ axis: 'x', at: z, dir: -1, min: -164, max: 154 });
  }

  for (let i = 0; i < count; i++) {
    const route = routes[i % routes.length];
    const cls = pick(rng, ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
    const car = makeCar(pick(rng, CAR_COLORS), { cls: cls === 'sport' ? 'sport' : cls, kind: 'traffic' });
    car.route = route;
    car.along = route.min + ((i * 53) % (route.max - route.min));
    car.cruise = 9 + rng() * 5;
    placeTrafficCar(car);
    scene.add(car.group);
    cars.push(car);
  }

  function placeTrafficCar(car) {
    const { axis, at, dir } = car.route;
    const laneOff = WORLD.lane * (axis === 'z' ? (dir > 0 ? -1 : 1) : (dir > 0 ? 1 : -1));
    if (axis === 'z') {
      car.group.position.set(at + laneOff, groundHeight(at + laneOff, car.along), car.along);
      car.heading = dir > 0 ? 0 : Math.PI;
    } else {
      car.group.position.set(car.along, groundHeight(car.along, at + laneOff), at + laneOff);
      car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.group.rotation.y = car.heading;
  }

  // Distance to the next intersection ahead, or Infinity.
  function nextCrossing(car) {
    const { axis, dir } = car.route;
    const lines = axis === 'z' ? WORLD.streets.concat([WORLD.oceanDrive]) : WORLD.avenues;
    let best = Infinity;
    for (const line of lines) {
      const d = (line - car.along) * dir;
      if (d > 2 && d < best) best = d;
    }
    return best;
  }

  function update(dt, time) {
    const phase = lightPhase(time);
    for (const car of cars) {
      const axisGreen = car.route.axis === 'z' ? phase.ns === 'green' : phase.ew === 'green';
      const cross = nextCrossing(car);
      let target = car.cruise;
      if (!axisGreen && cross < 13) target = 0;
      // Keep a gap to the car ahead on the same route.
      for (const other of cars) {
        if (other === car || other.route !== car.route) continue;
        const gap = (other.along - car.along) * car.route.dir;
        if (gap > 0 && gap < 8) target = Math.min(target, other.speed);
      }
      const accel = target > car.speed ? 6 : 18;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt);
      car.along += car.speed * car.route.dir * dt;
      if (car.along > car.route.max + 6) car.along = car.route.min - 6;
      if (car.along < car.route.min - 6) car.along = car.route.max + 6;
      placeTrafficCar(car);
      spinWheels(car, dt);
    }
  }

  function remove(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  return { cars, update, remove };
}

// Simple arcade drive step shared by the player car and police cars:
// accelerate toward `drive` (-1..1), steer with `steer` (-1..1).
export function driveStep(car, dt, drive, steer) {
  const maxF = car.cls === 'sport' ? 30 : 24;
  const maxR = 9;
  if (drive > 0) car.speed += TUNING.carAccel * drive * dt;
  else if (drive < 0) car.speed -= (car.speed > 0.5 ? TUNING.carBrake : TUNING.carAccel * 0.7) * dt;
  car.speed -= car.speed * TUNING.carDrag * dt;
  car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
  if (Math.abs(car.speed) > 0.05) {
    car.heading += steer * dt * 1.9 * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 8);
  }
  car.group.position.x += Math.sin(car.heading) * car.speed * dt;
  car.group.position.z += Math.cos(car.heading) * car.speed * dt;
  car.group.position.y = groundHeight(car.group.position.x, car.group.position.z);
  car.group.rotation.y = car.heading;
  spinWheels(car, dt);
}

// ---- Highway traffic -------------------------------------------------------
// Cars that follow a polyline path over the terrain: a one-way stream
// around the coastal loop, and a two-way ping-pong on the north freeway.
// No lights out here — just steady cruising with simple spacing.

function makePath(pts, closed) {
  const list = closed ? pts.concat([pts[0]]) : pts.slice();
  const segs = [];
  let total = 0;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  function sample(s) {
    if (closed) s = ((s % total) + total) % total;
    else s = Math.max(0, Math.min(total, s));
    let seg = segs[segs.length - 1];
    for (const sg of segs) { if (s >= sg.start && s <= sg.start + sg.len) { seg = sg; break; } }
    const t = seg.len > 0 ? (s - seg.start) / seg.len : 0;
    const x = seg.a.x + (seg.b.x - seg.a.x) * t;
    const z = seg.a.z + (seg.b.z - seg.a.z) * t;
    return { x, z, heading: Math.atan2(seg.b.x - seg.a.x, seg.b.z - seg.a.z) };
  }
  return { sample, total };
}

export function createHighwayTraffic(scene, rng) {
  const cars = [];
  const loop = makePath(highwayLoopPoints(), true);
  const freeway = makePath(FREEWAY_PTS, false);
  const c = WORLD.city;

  function addCar(path, s, dir, speed) {
    const cls = pick(rng, ['sedan', 'sedan', 'sport', 'van', 'truck']);
    const car = makeCar(pick(rng, CAR_COLORS), { cls, kind: 'traffic' });
    car.path = path;
    car.s = s;
    car.dir = dir;
    car.speed = speed;
    car.cruise = speed;
    place(car);
    scene.add(car.group);
    cars.push(car);
    return car;
  }

  function place(car) {
    const p = car.path.sample(car.s);
    car.heading = car.dir > 0 ? p.heading : p.heading + Math.PI;
    let px = p.x, pz = p.z;
    if (car.path === freeway) {
      // Two-way road: each direction keeps to its own right-hand lane.
      px += -Math.cos(car.heading) * 2.4;
      pz += Math.sin(car.heading) * 2.4;
    }
    const inCity = px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1;
    car.group.position.set(px, inCity ? 0.65 : heightAt(px, pz) + 0.2, pz);
    car.group.rotation.y = car.heading;
  }

  for (let i = 0; i < 9; i++) addCar(loop, (loop.total / 9) * i, 1, 13 + rng() * 4);
  for (let i = 0; i < 4; i++) addCar(freeway, (freeway.total / 4) * i + 20, i % 2 ? -1 : 1, 16 + rng() * 4);

  function update(dt) {
    for (const car of cars) {
      car.s += car.speed * car.dir * dt;
      if (car.path === freeway) {
        if (car.s > freeway.total - 2) { car.s = freeway.total - 2; car.dir = -1; }
        if (car.s < 2) { car.s = 2; car.dir = 1; }
      }
      place(car);
      spinWheels(car, dt);
    }
  }

  return { cars, update };
}
