// Missions and story: Marina Sol's three jobs (an errand, a hot car, a bay heist),
// repeatable taxi fares, and eight hidden golden briefcases. One gold objective marker
// (beam + floating letter) always points at the current goal; progress is written to
// the save as each job lands.
import { CASE_SPOTS, HEIST_CASE, LOCKUP, MARINA, MISSION2_CAR } from './config.js';
import { clamp, pick, range } from './random.js';
import { AVENUES } from './config.js';
import { makeCar } from './vehicles.js';
import { storeSave } from './save.js';

const THREE = window.THREE;

function letterSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(3.6, 3.6, 1);
  sprite.renderOrder = 20;
  return { sprite, canvas, tex, letter: '' };
}

function drawLetter(marker, letter) {
  if (marker.letter === letter) return;
  marker.letter = letter;
  const g = marker.canvas.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fillStyle = '#f2c94c';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#20242c';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 68);
  marker.tex.needsUpdate = true;
}

export function createMissions(scene, rng, G) {
  // The objective marker: a gold beam, a ground ring and a floating letter.
  const markerGroup = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  const marker = letterSprite();
  marker.sprite.position.y = 7;
  markerGroup.add(beam, ring, marker.sprite);
  markerGroup.visible = false;
  scene.add(markerGroup);

  // Golden briefcases.
  const cases = [];
  const caseGeo = new THREE.BoxGeometry(0.55, 0.34, 0.4);
  const caseMat = new THREE.MeshLambertMaterial({ color: 0xd8a920, emissive: 0x5a4300 });
  const miniBeamGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 8, 1, true);
  const miniBeamMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  CASE_SPOTS.forEach((spot, i) => {
    if (G.save.casesFound.includes(i)) return;
    const group = new THREE.Group();
    const box = new THREE.Mesh(caseGeo, caseMat);
    box.position.y = 0.2;
    const glow = new THREE.Mesh(miniBeamGeo, miniBeamMat);
    glow.position.y = 2.5;
    group.add(box, glow);
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    cases.push({ i, group, taken: false });
  });
  // The heist case waits at the warehouse until the job starts.
  const heistProp = new THREE.Group();
  const heistBox = new THREE.Mesh(caseGeo, caseMat);
  heistBox.position.y = 0.2;
  heistProp.add(heistBox);
  heistProp.position.set(HEIST_CASE.x, 0, HEIST_CASE.z);
  heistProp.visible = false;
  scene.add(heistProp);

  const stage = G.save.storyStage;
  const ms = {
    phase: stage <= 0 ? 'meet' : stage === 1 ? 'm2_brief' : stage === 2 ? 'm3_brief' : 'done',
    objective: null,
    override: null,
    marinaCar: null,
    hotCar: null,
    caseTaken: false,
    pendingToasts: [],
    taxi: { state: 'idle', cool: 5, x: 0, z: 0, dropX: 0, dropZ: 0, timer: 0, fare: 0 },

    say(text, delay = 0) {
      this.pendingToasts.push({ at: G.time + delay, text });
    },

    showMarker(x, z, letter) {
      markerGroup.position.set(x, 0, z);
      markerGroup.visible = true;
      drawLetter(marker, letter);
    },

    hideMarker() {
      markerGroup.visible = false;
    },

    setObjectiveOverride(obj) {
      this.override = obj;
    },

    getObjective() {
      return this.override || this.objective;
    },

    onEnterCar(car) {
      if (car === this.marinaCar && this.phase === 'm1_drive') {
        this.phase = 'm1_deliver';
        G.hud.toast('Marina: Take it to the east lockup. And be careful with it.');
      }
      if (car === this.hotCar && this.phase === 'm2_steal') {
        G.police.heat = Math.max(G.police.heat, 200);
        this.phase = 'm2_deliver';
        G.hud.toast('Marina: They are watching that car — drive, now!');
      }
    },

    onPlayerDown() {
      if (this.phase === 'm1_deliver') this.phase = 'm1_drive';
      else if (this.phase === 'm2_deliver') this.phase = 'm2_steal';
      else if (this.phase === 'm3_escape') {
        this.caseTaken = false;
        heistProp.visible = true;
        this.phase = 'm3_case';
        G.hud.toast('You dropped the case!');
      }
      if (this.taxi.state !== 'idle') {
        this.taxi.state = 'idle';
        this.taxi.cool = 6;
      }
    },

    distTo(x, z) {
      const p = G.player.pos();
      return Math.hypot(p.x - x, p.z - z);
    },

    update(dt) {
      for (let i = this.pendingToasts.length - 1; i >= 0; i -= 1) {
        if (G.time >= this.pendingToasts[i].at) {
          G.hud.toast(this.pendingToasts[i].text);
          this.pendingToasts.splice(i, 1);
        }
      }
      const player = G.player;
      const onFoot = !player.car;

      // Briefcase pickups.
      for (const c of cases) {
        if (c.taken) continue;
        c.group.rotation.y += dt * 1.4;
        c.group.position.y = 0.12 + Math.sin(G.time * 2 + c.i) * 0.07;
        if (onFoot && this.distTo(c.group.position.x, c.group.position.z) < 1.8) {
          c.taken = true;
          scene.remove(c.group);
          G.save.casesFound.push(c.i);
          storeSave(G.save);
          G.addCash(100);
          G.hud.toast(`Golden case ${G.save.casesFound.length}/8 found — +$100`);
        }
      }

      switch (this.phase) {
        case 'meet': {
          this.objective = { x: MARINA.x, z: MARINA.z, letter: 'M', label: 'Meet Marina Sol at the marina' };
          if (onFoot && this.distTo(MARINA.x, MARINA.z) < 3.6) {
            this.say('Marina: You must be the new driver. I have work, if you want it.');
            this.say('Marina: Take my coupe to the east lockup. $150, and a pistol for future work.', 2.4);
            this.marinaCar = makeCar(0x1f8a8c, { cls: 'coupe', kind: 'parked' });
            this.marinaCar.mission = 'marina';
            this.marinaCar.group.position.set(52, 0, 158);
            this.marinaCar.heading = Math.PI / 2;
            this.marinaCar.group.rotation.y = Math.PI / 2;
            scene.add(this.marinaCar.group);
            G.cars.push(this.marinaCar);
            this.phase = 'm1_drive';
          }
          break;
        }
        case 'm1_drive': {
          const c = this.marinaCar.group.position;
          this.objective = { x: c.x, z: c.z, letter: 'C', label: 'Take Marina\'s teal coupe' };
          break;
        }
        case 'm1_deliver': {
          if (player.car === this.marinaCar) {
            this.objective = { x: LOCKUP.x, z: LOCKUP.z, letter: 'D', label: 'Deliver the coupe to the east lockup' };
            if (this.distTo(LOCKUP.x, LOCKUP.z) < 7.5) this.completeJob(1);
          } else {
            const c = this.marinaCar.group.position;
            this.objective = { x: c.x, z: c.z, letter: 'C', label: 'Get back in Marina\'s coupe' };
          }
          break;
        }
        case 'm2_brief': {
          this.objective = { x: MARINA.x, z: MARINA.z, letter: 'M', label: 'Return to Marina Sol' };
          if (onFoot && this.distTo(MARINA.x, MARINA.z) < 3.6) {
            this.say('Marina: Good work. Now — a red sports car downtown. It is... borrowed.');
            this.say('Marina: Bring it to the lockup. Expect attention. $300.', 2.4);
            this.hotCar = makeCar(0xd42427, { cls: 'sport', kind: 'parked' });
            this.hotCar.mission = 'hotgoods';
            this.hotCar.group.position.set(MISSION2_CAR.x, 0, MISSION2_CAR.z);
            this.hotCar.heading = Math.PI;
            this.hotCar.group.rotation.y = Math.PI;
            scene.add(this.hotCar.group);
            G.cars.push(this.hotCar);
            this.phase = 'm2_steal';
          }
          break;
        }
        case 'm2_steal': {
          const c = this.hotCar.group.position;
          this.objective = { x: c.x, z: c.z, letter: 'C', label: 'Steal the marked red sports car' };
          break;
        }
        case 'm2_deliver': {
          if (player.car === this.hotCar) {
            this.objective = { x: LOCKUP.x, z: LOCKUP.z, letter: 'D', label: 'Deliver the sports car to the east lockup' };
            if (this.distTo(LOCKUP.x, LOCKUP.z) < 7.5) this.completeJob(2);
          } else {
            const c = this.hotCar.group.position;
            this.objective = { x: c.x, z: c.z, letter: 'C', label: 'Get back in the sports car' };
          }
          break;
        }
        case 'm3_brief': {
          this.objective = { x: MARINA.x, z: MARINA.z, letter: 'M', label: 'Return to Marina Sol' };
          if (onFoot && this.distTo(MARINA.x, MARINA.z) < 3.6) {
            this.say('Marina: Last job. A gold case sits at the lifeguard warehouse, south beach.');
            this.say('Marina: Take it, lose the police, bring it to me. $600.', 2.4);
            heistProp.visible = true;
            this.phase = 'm3_case';
          }
          break;
        }
        case 'm3_case': {
          this.objective = { x: HEIST_CASE.x, z: HEIST_CASE.z, letter: '!', label: 'Grab the gold case at the lifeguard warehouse' };
          if (onFoot && this.distTo(HEIST_CASE.x, HEIST_CASE.z) < 2) {
            heistProp.visible = false;
            this.caseTaken = true;
            G.police.heat = Math.max(G.police.heat, 300);
            G.hud.toast('Case taken — lose the police!');
            this.phase = 'm3_escape';
          }
          break;
        }
        case 'm3_escape': {
          this.objective = { x: null, z: null, letter: '', label: 'Lose the police!' };
          if (G.police.heat <= 0) {
            G.hud.toast('Clean. Take the case back to Marina.');
            this.phase = 'm3_return';
          }
          break;
        }
        case 'm3_return': {
          this.objective = { x: MARINA.x, z: MARINA.z, letter: 'M', label: 'Bring the case back to Marina' };
          if (onFoot && this.distTo(MARINA.x, MARINA.z) < 3.6) this.completeJob(3);
          break;
        }
        default: {
          if (!this.taxiObjective()) this.objective = null;
        }
      }
      if (this.phase === 'done' || G.save.storyStage >= 1) this.updateTaxi(dt);
      const obj = this.getObjective();
      if (obj && obj.x !== null && obj.x !== undefined) this.showMarker(obj.x, obj.z, obj.letter || 'M');
      else this.hideMarker();
    },

    taxiObjective() {
      if (this.taxi.state === 'pickup') {
        this.objective = { x: this.taxi.x, z: this.taxi.z, letter: '$', label: 'Pick up the fare' };
        return true;
      }
      if (this.taxi.state === 'dropoff') {
        this.objective = {
          x: this.taxi.dropX, z: this.taxi.dropZ, letter: '$',
          label: `Drop off the fare · ${Math.max(0, Math.ceil(this.taxi.timer))}s`,
        };
        return true;
      }
      return false;
    },

    updateTaxi(dt) {
      const t = this.taxi;
      const player = G.player;
      if (G.save.storyStage < 1) return;
      if (t.state === 'idle') {
        t.cool -= dt;
        if (t.cool <= 0) {
          const p = player.pos();
          const a = pick(rng, AVENUES);
          if (rng() < 0.5) {
            t.x = a + (rng() < 0.5 ? -9.3 : 9.3);
            t.z = clamp(p.z + range(rng, -100, 100), -195, 195);
          } else {
            t.z = a + (rng() < 0.5 ? -9.3 : 9.3);
            t.x = clamp(p.x + range(rng, -100, 100), -195, 195);
          }
          if (Math.hypot(t.x - p.x, t.z - p.z) > 25) t.state = 'pickup';
          else t.cool = 2;
        }
      } else if (t.state === 'pickup') {
        if (this.phase === 'done') this.taxiObjective();
        if (player.car && this.distTo(t.x, t.z) < 5) {
          const p = player.pos();
          let dx = 0;
          let dz = 0;
          let dist = 0;
          for (let tries = 0; tries < 10; tries += 1) {
            const a = pick(rng, AVENUES);
            if (rng() < 0.5) {
              dx = a + (rng() < 0.5 ? -9.3 : 9.3);
              dz = clamp(p.z + range(rng, -190, 190), -195, 195);
            } else {
              dz = a + (rng() < 0.5 ? -9.3 : 9.3);
              dx = clamp(p.x + range(rng, -190, 190), -195, 195);
            }
            dist = Math.hypot(dx - p.x, dz - p.z);
            if (dist > 80) break;
          }
          t.dropX = dx;
          t.dropZ = dz;
          t.timer = dist / 7 + 25;
          t.fare = clamp(Math.round(dist * 0.35), 40, 90);
          t.state = 'dropoff';
          G.hud.toast('Passenger in — go, go!');
        }
      } else if (t.state === 'dropoff') {
        if (this.phase === 'done') this.taxiObjective();
        t.timer -= dt;
        if (t.timer <= 0) {
          t.state = 'idle';
          t.cool = 6;
          G.hud.toast('Too slow — the fare walked away.');
        } else if (player.car && this.distTo(t.dropX, t.dropZ) < 6.5) {
          G.addCash(t.fare);
          G.save.taxiDone += 1;
          storeSave(G.save);
          G.hud.toast(`Fare paid — $${t.fare}`);
          t.state = 'idle';
          t.cool = 5;
        }
      }
      // While a story phase has no objective of its own the taxi marker shows;
      // the story sets its objective every frame above, so only fill the gaps.
      if (this.phase === 'done') this.taxiObjective();
    },

    completeJob(n) {
      if (n === 1) {
        G.addCash(150);
        G.save.storyStage = 1;
        this.marinaCar.mission = null;
        G.hud.toast('Job done — +$150. Marina unlocked your pistol (press 2).');
        this.phase = 'm2_brief';
      } else if (n === 2) {
        G.addCash(300);
        G.save.storyStage = 2;
        this.hotCar.mission = null;
        G.hud.toast('Job done — +$300.');
        this.phase = 'm3_brief';
      } else {
        G.addCash(600);
        G.save.storyStage = 3;
        G.hud.flash('PALMERA BAY IS YOURS', '#f2c94c');
        G.hud.toast('Story complete — +$600. The bay is yours now: fares and cases remain.');
        this.phase = 'done';
      }
      storeSave(G.save);
      G.audio.sting();
    },
  };

  return ms;
}
