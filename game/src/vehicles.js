// vehicles.js — every car in Palmera Bay: the procedural car meshes, the
// arcade driving physics the player and the police share, the traffic that
// cruises the avenue grid, and the parked cars waiting to be stolen.

import { CAR, CITY } from './config.js';
import { makeRng, pick, range } from './random.js';
import { avenuePositions, collideCircle, COAST_ROAD_Z } from './world.js';

export const CAR_COLORS = [0xd64545, 0x3f7fbf, 0xe8b13a, 0x53a06a, 0xe6e2da, 0x7456a8, 0x30323c, 0xe07b39];

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14151a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

// One car mesh: a two-box body with a glass cabin, four wheels that steer and
// spin, and working-looking lights. Police cars get the livery and a light
// bar whose two halves the police module flashes.
export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f3f5 : color });
  const body = new THREE.Mesh(boxGeo, paint);
  body.scale.set(1.9, 0.62, 4.3);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(boxGeo, glassMat);
  cabin.scale.set(1.66, 0.55, 2.1);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x1d3fbf }));
    stripe.scale.set(1.94, 0.3, 4.34);
    stripe.position.y = 0.55;
    g.add(stripe);
    const barR = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    barR.scale.set(0.8, 0.16, 0.5); barR.position.set(-0.45, 1.55, -0.25);
    const barB = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2a5aff }));
    barB.scale.set(0.8, 0.16, 0.5); barB.position.set(0.45, 1.55, -0.25);
    g.add(barR); g.add(barB);
    g.userData.barR = barR; g.userData.barB = barB;
  }
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(boxGeo, lightMat);
    hl.scale.set(0.42, 0.16, 0.06); hl.position.set(s * 0.6, 0.72, 2.16);
    g.add(hl);
    const tl = new THREE.Mesh(boxGeo, tailMat);
    tl.scale.set(0.42, 0.14, 0.06); tl.position.set(s * 0.6, 0.74, -2.16);
    g.add(tl);
  }
  return g;
}

export function makeCar(scene, rng, opts) {
  const mesh = makeCarMesh(opts.color, opts.police);
  mesh.position.set(opts.x, 0, opts.z);
  mesh.rotation.y = opts.heading || 0;
  scene.add(mesh);
  return {
    mesh, police: !!opts.police, parked: !!opts.parked,
    heading: opts.heading || 0, speed: 0, steer: 0,
    vx: 0, vz: 0, health: 100, driver: opts.driver || null,
    route: null, targetSpeed: range(rng, 8.5, 12.5),
    get pos() { return mesh.position; },
  };
}

// Arcade car physics shared by the player and police AI: throttle along the
// nose, steering that bites with speed, and a strong lateral grip so the car
// goes where it points unless the handbrake is down. controls:
// { throttle: -1..1, steer: -1..1, brake: bool, handbrake: bool }
export function driveCar(car, controls, dt, world) {
  const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
  let fSpeed = car.vx * fwdX + car.vz * fwdZ;
  if (controls.throttle > 0) {
    fSpeed += CAR.accel * controls.throttle * dt * (fSpeed < 0 ? 2.2 : 1);
    if (controls.brake) fSpeed -= CAR.brake * dt;
  } else if (controls.throttle < 0) {
    if (fSpeed > 0.6) fSpeed -= CAR.brake * dt;             // brake first
    else fSpeed = Math.max(-CAR.maxReverse, fSpeed - CAR.reverseAccel * dt);
  } else {
    fSpeed -= fSpeed * 0.55 * dt;                            // engine drag
    if (controls.brake) fSpeed -= Math.sign(fSpeed) * CAR.brake * dt;
  }
  fSpeed = Math.min(CAR.maxSpeed, fSpeed);
  const steerTarget = controls.steer * CAR.turnRate * Math.min(1, Math.abs(fSpeed) / 7) * Math.sign(fSpeed || 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  if (Math.abs(fSpeed) > 0.05) car.heading += car.steer * dt * (controls.handbrake ? 1.5 : 1);
  const nfx = Math.sin(car.heading), nfz = Math.cos(car.heading);
  const latX = car.vx - nfx * fSpeed, latZ = car.vz - nfz * fSpeed;
  const grip = controls.handbrake ? 1.6 : CAR.grip;
  car.vx = nfx * fSpeed + latX * Math.max(0, 1 - grip * dt);
  car.vz = nfz * fSpeed + latZ * Math.max(0, 1 - grip * dt);
  car.pos.x += car.vx * dt;
  car.pos.z += car.vz * dt;
  const before = { x: car.pos.x, z: car.pos.z };
  collideCircle(world, car.pos, CAR.radius);
  if (Math.abs(car.pos.x - before.x) > 0.01 || Math.abs(car.pos.z - before.z) > 0.01) {
    car.vx *= 0.55; car.vz *= 0.55; // a wall scrubs speed
  }
  car.speed = fSpeed;
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  const spin = fSpeed * dt / 0.36;
  for (let i = 0; i < 4; i++) {
    const w = car.mesh.userData.wheels[i];
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = controls.steer * 0.42;
  }
  return Math.abs(fSpeed) * 3.6;
}

// --- traffic ---------------------------------------------------------------
// Traffic cars follow the avenue grid: straight down their lane, and at some
// intersections they turn onto the crossing avenue. Lanes are right-handed:
// you drive on the side of the road your direction points to.
export function createTraffic(scene, seed, world) {
  const rng = makeRng(seed ^ 0x7a17);
  const avenues = avenuePositions();
  const cars = [];
  function laneFor(axis, dir) { return dir > 0 ? 2.3 : -2.3; }
  function spawn() {
    const axis = rng() < 0.5 ? 'z' : 'x';
    const avenue = pick(rng, avenues);
    const dir = rng() < 0.5 ? 1 : -1;
    const along = range(rng, -CITY.half, CITY.half);
    const lane = laneFor(axis, dir);
    const car = makeCar(scene, rng, {
      color: pick(rng, CAR_COLORS),
      x: axis === 'z' ? avenue + lane : along,
      z: axis === 'z' ? along : avenue + lane,
      heading: axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      driver: 'traffic',
    });
    car.route = { axis, dir, avenue };
    cars.push(car);
    return car;
  }
  for (let i = 0; i < 14; i++) spawn();
  // parked cars on curbs and along the coast road, waiting to be stolen
  const parked = [];
  for (let i = 0; i < 12; i++) {
    const onCoast = i >= 8;
    const avenue = pick(rng, avenues);
    const side = rng() < 0.5 ? -1 : 1;
    const along = range(rng, -CITY.half + 16, CITY.half - 16);
    const car = makeCar(scene, rng, {
      color: pick(rng, CAR_COLORS),
      x: onCoast ? along : avenue + side * (CITY.roadWidth / 2 + 1.7),
      z: onCoast ? COAST_ROAD_Z + (side > 0 ? 4.4 : -4.4) : along,
      heading: onCoast ? Math.PI / 2 : 0,
      parked: true,
    });
    parked.push(car); cars.push(car);
  }
  // the marked sports car Marina wants back in mission 2: fast red, downtown
  const sports = makeCar(scene, rng, { color: 0xff2244, x: avenues[2] + 5.4, z: -40, heading: 0, parked: true });
  parked.push(sports); cars.push(sports);

  function update(dt, playerPos) {
    for (const car of cars) {
      if (car.parked || car.driver !== 'traffic') continue;
      const r = car.route;
      // slow for a car ahead in the same lane
      let want = car.targetSpeed;
      for (const other of cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 1.8) want = Math.min(want, Math.max(0, (ahead - 5)));
      }
      const throttle = car.speed < want ? 0.55 : -0.25;
      // at an intersection, sometimes turn onto the crossing avenue
      const crossCoord = r.axis === 'z' ? car.pos.z : car.pos.x;
      for (const a of avenues) {
        if (Math.abs(crossCoord - a) < 1.1 && rng() < 0.006) {
          const newDir = rng() < 0.5 ? 1 : -1;
          r.axis = r.axis === 'z' ? 'x' : 'z';
          r.dir = newDir;
          r.avenue = a;
          car.heading = r.axis === 'z' ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
          const lane = laneFor(r.axis, newDir);
          if (r.axis === 'z') car.pos.x = a + lane; else car.pos.z = a + lane;
          break;
        }
      }
      const targetHeading = r.axis === 'z' ? (r.dir > 0 ? 0 : Math.PI) : (r.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      driveCar(car, { throttle, steer: Math.max(-1, Math.min(1, dh * 1.6)), brake: false, handbrake: false }, dt, world);
      // keep traffic inside the world: turn around at the grid edge
      if (Math.abs(car.pos.x) > CITY.half + 4 || Math.abs(car.pos.z) > CITY.half + 4) {
        r.dir *= -1;
        car.heading += Math.PI;
      }
    }
  }
  return { cars, parked, sports, update };
}
