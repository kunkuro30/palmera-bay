// characters.js — "Polygon War" figures: big faceted heads (~1:3.5
// head-to-body), angular low-poly bodies, flat shading and clean solid
// colours. The head is a low-segment SPHERE — never a plain box — with a
// jaw facet, two dark eyes, a nose and a mouth, so a face reads at camera
// distance; hair and hats are separate faceted shapes per role. Roles read
// from silhouette + signature colours: police blue + cap badge, firefighter
// red helmet + reflective stripes, doctor white coat + stethoscope, nurse
// scrubs + cap, gangster black jacket + gold chain + shades, hoodie friend,
// casual civilians. Parts (head / torso / arms / legs / gear / weapon) hang
// off named groups so the animation poses in this file can swing them.

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function ball(r, color, x, y, z, wSeg = 7, hSeg = 5) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, wSeg, hSeg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// A chunky low-poly sidearm, its own group so it can be posed with the arm.
export function makeWeapon() {
  const g = new THREE.Group();
  g.add(box(0.08, 0.19, 0.10, 0x22242a, 0, -0.07, 0.02));       // grip
  g.add(box(0.07, 0.09, 0.42, 0x33363e, 0, 0.03, 0.14));       // slide/barrel
  g.add(box(0.03, 0.06, 0.03, 0x111318, 0, 0.10, 0.30));       // front sight
  g.add(box(0.075, 0.07, 0.06, 0x17191e, 0, 0.03, 0.36));      // muzzle
  return g;
}

// Headwear and hair on the faceted head (head-local: skull centre y +0.28).
function addHat(head, kind, color) {
  if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.325, 7, 4, 0, Math.PI * 2, 0, 1.45), mat(color));
    dome.scale.y = 0.72;
    dome.position.y = 0.335;
    dome.castShadow = true;
    head.add(dome);
    const brim = box(0.30, 0.045, 0.22, color, 0, 0.325, 0.31);
    brim.rotation.x = 0.12;
    head.add(brim);
  } else if (kind === 'police') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.295, 0.32, 0.19, 8), mat(0x1d3fbf));
    crown.position.y = 0.50; crown.castShadow = true;
    head.add(crown);
    head.add(box(0.30, 0.04, 0.17, 0x101828, 0, 0.415, 0.29));            // brim
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), mat(0xffd23e));
    badge.position.set(0, 0.50, 0.30);
    head.add(badge);
  } else if (kind === 'fire') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 5, 0, Math.PI * 2, 0, 1.8), mat(0xd42a2a));
    dome.position.y = 0.31; dome.castShadow = true;
    head.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.05, 10), mat(0xd42a2a));
    brim.position.y = 0.335; brim.castShadow = true;
    head.add(brim);
    head.add(box(0.12, 0.14, 0.03, 0xffd23e, 0, 0.38, 0.345));            // shield
  } else if (kind === 'nurse') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.12, 8), mat(0xffffff));
    cap.position.y = 0.575; cap.castShadow = true;
    head.add(cap);
    head.add(box(0.05, 0.13, 0.02, 0xd42a2a, 0, 0.575, 0.205));
    head.add(box(0.13, 0.05, 0.02, 0xd42a2a, 0, 0.575, 0.205));
  } else if (kind === 'sun') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.48, 0.14, 9), mat(color));
    hat.position.y = 0.52; hat.castShadow = true;
    head.add(hat);
  } else if (kind === 'chef') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.30, 8), mat(0xffffff));
    band.position.y = 0.56; band.castShadow = true;
    head.add(band);
    const top = ball(0.26, 0xffffff, 0, 0.74, 0);
    top.scale.y = 0.62;
    head.add(top);
  } else if (kind === 'hair') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.315, 7, 5, 0, Math.PI * 2, 0, 1.85), mat(color));
    cap.position.y = 0.30;
    cap.rotation.x = -0.28;
    cap.castShadow = true;
    head.add(cap);
  }
}

/**
 * Build one Polygon War figure (~2.05 units tall, head ~0.6 of it).
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
    chain: false, shades: false, stripes: null, badge: false,
  }, opts);
  const group = new THREE.Group();
  const parts = {};

  // Legs pivot at the hip (y 0.80) so the walk cycle can swing them.
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const leg = new THREE.Group();
    leg.position.set(0.12 * s, 0.80, 0);
    leg.add(box(0.21, 0.72, 0.23, o.shorts ? o.skin : o.pants, 0, -0.38, 0));
    if (o.shorts) leg.add(box(0.23, 0.32, 0.25, o.pants, 0, -0.17, 0));
    if (o.stripes) leg.add(box(0.23, 0.05, 0.25, o.stripes, 0, -0.58, 0));
    leg.add(box(0.22, 0.11, 0.35, o.shoes, 0, -0.755, 0.05));
    group.add(leg);
    parts['leg' + side] = leg;
  }
  if (o.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.44, 0.42, 6), mat(o.skirt));
    skirt.position.y = 0.82;
    skirt.castShadow = true;
    group.add(skirt);
  }

  // Torso: chunky angular blocks — base, chest and a shoulder bar.
  const torso = new THREE.Group();
  torso.position.set(0, 0.80, 0);
  torso.add(box(0.56, 0.62, 0.30, o.shirt, 0, 0.31, 0));
  const chest = box(0.50, 0.30, 0.33, o.shirt, 0, 0.44, 0);
  chest.rotation.x = -0.05;
  torso.add(chest);
  torso.add(box(0.66, 0.13, 0.32, o.shirt, 0, 0.585, 0));
  if (o.apron) torso.add(box(0.42, 0.46, 0.04, o.apron, 0, 0.28, 0.165));
  if (o.stripes) {
    torso.add(box(0.58, 0.06, 0.32, o.stripes, 0, 0.38, 0));
    torso.add(box(0.58, 0.06, 0.32, o.stripes, 0, 0.15, 0));
  }
  if (o.badge) torso.add(box(0.07, 0.09, 0.03, 0xffd23e, -0.15, 0.44, 0.165));
  if (o.chain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.024, 6, 12),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, flatShading: true, emissive: 0x554400 }));
    chain.position.set(0, 0.46, 0.15);
    chain.rotation.x = 0.5;
    torso.add(chain);
  }
  if (o.stethoscope) {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.02, 6, 12), mat(0x22242a));
    tube.position.set(0, 0.47, 0.145);
    tube.rotation.x = 0.45;
    torso.add(tube);
    torso.add(box(0.06, 0.06, 0.03, 0xd8dde2, 0.07, 0.27, 0.16));
  }
  if (o.hoodie) {
    const hood = ball(0.23, o.shirt, 0, 0.56, -0.20);
    hood.scale.set(1.05, 0.75, 0.72);
    torso.add(hood);
  }
  if (o.gear) {
    torso.add(box(0.62, 0.46, 0.37, o.gear, 0, 0.30, 0));       // tactical vest
    torso.add(box(0.15, 0.15, 0.06, 0x22242a, -0.14, 0.20, 0.20));
    torso.add(box(0.15, 0.15, 0.06, 0x22242a, 0.14, 0.20, 0.20));
  }
  group.add(torso);
  parts.torso = torso;

  // Arms pivot at the shoulder (y 1.32).
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const arm = new THREE.Group();
    arm.position.set(0.365 * s, 1.32, 0);
    arm.add(box(0.17, 0.56, 0.19, o.shirt, 0, -0.26, 0));
    arm.add(box(0.15, 0.15, 0.16, o.skin, 0, -0.60, 0));
    if (o.weapon && side === 'R') {
      const w = makeWeapon();
      w.position.set(0, -0.62, 0.05);
      arm.add(w);
      parts.weapon = w;
    }
    group.add(arm);
    parts['arm' + side] = arm;
  }

  // Head — a faceted low-segment sphere on a short neck, with a jaw facet,
  // two readable eyes, a nose and a mouth. Never a plain box.
  group.add(box(0.16, 0.14, 0.16, o.skin, 0, 1.44, 0));         // neck
  const head = new THREE.Group();
  head.position.set(0, 1.46, 0);
  head.add(ball(0.30, o.skin, 0, 0.28, 0));                                   // skull
  const jaw = ball(0.235, o.skin, 0, 0.15, 0.035);
  jaw.scale.set(0.94, 0.78, 0.96);
  head.add(jaw);
  head.add(box(0.06, 0.075, 0.03, 0x1c1e24, -0.105, 0.30, 0.265));            // eyes
  head.add(box(0.06, 0.075, 0.03, 0x1c1e24, 0.105, 0.30, 0.265));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 4), mat(o.skin));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.21, 0.30);
  head.add(nose);
  head.add(box(0.10, 0.025, 0.02, 0x8a5a44, 0, 0.09, 0.245));                 // mouth
  if (o.shades) head.add(box(0.27, 0.055, 0.03, 0x101216, 0, 0.305, 0.27));
  if (o.hairLong) {
    head.add(box(0.46, 0.52, 0.10, o.hatColor, 0, 0.02, -0.235));
    head.add(box(0.09, 0.40, 0.30, o.hatColor, -0.26, 0.05, -0.02));
    head.add(box(0.09, 0.40, 0.30, o.hatColor, 0.26, 0.05, -0.02));
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
    g.position.y = baseY + 0.16;
    p.armL.rotation.x = -0.4; p.armR.rotation.x = -2.6;
    p.legL.rotation.x = 0.15; p.legR.rotation.x = -0.1;
    return;
  }
  if (g.rotation.x !== 0) { g.rotation.x = 0; g.position.y = baseY; }
  const sw = Math.min(1, speed / 4) * 0.55;
  const ph = time * (4 + speed * 1.6) + fig.phase;
  p.legL.rotation.x = Math.sin(ph) * sw;
  p.legR.rotation.x = -Math.sin(ph) * sw;
  if (p.weapon && p.weapon.visible) {
    p.armR.rotation.x = -1.35;                                 // gun arm points forward
    p.armL.rotation.x = Math.sin(ph) * sw * 0.5;
  } else {
    p.armL.rotation.x = -Math.sin(ph) * sw * 0.8;
    p.armR.rotation.x = Math.sin(ph) * sw * 0.8;
  }
  p.armL.rotation.z = 0.06;
  p.armR.rotation.z = -0.06;
  p.torso.rotation.x = Math.min(0.14, speed * 0.016);
  p.head.rotation.y = Math.sin(time * 0.6 + fig.phase) * 0.14;
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
