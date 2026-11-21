// The living crowd. Four populations share the Polygon War figure kit:
//  - shoppers stroll the promenade and stop at shop fronts to "buy",
//  - city walkers pace the SIDEWALKS and the park path,
//  - beach life: sunbathers on towels, a volleyball rally, swimmers,
//  - one keeper per shop, dressed for their shop, standing at the door,
// plus role NPCs (clinic staff, firefighters, your friend) and a lone
// fisherman on the lake dock up north. Walkers follow waypoint loops and
// stand on groundHeight, so they ride the sidewalks and the terrain.

import { WORLD, SHOPS, PALETTE, groundHeight, heightAt, waterDepthAt, SEA_LEVEL } from './config.js';
import { makeFigure, poseFigure, poseSunbather, poseSwimmer } from './characters.js';
import { pick, range, makeRng } from './random.js';

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
  // Traffic cars, wired in by main.js, so walkers can yield at kerbs.
  let trafficCarsFn = () => [];

  function addWalker(route, t0, opts = {}) {
    const fig = makeFigure(opts.outfit || randomOutfit(rng, route.pts[0][1] > 80));
    fig.phase = rng() * 6;
    if (!opts.noKid && rng() > 0.85) fig.group.scale.setScalar(0.72);   // a kid, shorter than the adults
    scene.add(fig.group);
    const w = { fig, route, seg: 0, t: t0, dir: 1, pause: 0, speed: opts.speed || range(rng, 2.2, 3.6), lat: opts.lat || 0 };
    walkers.push(w);
    figures.push(fig);
    placeOnRoute(w);
    return w;
  }

  const routes = buildRoutes();
  for (let i = 0; i < 32; i++) addWalker(routes[i % routes.length], (i * 0.37) % 1);
  // Extra shoppers dedicated to the shop-front route so it never empties.
  for (let i = 0; i < 10; i++) addWalker(routes[1], i / 10);
  // Pairs stroll side by side: same route, same pace, a shoulder apart.
  for (const [ri, t0] of [[0, 0.2], [0, 0.65], [1, 0.45], [5, 0.3]]) {
    const speed = range(rng, 2.4, 3.2);
    addWalker(routes[ri], t0, { lat: 0.8, speed, noKid: true });
    addWalker(routes[ri], t0, { lat: -0.8, speed, noKid: true });
  }
  // Joggers in neon: the park loop, the promenade, one avenue sidewalk.
  const NEON = [0xff5964, 0xffd23e, 0x06d6a0, 0x00bbf9, 0xf15bb5];
  for (const [ri, t0] of [[2, 0.1], [2, 0.55], [0, 0.4], [0, 0.85], [5, 0.6]]) {
    const outfit = randomOutfit(rng, true);
    outfit.shirt = pick(rng, NEON);
    outfit.shorts = true;
    outfit.skirt = null;
    addWalker(routes[ri], t0, { outfit, speed: range(rng, 5.4, 6.6), noKid: true });
  }

  // Pure route interpolation (no side effects) so the kerb-yield check in
  // updateWalker can preview the walker's next position.
  function routePoint(route, seg, t, lat) {
    const pts = route.pts;
    const a = pts[seg];
    const b = pts[(seg + 1) % pts.length];
    let x = a[0] + (b[0] - a[0]) * t;
    let z = a[1] + (b[1] - a[1]) * t;
    if (lat) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      x += (-dz / len) * lat;
      z += (dx / len) * lat;
    }
    return { x, z };
  }

  function placeOnRoute(w) {
    const pts = w.route.pts;
    const a = pts[w.seg];
    const b = pts[(w.seg + 1) % pts.length];
    const { x, z } = routePoint(w.route, w.seg, w.t, w.lat);
    const y = groundHeight(x, z);
    w.fig.group.position.set(x, y, z);
    w.fig.baseY = y;
    w.fig.group.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) * w.dir;
    if (w.dir < 0) w.fig.group.rotation.y += Math.PI;
    return { x, z };
  }

  // Is (x, z) inside a traffic road band (avenue or street carriageway)?
  function inRoadBand(x, z) {
    if (z > 12 && z < 200) for (const a of WORLD.avenues) if (Math.abs(x - a) < WORLD.roadHalf + 0.9) return true;
    if (x > -174 && x < 164) for (const s of WORLD.streets.concat([WORLD.oceanDrive])) if (Math.abs(z - s) < WORLD.roadHalf + 0.9) return true;
    return false;
  }
  function carNear(x, z) {
    for (const c of trafficCarsFn()) {
      const p = c.group.position;
      if (Math.hypot(p.x - x, p.z - z) < 9) return true;
    }
    return false;
  }

  function updateWalker(w, dt, time) {
    const fig = w.fig;
    if (fig.down > 0) { fig.down -= dt; poseFigure(fig, time, 0); return; }
    if (w.pause > 0) { w.pause -= dt; poseFigure(fig, time, 0); return; }
    const pts = w.route.pts;
    const a = pts[w.seg];
    const b = pts[(w.seg + 1) % pts.length];
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // Kerb yield (physics pass): a walker about to STEP INTO a road band
    // waits while a car bears down on that spot. Once in the road they
    // keep walking — traffic brakes for them instead (vehicles.js).
    const nextT = w.t + (w.speed * dt / segLen) * w.dir;
    if (nextT > 0 && nextT < 1 && !inRoadBand(fig.group.position.x, fig.group.position.z)) {
      const cand = routePoint(w.route, w.seg, nextT, w.lat);
      if (inRoadBand(cand.x, cand.z) && carNear(cand.x, cand.z)) { poseFigure(fig, time, 0); return; }
    }
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
  const keeperHats = { sushi: 'chef', taco: 'cap', donuts: 'chef', coffee: 'cap', icecream: 'chef', burger: 'cap', noodle: 'chef', pizza: 'chef', souvenir: 'sun' };
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
  bangGroup.position.set(WORLD.pier.x - 3.4, 2.42, 190);
  scene.add(bangGroup);
  // A fisherman at the end of the lake dock, up north.
  addRoleFigure({
    skin: 0x7a4b2a, shirt: 0xf2b134, pants: 0x386641,
    hat: 'cap', hatColor: 0x2e86c8,
  }, 50, -114, Math.PI);
  // Two people waiting at the Ocean Drive bus stop world.js built.
  addRoleFigure(randomOutfit(rng, false), 28.6, 158.7, 0.3);
  addRoleFigure(randomOutfit(rng, false), 31.8, 158.7, -0.25);
  // BUILD 7: the promenade kiosk vendors (kiosk structures are world.js
  // buildCity7 — same coordinates by convention, like the bench sitters;
  // fixed outfits, no rng draws) and two soldiers at the garrison gate.
  addRoleFigure({
    skin: 0xe0ac7e, shirt: 0xf7f0dd, pants: 0x3a506b,
    apron: 0xd42a2a, hat: 'cap', hatColor: 0xd42a2a,
  }, -56, 188.9, 0);
  addRoleFigure({
    skin: 0xc68863, shirt: 0xf7f0dd, pants: 0x5c374c,
    apron: 0xff6fa5, hat: 'chef', hairLong: true, hatColor: 0x3a2a1a,
  }, 48, 188.9, 0);
  addRoleFigure({
    skin: 0x9c6644, shirt: 0xf7f0dd, pants: 0x2b2d42,
    apron: 0x2e86c8, hat: 'cap', hatColor: 0x2e86c8,
  }, 113, 188.9, 0);
  addRoleFigure({
    skin: 0x7a4b2a, shirt: 0x556b2f, pants: 0x4a5a28,
    hat: 'cap', hatColor: 0x556b2f, rifle: true,
  }, 106.5, -27.5, -Math.PI / 2);
  addRoleFigure({
    skin: 0xf2c79b, shirt: 0x556b2f, pants: 0x4a5a28,
    hat: 'cap', hatColor: 0x556b2f, rifle: true,
  }, 106.5, -32.5, -Math.PI / 2);
  // BUILD 10: the living garrison — two standing sentries (HQ door,
  // hangar door), a six-soldier drill formation on the parade ground,
  // and two patrol pairs walking loops on the base's internal roads.
  // Structures stand in world.js buildCity7 at the same coordinates by
  // convention. All randomness comes from an own stream (rPatrol), so
  // the city's seeded layout is untouched.
  const SOLDIER = { shirt: 0x556b2f, pants: 0x4a5a28, hat: 'cap', hatColor: 0x556b2f, rifle: true };
  addRoleFigure({ skin: 0xc68863, ...SOLDIER }, 131, -55.9, 0.12);
  addRoleFigure({ skin: 0x8a5a3b, ...SOLDIER }, 143.9, -42, -Math.PI / 2);
  const drillSkins = [0xf2c79b, 0xc68863, 0x9c6644, 0x7a4b2a, 0xe0ac7e, 0x8a5a3b];
  [[122, -50.2], [125, -50.2], [128, -50.2], [122, -52.4], [125, -52.4], [128, -52.4]]
    .forEach(([dx, dz], i) => {
      addRoleFigure({ skin: drillSkins[i], ...SOLDIER }, dx, dz, Math.PI);
    });
  const rPatrol = makeRng(20261121);
  const patrolA = { pts: [[113, -30.5], [137, -30.5], [137, -38.5], [113, -38.5]], loop: true };
  const patrolB = { pts: [[161.5, -45], [165, -53.5], [175, -53.5], [180, -45], [175, -36.5], [165, -36.5]], loop: true };
  function addPatrol(route, t0, lat) {
    const fig = makeFigure({
      skin: pick(rPatrol, PALETTE.skin), shirt: 0x556b2f, pants: 0x4a5a28,
      hat: 'cap', hatColor: 0x556b2f, gear: 0x44542a, shoes: 0x2a2a24, rifle: true,
    });
    fig.phase = rPatrol() * 6;
    scene.add(fig.group);
    const w = { fig, route, seg: 0, t: t0, dir: 1, pause: 0, speed: 2.6, lat };
    walkers.push(w);
    figures.push(fig);
    placeOnRoute(w);
  }
  addPatrol(patrolA, 0.15, 0.8);
  addPatrol(patrolA, 0.15, -0.8);
  addPatrol(patrolB, 0.55, 0.8);
  addPatrol(patrolB, 0.55, -0.8);

  // ---- Bench sitters on the promenade (benches are world.js furniture) ---
  for (const bx of [-60, 30, 120]) {
    const fig = makeFigure(randomOutfit(rng, true));
    const seatY = groundHeight(bx, 196.8) + 0.49;   // the bench seat top
    fig.group.position.set(bx, seatY - 0.96, 196.8);
    fig.baseY = seatY - 0.96;
    fig.group.rotation.y = 0;                        // facing the sea
    fig.parts.legL.rotation.x = -0.95;               // legs swung forward,
    fig.parts.legR.rotation.x = -0.95;               // feet near the boards
    fig.parts.armL.rotation.x = -0.25;
    fig.parts.armR.rotation.x = -0.25;
    fig.noPose = true;
    fig.seated = true;   // physics check asserts hips vs the bench seat top
    scene.add(fig.group);
    figures.push(fig);
  }

  // ---- Short queues at three shop doors, facing their keeper -------------
  for (const shop of [SHOPS[2], SHOPS[4], SHOPS[7]]) {   // donuts, icecream, pizza
    for (let q = 0; q < 2; q++) {
      const fig = makeFigure(randomOutfit(rng, true));
      const qx = shop.x + 2.8 + (q ? 0.3 : 0);
      const qz = WORLD.shopsZ + 7.6 + q * 1.3;
      fig.group.position.set(qx, groundHeight(qx, qz), qz);
      fig.baseY = groundHeight(qx, qz);
      fig.group.rotation.y = Math.PI - q * 0.18;         // face the shop
      scene.add(fig.group);
      figures.push(fig);
      fig.still = true;
    }
  }

  // ---- Beach life -----------------------------------------------------------
  const beachAnims = [];
  beachAnims.push((t) => { bangGroup.position.y = 2.42 + Math.sin(t * 2.2) * 0.14; });
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
    fig.anchorX = vx;   // they shuffle ±1 m around this mark when playing
    fig.anchorZ = vz;
    fig.group.rotation.y = Math.atan2(36 - vx, 212 - vz);
    scene.add(fig.group);
    figures.push(fig);
    volley.push({ fig, hx: vx, hz: vz, baseY: heightAt(vx, vz) });
  }
  beachAnims.push((t) => {
    const k = (t % 2.4) / 2.4;
    const from = k < 0.5 ? [32.5, 209] : [39.5, 215];
    const to = k < 0.5 ? [39.5, 215] : [32.5, 209];
    const u = (k % 0.5) * 2;
    ball.position.set(from[0] + (to[0] - from[0]) * u, vBase + 2.2 + Math.sin(u * Math.PI) * 1.7, from[1] + (to[1] - from[1]) * u);
    // The players shuffle around their marks; whoever receives the ball
    // hops up to meet it as it arrives.
    volley.forEach((p, i) => {
      poseFigure(p.fig, t, 0.7);
      const recv = (k < 0.5 && i === 3) || (k >= 0.5 && i === 0);
      const hop = recv && u > 0.72 ? Math.sin((u - 0.72) / 0.28 * Math.PI) * 0.5 : 0;
      p.fig.group.position.set(
        p.hx + Math.sin(t * 0.9 + i * 1.7) * 1.1,
        p.baseY + hop,
        p.hz + Math.cos(t * 0.7 + i * 2.3) * 0.8);
    });
  });

  // Swimmers, placed by the point-in-water test (physics standard #4):
  // an anchor is accepted only when waterDepthAt — the same maths that
  // draws the coastline — reports 0.45–1.15 m of water there AND across
  // the whole drift disc, so nobody can end up paddling on sand. The old
  // fixed z-band ignored the Fourier coastline and beached half of them.
  // baseY sits 0.20 BELOW the surface so the body is in the water with
  // just the back and head breaking it. Anchors are resampled until the
  // test passes; tools/physics_check.py re-verifies every anchor in-page.
  const swimmers = [];
  function addSwimmer(x, z, surfaceY) {
    const fig = makeFigure({ skin: pick(rng, PALETTE.skin), shirt: pick(rng, PALETTE.shirts), pants: pick(rng, PALETTE.pants), shorts: true });
    fig.group.position.set(x, 0, z);
    fig.baseY = surfaceY - 0.20;
    fig.baseX = x;
    fig.baseZ = z;
    scene.add(fig.group);
    figures.push(fig);
    swimmers.push(fig);
  }
  function swimSpotOK(x, z) {
    const d = waterDepthAt(x, z);
    if (d < 0.45 || d > 1.15) return false;
    for (const [ox, oz] of [[3.2, 1.5], [-3.2, 1.5], [3.2, -1.5], [-3.2, -1.5]]) {
      if (waterDepthAt(x + ox, z + oz) < 0.3) return false;
    }
    if (x > 1 && x < 15 && z > 185 && z < 256) return false;   // keep off the pier
    return true;
  }
  function findSeaSpot(x0, x1, z0, z1) {
    for (let i = 0; i < 300; i++) {
      const x = range(rng, x0, x1), z = range(rng, z0, z1);
      if (swimSpotOK(x, z)) return [x, z];
    }
    return null;
  }
  // Three in the camera sector off the main beach (in frame for both the
  // beach and gulls shot cameras), five spread along the whole shore.
  for (let i = 0; i < 3; i++) { const s = findSeaSpot(-10, 70, 240, 264); if (s) addSwimmer(s[0], s[1], SEA_LEVEL); }
  for (let i = 0; i < 5; i++) { const s = findSeaSpot(-165, 175, 230, 282); if (s) addSwimmer(s[0], s[1], SEA_LEVEL); }
  // Two in the lake, on the ring where the bed gives swimming depth.
  for (let i = 0; i < 2; i++) {
    let spot = null;
    for (let k = 0; k < 300 && !spot; k++) {
      const a = rng() * Math.PI * 2, r = range(rng, 4, WORLD.lake.waterR - 4);
      const x = WORLD.lake.x + Math.cos(a) * r, z = WORLD.lake.z + Math.sin(a) * r;
      if (swimSpotOK(x, z)) spot = [x, z];
    }
    if (spot) addSwimmer(spot[0], spot[1], WORLD.lake.waterY);
  }
  beachAnims.push((t) => {
    for (const s of swimmers) {
      s.group.position.x = s.baseX + Math.sin(t * 0.12 + s.phase) * 3.2;
      s.group.position.z = s.baseZ + Math.cos(t * 0.09 + s.phase) * 1.5;
      poseSwimmer(s, t);
    }
  });

  function update(dt, time) {
    for (const w of walkers) updateWalker(w, dt, time);
    for (const f of figures) if (f.still) poseFigure(f, time, 0);
    for (const a of beachAnims) a(time);
  }

  return {
    figures, walkers, swimmers, update,
    setTrafficCars(fn) { trafficCarsFn = fn; },
  };
}
