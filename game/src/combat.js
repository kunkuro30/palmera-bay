// Combat, two flavours:
//  - Fists: a punch that knocks a pedestrian flat (and is very much a crime).
//  - TPS gunplay: while aiming (right mouse held), a left click fires a
//    raycast from the camera through the centre-screen crosshair; the
//    nearest figure or police cruiser inside the ray takes the hit.
// Police contact damage while they ram, and the busted reset when health
// runs out. No gore — figures just topple.

import { TUNING } from './config.js';
import { softDotTexture, createVfxBursts } from './fx.js';

const THREE = window.THREE;

export function createCombat(G) {
  let punchCooldown = 0;
  let shootCooldown = 0;
  let lastBustedAt = -99;   // build 12: main.js tells a bust apart from an evasion
  let lastDryAt = -99;      // build 15: dry-click sound/prompt throttle
  const puffs = [];         // build 15: live muzzle-smoke sprites
  const bursts = createVfxBursts(G.scene);   // build 15: CleanVfx flash + impact sparks

  function punch() {
    if (punchCooldown > 0 || G.player.car) return;
    punchCooldown = 0.45;
    const p = G.playerPos();
    let best = null;
    let bestD = 2.6;
    for (const fig of G.crowd.figures) {
      const fp = fig.group.position;
      const d = Math.hypot(fp.x - p.x, fp.z - p.z);
      if (d < bestD && fig.down <= 0) { best = fig; bestD = d; }
    }
    G.player.swingArm();
    if (best) {
      best.down = 4;
      G.police.addHeat(70);
      G.audio.thud();
      G.hud.toast('Bad idea. The police saw that.');
    } else {
      G.audio.whoosh();
    }
  }

  // Fire one shot down the crosshair. The ray starts at the camera and runs
  // through the screen centre — exactly where the crosshair is drawn.
  // BUILD 14: the CURRENT weapon's stats drive the shot — damage, range
  // and the refire cooldown all come from weapons.js; figures carry hit
  // points now (a pistol drops a man in three, the rifle in two, the
  // SMG in a burst), and every trigger pull is counted on G.weapons.
  function shoot() {
    const w = G.weapons ? G.weapons.def() : null;
    if (shootCooldown > 0 || G.player.car || !G.player.aiming || !w || w.id === 'fists') return;
    // BUILD 15: the magazine gates the shot. A dry trigger clicks and
    // flashes the reload prompt (throttled — a held SMG trigger must
    // not spam either); a running reload swallows the pull silently.
    const spend = G.weapons.trySpend();
    if (spend === 'busy') return;
    if (spend === 'dry') {
      shootCooldown = 0.25;
      if (G.time - lastDryAt > 0.8) {
        lastDryAt = G.time;
        G.audio.dryClick();
        G.hud.toast('CLICK — R — RELOAD', 1200);
      }
      return;
    }
    shootCooldown = w.cooldown;
    G.weapons.noteShot();
    G.audio.blast();
    // BUILD 15 (HumanAnimator adoption): the shot kicks Rio's gun arm —
    // poseFigure reads fig.recoil, player.js decays it.
    const pfig = G.player.fig;
    pfig.recoil = Math.min(1, (pfig.recoil || 0) + (w.id === 'rifle' ? 0.7 : w.id === 'smg' ? 0.3 : 0.5));
    const cam = G.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const chest = new THREE.Vector3();
    let bestT = w.range, bestFig = null, bestUnit = null;
    for (const fig of G.crowd.figures) {
      if (fig.down > 0) continue;
      chest.copy(fig.group.position); chest.y += 1.15;
      const t = chest.clone().sub(origin).dot(dir);
      if (t < 2 || t > bestT) continue;
      const d = origin.clone().add(dir.clone().multiplyScalar(t)).distanceTo(chest);
      if (d < 1.05) { bestT = t; bestFig = fig; bestUnit = null; }
    }
    for (const unit of G.police.units) {
      chest.copy(unit.car.group.position); chest.y += 1.0;
      const t = chest.clone().sub(origin).dot(dir);
      if (t < 2 || t > bestT) continue;
      const d = origin.clone().add(dir.clone().multiplyScalar(t)).distanceTo(chest);
      if (d < 1.9) { bestT = t; bestUnit = unit; bestFig = null; }
    }
    // BUILD 15: civilian metal is a target too — traffic, parked and
    // highway cars take real damage now (wrecks.js owns their HP and
    // what happens at zero). The player's own car is never a target.
    let bestCar = null;
    const carLists = [G.cars, G.traffic ? G.traffic.cars : [], G.highway ? G.highway.cars : []];
    for (const list of carLists) {
      for (const car of list) {
        if (car.wrecked) continue;
        chest.copy(car.group.position); chest.y += 0.9;
        const t = chest.clone().sub(origin).dot(dir);
        if (t < 2 || t > bestT) continue;
        const d = origin.clone().add(dir.clone().multiplyScalar(t)).distanceTo(chest);
        if (d < 1.9) { bestT = t; bestCar = car; bestFig = null; bestUnit = null; }
      }
    }
    // Tracer + muzzle flash, gone in a blink. BUILD 15: the flash is
    // no longer a faceted sphere — it is a CleanVfx additive radial
    // sprite (fx.js), and a hit throws a fan of impact sparks at the
    // strike point.
    const gun = new THREE.Vector3();
    if (G.player.fig.parts.weapon) G.player.fig.parts.weapon.getWorldPosition(gun);
    else gun.copy(G.playerPos());
    const end = origin.clone().add(dir.clone().multiplyScalar(bestFig || bestUnit || bestCar ? bestT : w.range));
    const lineGeo = new THREE.BufferGeometry().setFromPoints([gun, end]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    G.scene.add(line);
    setTimeout(() => { G.scene.remove(line); }, 60);
    if ((G.qualityStep || 0) < 5) {
      bursts.flash(gun.clone().add(dir.clone().multiplyScalar(0.4)), w.id === 'rifle' ? 0.85 : 0.6);
      if (bestFig || bestUnit || bestCar) bursts.sparks(end, 5);
    }
    // BUILD 15: a muzzle-smoke puff — one soft sprite that swells,
    // rises and thins over ~0.8 s (updated below). Skipped on the
    // adaptive ladder's lowest rung, like every particle in build 15.
    if ((G.qualityStep || 0) < 5) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softDotTexture(), color: 0xcfd4d8, transparent: true, opacity: 0.32, depthWrite: false,
      }));
      puff.position.copy(gun).add(dir.clone().multiplyScalar(0.55));
      puff.scale.set(0.22, 0.22, 1);
      G.scene.add(puff);
      puffs.push({ s: puff, t: 0 });
    }
    if (bestFig) {
      bestFig.hp = (bestFig.hp === undefined ? 100 : bestFig.hp) - w.dmg;
      G.police.addHeat(110);
      G.audio.thud();
      if (bestFig.hp <= 0) {
        bestFig.down = 5;
        bestFig.hp = 100;   // he gets up later, shaken but whole
        G.hud.toast('Shots fired — the whole bay heard that.');
      }
    } else if (bestUnit) {
      G.police.addHeat(80);
      G.audio.thud();
      if (G.wrecks) G.wrecks.damageCar(bestUnit.car, w.dmg);   // BUILD 15: cruisers burn too
    } else if (bestCar) {
      G.police.addHeat(60);
      G.audio.thud();
      if (G.wrecks) G.wrecks.damageCar(bestCar, w.dmg);
    }
  }

  function update(dt) {
    if (punchCooldown > 0) punchCooldown -= dt;
    if (shootCooldown > 0) shootCooldown -= dt;
    bursts.update(dt);
    // BUILD 15: muzzle-smoke puffs swell, rise and thin out.
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.t += dt;
      const k = p.t / 0.8;
      if (k >= 1) { G.scene.remove(p.s); p.s.material.dispose(); puffs.splice(i, 1); continue; }
      const sc = 0.22 + k * 0.75;
      p.s.scale.set(sc, sc, 1);
      p.s.position.y += dt * 0.55;
      p.s.material.opacity = 0.32 * (1 - k);
    }
    // Police cruisers that touch the player (or the player's car) hurt.
    let hurt = false;
    const p = G.playerPos();
    for (const unit of G.police.units) {
      const up = unit.car.group.position;
      if (Math.hypot(up.x - p.x, up.z - p.z) < 3.6 && Math.abs(unit.car.speed) > 3) hurt = true;
    }
    if (hurt) {
      // Build 12: armour soaks damage first, point for point.
      let dmg = 26 * dt;
      if (G.player.armour > 0) {
        const soaked = Math.min(G.player.armour, dmg);
        G.player.armour -= soaked;
        dmg -= soaked;
      }
      G.player.health -= dmg;
      if (G.player.health <= 0) busted();
    } else if (G.player.health < 100) {
      G.player.health = Math.min(100, G.player.health + 5 * dt);
    }
  }

  function busted() {
    lastBustedAt = G.time;
    G.player.health = 100;
    G.player.armour = 0;
    G.police.heat = 0;
    const fine = Math.min(G.save.cash, 100);
    G.save.cash -= fine;
    G.persist();
    G.player.resetToSpawn();
    G.hud.toast(fine > 0 ? `BUSTED · fined $${fine}` : 'BUSTED · let off with a warning');
    G.audio.busted();
  }

  return { punch, shoot, update, bursts, get lastBustedAt() { return lastBustedAt; } };
}
