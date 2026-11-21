// characters.js — BUILD 8: real-proportion figures. The old "Polygon
// War" big-head kit (2.04 tall, head ~1:3.5) is retired by the user's
// direct order: the winners' look is a NORMAL adult — 1.78 units tall,
// slim, head 0.236 across ≈ 1/7.5 of the height — built from smooth
// capsules and spheres (no flat shading, no boxes for body parts), so a
// person reads as a person at street distance. Roles still read from
// silhouette + signature kit: police cap + badge, firefighter helmet +
// reflective stripes, doctor's stethoscope, nurse cap with red cross,
// gangster shades + gold chain, hoodie friend, chef whites, MC in an
// orange jacket and red shoes. Parts (head / torso / arms / legs / gear /
// weapon) hang off named groups so the poses in this file can swing them.
//
// Figure metrics (the contract every consumer fits to — physics
// standard #1: fit by the figure's REAL bounding box):
//   height 1.78 · hip pivot 0.96 above the origin · head box (standing
//   or seated upright) y [1.50, 1.80], half-width 0.13.

export const FIGURE = {
  height: 1.78,
  hip: 0.96,
  headHalf: 0.13,
  headLo: 1.50,
  headHi: 1.80,
};

function mat(color, opts = {}) {
  // Smooth-shaded Lambert: rounded forms, no facets.
  return new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
}
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function ball(r, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function capsule(r, len, color, x, y, z, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, 1, sz);
  m.castShadow = true;
  return m;
}
function ring(r, h, color, x, y, z, sx = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, 1, sz);
  m.castShadow = true;
  return m;
}

// BUILD 13: a proper pistol, modelled like the real thing in small
// primitives — slide over a frame, a round barrel tipping the muzzle,
// an angled grip with a magazine base plate, a trigger guard loop and
// front + rear sights. Its own group so it can be posed with the arm;
// the origin sits at the grip top, where the hand closes on it.
export function makeWeapon() {
  const g = new THREE.Group();
  const steel = 0x33363e, dark = 0x1b1d22, gripC = 0x24262c;
  g.add(box(0.046, 0.055, 0.30, steel, 0, 0.045, 0.10));            // slide
  g.add(box(0.040, 0.035, 0.30, dark, 0, 0.005, 0.10));             // frame under the slide
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 8), mat(dark));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.045, 0.265);
  barrel.castShadow = true;
  g.add(barrel);                                                    // muzzle
  const grip = box(0.05, 0.155, 0.07, gripC, 0, -0.075, -0.028);
  grip.rotation.x = 0.24;                                           // grip rakes back
  g.add(grip);
  g.add(box(0.056, 0.018, 0.085, dark, 0, -0.152, -0.047));         // magazine base plate
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0075, 6, 12), mat(dark));
  guard.position.set(0, -0.028, 0.075);
  guard.castShadow = true;
  g.add(guard);                                                     // trigger guard
  g.add(box(0.014, 0.035, 0.014, dark, 0, 0.088, 0.225));           // front sight post
  g.add(box(0.034, 0.028, 0.016, dark, 0, 0.082, -0.038));          // rear sight block
  return g;
}

// BUILD 13: a long gun for the garrison — receiver, a long round
// barrel with a muzzle brake, a butt stock, a box magazine and a carry
// sight. Built along +z like the pistol; makeFigure slings it across
// a soldier's back, world.js stands copies in the Arms display racks.
export function makeRifle() {
  const g = new THREE.Group();
  const body = 0x2c2e33, dark = 0x17191e;
  g.add(box(0.05, 0.075, 0.34, body, 0, 0, 0.02));                  // receiver
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8), mat(dark));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, 0.40);
  barrel.castShadow = true;
  g.add(barrel);                                                    // barrel
  g.add(box(0.036, 0.05, 0.07, dark, 0, 0.018, 0.60));              // muzzle brake
  g.add(box(0.042, 0.06, 0.20, body, 0, -0.01, 0.24));              // handguard
  const stock = box(0.045, 0.10, 0.24, 0x3a332a, 0, -0.025, -0.26);
  stock.rotation.x = -0.10;
  g.add(stock);                                                     // butt stock
  g.add(box(0.04, 0.11, 0.06, dark, 0, -0.085, 0.05));              // magazine
  g.add(box(0.016, 0.045, 0.10, dark, 0, 0.062, 0.02));             // carry sight
  g.add(box(0.014, 0.03, 0.014, dark, 0, 0.055, 0.52));             // front post
  return g;
}

// BUILD 14: a compact submachine gun in the same language as the
// build-13 pistol and rifle — stamped receiver, short round barrel
// with a perforated shroud, a curved magazine, a wire-thin butt stub
// and a stubby front grip. Same grip-top origin and +z forward as
// makeWeapon, so the hand closes on it identically.
export function makeSmg() {
  const g = new THREE.Group();
  const steel = 0x33363e, dark = 0x1b1d22, gripC = 0x24262c;
  g.add(box(0.05, 0.07, 0.34, steel, 0, 0.02, 0.06));               // receiver
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), mat(dark));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, 0.30);
  barrel.castShadow = true;
  g.add(barrel);                                                    // short barrel
  g.add(box(0.055, 0.055, 0.12, dark, 0, 0.03, 0.245));             // shroud block
  const mag = box(0.04, 0.17, 0.055, dark, 0, -0.10, 0.10);
  mag.rotation.x = 0.38;                                            // curved-look magazine
  g.add(mag);
  const grip = box(0.048, 0.13, 0.06, gripC, 0, -0.075, -0.06);
  grip.rotation.x = 0.22;
  g.add(grip);
  g.add(box(0.04, 0.045, 0.16, dark, 0, 0.015, -0.17));             // butt stub
  g.add(box(0.036, 0.09, 0.04, gripC, 0, -0.045, 0.185));           // front grip
  g.add(box(0.013, 0.03, 0.013, dark, 0, 0.075, 0.20));             // front post
  g.add(box(0.03, 0.024, 0.014, dark, 0, 0.07, -0.05));             // rear sight
  return g;
}

// Headwear and hair on the smooth head. Head-local frame: the head group
// sits at y 1.52, the skull centre is rel y +0.135, skull radius 0.118.
function addHat(head, kind, color) {
  if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.126, 16, 10, 0, Math.PI * 2, 0, 1.35), mat(color));
    dome.position.set(0, 0.148, 0);
    dome.castShadow = true;
    head.add(dome);
    const brim = box(0.17, 0.018, 0.14, color, 0, 0.155, 0.135);
    brim.rotation.x = 0.10;
    head.add(brim);
  } else if (kind === 'police') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.116, 0.085, 14), mat(0x1d3fbf));
    crown.position.y = 0.238; crown.castShadow = true;
    head.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.128, 0.016, 14), mat(0x101828));
    brim.position.set(0, 0.196, 0.018);
    brim.scale.z = 1.18;
    brim.castShadow = true;
    head.add(brim);
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.028), mat(0xffd23e, { emissive: 0x443300 }));
    badge.position.set(0, 0.238, 0.112);
    head.add(badge);
  } else if (kind === 'fire') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.136, 16, 10, 0, Math.PI * 2, 0, 1.85), mat(0xd42a2a));
    dome.position.y = 0.138; dome.castShadow = true;
    head.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.018, 16), mat(0xd42a2a));
    brim.position.y = 0.155; brim.castShadow = true;
    head.add(brim);
    head.add(box(0.055, 0.07, 0.015, 0xffd23e, 0, 0.175, 0.128));   // shield
  } else if (kind === 'nurse') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.082, 0.046, 12), mat(0xffffff));
    cap.position.y = 0.248; cap.castShadow = true;
    head.add(cap);
    head.add(box(0.016, 0.05, 0.01, 0xd42a2a, 0, 0.245, 0.07));
    head.add(box(0.05, 0.016, 0.01, 0xd42a2a, 0, 0.245, 0.07));
  } else if (kind === 'sun') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.225, 0.016, 16), mat(color));
    brim.position.y = 0.195; brim.castShadow = true;
    head.add(brim);
    head.add(ball(0.10, color, 0, 0.215, 0, 1, 0.62, 1));
  } else if (kind === 'chef') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.12, 0.11, 14), mat(0xffffff));
    band.position.y = 0.228; band.castShadow = true;
    head.add(band);
    head.add(ball(0.116, 0xffffff, 0, 0.30, 0, 1, 0.62, 1));
  } else if (kind === 'hair') {
    // A hair cap: a slightly larger sphere shell over the top and back
    // of the skull, tipped back so the face stays clear.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, 1.78), mat(color));
    cap.position.set(0, 0.142, -0.008);
    cap.rotation.x = -0.30;
    cap.castShadow = true;
    head.add(cap);
  }
}

/**
 * Build one real-proportion figure (1.78 tall, head ≈ 1/7.5 of height).
 * opts: skin, shirt, pants, hat ('cap'|'police'|'fire'|'nurse'|'sun'|'chef'|'hair'),
 * hatColor, gear (vest colour or null), weapon (bool), apron (front panel colour),
 * shorts (bool), shoes, skirt, hairLong, hoodie, stethoscope, chain, shades,
 * stripes (reflective stripe colour), badge (chest badge bool).
 */
export function makeFigure(opts) {
  const o = Object.assign({
    skin: 0xf2c79b, shirt: 0x118ab2, pants: 0x2b2d42,
    hat: null, hatColor: 0xef476f, gear: null, weapon: false,
    apron: null, shorts: false, shoes: 0xf2f2f2, skirt: null,
    hairLong: false, hoodie: false, stethoscope: false,
    chain: false, shades: false, stripes: null, badge: false, rifle: false,
  }, opts);
  const group = new THREE.Group();
  const parts = {};

  // Legs pivot at the hip (y 0.96): one smooth capsule per leg — thigh
  // and shin in a single tapered read — with a proper shoe at the foot.
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const leg = new THREE.Group();
    leg.position.set(0.10 * s, FIGURE.hip, 0);
    leg.add(capsule(0.07, 0.73, o.shorts ? o.skin : o.pants, 0, -0.435, 0));
    if (o.shorts) leg.add(capsule(0.082, 0.20, o.pants, 0, -0.155, 0));
    if (o.stripes) leg.add(ring(0.078, 0.045, o.stripes, 0, -0.62, 0));
    leg.add(box(0.115, 0.09, 0.27, o.shoes, 0, -0.915, 0.045));
    group.add(leg);
    parts['leg' + side] = leg;
  }
  if (o.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.275, 0.37, 14), mat(o.skirt));
    skirt.position.y = 0.875;
    skirt.castShadow = true;
    group.add(skirt);
  }

  // Torso: a slim capsule (scaled to an elliptical cross-section) over a
  // pelvis sphere, with a soft shoulder bar — no boxes, no slab chest.
  const torso = new THREE.Group();
  torso.position.set(0, FIGURE.hip, 0);
  torso.add(ball(0.15, o.pants, 0, 0.03, 0, 1.12, 0.72, 0.86));            // pelvis
  torso.add(capsule(0.155, 0.30, o.shirt, 0, 0.27, 0, 1.12, 0.80));       // chest
  torso.add(ball(0.16, o.shirt, 0, 0.44, 0, 1.28, 0.55, 0.82));           // shoulders
  if (o.apron) {
    const apron = box(0.27, 0.36, 0.025, o.apron, 0, 0.20, 0.128);
    apron.rotation.x = 0.06;
    torso.add(apron);
  }
  if (o.stripes) {
    torso.add(ring(0.168, 0.05, o.stripes, 0, 0.30, 0, 1.12, 0.80));
    torso.add(ring(0.172, 0.05, o.stripes, 0, 0.13, 0, 1.12, 0.80));
  }
  if (o.badge) torso.add(box(0.05, 0.06, 0.02, 0xffd23e, -0.10, 0.33, 0.122));
  if (o.chain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.016, 8, 20),
      mat(0xffd23e, { emissive: 0x554400 }));
    chain.position.set(0, 0.375, 0.075);
    chain.rotation.x = 1.05;
    chain.castShadow = true;
    torso.add(chain);
  }
  if (o.stethoscope) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.013, 8, 18), mat(0x22242a));
    tube.position.set(0, 0.40, 0.08);
    tube.rotation.x = 0.95;
    torso.add(tube);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 10), mat(0xd8dde2));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0.06, 0.17, 0.128);
    torso.add(disc);
  }
  if (o.hoodie) torso.add(ball(0.13, o.shirt, 0, 0.47, -0.105, 1.1, 0.8, 0.9));
  if (o.gear) {
    torso.add(capsule(0.175, 0.26, o.gear, 0, 0.26, 0, 1.10, 0.85));      // tactical vest
    torso.add(box(0.11, 0.11, 0.05, 0x17191e, -0.09, 0.14, 0.15));
    torso.add(box(0.11, 0.11, 0.05, 0x17191e, 0.09, 0.14, 0.15));
  }
  if (o.rifle) {
    // BUILD 13: a rifle slung diagonally across the back — butt at one
    // hip, barrel tipping over the opposite shoulder. Deliberately NOT
    // parts.weapon: soldiers carry, they do not aim, so poseFigure's
    // gun-arm raise must never fire for them.
    const r = makeRifle();
    r.position.set(0.02, 0.30, -0.175);
    r.rotation.set(-1.02, 0, 0.42);
    torso.add(r);
  }
  group.add(torso);
  parts.torso = torso;

  // Arms pivot at the shoulder (y 1.40): slim capsules ending in a hand.
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const arm = new THREE.Group();
    arm.position.set(0.215 * s, 1.40, 0);
    arm.add(capsule(0.052, 0.50, o.shirt, 0, -0.29, 0));
    arm.add(ball(0.052, o.skin, 0, -0.60, 0));
    if (o.weapon && side === 'R') {
      const w = makeWeapon();
      w.position.set(0, -0.615, 0.03);
      arm.add(w);
      parts.weapon = w;
    }
    group.add(arm);
    parts['arm' + side] = arm;
  }

  // Head — a smooth sphere (r 0.118, diameter 0.236 ≈ 1/7.5 of 1.78) on
  // a slim neck, with a soft jaw, two readable eyes, a nose and a mouth.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.12, 10), mat(o.skin));
  neck.position.y = 1.47;
  neck.castShadow = true;
  group.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  head.add(ball(0.118, o.skin, 0, 0.135, 0));                               // skull
  head.add(ball(0.098, o.skin, 0, 0.062, 0.012, 0.88, 0.72, 0.92));        // jaw
  head.add(ball(0.0135, 0x1c1e24, -0.044, 0.148, 0.106));                  // eyes
  head.add(ball(0.0135, 0x1c1e24, 0.044, 0.148, 0.106));
  head.add(ball(0.02, o.skin, 0, 0.098, 0.117, 0.8, 1.1, 0.9));            // nose
  head.add(box(0.038, 0.008, 0.01, 0x8a5a44, 0, 0.038, 0.104));            // mouth
  if (o.shades) head.add(box(0.20, 0.045, 0.02, 0x101216, 0, 0.15, 0.11));
  if (o.hairLong) {
    head.add(ball(0.125, o.hatColor, 0, 0.02, -0.055, 1.02, 1.6, 0.60));   // back fall
    head.add(capsule(0.028, 0.20, o.hatColor, -0.115, -0.02, -0.005));
    head.add(capsule(0.028, 0.20, o.hatColor, 0.115, -0.02, -0.005));
  }
  if (o.hat) addHat(head, o.hat, o.hatColor);
  else if (o.hairLong) addHat(head, 'hair', o.hatColor);
  group.add(head);
  parts.head = head;

  group.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { group, parts, phase: Math.random() * 6.28 };
}

// Pose a figure: walking swing, idle sway, weapon arm raised (only while the
// weapon is visible, i.e. aiming), or knocked flat while fig.down runs out.
// Figures flagged fig.noPose (sunbathers) keep the pose set by their placer.
// fig.baseY is the ground height the figure stands on (terrain-aware).
export function poseFigure(fig, time, speed) {
  if (fig.noPose) return;
  const p = fig.parts;
  const g = fig.group;
  const baseY = fig.baseY || 0;
  if (fig.down > 0) {
    g.rotation.x = -Math.PI / 2;
    g.position.y = baseY + 0.15;
    p.armL.rotation.x = -0.4; p.armR.rotation.x = -2.6;
    p.legL.rotation.x = 0.15; p.legR.rotation.x = -0.1;
    return;
  }
  if (g.rotation.x !== 0) { g.rotation.x = 0; g.position.y = baseY; }
  const sw = Math.min(1, speed / 4) * 0.55;
  const ph = time * (4 + speed * 1.6) + fig.phase;
  p.legL.rotation.x = Math.sin(ph) * sw;
  p.legR.rotation.x = -Math.sin(ph) * sw;
  // BUILD 15 — adopted technique (HumanAnimator, from the user's
  // Palmera Core Engine v2.0 reference), adapted to THIS rig: our
  // figures expose a single torso group, shoulder-pivot arms and a
  // head group — no elbow/knee/neck/pelvis joints — so the pose uses
  // what exists. When player.js hands over fig.aimPose (the camera's
  // real pitch) the gun arm tracks the pitch with a decaying recoil
  // kick (fig.recoil, set by combat.js), the support arm comes up,
  // the torso twists into the shot and the head pitches with the aim.
  const ap = (p.weapon && p.weapon.visible) ? fig.aimPose : null;
  if (p.weapon && p.weapon.visible) {
    if (ap) {
      const pitch = Math.max(-0.75, Math.min(0.75, ap.pitch || 0));
      const rec = fig.recoil || 0;
      p.armR.rotation.x = -1.35 + pitch - rec * 0.35;
      p.armL.rotation.x = -0.95 + pitch * 0.85;
      p.torso.rotation.y = -0.22;
      p.torso.rotation.x = Math.min(0.14, speed * 0.016) + pitch * 0.3;
      p.head.rotation.x = pitch * 0.5;
      p.head.rotation.y *= 0.7;
    } else {
      p.armR.rotation.x = -1.35;                                 // gun arm points forward
      p.armL.rotation.x = Math.sin(ph) * sw * 0.5;
      p.torso.rotation.y = 0;
      p.torso.rotation.x = Math.min(0.14, speed * 0.016);
      p.head.rotation.y = Math.sin(time * 0.6 + fig.phase) * 0.14;
      p.head.rotation.x *= 0.8;
    }
  } else {
    p.armL.rotation.x = -Math.sin(ph) * sw * 0.8;
    p.armR.rotation.x = Math.sin(ph) * sw * 0.8;
    // HumanAnimator's counter-rotation: the torso yaws gently against
    // the leg swing instead of riding it like a plank.
    p.torso.rotation.y = Math.sin(ph) * sw * 0.12;
    p.torso.rotation.x = Math.min(0.14, speed * 0.016);
    p.head.rotation.y = Math.sin(time * 0.6 + fig.phase) * 0.14;
    p.head.rotation.x *= 0.8;
  }
  p.armL.rotation.z = 0.06;
  p.armR.rotation.z = -0.06;
}

// Sunbather: flat on the back, arms out, legs straight.
export function poseSunbather(fig) {
  const p = fig.parts;
  fig.group.rotation.x = -Math.PI / 2 + 0.12;
  fig.group.position.y = (fig.baseY || 0) + 0.10;
  p.armL.rotation.z = 0.9;
  p.armR.rotation.z = -0.9;
  p.legL.rotation.x = 0.05;
  p.legR.rotation.x = -0.04;
}

// Swimmer: face-down paddle in the water.
export function poseSwimmer(fig, t) {
  const p = fig.parts;
  const baseY = fig.baseY !== undefined ? fig.baseY : 0.3;
  fig.group.rotation.x = Math.PI * 0.44;
  fig.group.position.y = baseY + Math.sin(t * 2 + fig.phase) * 0.05;
  p.armL.rotation.x = Math.sin(t * 2.4 + fig.phase) * 1.4;
  p.armR.rotation.x = -Math.sin(t * 2.4 + fig.phase) * 1.4;
  p.legL.rotation.x = Math.sin(t * 3 + fig.phase) * 0.3;
  p.legR.rotation.x = -Math.sin(t * 3 + fig.phase) * 0.3;
}
