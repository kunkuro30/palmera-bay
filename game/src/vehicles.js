// vehicles.js — car models, one shared arcade driving model, and the bay's
// traffic: lane-following cars, parked cars waiting to be borrowed, and one
// red sports car with a date at a lockup.

import { CAR, CITY, AVENUES } from './config.js';
import { range, pick } from './random.js';

const GLASS = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.15, metalness: 0.6 });
const TYRE = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.9 });
const HUB = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: 0.4, metalness: 0.6 });

function makeWheel() {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 12), TYRE);
  tyre.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8), HUB);
  hub.rotation.z = Math.PI / 2;
  spin.add(tyre);
  spin.add(hub);
  pivot.add(spin);
  return { pivot, spin };
}

export function createCar(scene, color, { police = false } = {}) {
  const mesh = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: police ? 0xf2f3f5 : color, roughness: 0.45, metalness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.62, 4.3), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  mesh.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.55, 2.1), GLASS);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  mesh.add(cabin);

  const wheels = {};
  const wheelPos = { fl: [-0.88, 1.42], fr: [0.88, 1.42], rl: [-0.88, -1.42], rr: [0.88, -1.42] };
  for (const [name, [x, z]] of Object.entries(wheelPos)) {
    const w = makeWheel();
    w.pivot.position.set(x, 0.37, z);
    mesh.add(w.pivot);
    wheels[name] = w;
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  for (const sx of [-0.58, 0.58]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    head.position.set(sx, 0.78, 2.16);
    mesh.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tail.position.set(sx, 0.82, -2.16);
    mesh.add(tail);
  }

  if (police) {
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x2456c8, roughness: 0.5 });
    for (const sx of [-0.93, 0.93]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 3.6), stripeMat);
      stripe.position.set(sx, 0.62, 0);
      mesh.add(stripe);
    }
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.09, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x22242a }));
    barBase.position.set(0, 1.5, -0.25);
    mesh.add(barBase);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.17, 0.44),
      new THREE.MeshBasicMaterial({ color: 0xff2d20 }));
    barR.position.set(-0.33, 1.6, -0.25);
    mesh.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.17, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x2d6bff }));
    barB.position.set(0.33, 1.6, -0.25);
    mesh.add(barB);
    mesh.userData.barR = barR;
    mesh.userData.barB = barB;
  }

  scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading: 0,
    vel: { x: 0, z: 0 },
    speed: 0,
    steerVis: 0,
    spin: 0,
    police,
    parked: false,
    driver: null,
    wheels,
  };
}

export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// the steering input that turns a car toward a point on the ground
export function steerToward(car, tx, tz, gain = 1.35) {
  const want = Math.atan2(tx - car.pos.x, tz - car.pos.z);
  const diff = angleDiff(want, car.heading);
  return Math.max(-1, Math.min(1, -diff * gain));
}

// One arcade driving model for everyone: traffic, police and the player.
// input.steer > 0 turns right; grip kills sideways slide; buildings scrub speed.
export function driveCar(car, input, dt, world) {
  const f = forwardOf(car.heading);
  let fSpeed = car.vel.x * f.x + car.vel.z * f.z;
  let lx = car.vel.x - f.x * fSpeed;
  let lz = car.vel.z - f.z * fSpeed;
  const gripKeep = Math.max(0, 1 - CAR.grip * dt * (input.handbrake ? 0.3 : 1));
  lx *= gripKeep;
  lz *= gripKeep;

  if (input.throttle > 0) {
    fSpeed += CAR.accel * input.throttle * dt * (1 - Math.max(0, fSpeed) / (CAR.maxSpeed * 1.3));
  } else if (input.throttle < 0) {
    if (fSpeed > 0.5) fSpeed -= CAR.brakeDecel * dt;
    else fSpeed = Math.max(fSpeed + CAR.accel * 0.62 * input.throttle * dt, -CAR.maxReverse);
  }
  if (input.brake) {
    fSpeed -= Math.sign(fSpeed) * Math.min(Math.abs(fSpeed), CAR.brakeDecel * dt);
  }
  fSpeed -= fSpeed * 0.32 * dt;
  if (input.handbrake) fSpeed -= fSpeed * 1.5 * dt;
  fSpeed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, fSpeed));

  const authority = Math.max(-1.25, Math.min(1.25, fSpeed / 7));
  car.heading -= input.steer * 1.7 * authority * dt;

  const nf = forwardOf(car.heading);
  car.vel.x = nf.x * fSpeed + lx;
  car.vel.z = nf.z * fSpeed + lz;
  car.pos.x += car.vel.x * dt;
  car.pos.z += car.vel.z * dt;
  car.pos.x = Math.max(-268, Math.min(268, car.pos.x));
  car.pos.z = Math.max(-196, Math.min(305, car.pos.z));

  let hit = false;
  if (world && world.collideCircle(car.pos, CAR.radius)) {
    car.vel.x *= 0.3;
    car.vel.z *= 0.3;
    fSpeed *= 0.3;
    hit = true;
  }
  car.speed = fSpeed;

  car.mesh.rotation.y = car.heading;
  car.spin += (fSpeed * dt) / 0.37;
  for (const w of Object.values(car.wheels)) w.spin.rotation.x = car.spin;
  car.steerVis += ((input.steer * 0.42) - car.steerVis) * Math.min(1, dt * 9);
  car.wheels.fl.pivot.rotation.y = car.steerVis;
  car.wheels.fr.pivot.rotation.y = car.steerVis;
  return hit;
}

const TRAFFIC_COLORS = [0x3f6fb5, 0xb5b8bd, 0x707880, 0x8f2f35, 0x2f7d5a, 0xd9a441, 0x5a4a8a, 0xc0c6cc, 0x37414f, 0x7a4a2f];

export function createTraffic(scene, rng, world) {
  const cars = [];
  const moving = [];

  function laneFor(axis, line, dir) {
    // right-hand traffic: the lane sits on the driver's right
    if (axis === 'z') return { x: line + (dir > 0 ? -2.2 : 2.2), heading: dir > 0 ? 0 : Math.PI };
    return { z: line + (dir > 0 ? 2.2 : -2.2), heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }

  function setRoute(car, axis, line, dir, along) {
    car.route = { axis, line, dir };
    const lane = laneFor(axis, line, dir);
    car.heading = lane.heading;
    if (axis === 'z') {
      car.pos.set(lane.x, 0, along);
      car.wp = { x: lane.x, z: dir * 186 };
    } else {
      car.pos.set(along, 0, lane.z);
      car.wp = { x: dir * 186, z: lane.z };
    }
    car.vel.x = 0;
    car.vel.z = 0;
  }

  for (let i = 0; i < 14; i++) {
    const car = createCar(scene, pick(rng, TRAFFIC_COLORS));
    car.driver = 'traffic';
    car.cruise = range(rng, 8.5, 12.5);
    const axis = rng() < 0.6 ? 'z' : 'x';
    const line = rng() < 0.18 ? CITY.coastZ : pick(rng, AVENUES);
    if (line === CITY.coastZ) setRoute(car, 'x', line, rng() < 0.5 ? 1 : -1, range(rng, -170, 170));
    else setRoute(car, axis, line, rng() < 0.5 ? 1 : -1, range(rng, -170, 170));
    cars.push(car);
    moving.push(car);
  }

  const parked = [];
  for (let i = 0; i < 12; i++) {
    const car = createCar(scene, pick(rng, TRAFFIC_COLORS));
    const a = pick(rng, AVENUES);
    const side = rng() < 0.5 ? -1 : 1;
    car.pos.set(a + side * (CITY.roadWidth / 2 + 1.7), 0, range(rng, -168, 168));
    car.heading = side > 0 ? Math.PI : 0;
    car.mesh.rotation.y = car.heading;
    car.parked = true;
    cars.push(car);
    parked.push(car);
  }

  const sports = createCar(scene, 0xd8232a);
  sports.pos.set(53 + CITY.roadWidth / 2 + 1.7, 0, -40);
  sports.heading = Math.PI;
  sports.mesh.rotation.y = sports.heading;
  sports.parked = true;
  sports.isSports = true;
  cars.push(sports);
  parked.push(sports);

  function nearestAvenue(v) {
    let best = AVENUES[0];
    for (const a of AVENUES) if (Math.abs(a - v) < Math.abs(best - v)) best = a;
    return best;
  }

  function update(dt) {
    for (const car of moving) {
      if (car.driver !== 'traffic') continue;
      const r = car.route;
      const along = r.axis === 'z' ? car.pos.z : car.pos.x;
      const toEnd = (r.dir * 186 - along) * r.dir;
      // maybe turn at the cross street we are passing
      const crossCoord = r.axis === 'z' ? car.pos.z : car.pos.x;
      const crossLine = r.axis === 'z' ? nearestAvenue(crossCoord) : nearestAvenue(crossCoord);
      const nearCross = Math.abs(crossCoord - crossLine) < 3.4;
      if ((toEnd < 7 || (nearCross && rng() < 0.006)) && !car.turning) {
        const newAxis = r.axis === 'z' ? 'x' : 'z';
        const newLine = r.axis === 'z' ? crossLine : crossLine;
        const newDir = rng() < 0.5 ? 1 : -1;
        const lane = laneFor(newAxis, newLine, newDir);
        car.turning = true;
        car.route = { axis: newAxis, line: newLine, dir: newDir };
        if (newAxis === 'z') car.wp = { x: lane.x, z: car.pos.z + newDir * 26 };
        else car.wp = { x: car.pos.x + newDir * 26, z: lane.z };
        car.turnTarget = newDir * 186;
      }
      if (car.turning) {
        const d = Math.hypot(car.wp.x - car.pos.x, car.wp.z - car.pos.z);
        if (d < 8) {
          car.turning = false;
          const lane = laneFor(car.route.axis, car.route.line, car.route.dir);
          if (car.route.axis === 'z') car.wp = { x: lane.x, z: car.turnTarget };
          else car.wp = { x: car.turnTarget, z: lane.z };
        }
      }
      // slow for the car ahead in the same lane
      let desired = car.cruise;
      for (const other of moving) {
        if (other === car || other.driver !== 'traffic') continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const f = forwardOf(car.heading);
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * -f.z + dz * f.x);
        if (ahead > 0 && ahead < 10 && side < 2.4) {
          desired = ahead < 5 ? 0 : Math.min(desired, Math.abs(other.speed) * 0.9);
        }
      }
      const throttle = car.speed < desired - 0.4 ? 0.8 : car.speed > desired + 0.6 ? -0.5 : 0.12;
      driveCar(car, { throttle, steer: steerToward(car, car.wp.x, car.wp.z), brake: false, handbrake: false }, dt, world);
    }
  }

  return { cars, parked, sports, update };
}
