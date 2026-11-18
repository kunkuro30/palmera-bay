// Cars: a low-poly factory (body, cabin, wheels, lights; a lightbar for police) plus the
// ambient traffic system — lane driving on the grid with turns at intersections, stopping
// for obstacles — and the parked cars that line the curbs. Cars the player can take are
// registered in G.cars; traffic cars join that list until the player grabs one.
import { AVENUES, CAR_CLASSES, COAST_Z, KEEP_CLEAR, PARKED_COUNT, TRAFFIC_COUNT } from './config.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0a51e, 0xd8d8d8, 0x30343a, 0x3fae6a, 0xe86a17, 0x8e44ad, 0xf2f2f2, 0x1f8a8c];
const bodyGeo = new THREE.BoxGeometry(1.9, 0.62, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.66, 0.55, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const lightGeo = new THREE.BoxGeometry(0.36, 0.15, 0.06);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xd42a20 });

let nextCarId = 1;

/** Build one car. opts: { police, cls }. The group faces +z; heading 0 drives toward +z. */
export function makeCar(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: opts.police ? 0xf4f4f4 : color });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.58;
  if (opts.cls === 'sport') body.scale.set(1.06, 0.82, 1.03);
  const cabin = new THREE.Mesh(cabinGeo, opts.police ? tireMat : glassMat);
  cabin.position.set(0, 1.12, -0.25);
  group.add(body, cabin);
  const wheels = [];
  for (const [x, z] of [[-0.88, 1.45], [0.88, 1.45], [-0.88, -1.45], [0.88, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(x, 0.37, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(sx, 0.66, 2.21);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(sx, 0.66, -2.21);
    group.add(head, tail);
  }
  let lights = null;
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.5), tireMat);
    bar.position.set(0, 1.47, -0.25);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.44), new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
    red.position.set(-0.37, 1.5, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.44), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.37, 1.5, -0.25);
    group.add(bar, red, blue);
    lights = { red, blue };
  }
  return {
    id: nextCarId++, group, wheels, lights,
    cls: opts.cls || 'sedan', kind: opts.kind || 'parked',
    speed: 0, heading: 0, radius: 2.3, mission: null, cruise: 0.65,
    axis: 'z', at: 0, dir: 1, along: 0, turnCool: 0, phase: Math.random() * 6,
  };
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

function laneCoord(car) {
  // Right-hand traffic: the lateral offset flips with the direction of travel.
  if (car.axis === 'z') return car.at + (car.dir > 0 ? -3 : 3);
  return car.at + (car.dir > 0 ? 3 : -3);
}

function placeOnRoad(car) {
  const lane = laneCoord(car);
  if (car.axis === 'z') car.group.position.set(lane, 0, car.along);
  else car.group.position.set(car.along, 0, lane);
  car.heading = car.axis === 'z' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.group.rotation.y = car.heading;
}

function randomRoad(rng) {
  const r = rng();
  if (r < 0.45) return { axis: 'z', at: pick(rng, AVENUES) };
  if (r < 0.9) return { axis: 'x', at: pick(rng, AVENUES) };
  return { axis: 'x', at: COAST_Z };
}

function spawnTraffic(rng, car, nearPos, minDist, maxDist) {
  const road = randomRoad(rng);
  car.axis = road.axis;
  car.at = road.at;
  car.dir = rng() < 0.5 ? 1 : -1;
  if (nearPos) {
    const alongBase = road.axis === 'z' ? nearPos.z : nearPos.x;
    const away = alongBase + car.dir * range(rng, minDist, maxDist);
    car.along = Math.max(-200, Math.min(200, away));
  } else {
    car.along = range(rng, -200, 200);
  }
  car.cruise = range(rng, 0.5, 0.78);
  car.speed = CAR_CLASSES[car.cls].max * car.cruise * 0.6;
  placeOnRoad(car);
}

export function createVehicles(scene, rng, G) {
  const cars = [];
  G.cars = cars;

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const car = makeCar(pick(rng, CAR_COLORS), { cls: rng() < 0.25 ? 'coupe' : 'sedan', kind: 'traffic' });
    spawnTraffic(rng, car, null, 0, 0);
    if (car.group.position.distanceTo(new THREE.Vector3(2.8, 0, 118)) < 16) car.along += 40;
    placeOnRoad(car);
    scene.add(car.group);
    cars.push(car);
  }

  let parked = 0;
  let guard = 0;
  while (parked < PARKED_COUNT && guard < 300) {
    guard += 1;
    const road = randomRoad(rng);
    const side = rng() < 0.5 ? -1 : 1;
    const along = range(rng, -200, 200);
    const lateral = road.at + side * (7 + 1.7);
    const x = road.axis === 'z' ? lateral : along;
    const z = road.axis === 'z' ? along : lateral;
    if (KEEP_CLEAR.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
    if (Math.hypot(2.8 - x, 118 - z) < 11) continue;
    const car = makeCar(pick(rng, CAR_COLORS), { cls: pick(rng, ['sedan', 'sedan', 'coupe', 'sport']), kind: 'parked' });
    car.group.position.set(x, 0, z);
    car.heading = road.axis === 'z' ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.group.rotation.y = car.heading;
    scene.add(car.group);
    cars.push(car);
    parked += 1;
  }

  function obstacleAhead(car, dt) {
    const f = carForward(car);
    const px = car.group.position.x + f.x * 7;
    const pz = car.group.position.z + f.z * 7;
    const check = (ox, oz) => {
      const dx = ox - car.group.position.x;
      const dz = oz - car.group.position.z;
      const ahead = dx * f.x + dz * f.z;
      const lateral = Math.abs(dx * f.z - dz * f.x);
      return ahead > 0 && ahead < 9.5 && lateral < 1.9 ? ahead : Infinity;
    };
    let nearest = check(G.player.pos().x, G.player.pos().z);
    for (const other of cars) {
      if (other === car) continue;
      const d = check(other.group.position.x, other.group.position.z);
      if (d < nearest) nearest = d;
    }
    for (const unit of G.police.units) {
      if (unit.dead) continue;
      const d = check(unit.car.group.position.x, unit.car.group.position.z);
      if (d < nearest) nearest = d;
    }
    return nearest;
  }

  return {
    cars,
    update(dt) {
      for (const car of cars) {
        if (car.kind !== 'traffic') continue;
        const spec = CAR_CLASSES[car.cls];
        let want = spec.max * car.cruise;
        const ahead = obstacleAhead(car, dt);
        if (ahead < 9.5) want = ahead < 5 ? 0 : want * ((ahead - 4.5) / 5);
        car.speed += Math.max(-16 * dt, Math.min(8 * dt, want - car.speed));
        const prevAlong = car.along;
        car.along += car.dir * car.speed * dt;
        // Turning at intersections: when the along coordinate passes a crossing road.
        car.turnCool -= dt;
        const crossings = AVENUES;
        for (const c of crossings) {
          const crossed = (prevAlong - c) * (car.along - c) < 0 && Math.abs(car.along - c) < 3;
          if (crossed && car.turnCool <= 0 && rng() < 0.35) {
            const oldAxis = car.axis;
            car.axis = oldAxis === 'z' ? 'x' : 'z';
            car.at = c;
            car.dir = rng() < 0.5 ? 1 : -1;
            car.along = oldAxis === 'z' ? car.group.position.x : car.group.position.z;
            car.turnCool = 2.5;
            break;
          }
        }
        if (car.along > 205 || car.along < -205) car.dir = -car.dir;
        placeOnRoad(car);
        const spin = (car.speed * dt) / 0.37;
        for (const w of car.wheels) w.rotation.x += spin;
        // Respawn far traffic near the player so the city always feels alive around them.
        const p = G.player.pos();
        if (Math.hypot(car.group.position.x - p.x, car.group.position.z - p.z) > 150) {
          spawnTraffic(rng, car, p, 105, 135);
        }
      }
    },
  };
}
