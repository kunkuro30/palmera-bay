// Combat: fists and a hitscan pistol for the player, return fire for police officers.
// Shots are resolved with ray-sphere tests against people (and cars, for sparks of
// cover), drawn as fading tracer lines with a brief muzzle flash. Firing is loud: it
// adds heat and panics nearby pedestrians.
import { CRIME_HEAT } from './config.js';
import { clamp, range } from './random.js';

const THREE = window.THREE;

export function createCombat(scene, rng, G) {
  const tracers = [];
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  flash.visible = false;
  scene.add(flash);
  let flashT = 0;

  const combat = {
    weapon: 'fists',
    attackCool: 0,
    shotHeatCool: 0,

    pistolUnlocked() {
      return G.save.storyStage >= 1;
    },

    switchWeapon(name) {
      if (name === 'pistol' && !this.pistolUnlocked()) {
        G.hud.toast('Pistol locked — finish Marina\'s first job.');
        return;
      }
      this.weapon = name;
    },

    hitPed(ped, dmg, cause) {
      if (!ped.alive) return false;
      ped.hp -= dmg;
      if (ped.hp <= 0) {
        G.pedsSys.kill(ped);
        return true;
      }
      ped.mode = 'flee';
      ped.fleeFrom = { x: G.player.pos().x, z: G.player.pos().z };
      ped.fleeT = 2.5;
      return false;
    },

    damageOfficer(officer, dmg) {
      if (officer.dead) return;
      officer.hp -= dmg;
      if (officer.hp <= 0) {
        officer.dead = true;
        officer.group.rotation.x = -Math.PI / 2;
        officer.group.position.y = 0.12;
        for (const unit of G.police.units) {
          if (unit.officer === officer) {
            unit.dead = true;
            unit.removeT = 0;
          }
        }
        G.hud.toast('Officer down!');
      }
    },

    tracer(from, to, color = 0xffe9a0) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, from.y, from.z),
        new THREE.Vector3(to.x, to.y, to.z),
      ]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      tracers.push({ line, mat, geo, ttl: 0.08 });
      if (tracers.length > 10) {
        const old = tracers.shift();
        scene.remove(old.line);
        old.geo.dispose();
        old.mat.dispose();
      }
    },

    attack() {
      if (this.attackCool > 0 || G.player.car) return;
      const player = G.player;
      const pp = player.pos();
      if (this.weapon === 'fists') {
        this.attackCool = 0.3;
        let best = null;
        let bd = 2.4;
        const consider = (pos, ref, kind) => {
          const d = Math.hypot(pos.x - pp.x, pos.z - pp.z);
          if (d >= bd) return;
          const ang = Math.abs(Math.atan2(pos.x - pp.x, pos.z - pp.z) - player.facing);
          const wrapped = Math.min(ang, Math.PI * 2 - ang);
          if (wrapped > 1.25) return;
          bd = d;
          best = { ref, kind };
        };
        for (const ped of G.peds) if (ped.alive) consider(ped.group.position, ped, 'ped');
        for (const unit of G.police.units) {
          if (unit.officer && !unit.officer.dead) {
            consider(unit.officer.group.position, unit.officer, 'officer');
          }
        }
        if (best) {
          G.audio.punch();
          if (best.kind === 'ped') this.hitPed(best.ref, 34, 'fists');
          else this.damageOfficer(best.ref, 34);
        }
        return;
      }
      // Pistol.
      if (!this.pistolUnlocked()) {
        G.hud.toast('Pistol locked — finish Marina\'s first job.');
        this.attackCool = 0.3;
        return;
      }
      this.attackCool = 0.24;
      G.audio.shot();
      G.pedsSys.panic(pp.x, pp.z, 26);
      if (this.shotHeatCool <= 0) {
        G.police.addHeat(CRIME_HEAT.shot);
        this.shotHeatCool = 0.35;
      }
      const origin = G.camera.position.clone();
      const dir = new THREE.Vector3();
      G.camera.getWorldDirection(dir);
      let bestT = 60;
      let bestHit = null;
      const testSphere = (center, r, ref, kind) => {
        const ox = center.x - origin.x;
        const oy = center.y - origin.y;
        const oz = center.z - origin.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > bestT) return;
        const d2 = ox * ox + oy * oy + oz * oz - t * t;
        if (d2 > r * r) return;
        bestT = t - Math.sqrt(r * r - d2);
        bestHit = { ref, kind };
      };
      for (const ped of G.peds) {
        if (!ped.alive) continue;
        const p = ped.group.position;
        testSphere({ x: p.x, y: 1.05, z: p.z }, 0.62, ped, 'ped');
      }
      for (const unit of G.police.units) {
        if (unit.officer && !unit.officer.dead) {
          const p = unit.officer.group.position;
          testSphere({ x: p.x, y: 1.05, z: p.z }, 0.62, unit.officer, 'officer');
        }
      }
      for (const car of G.allCars()) {
        const p = car.group.position;
        testSphere({ x: p.x, y: 0.75, z: p.z }, 2.6, car, 'car');
      }
      const muzzle = {
        x: pp.x + Math.sin(player.facing) * 0.45,
        y: 1.38,
        z: pp.z + Math.cos(player.facing) * 0.45,
      };
      const end = bestHit
        ? { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT, z: origin.z + dir.z * bestT }
        : { x: origin.x + dir.x * 60, y: origin.y + dir.y * 60, z: origin.z + dir.z * 60 };
      this.tracer(muzzle, end);
      flash.position.set(muzzle.x, muzzle.y, muzzle.z);
      flash.visible = true;
      flashT = 0.045;
      if (bestHit) {
        if (bestHit.kind === 'ped') this.hitPed(bestHit.ref, 50, 'pistol');
        else if (bestHit.kind === 'officer') this.damageOfficer(bestHit.ref, 50);
      }
    },

    officerShoot(officer) {
      const op = officer.group.position;
      const pp = G.player.pos();
      const dist = Math.hypot(pp.x - op.x, pp.z - op.z);
      const hitChance = clamp(1.05 - dist / 30, 0.2, 0.88);
      const hit = rng() < hitChance;
      const from = { x: op.x, y: 1.38, z: op.z };
      const to = hit
        ? { x: pp.x, y: 1.1, z: pp.z }
        : { x: pp.x + range(rng, -1.6, 1.6), y: range(rng, 0.4, 1.8), z: pp.z + range(rng, -1.6, 1.6) };
      this.tracer(from, to, 0xffb0a0);
      G.audio.shot();
      if (hit) G.player.damage(7);
    },

    update(dt) {
      this.attackCool = Math.max(0, this.attackCool - dt);
      this.shotHeatCool = Math.max(0, this.shotHeatCool - dt);
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flash.visible = false;
      }
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        const t = tracers[i];
        t.ttl -= dt;
        t.mat.opacity = Math.max(0, t.ttl / 0.08) * 0.9;
        if (t.ttl <= 0) {
          scene.remove(t.line);
          t.geo.dispose();
          t.mat.dispose();
          tracers.splice(i, 1);
        }
      }
    },
  };

  return combat;
}
