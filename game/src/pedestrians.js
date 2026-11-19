// The living crowd. Four populations share the Polygon War figure kit:
//  - shoppers stroll the promenade and stop at shop fronts to "buy",
//  - city walkers pace the SIDEWALKS and the park path,
//  - beach life: sunbathers on towels, a volleyball rally, swimmers,
//  - one keeper per shop, dressed for their shop, standing at the door,
// plus role NPCs (clinic staff, firefighters, your friend) and a lone
// fisherman on the lake dock up north. Walkers follow waypoint loops and
// stand on groundHeight, so they ride the sidewalks and the terrain.

import { WORLD, SHOPS, PALETTE, groundHeight, heightAt } from './config.js';
import { makeFigure, poseFigure, poseSunbather, poseSwimmer } from './characters.js';
import { pick, range } from './random.js';

const THREE = window.THREE;

function lam(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}
function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function randomOutfit(rng, beachy) {
  const o = {
    skin: pick(rng, PALETTE.skin),
    shirt: pick(rng, PALETTE.shirts),
    pants: pick(rng, PALETTE.pants),
    hat: rng() > 0.55 ? pick(rng, ['cap', 'sun', 'hair']) : null,
    hatColor: pick(rng, PALETTE.shirts),
    shorts: beachy ? rng() > 0.4 : rng() > 0.8,
  };
  // About half the city is women: long hair, sometimes a skirt.
  if (rng() > 0.52) {
    o.hairLong = true;
    o.hat = null;
    o.hatColor = pick(rng, [0x3a2a1a, 0x14100c, 0x8a5a2b, 0xd8b36a, 0xb03a2e]);
    if (rng() > 0.45) { o.skirt = pick(rng, PALETTE.shirts); o.shorts = false; }
  }
  return o;
}

// Waypoint routes: promenade line, shop front line, park loop, the city
// SIDEWALKS (avenue east strips + street strips), and a lakeside stroll.
function buildRoutes() {
  const routes = [];
  routes.push({ pts: [[-170, WORLD.promenadeZ], [170, WORLD.promenadeZ]], loop: false });
  routes.push({ pts: [[-118, WORLD.shopsZ + 6.5], [118, WORLD.shopsZ + 6.5]], loop: false });
  const park = WORLD.park;
  routes.push({ pts: [[park.x0 + 5, 58], [park.x1 - 5, 58], [park.x1 - 5, 76], [park.x0 + 5, 76]], loop: true });
  for (const x of [-100, -50, 0, 50, 100]) {
    routes.push({ pts: [[x + 9.3, 26], [x + 9.3, 158]], loop: false });       // avenue sidewalks
  }
  routes.push({ pts: [[-155, 70.7], [145, 70.7]], loop: false });             // street sidewalks
  routes.push({ pts: [[-155, 134.3], [145, 134.3]], loop: false });
  routes.push({ pts: [[16, -96], [96, -100]], loop: false });                 // lakeside stroll
  return routes;
}

export function createCrowd(scene, rng) {
  const figures = [];   // every animated figure, for combat lookups
  const walkers = [];

  function addWalker(route, t0) {
    const fig = makeFigure(randomOutfit(rng, route.pts[0][1] > 80));
    fig.phase = rng() * 6;
    if (rng() > 0.85) fig.group.scale.setScalar(0.62);   // a kid, shorter than the adults
    scene.add(fig.group);
    const w = { fig, route, seg: 0, t: t0, dir: 1, pause: 0, speed: range(rng, 2.2, 3.6) };
    walkers.push(w);
    figures.push(fig);
    placeOnRoute(w);
    return w;
  }

  const routes = buildRoutes();
  for (let i = 0; i < 30; i++) addWalker(routes[i % routes.length], (i * 0.37) % 1);
  // Extra shoppers dedicated to the shop-front route so it never empties.
  for (let i = 0; i < 8; i++) addWalker(routes[1], i / 8);

  function placeOnRoute(w) {
    const pts = w.route.pts;
    const a = pts[w.seg];
    const b = pts[(w.seg + 1) % pts.length];
    const x = a[0] + (b[0] - a[0]) * w.t;
    const z = a[1] + (b[1] - a[1]) * w.t;
    const y = groundHeight(x, z);
    w.fig.group.position.set(x, y, z);
    w.fig.baseY = y;
    w.fig.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) * w.dir;
    if (w.dir < 0) w.fig.group.rotation.y += Math.PI;
    return { x, z };
  }

  function updateWalker(w, dt, time) {
    const fig = w.fig;
    if (fig.down > 0) { fig.down -= dt; poseFigure(fig, time, 0); return; }
    if (w.pause > 0) { w.pause -= dt; poseFigure(fig, time, 0); return; }
    const pts = w.route.pts;
    const a = pts[w.seg];
    const b = pts[(w.seg + 1) % pts.length];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    w.t += (w.speed * dt / segLen) * w.dir;
    if (w.t >= 1 || w.t <= 0) {
      if (w.route.loop) {
        w.seg = (w.seg + 1) % pts.length;
        w.t = 0;
      } else if (w.t >= 1) {
        if (w.seg < pts.length - 2) { w.seg += 1; w.t = 0; }
        else { w.dir = -1; w.t = 1; }
      } else {
        if (w.seg > 0) { w.seg -= 1; w.t = 1; }
        else { w.dir = 1; w.t = 0; }
      }
      // Shoppers pause at shop fronts as if buying.
      if (w.route === routes[1] && rng() > 0.45) w.pause = range(rng, 1.5, 4);
    }
    placeOnRoute(w);
    poseFigure(fig, time, w.speed);
  }

  // ---- Shopkeepers, dressed per shop --------------------------------------
  const keeperHats = { fish: 'cap', tackle: 'cap', donuts: 'chef', coffee: 'cap', icecream: 'chef', candy: 'sun', juice: 'cap', market: 'cap', souvenir: 'sun' };
  for (const shop of SHOPS) {
    const fig = makeFigure({
      skin: pick(rng, PALETTE.skin), shirt: 0xf7f0dd, pants: 0x3a506b,
      apron: shop.keeper, hat: keeperHats[shop.kind] || 'cap', hatColor: shop.color,
    });
    const kx = shop.x + 2.8, kz = WORLD.shopsZ + 6.4;
    fig.group.position.set(kx, groundHeight(kx, kz), kz);
    fig.baseY = groundHeight(kx, kz);
    fig.group.rotation.y = 0;   // face the promenade and the beach
    scene.add(fig.group);
    figures.push(fig);
    fig.still = true;
  }

  // ---- Role NPCs: clinic staff, firefighters, your friend, a fisherman ----
  function addRoleFigure(opts, x, z, ry) {
    const fig = makeFigure(opts);
    fig.group.position.set(x, groundHeight(x, z), z);
    fig.baseY = groundHeight(x, z);
    fig.group.rotation.y = ry;
    scene.add(fig.group);
    figures.push(fig);
    fig.still = true;
    return fig;
  }
  // Doctor in a white coat with a stethoscope, nurse in scrubs + cap,
  // outside the Bay Clinic: the doctor at the west corner, the nurse east
  // of the door — both clear of the parked ambulance's bulk so they read
  // instantly from the promenade.
  addRoleFigure({
    skin: 0xe0ac7e, shirt: 0xffffff, apron: 0xf0f0ea, pants: 0x3a506b,
    stethoscope: true, hat: 'hair', hatColor: 0x3a2a1a,
  }, -134.5, 189, 0.35);
  addRoleFigure({
    skin: 0xc68863, shirt: 0x39b5a8, pants: 0x2a7f74,
    hat: 'nurse', hairLong: true, hatColor: 0x14100c,
  }, -118.5, 186, -0.3);
  // Two firefighters by their truck: red helmets, reflective stripes.
  for (const [fx, fz, fry] of [[52.5, 27.5, 2.4], [60, 27, -2.6]]) {
    addRoleFigure({
      skin: pick(rng, PALETTE.skin), shirt: 0x27324a, pants: 0x27324a,
      hat: 'fire', stripes: 0xf7d154,
    }, fx, fz, fry);
  }
  // Your friend — hoodie and cap — waits at the pier entrance with the jobs.
  // A bobbing gold "!" floats over his head.
  const friend = addRoleFigure({
    skin: 0x9c6644, shirt: 0x5b8c5a, pants: 0x2b2d42,
    hoodie: true, hat: 'cap', hatColor: 0xd42427,
  }, WORLD.pier.x - 3.4, 190, Math.PI * 0.55);
  const bang = box(0.16, 0.62, 0.16, 0xffd23e, 0, 0, 0);
  const bangDot = box(0.16, 0.16, 0.16, 0xffd23e, 0, -0.5, 0);
  const bangGroup = new THREE.Group();
  bangGroup.add(bang); bangGroup.add(bangDot);
  bangGroup.position.set(WORLD.pier.x - 3.4, 3.35, 190);
  scene.add(bangGroup);
  // A fisherman at the end of the lake dock, up north.
  addRoleFigure({
    skin: 0x7a4b2a, shirt: 0xf2b134, pants: 0x386641,
    hat: 'cap', hatColor: 0x2e86c8,
  }, 50, -114, Math.PI);

  // ---- Beach life -----------------------------------------------------------
  const beachAnims = [];
  beachAnims.push((t) => { bangGroup.position.y = 3.35 + Math.sin(t * 2.2) * 0.14; });
  for (let i = 0; i < 9; i++) {
    const x = range(rng, -160, 165);
    const z = range(rng, 202, 224);
    if (Math.abs(x - WORLD.statue.x) < 9 && z > 198 && z < 226) continue;
    if (Math.abs(x - WORLD.pier.x) < 6) continue;
    const h = heightAt(x, z);
    const towel = box(1.4, 0.06, 2.4, pick(rng, PALETTE.shirts), x, h + 0.05, z);
    towel.rotation.y = range(rng, -0.4, 0.4);
    scene.add(towel);
    const fig = makeFigure({ skin: pick(rng, PALETTE.skin), shirt: pick(rng, PALETTE.shirts), pants: pick(rng, PALETTE.shirts), shorts: true, hat: 'sun', hatColor: 0xf7e0a0 });
    fig.group.position.set(x, h, z);
    fig.baseY = h;
    fig.group.rotation.y = towel.rotation.y;
    scene.add(fig.group);
    poseSunbather(fig);
    fig.noPose = true;   // poseFigure must not stand them back up
    figures.push(fig);
    fig.still = true;
    if (i % 2 === 0) {
      const um = new THREE.Group();
      um.add(box(0.09, 2.4, 0.09, 0x8a6844, 0, 1.2, 0));
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.8, 8), lam(pick(rng, PALETTE.shirts)));
      top.position.y = 2.5; top.castShadow = true;
      um.add(top);
      um.position.set(x + 1.4, h, z - 0.6);
      um.rotation.z = 0.16;
      scene.add(um);
    }
  }
  // One more sunbather on the little lake beach, up north.
  {
    const x = 76, z = -100;
    const h = heightAt(x, z);
    const fig = makeFigure({ skin: pick(rng, PALETTE.skin), shirt: pick(rng, PALETTE.shirts), pants: pick(rng, PALETTE.shirts), shorts: true, hat: 'sun', hatColor: 0xf7e0a0 });
    fig.group.position.set(x, h, z);
    fig.baseY = h;
    scene.add(fig.group);
    poseSunbather(fig);
    fig.noPose = true;
    figures.push(fig);
    fig.still = true;
  }

  // Volleyball: four players around a net, ball arcing between them.
  const vBase = heightAt(36, 212);
  const net = new THREE.Group();
  net.add(box(0.16, 2.2, 0.16, 0x33373d, -4, 1.1, 0));
  net.add(box(0.16, 2.2, 0.16, 0x33373d, 4, 1.1, 0));
  net.add(box(8, 1, 0.06, 0xffffff, 0, 1.7, 0));
  net.position.set(36, vBase, 212);
  scene.add(net);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lam(0xffffff));
  ball.castShadow = true;
  scene.add(ball);
  const volley = [];
  for (const [vx, vz] of [[32, 208], [40, 208], [32, 216], [40, 216]]) {
    const fig = makeFigure(randomOutfit(rng, true));
    fig.group.position.set(vx, heightAt(vx, vz), vz);
    fig.baseY = heightAt(vx, vz);
    fig.group.rotation.y = Math.atan2(36 - vx, 212 - vz);
    scene.add(fig.group);
    figures.push(fig);
    volley.push(fig);
  }
  beachAnims.push((t) => {
    const k = (t % 2.4) / 2.4;
    const from = k < 0.5 ? [32.5, 209] : [39.5, 215];
    const to = k < 0.5 ? [39.5, 215] : [32.5, 209];
    const u = (k % 0.5) * 2;
    ball.position.set(from[0] + (to[0] - from[0]) * u, vBase + 2.2 + Math.sin(u * Math.PI) * 1.7, from[1] + (to[1] - from[1]) * u);
    for (const fig of volley) poseFigure(fig, t, 0);
  });

  // Swimmers bobbing beyond the foam line, south shore.
  const swimmers = [];
  for (let i = 0; i < 6; i++) {
    const fig = makeFigure({ skin: pick(rng, PALETTE.skin), shirt: pick(rng, PALETTE.shirts), pants: pick(rng, PALETTE.pants), shorts: true });
    fig.group.position.set(range(rng, -120, 140), 0, range(rng, 240, 256));
    fig.baseY = 0.3;
    scene.add(fig.group);
    figures.push(fig);
    swimmers.push(fig);
  }
  beachAnims.push((t) => { for (const s of swimmers) poseSwimmer(s, t); });

  function update(dt, time) {
    for (const w of walkers) updateWalker(w, dt, time);
    for (const f of figures) if (f.still) poseFigure(f, time, 0);
    for (const a of beachAnims) a(time);
  }

  return { figures, walkers, update };
}
