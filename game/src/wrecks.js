// BUILD 15 — car health, explosions and burning wrecks. Until now the
// bay's cars were indestructible scenery; now every car carries hit
// points (traffic / parked / highway 100, police cruisers 140, Rio's
// Comet 130 — its armour upgrades shave a percentage off every hit).
// Gunfire (combat.js) and hard collisions (below) wear them down: a
// hood-smoke warning under 40 %, and at zero the car BLOWS — a soft
// additive flash (fx.js radial sprite, no square edges), an expanding
// ground ring and a real particle fire (THREE.Points) that burns for
// ~20 s before settling to smoke. The husk stays as a blackened,
// undrivable wreck; splash hurts whoever stands close, a police
// witness adds a star, and chain reactions are deferred a tick so an
// explosion never recurses into itself. Wrecks cap at 8 per session.

import { TUNING, groundHeight } from './config.js';
import { softDotTexture, smokeTexture, makeFlashSprite } from './fx.js';

const THREE = window.THREE;

export function createWrecks(scene, G) {
  const wreckList = [];
  const fires = [];        // { car, firePts, smokePts, t, x, y, z }
  const flashes = [];      // { sprite, ring, t }
  const pending = [];      // deferred splash damage { car, dmg }
  let lastExplosion = null;

  const particlesOff = () => (G.qualityStep || 0) >= 5;

  function hpMax(car) {
    if (car.isComet) return 130;
    return (car.kind === 'police' || car.cls === 'police') ? 140 : 100;
  }
  function hpOf(car) {
    if (car.hp === undefined) car.hp = hpMax(car);
    return car.hp;
  }

  // ---- particle helpers -------------------------------------------------
  function makePoints(n, { size, color, map, blending, opacity }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { seeds[i * 2] = Math.random(); seeds[i * 2 + 1] = Math.random(); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size, color, map, transparent: true, opacity, depthWrite: false, blending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData = { seeds, n };
    pts.frustumCulled = false;
    return pts;
  }

  // Recycle-rise animation shared by fire and smoke: each particle
  // loops from the base upward over its own lifetime, drifting a
  // little with its seed. Writes positions in the points' local frame
  // (the Points object sits at the emitter's world position).
  function animateRise(pts, t, riseH, spread, life) {
    const pos = pts.geometry.attributes.position;
    const { seeds, n } = pts.userData;
    for (let i = 0; i < n; i++) {
      const ph = ((t / life) + seeds[i * 2]) % 1;
      const ang = seeds[i * 2 + 1] * Math.PI * 2 + t * 0.7;
      const r = spread * (0.25 + 0.75 * seeds[i * 2 + 1]) * (0.4 + ph * 0.8);
      pos.setXYZ(i, Math.cos(ang) * r, ph * riseH, Math.sin(ang) * r);
    }
    pos.needsUpdate = true;
  }

  function attachHoodSmoke(car) {
    if (car.smokeFx || particlesOff()) return;
    const pts = makePoints(9, {
      size: 1.15, color: 0x6a7076, map: smokeTexture(),
      blending: THREE.NormalBlending, opacity: 0.30,
    });
    pts.position.set(0, 1.15, (car.dims ? car.dims.length * 0.32 : 1.4));
    car.group.add(pts);
    car.smokeFx = pts;
  }
  function detachHoodSmoke(car) {
    if (!car.smokeFx) return;
    car.group.remove(car.smokeFx);
    car.smokeFx.geometry.dispose();
    car.smokeFx.material.dispose();
    car.smokeFx = null;
  }

  // ---- damage + explosion -------------------------------------------------
  function hurtPlayer(dmg) {
    let d = dmg;
    if (G.player.armour > 0) {
      const soaked = Math.min(G.player.armour, d);
      G.player.armour -= soaked;
      d -= soaked;
    }
    G.player.health = Math.max(10, G.player.health - d);
  }

  function explode(car) {
    if (car.wrecked) return;
    car.wrecked = true;
    car.hp = 0;
    car.speed = 0;
    detachHoodSmoke(car);
    const p = car.group.position;
    lastExplosion = { x: p.x, y: p.y, z: p.z, t: G.time };
    // Leave the traffic flow (the husk stays in the scene as a wreck).
    if (G.traffic) G.traffic.remove(car);
    for (let i = G.police.units.length - 1; i >= 0; i--) {
      if (G.police.units[i].car === car) G.police.units.splice(i, 1);
    }
    // Rio gets out of a blowing car the hard way: beside it, hurting.
    let ejected = false;
    if (G.player.car === car) {
      ejected = true;
      G.player.exitCar(true);
      hurtPlayer(45 * (car.isComet ? (1 - 0.15 * (G.save.upgArmor || 0)) : 1));
      G.hud.toast('IT BLEW — you got clear. Just.');
    }
    // Blacken: clone materials once (the originals are kept for a
    // safehouse repair), then crush the colour down to charcoal.
    car.savedMats = [];
    car.group.traverse((m) => {
      if (!m.isMesh) return;
      car.savedMats.push([m, m.material]);
      m.material = m.material.clone();
      if (m.material.color) m.material.color.multiplyScalar(0.16);
      if (m.material.emissive) m.material.emissive.setHex(0x000000);
    });
    // Flash + expanding ring (always), particle fire + smoke (unless
    // the quality ladder's bottom rung has particles off).
    const flash = makeFlashSprite(4.5, 0xffc46b);
    flash.position.set(p.x, p.y + 1.3, p.z);
    scene.add(flash);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.05, 40),
      new THREE.MeshBasicMaterial({ color: 0xffa63e, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, p.y + 0.25, p.z);
    scene.add(ring);
    flashes.push({ sprite: flash, ring, t: 0 });
    G.audio.blast();
    if (!particlesOff()) {
      const firePts = makePoints(44, {
        size: 1.55, color: 0xff8a3c, map: softDotTexture(),
        blending: THREE.AdditiveBlending, opacity: 0.95,
      });
      firePts.position.set(p.x, p.y + 0.55, p.z);
      scene.add(firePts);
      const smokePts = makePoints(16, {
        size: 2.6, color: 0x4a4e54, map: smokeTexture(),
        blending: THREE.NormalBlending, opacity: 0.34,
      });
      smokePts.position.set(p.x, p.y + 1.0, p.z);
      scene.add(smokePts);
      fires.push({ car, firePts, smokePts, t: 0, x: p.x, y: p.y, z: p.z });
    } else {
      fires.push({ car, firePts: null, smokePts: null, t: 0, x: p.x, y: p.y, z: p.z });
    }
    // Splash: figures go down, nearby cars take a deferred hit (chain
    // reactions land next tick), a watching cruiser adds a star.
    for (const fig of G.crowd.figures) {
      const fp = fig.group.position;
      if (fig.down <= 0 && Math.hypot(fp.x - p.x, fp.z - p.z) < 5.5) { fig.hp = 0; fig.down = 5; }
    }
    const others = G.allCars().concat(G.highway ? G.highway.cars : []);
    for (const other of others) {
      if (other === car || other.wrecked) continue;
      const op = other.group.position;
      if (Math.hypot(op.x - p.x, op.z - p.z) < 6.5) pending.push({ car: other, dmg: 60 });
    }
    const pp = G.playerPos();
    if (!ejected && !G.player.car && Math.hypot(pp.x - p.x, pp.z - p.z) < 6) hurtPlayer(45);
    let witnessed = false;
    for (const u of G.police.units) {
      const up = u.car.group.position;
      if (Math.hypot(up.x - p.x, up.z - p.z) < 45) { witnessed = true; break; }
    }
    if (witnessed) G.police.addHeat(TUNING.starHeat);
    // The session's wreck cap: the oldest husk is towed away.
    wreckList.push(car);
    if (wreckList.length > 8) {
      const old = wreckList.shift();
      const fi = fires.findIndex((f) => f.car === old);
      if (fi >= 0) { removeFire(fires[fi]); fires.splice(fi, 1); }
      scene.remove(old.group);
      const gi = G.cars.indexOf(old);
      if (gi >= 0) G.cars.splice(gi, 1);
    }
  }

  function removeFire(f) {
    for (const pts of [f.firePts, f.smokePts]) {
      if (!pts) continue;
      scene.remove(pts);
      pts.geometry.dispose();
      pts.material.dispose();
    }
    f.firePts = null;
    f.smokePts = null;
  }

  function damageCar(car, dmg) {
    if (!car || car.wrecked || !(dmg > 0)) return;
    let d = dmg;
    if (car.isComet) d *= (1 - 0.18 * (G.save.upgArmor || 0));
    car.hp = hpOf(car) - d;
    if (car.hp <= hpMax(car) * 0.4 && car.hp > 0) attachHoodSmoke(car);
    if (car.hp <= 0) explode(car);
  }

  // Full repair (the safehouse rest does this for the Comet): fresh
  // HP, original paint back on, fire out, wreck flag cleared.
  function repairCar(car) {
    detachHoodSmoke(car);
    const fi = fires.findIndex((f) => f.car === car);
    if (fi >= 0) { removeFire(fires[fi]); fires.splice(fi, 1); }
    if (car.savedMats) {
      for (const [mesh, mat] of car.savedMats) mesh.material = mat;
      car.savedMats = null;
    }
    const wi = wreckList.indexOf(car);
    if (wi >= 0) wreckList.splice(wi, 1);
    car.wrecked = false;
    car.hp = hpMax(car);
  }

  // ---- per-step update -----------------------------------------------------
  function update(dt) {
    // Deferred chain damage lands a tick after the blast that caused it.
    while (pending.length) {
      const p = pending.pop();
      damageCar(p.car, p.dmg);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      const k = f.t / 0.45;
      if (k >= 1) {
        scene.remove(f.sprite); scene.remove(f.ring);
        f.sprite.material.dispose(); f.ring.material.dispose(); f.ring.geometry.dispose();
        flashes.splice(i, 1);
        continue;
      }
      const sc = 4.5 + k * 6;
      f.sprite.scale.set(sc, sc, 1);
      f.sprite.material.opacity = 0.95 * (1 - k);
      f.ring.scale.setScalar(1 + k * 6.5);
      f.ring.material.opacity = 0.85 * (1 - k);
    }
    for (const f of fires) {
      f.t += dt;
      if (f.firePts) {
        if (f.t > 20) { // the fire dies down; smoke only from here
          scene.remove(f.firePts);
          f.firePts.geometry.dispose(); f.firePts.material.dispose();
          f.firePts = null;
        } else {
          animateRise(f.firePts, f.t * 1.6, 2.1, 1.15, 0.7);
          f.firePts.material.opacity = 0.95 * Math.min(1, (20 - f.t) / 3 + 0.25);
        }
      }
      if (f.smokePts) animateRise(f.smokePts, f.t, 3.6, 1.3, 2.6);
    }
    // Hood smoke on merely-damaged cars.
    for (const car of G.allCars()) if (car.smokeFx) animateRise(car.smokeFx, G.time * 1.4, 1.1, 0.35, 1.4);
    if (G.highway) for (const car of G.highway.cars) if (car.smokeFx) animateRise(car.smokeFx, G.time * 1.4, 1.1, 0.35, 1.4);

    // Car-vs-car contact for the player's car: traffic finally has
    // something to hit. A fast overlap damages both sides (the other
    // car harder), shoves a roadblock car sideways (police.js reads
    // car.shove), and bleeds the player's speed.
    const pc = G.player.car;
    if (pc && !pc.wrecked) {
      const pp = pc.group.position;
      const others = G.allCars().concat(G.highway ? G.highway.cars : []);
      for (const other of others) {
        if (other === pc) continue;
        const op = other.group.position;
        const dx = pp.x - op.x, dz = pp.z - op.z;
        const d = Math.hypot(dx, dz);
        if (d > 3.3 || d < 0.001) continue;
        const rel = Math.abs(pc.speed);
        if (rel > 5 && G.time - (other.lastHitAt || -9) > 0.6) {
          other.lastHitAt = G.time;
          damageCar(other, rel * 2.0);
          damageCar(pc, rel * 0.9);
          if (other.blockCar) other.shove = { x: -dx / d, z: -dz / d, power: rel * 0.55 };
          G.audio.thud();
        }
        // Push the player's car out of the overlap, speed bleeding off.
        const push = (3.3 - d) * 0.5;
        pp.x += (dx / d) * push;
        pp.z += (dz / d) * push;
        pp.y = groundHeight(pp.x, pp.z);
        if (rel > 3) pc.speed *= 0.55;
      }
    }
  }

  return {
    damageCar, repairCar, update, hpOf, hpMax,
    isWreck: (car) => !!car.wrecked,
    get wrecks() { return wreckList; },
    get fires() { return fires; },
    get lastExplosion() { return lastExplosion; },
  };
}
