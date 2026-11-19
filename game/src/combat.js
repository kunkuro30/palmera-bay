// Combat, two flavours:
//  - Fists: a punch that knocks a pedestrian flat (and is very much a crime).
//  - TPS gunplay: while aiming (right mouse held), a left click fires a
//    raycast from the camera through the centre-screen crosshair; the
//    nearest figure or police cruiser inside the ray takes the hit.
// Police contact damage while they ram, and the busted reset when health
// runs out. No gore — figures just topple.

import { TUNING } from './config.js';

const THREE = window.THREE;

export function createCombat(G) {
  let punchCooldown = 0;
  let shootCooldown = 0;

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
  function shoot() {
    if (shootCooldown > 0 || G.player.car || !G.player.aiming) return;
    shootCooldown = 0.22;
    G.audio.blast();
    const cam = G.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const chest = new THREE.Vector3();
    let bestT = 70, bestFig = null, bestUnit = null;
    for (const fig of G.crowd.figures) {
      if (fig.down > 0) continue;
      chest.copy(fig.group.position); chest.y += 1.35;
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
    // Tracer + muzzle flash, gone in a blink.
    const gun = new THREE.Vector3();
    if (G.player.fig.parts.weapon) G.player.fig.parts.weapon.getWorldPosition(gun);
    else gun.copy(G.playerPos());
    const end = origin.clone().add(dir.clone().multiplyScalar(bestFig || bestUnit ? bestT : 60));
    const lineGeo = new THREE.BufferGeometry().setFromPoints([gun, end]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    G.scene.add(line);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    flash.position.copy(gun).add(dir.clone().multiplyScalar(0.4));
    G.scene.add(flash);
    setTimeout(() => { G.scene.remove(line); G.scene.remove(flash); }, 60);
    if (bestFig) {
      bestFig.down = 5;
      G.police.addHeat(110);
      G.audio.thud();
      G.hud.toast('Shots fired — the whole bay heard that.');
    } else if (bestUnit) {
      G.police.addHeat(80);
      G.audio.thud();
    }
  }

  function update(dt) {
    if (punchCooldown > 0) punchCooldown -= dt;
    if (shootCooldown > 0) shootCooldown -= dt;
    // Police cruisers that touch the player (or the player's car) hurt.
    let hurt = false;
    const p = G.playerPos();
    for (const unit of G.police.units) {
      const up = unit.car.group.position;
      if (Math.hypot(up.x - p.x, up.z - p.z) < 3.6 && Math.abs(unit.car.speed) > 3) hurt = true;
    }
    if (hurt) {
      G.player.health -= 26 * dt;
      if (G.player.health <= 0) busted();
    } else if (G.player.health < 100) {
      G.player.health = Math.min(100, G.player.health + 5 * dt);
    }
  }

  function busted() {
    G.player.health = 100;
    G.police.heat = 0;
    const fine = Math.min(G.save.cash, 100);
    G.save.cash -= fine;
    G.persist();
    G.player.resetToSpawn();
    G.hud.toast(fine > 0 ? `BUSTED · fined $${fine}` : 'BUSTED · let off with a warning');
    G.audio.busted();
  }

  return { punch, shoot, update };
}
