// GO RIO RIO · vehicles.js — the smooth-design car builder and the traffic system.
// Smooth-design cars (build 8) and the traffic system. Bodies are single
// rounded capsule loaves with glass canopies (see the design note above
// makeCar), wheels spin with speed, taxis get a roof sign, trucks a cargo
// box, police a light bar whose red/blue lamps the police system flashes.
// Traffic drives the avenue/street grid in marked lanes and queues at
// red lights.

import { WORLD, TUNING, groundHeight, heightAt, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { pick } from './random.js';
import { buildFleetVehicle } from './fleet.js';

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

const CAR_COLORS = [0xd42427, 0x1f8a8c, 0xf2f2f2, 0x2b50c8, 0xf28c28, 0x37b24d, 0x845ef7, 0x495057, 0xffd23e, 0x12b5a5, 0xff8fb8, 0xf5e6c8, 0x073b4c, 0x90be6d];

// BUILD 8 — MY OWN CAR DESIGN, smooth not boxy (the user's words: "the
// cars must use YOUR design"). The build-5 approach (real-proportioned
// boxes upscaled by K against a 2.04 figure) is retired with the figure
// itself: the reference human is now the real-proportioned 1.78 figure,
// and the cars are modelled DIRECTLY at real-world size — a family sedan
// is 4.70 long, 1.85 wide, roof 1.48 (figure/roof 1.20, the real band),
// a sports coupe roof 1.32, a van roof 1.95, a truck cab top 2.30.
//
// Design language: the body is ONE smooth capsule loaf (rounded nose,
// tapered rear, tucked rocker), a glass canopy sphere floats the cabin
// in it and a painted roof panel caps the glass — sloped hood and
// windshield come free from the sphere curves. Dark arch discs seat the
// wheels in the body sides, sphere headlights hug the nose, a dark
// valance capsule bands the lower body (two-tone), chrome mirrors and
// trim finish it. No sharp shipping-box silhouettes anywhere.

function paintMat(color) {
  // BUILD 16: glossier clearcoat feel + stronger sky-environment response.
  return new THREE.MeshStandardMaterial({ color, roughness: 0.27, metalness: 0.25, envMapIntensity: 1.35 });
}
function glassMat() {
  return new THREE.MeshStandardMaterial({ color: 0x141e28, roughness: 0.06, metalness: 0.55, envMapIntensity: 1.7 });
}
function trimMat(color, roughness = 0.7, metalness = 0.1) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function stdBox(w, h, d, material, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  m.castShadow = true;
  return m;
}
function stdBall(r, material, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

const CAR_PROFILES = {
  sedan: {
    R: 0.78, len: 3.14, cy: 0.60, sy: 0.50, wheelR: 0.34, wheelZ: 1.45, wheelX: 0.80,
    glass: { s: [0.72, 0.40, 1.05], p: [0, 1.06, -0.25] },
    roof: { s: [0.76, 0.22, 1.09], p: [0, 1.26, -0.25] },
    glassFrame: { x: [-0.74, 0.74], y: [0.92, 1.44], z: [-1.32, 0.82] },
    roofFrame: { x: [-0.78, 0.78], y: [1.38, 1.50], z: [-1.36, 0.86] },
    dims: { length: 4.70, width: 1.85, roofY: 1.48 },
    rimY: 1.12, shieldZ: 0.60, shieldY: 1.10,
  },
  sport: {
    R: 0.72, len: 3.30, cy: 0.55, sy: 0.52, wheelR: 0.35, wheelZ: 1.50, wheelX: 0.80,
    glass: { s: [0.68, 0.34, 0.95], p: [0, 0.98, -0.45] },
    roof: { s: [0.72, 0.18, 0.99], p: [0, 1.14, -0.45] },
    glassFrame: { x: [-0.70, 0.70], y: [0.86, 1.30], z: [-1.42, 0.52] },
    roofFrame: { x: [-0.74, 0.74], y: [1.22, 1.34], z: [-1.46, 0.56] },
    dims: { length: 4.74, width: 1.86, roofY: 1.32 },
    rimY: 1.06, shieldZ: 0.48, shieldY: 1.02,
  },
};

// One capsule-bodied car (sedan / sport / taxi, closed or cabrio).
function capsuleCar(color, prof, opts) {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const glass = glassMat();
  const dark = trimMat(0x23252b, 0.75, 0.05);
  const chrome = trimMat(0xd8dde2, 0.25, 0.9);
  const tl = trimMat(0xff2d2d, 0.4, 0.1);
  tl.emissive = new THREE.Color(0x5c0606);
  const hl = trimMat(0xfff6c9, 0.4, 0.1);
  hl.emissive = new THREE.Color(0x776a20);

  // The body loaf: a capsule lying along z, squashed to an elliptical
  // cross-section — widest at the beltline (cy), tucked under below.
  const bodyGeo = new THREE.CapsuleGeometry(prof.R, prof.len, 8, 20);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(prof.dims.width / (2 * prof.R), prof.sy, 1);
  body.position.y = prof.cy;
  body.castShadow = true;
  g.add(body);
  // Two-tone valance: a flatter capsule banding the lower body.
  const valGeo = new THREE.CapsuleGeometry(prof.R, prof.len, 8, 20);
  valGeo.rotateX(Math.PI / 2);
  const val = new THREE.Mesh(valGeo, dark);
  val.scale.set(prof.dims.width / (2 * prof.R) * 1.005, prof.sy * 0.62, 1.002);
  val.position.y = prof.cy - prof.R * prof.sy * 0.38;
  val.castShadow = true;
  g.add(val);

  const beltTop = prof.cy + prof.R * prof.sy;   // top of the body loaf
  let frameBoxes = [];
  let tub = null;
  let topY = prof.dims.roofY;

  if (opts.openTop) {
    // Cabrio: no canopy — a raked windshield, a dark interior tub with
    // seat backs, and a padded rim roll around the cockpit opening.
    const shield = stdBox(1.45, 0.36, 0.045, glass, 0, prof.shieldY, prof.shieldZ, -0.38);
    g.add(shield);
    g.add(stdBox(1.45, 0.16, 1.75, dark, 0, beltTop - 0.08, -0.22));            // interior
    g.add(stdBox(0.52, 0.40, 0.13, dark, -0.42, beltTop + 0.02, -0.80));       // seat backs
    g.add(stdBox(0.52, 0.40, 0.13, dark, 0.42, beltTop + 0.02, -0.80));
    const rollGeo = new THREE.CapsuleGeometry(0.045, 1.75, 4, 10);
    rollGeo.rotateX(Math.PI / 2);
    for (const sx of [-0.79, 0.79]) {
      const roll = new THREE.Mesh(rollGeo, paint);
      roll.position.set(sx, prof.rimY - 0.045, -0.22);
      roll.castShadow = true;
      g.add(roll);
    }
    const rearGeo = new THREE.CapsuleGeometry(0.045, 1.50, 4, 10);
    rearGeo.rotateZ(Math.PI / 2);
    const rear = new THREE.Mesh(rearGeo, paint);
    rear.position.set(0, prof.rimY - 0.045, -1.10);
    rear.castShadow = true;
    g.add(rear);
    tub = { x: [-0.80, 0.80], z: [-1.15, 0.70], rimY: prof.rimY, floorY: 0.55 };
    frameBoxes.push({ name: 'rear deck', x: [-0.85, 0.85], y: [0.80, prof.rimY], z: [-1.45, -1.05] });
    topY = prof.shieldY + 0.18;
  } else {
    // Closed: glass canopy + painted roof panel nested in it.
    g.add(stdBall(1, glass, ...prof.glass.p, ...prof.glass.s));
    g.add(stdBall(1, paint, ...prof.roof.p, ...prof.roof.s));
    frameBoxes.push({ name: 'cabin glass', ...prof.glassFrame });
    frameBoxes.push({ name: 'roof', ...prof.roofFrame });
  }

  // Mirrors, lights (spheres hug the curved nose), chrome side trim.
  g.add(stdBall(0.14, paint, -0.94, beltTop + 0.02, 0.55, 0.55, 0.38, 0.85));
  g.add(stdBall(0.14, paint, 0.94, beltTop + 0.02, 0.55, 0.55, 0.38, 0.85));
  const noseZ = prof.len / 2 + prof.R * 0.86;
  g.add(stdBall(0.07, hl, -0.55, prof.cy + 0.06, noseZ));
  g.add(stdBall(0.07, hl, 0.55, prof.cy + 0.06, noseZ));
  g.add(stdBall(0.065, tl, -0.55, prof.cy + 0.10, -noseZ));
  g.add(stdBall(0.065, tl, 0.55, prof.cy + 0.10, -noseZ));
  for (const sx of [-1, 1]) g.add(stdBox(0.025, 0.045, 3.3, chrome, sx * (prof.dims.width / 2 + 0.005), prof.cy + 0.16, 0));

  if (opts.cls === 'sport') {
    g.add(stdBox(0.08, 0.16, 0.08, dark, -0.55, beltTop + 0.10, -2.15));
    g.add(stdBox(0.08, 0.16, 0.08, dark, 0.55, beltTop + 0.10, -2.15));
    g.add(stdBox(1.5, 0.05, 0.34, dark, 0, beltTop + 0.20, -2.18));
    if (opts.openTop) frameBoxes.push({ name: 'spoiler', x: [-0.75, 0.75], y: [beltTop + 0.12, beltTop + 0.26], z: [-2.35, -2.01] });
  }
  if (opts.cls === 'taxi') {
    if (opts.openTop) {
      // Sign on two posts over the windshield — ahead of the driver's
      // head box (asserted in shots.seat()).
      g.add(stdBox(0.06, 0.30, 0.06, dark, -0.30, prof.rimY + 0.12, 0.68));
      g.add(stdBox(0.06, 0.30, 0.06, dark, 0.30, prof.rimY + 0.12, 0.68));
      const signMat = trimMat(0xfff3b0, 0.5, 0.05);
      signMat.emissive = new THREE.Color(0x554a10);
      g.add(stdBox(0.72, 0.22, 0.38, signMat, 0, prof.rimY + 0.32, 0.68));
      frameBoxes.push({ name: 'taxi sign', x: [-0.36, 0.36], y: [prof.rimY + 0.21, prof.rimY + 0.43], z: [0.49, 0.87] });
      topY = prof.rimY + 0.43;
    } else {
      const signMat = trimMat(0xfff3b0, 0.5, 0.05);
      signMat.emissive = new THREE.Color(0x554a10);
      g.add(stdBox(0.72, 0.22, 0.38, signMat, 0, prof.dims.roofY + 0.12, -0.35));
      frameBoxes.push({ name: 'taxi sign', x: [-0.36, 0.36], y: [prof.dims.roofY + 0.01, prof.dims.roofY + 0.23], z: [-0.54, -0.16] });
      topY = prof.dims.roofY + 0.23;
    }
  }

  // Wheels seated in dark arch discs on the body sides.
  const wheels = [];
  const tyreMat = trimMat(0x1b1d20, 0.9, 0.0);
  const hubMat = trimMat(0xc9ced4, 0.3, 0.85);
  const wheelGeo = new THREE.CylinderGeometry(prof.wheelR, prof.wheelR, 0.24, 18);
  const hubGeo = new THREE.CylinderGeometry(prof.wheelR * 0.55, prof.wheelR * 0.55, 0.26, 12);
  const archGeo = new THREE.CylinderGeometry(prof.wheelR * 1.28, prof.wheelR * 1.28, 0.05, 18);
  for (const [wx, wz] of [[-prof.wheelX, prof.wheelZ], [prof.wheelX, prof.wheelZ], [-prof.wheelX, -prof.wheelZ], [prof.wheelX, -prof.wheelZ]]) {
    const arch = new THREE.Mesh(archGeo, dark);
    arch.rotation.z = Math.PI / 2;
    arch.position.set(wx * 0.94, prof.wheelR, wz);
    g.add(arch);
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre); w.add(hub);
    w.position.set(wx, prof.wheelR, wz);
    g.add(w);
    wheels.push(w);
  }

  // SEAT SOCKET (physics standard #1/#2), fitted to the NEW figure's
  // real bounding box (1.78 tall, hip pivot 0.96 above its origin): the
  // origin sits low in the footwell (y −0.24) so the pelvis lands on the
  // cushion (~0.72) and the head box rides at [1.50, 1.80] above it.
  const seat = opts.openTop
    ? { x: 0.42, y: -0.24, z: 0.05 }
    : { x: 0.42, y: -0.24, z: 0.15 };
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 18), dark);
  rim.castShadow = true;
  wheel.add(rim);
  wheel.add(stdBox(0.34, 0.045, 0.035, dark, 0, 0, 0));
  wheel.position.set(seat.x, seat.y + 1.22, seat.z + 0.52);
  wheel.rotation.x = -0.5;
  g.add(wheel);

  const dims = {
    length: prof.dims.length, width: prof.dims.width,
    roofY: opts.openTop ? null : prof.dims.roofY,
    rimY: opts.openTop ? prof.rimY : null,
    topY,
  };
  return { group: g, wheels, brakeMat: tl, seat, frameBoxes, tub, dims, wheelR: prof.wheelR };
}

/**
 * Build one car. cls: 'sedan' | 'sport' | 'taxi' | 'truck' | 'van' | 'police'.
 * The car faces +Z at heading 0. Returns { group, wheels, lights, speed, ... }.
 * All placement metadata (seat socket, frame boxes, tub, dims) is in
 * WORLD units — the cars are modelled at real size, no scaling pass.
 */
export function makeCar(color, opts = {}) {
  const cls = opts.cls || 'sedan';
  if (cls === 'police') {
    // Cruisers are the fleet module's police_car (fleet.js), restyled in
    // build 8 to the same smooth design language and carrying the same
    // seat/frame/dims contract + lights {red, blue} + brakeMat, so
    // police.js, driveStep and shots.seat() work on it unchanged.
    const v = buildFleetVehicle('police_car');
    return { ...v, color, kind: opts.kind || 'traffic' };
  }
  let built;
  if (cls === 'van') built = boxyVan(color);
  else if (cls === 'truck') built = boxyTruck(color);
  else built = capsuleCar(color, CAR_PROFILES[cls === 'sport' ? 'sport' : 'sedan'], { ...opts, cls });
  return {
    group: built.group, wheels: built.wheels, lights: null, cls, color,
    brakeMat: built.brakeMat,
    speed: 0, heading: 0, kind: opts.kind || 'traffic',
    radius: built.dims.length / 2, driver: null,
    seat: built.seat, frameBoxes: built.frameBoxes, tub: built.tub, dims: built.dims,
    wheelR: built.wheelR,
  };
}

// The van: a rounded-nose people carrier — box body softened by a sphere
// nose, a glass band and a roof cap. Real size: 5.0 long, roof 1.95.
function boxyVan(color) {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const glass = glassMat();
  const dark = trimMat(0x23252b, 0.75, 0.05);
  const tl = trimMat(0xff2d2d, 0.4, 0.1);
  tl.emissive = new THREE.Color(0x5c0606);
  const hl = trimMat(0xfff6c9, 0.4, 0.1);
  hl.emissive = new THREE.Color(0x776a20);

  g.add(stdBox(1.95, 1.55, 4.6, paint, 0, 1.075, -0.15));
  g.add(stdBox(1.99, 0.13, 4.65, paint, 0, 1.885, -0.15));                 // roof cap
  g.add(stdBall(0.95, paint, 0, 0.92, 2.05, 1.0, 0.62, 0.55));            // rounded nose
  g.add(stdBox(1.66, 0.60, 0.05, glass, 0, 1.44, 2.22, -0.40));           // windshield
  g.add(stdBox(1.97, 0.48, 3.2, glass, 0, 1.40, -0.35));                  // side glass band
  g.add(stdBox(1.97, 0.34, 4.62, dark, 0, 0.30, -0.15));                  // skirt
  g.add(stdBall(0.07, hl, -0.62, 0.72, 2.48));
  g.add(stdBall(0.07, hl, 0.62, 0.72, 2.48));
  g.add(stdBall(0.065, tl, -0.62, 0.78, -2.47));
  g.add(stdBall(0.065, tl, 0.62, 0.78, -2.47));
  g.add(stdBall(0.13, paint, -1.02, 1.35, 1.95, 0.5, 0.38, 0.85));
  g.add(stdBall(0.13, paint, 1.02, 1.35, 1.95, 0.5, 0.38, 0.85));

  const wheels = [];
  const tyreMat = trimMat(0x1b1d20, 0.9, 0.0);
  const hubMat = trimMat(0xc9ced4, 0.3, 0.85);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18);
  const hubGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.28, 12);
  for (const [wx, wz] of [[-0.84, 1.55], [0.84, 1.55], [-0.84, -1.75], [0.84, -1.75]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre); w.add(hub);
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  const seat = { x: 0.45, y: -0.05, z: 1.05 };
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 18), dark);
  rim.castShadow = true;
  wheel.add(rim);
  wheel.position.set(seat.x, seat.y + 1.22, seat.z + 0.52);
  wheel.rotation.x = -0.5;
  g.add(wheel);
  return {
    group: g, wheels, brakeMat: tl, seat,
    frameBoxes: [{ name: 'windshield', x: [-0.85, 0.85], y: [1.14, 1.78], z: [2.02, 2.42] }],
    tub: null,
    dims: { length: 5.0, width: 1.99, roofY: 1.95, rimY: null, topY: 1.95 },
    wheelR: 0.36,
  };
}

// The truck: cab with a rounded nose and a tall cargo box. Real size:
// 5.6 long, cab top 2.30, cargo top 2.90.
function boxyTruck(color) {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const glass = glassMat();
  const dark = trimMat(0x23252b, 0.75, 0.05);
  const cargoMat = paintMat(0xe8e4da);
  const tl = trimMat(0xff2d2d, 0.4, 0.1);
  tl.emissive = new THREE.Color(0x5c0606);
  const hl = trimMat(0xfff6c9, 0.4, 0.1);
  hl.emissive = new THREE.Color(0x776a20);

  g.add(stdBox(1.9, 0.5, 5.5, dark, 0, 0.45, 0));                          // chassis skirt
  g.add(stdBox(1.95, 1.75, 1.75, paint, 0, 1.425, 1.60));                 // cab
  g.add(stdBall(0.95, paint, 0, 0.88, 2.30, 1.0, 0.60, 0.50));            // rounded nose
  g.add(stdBox(1.66, 0.58, 0.05, glass, 0, 1.86, 2.44, -0.18));           // windshield
  g.add(stdBox(1.8, 0.06, 0.4, dark, 0, 2.02, 2.55));                     // sun visor
  g.add(stdBox(2.0, 2.3, 3.55, cargoMat, 0, 1.75, -1.05));                // cargo box
  g.add(stdBox(2.02, 0.18, 3.57, dark, 0, 0.62, -1.05));
  g.add(stdBall(0.07, hl, -0.62, 0.70, 2.68));
  g.add(stdBall(0.07, hl, 0.62, 0.70, 2.68));
  g.add(stdBall(0.065, tl, -0.62, 0.75, -2.85));
  g.add(stdBall(0.065, tl, 0.62, 0.75, -2.85));
  g.add(stdBall(0.13, paint, -1.05, 1.80, 2.30, 0.5, 0.38, 0.85));
  g.add(stdBall(0.13, paint, 1.05, 1.80, 2.30, 0.5, 0.38, 0.85));

  const wheels = [];
  const tyreMat = trimMat(0x1b1d20, 0.9, 0.0);
  const hubMat = trimMat(0xc9ced4, 0.3, 0.85);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 18);
  const hubGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.30, 12);
  for (const [wx, wz] of [[-0.88, 1.85], [0.88, 1.85], [-0.88, -1.95], [0.88, -1.95]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre); w.add(hub);
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  const seat = { x: 0.45, y: 0.15, z: 1.55 };
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.03, 8, 18), dark);
  rim.castShadow = true;
  wheel.add(rim);
  wheel.position.set(seat.x, seat.y + 1.22, seat.z + 0.52);
  wheel.rotation.x = -0.5;
  g.add(wheel);
  return {
    group: g, wheels, brakeMat: tl, seat,
    frameBoxes: [{ name: 'windshield', x: [-0.85, 0.85], y: [1.55, 2.18], z: [2.28, 2.58] }],
    tub: null,
    dims: { length: 5.6, width: 2.02, roofY: 2.30, rimY: null, topY: 2.90 },
    wheelR: 0.42,
  };
}


export function spinWheels(car, dt) {
  const s = (car.speed * dt) / (car.wheelR || 0.38);
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
  // DEFECT FIX (N-4): the park (x 56..120, z 44..88) is a lawn, not a
  // road — the avenue x=100 and street z=80 routes are split into two
  // segments with a cut-out at the park kerbs (the wrap margin of 6 m
  // in update() stays on the road side), instead of running straight
  // across the grass.
  const PARK = WORLD.park;
  for (const x of WORLD.avenues) {
    if (x > PARK.x0 && x < PARK.x1) {
      for (const [min, max] of [[20, PARK.z0 - 8], [PARK.z1 + 8, 194]]) {
        routes.push({ axis: 'z', at: x, dir: 1, min, max });
        routes.push({ axis: 'z', at: x, dir: -1, min, max });
      }
    } else {
      routes.push({ axis: 'z', at: x, dir: 1, min: 20, max: 194 });
      routes.push({ axis: 'z', at: x, dir: -1, min: 20, max: 194 });
    }
  }
  for (const z of WORLD.streets.concat([WORLD.oceanDrive])) {
    if (z > PARK.z0 && z < PARK.z1) {
      for (const [min, max] of [[-164, PARK.x0 - 8], [PARK.x1 + 8, 154]]) {
        routes.push({ axis: 'x', at: z, dir: 1, min, max });
        routes.push({ axis: 'x', at: z, dir: -1, min, max });
      }
    } else {
      routes.push({ axis: 'x', at: z, dir: 1, min: -164, max: 154 });
      routes.push({ axis: 'x', at: z, dir: -1, min: -164, max: 154 });
    }
  }

  for (let i = 0; i < count; i++) {
    const route = routes[i % routes.length];
    const cls = pick(rng, ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
    const openTop = (cls === 'sport' && rng() > 0.35) || (cls === 'sedan' && rng() > 0.82);
    const color = pick(rng, CAR_COLORS);
    // BUILD 6: every fourth traffic car is the fleet module's
    // civil_sedan (same rng draws as the makeCar path, so the seeded
    // world/crowd layout is unchanged).
    const car = i % 4 === 3
      ? { ...buildFleetVehicle('civil_sedan', { color }), color, kind: 'traffic' }
      : makeCar(color, { cls, kind: 'traffic', openTop });
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
      if (car.wrecked) continue;   // BUILD 15: a wreck is scenery, not traffic
      const axisGreen = car.route.axis === 'z' ? phase.ns === 'green' : phase.ew === 'green';
      const cross = nextCrossing(car);
      let target = car.cruise;
      if (!axisGreen && cross < 13) target = 0;
      // Brake for a pedestrian in the lane ahead (physics pass: cars and
      // walkers share the road space at crossings, so a car must never
      // drive through one — walkers yield at the kerb, cars yield to
      // anyone already in the road).
      if (api.yieldFigures) {
        const cp = car.group.position;
        for (const fig of api.yieldFigures) {
          const fp = fig.group.position;
          let along, lateral;
          if (car.route.axis === 'z') { along = (fp.z - cp.z) * car.route.dir; lateral = Math.abs(fp.x - cp.x); }
          else { along = (fp.x - cp.x) * car.route.dir; lateral = Math.abs(fp.z - cp.z); }
          if (along > 0.5 && along < 8.5 && lateral < 2.0) { target = 0; break; }
        }
      }
      // Keep a gap to the car ahead on the same route.
      for (const other of cars) {
        if (other === car || other.route !== car.route) continue;
        const gap = (other.along - car.along) * car.route.dir;
        if (gap > 0 && gap < 7.6) target = Math.min(target, other.speed);
      }
      const accel = target > car.speed ? 6 : 18;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt);
      // Brake lights flare while slowing and stay lit while held at a light.
      const braking = target < car.speed - 0.05 || (target === 0 && car.speed < 1.6);
      car.brakeMat.emissive.setHex(braking ? 0xe02020 : 0x5c0606);
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

  // yieldFigures: the crowd's figure list, wired in by main.js so traffic
  // can brake for pedestrians (see update()).
  const api = { cars, update, remove, yieldFigures: null };
  return api;
}

// Simple arcade drive step shared by the player car and police cars:
// accelerate toward `drive` (-1..1), steer with `steer` (-1..1).
// BUILD 15: a car may carry its own top speed / acceleration (the
// Comet's garage upgrades set maxF and accelMul); everyone else keeps
// the class defaults.
export function driveStep(car, dt, drive, steer) {
  const maxF = car.maxF || (car.cls === 'sport' ? 30 : 24);
  const maxR = 9;
  if (drive > 0) car.speed += TUNING.carAccel * (car.accelMul || 1) * drive * dt;
  else if (drive < 0) car.speed -= (car.speed > 0.5 ? TUNING.carBrake : TUNING.carAccel * 0.7) * dt;
  if (car.brakeMat) car.brakeMat.emissive.setHex(drive < 0 && car.speed > 0.5 ? 0xe02020 : 0x5c0606);
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
      if (car.wrecked) continue;   // BUILD 15: burned out — the loop flows around it
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
