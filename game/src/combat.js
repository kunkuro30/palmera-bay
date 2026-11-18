// combat.js — fists and the pistol: the crosshair, the shot itself (a manual
// ray tested against people, cars and the building boxes, so no scene-wide
// raycast is needed), the muzzle flash and tracer, and who got hurt.
// Consequences (heat, money, story) belong to main.js; this module reports.

import { PLAYER } from './config.js';

export function createCombat(scene, audio) {
  const cross = document.createElement('div');
  cross.style.cssText = 'position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;' +
    'border:2px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.6);' +
    'pointer-events:none;display:none;z-index:4;';
  document.body.appendChild(cross);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, depthWrite: false }),
  );
  flash.visible = false;
  scene.add(flash);
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);

  const combat = { weapon: 'fists', cooldown: 0, flashTimer: 0 };

  combat.setWeapon = (w) => {
    combat.weapon = w;
    cross.style.display = w === 'pistol' ? 'block' : 'none';
  };
  combat.showCrosshair = (show) => {
    cross.style.display = show && combat.weapon === 'pistol' ? 'block' : 'none';
  };

  // One attack press. ctx: { player, camera, peds, cars, colliders, onCrime }
  combat.attack = (ctx) => {
    if (combat.cooldown > 0) return null;
    const { player, peds } = ctx;
    if (combat.weapon === 'fists') {
      combat.cooldown = 0.38;
      audio.punch();
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      for (const p of peds) {
        if (p.down > 0) continue;
        const dx = p.pos.x - player.pos.x, dz = p.pos.z - player.pos.z;
        if (Math.hypot(dx, dz) < PLAYER.punchRange && dx * fx + dz * fz > 0.2) {
          p.health -= PLAYER.punchDamage;
          if (p.health <= 0) { p.down = 4; p.mesh.rotation.x = Math.PI / 2; }
          return { type: 'punch', ped: p };
        }
      }
      return { type: 'swing' };
    }
    // pistol
    combat.cooldown = 0.27;
    audio.shot();
    const origin = new THREE.Vector3();
    ctx.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    ctx.camera.getWorldDirection(dir);
    const muzzle = player.pos.clone(); muzzle.y += 1.35;
    muzzle.x += Math.sin(player.heading) * 0.5; muzzle.z += Math.cos(player.heading) * 0.5;
    flash.position.copy(muzzle);
    flash.lookAt(muzzle.clone().add(dir));
    flash.material.opacity = 0.95; flash.visible = true;
    combat.flashTimer = 0.05;

    let bestT = 220, hit = null;
    const ray = new THREE.Ray(origin, dir);
    const testSphere = (cx, cy, cz, r, what, ref) => {
      const c = new THREE.Vector3(cx, cy, cz);
      const t = ray.distanceToPoint(c);
      if (t < 0 || t > bestT) return;
      const closest = ray.at(t, new THREE.Vector3());
      if (closest.distanceTo(c) < r) { bestT = t; hit = { what, ref, point: closest }; }
    };
    for (const p of peds) if (p.down <= 0) testSphere(p.pos.x, 1.05, p.pos.z, 0.85, 'ped', p);
    for (const c of ctx.cars) testSphere(c.pos.x, 0.8, c.pos.z, 2.5, c.police ? 'policecar' : 'car', c);
    for (const b of ctx.colliders) {
      const box = new THREE.Box3(
        new THREE.Vector3(b.minX, 0, b.minZ), new THREE.Vector3(b.maxX, 90, b.maxZ));
      const p = ray.intersectBox(box, new THREE.Vector3());
      if (p) {
        const t = origin.distanceTo(p);
        if (t < bestT) { bestT = t; hit = { what: 'wall', point: p }; }
      }
    }
    const end = hit ? hit.point : origin.clone().add(dir.clone().multiplyScalar(120));
    const posAttr = tracer.geometry.getAttribute('position');
    posAttr.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    posAttr.setXYZ(1, end.x, end.y, end.z);
    posAttr.needsUpdate = true;
    tracerMat.opacity = 0.85; tracer.visible = true;
    combat.flashTimer = Math.max(combat.flashTimer, 0.06);

    if (hit && hit.what === 'ped') {
      hit.ref.health -= 34;
      if (hit.ref.health <= 0) { hit.ref.down = 5; hit.ref.mesh.rotation.x = Math.PI / 2; }
    } else if (hit && (hit.what === 'car' || hit.what === 'policecar')) {
      hit.ref.health -= 12;
    }
    return { type: 'shot', hit };
  };

  combat.update = (dt) => {
    combat.cooldown = Math.max(0, combat.cooldown - dt);
    if (combat.flashTimer > 0) {
      combat.flashTimer -= dt;
      if (combat.flashTimer <= 0) { flash.visible = false; tracer.visible = false; }
    }
  };
  return combat;
}
