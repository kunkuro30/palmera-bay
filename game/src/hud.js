// The HUD: DOM elements over the canvas — cash and wanted stars top-right, health under
// the minimap, weapon and speedometer bottom-right, the objective banner up top, toasts,
// and the scrolling minimap itself (roads, beach, blips, police vision cones while they
// search, and the gold GPS route to the objective). The minimap border strobes red and
// blue while the police can see the player.
import { AVENUES, COAST_Z } from './config.js';

const VIEW_R = 90; // metres shown from centre to edge of the minimap
const SIZE = 150;

function nearest(values, v) {
  let best = values[0];
  for (const x of values) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const ctx = minimap.getContext('2d');
  const starsEl = el('stars');
  const cashEl = el('cash');
  const casesEl = el('casesLabel');
  const hpFill = el('hpFill');
  const distEl = el('distLabel');
  const bannerEl = el('banner');
  const bannerLabel = el('bannerLabel');
  const bannerDist = el('bannerDist');
  const toastsEl = el('toasts');
  const promptEl = el('prompt');
  const weaponEl = el('weapon');
  const speedoEl = el('speedo');
  const flashEl = el('flash');
  const dmgEl = el('dmgVin');
  const pauseEl = el('pauseOverlay');

  let lastCash = null;
  let lastStars = -1;
  let lastHp = -1;
  let flashT = 0;
  let dmgT = 0;

  const hud = {
    toast(text, ms = 3600) {
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = text;
      toastsEl.appendChild(div);
      while (toastsEl.children.length > 3) toastsEl.removeChild(toastsEl.firstChild);
      window.setTimeout(() => {
        div.classList.add('fade');
        window.setTimeout(() => div.remove(), 500);
      }, ms);
    },

    flash(text, color) {
      flashEl.textContent = text;
      flashEl.style.color = color;
      flashEl.style.opacity = '1';
      flashT = 1.6;
    },

    damageFlash() {
      dmgT = 0.6;
    },

    setPaused(paused) {
      pauseEl.classList.toggle('hidden', !paused);
    },

    bindStart(cb) {
      el('startOverlay').addEventListener('click', cb);
    },

    hideStart() {
      el('startOverlay').classList.add('hidden');
    },

    update(dt) {
      const save = G.save;
      const police = G.police;
      const player = G.player;

      if (save.cash !== lastCash) {
        lastCash = save.cash;
        cashEl.textContent = `$${save.cash}`;
      }
      const casesText = `Cases ${save.casesFound.length}/8`;
      if (casesEl.textContent !== casesText) casesEl.textContent = casesText;

      if (police.stars !== lastStars) {
        lastStars = police.stars;
        starsEl.textContent = '★'.repeat(police.stars) + '☆'.repeat(5 - police.stars);
      }
      if (police.stars === 0) starsEl.style.opacity = '0';
      else if (police.seen) starsEl.style.opacity = '1';
      else starsEl.style.opacity = (G.time * 2) % 1 < 0.55 ? '1' : '0.12';

      const hp = Math.max(0, Math.round(player.hp));
      if (hp !== lastHp) {
        lastHp = hp;
        hpFill.style.width = `${hp}%`;
        hpFill.style.background = hp > 50 ? '#57d977' : hp > 25 ? '#f2c94c' : '#e5534b';
      }

      const obj = G.missions.getObjective();
      const pp = player.pos();
      if (obj) {
        bannerEl.classList.remove('hidden');
        bannerLabel.textContent = obj.label;
        if (obj.x !== null && obj.x !== undefined) {
          const d = Math.round(Math.hypot(obj.x - pp.x, obj.z - pp.z));
          bannerDist.textContent = `· ${d} m`;
          distEl.textContent = `${d} m`;
        } else {
          bannerDist.textContent = '';
          distEl.textContent = '';
        }
      } else {
        bannerEl.classList.add('hidden');
        distEl.textContent = '';
      }

      promptEl.textContent = G.promptText || '';
      const weapon = G.combat.weapon;
      weaponEl.textContent = weapon === 'pistol' ? 'PISTOL' : 'FISTS';
      speedoEl.textContent = player.car ? `${Math.round(Math.abs(player.car.speed) * 3.6)} km/h` : '';

      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flashEl.style.opacity = '0';
      }
      if (dmgT > 0) {
        dmgT -= dt;
        dmgEl.style.opacity = String(Math.max(0, dmgT));
        if (dmgT <= 0) dmgEl.style.opacity = '0';
      }

      this.drawMinimap(obj);
      minimap.style.borderColor = police.stars > 0 && police.seen
        ? (Math.floor(G.time * 2.4) % 2 === 0 ? '#ff3b30' : '#2f7bff')
        : 'rgba(255,255,255,0.28)';
    },

    drawMinimap(obj) {
      const pp = G.player.pos();
      const scale = (SIZE / 2) / VIEW_R;
      const mx = (wx) => SIZE / 2 + (wx - pp.x) * scale;
      const my = (wz) => SIZE / 2 + (wz - pp.z) * scale;
      ctx.fillStyle = '#171d26';
      ctx.fillRect(0, 0, SIZE, SIZE);
      // Beach band.
      if (my(200) < SIZE) {
        ctx.fillStyle = '#6d5c36';
        ctx.fillRect(0, Math.max(0, my(200)), SIZE, SIZE - Math.max(0, my(200)));
      }
      // Roads.
      ctx.fillStyle = '#49546a';
      for (const a of AVENUES) {
        if (Math.abs(a - pp.x) < VIEW_R + 10) ctx.fillRect(mx(a) - 7 * scale, 0, 14 * scale, SIZE);
        if (Math.abs(a - pp.z) < VIEW_R + 10) ctx.fillRect(0, my(a) - 7 * scale, SIZE, 14 * scale);
      }
      if (Math.abs(COAST_Z - pp.z) < VIEW_R + 10) ctx.fillRect(0, my(COAST_Z) - 7 * scale, SIZE, 14 * scale);

      // GPS route: Manhattan along the grid to the objective.
      if (obj && obj.x !== null && obj.x !== undefined) {
        const ax = nearest(AVENUES, obj.x);
        const az = Math.abs(COAST_Z - obj.z) < Math.abs(nearest(AVENUES, obj.z) - obj.z) ? COAST_Z : nearest(AVENUES, obj.z);
        const pax = nearest(AVENUES, pp.x);
        const pts = [[pp.x, pp.z], [pax, pp.z], [pax, az], [ax, az], [obj.x, obj.z]];
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        pts.forEach(([x, z], i) => {
          if (i === 0) ctx.moveTo(mx(x), my(z));
          else ctx.lineTo(mx(x), my(z));
        });
        ctx.stroke();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.arc(mx(obj.x), my(obj.z), 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Traffic dots.
      ctx.fillStyle = '#cfd6dd';
      for (const car of G.cars) {
        const p = car.group.position;
        if (Math.abs(p.x - pp.x) > VIEW_R || Math.abs(p.z - pp.z) > VIEW_R) continue;
        ctx.fillRect(mx(p.x) - 1.4, my(p.z) - 1.4, 2.8, 2.8);
      }
      // Police blips, with vision cones while they search.
      const searching = G.police.stars > 0 && !G.police.seen;
      for (const unit of G.police.units) {
        if (unit.dead) continue;
        const p = unit.car.group.position;
        if (Math.abs(p.x - pp.x) > VIEW_R + 30 || Math.abs(p.z - pp.z) > VIEW_R + 30) continue;
        if (searching) {
          const h = unit.car.heading;
          const len = 26 * scale;
          const cxp = mx(p.x);
          const cyp = my(p.z);
          ctx.fillStyle = 'rgba(64,140,255,0.25)';
          ctx.beginPath();
          ctx.moveTo(cxp, cyp);
          ctx.lineTo(cxp + Math.sin(h - 0.49) * len, cyp + Math.cos(h - 0.49) * len);
          ctx.lineTo(cxp + Math.sin(h + 0.49) * len, cyp + Math.cos(h + 0.49) * len);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#3f8cff';
        ctx.beginPath();
        ctx.arc(mx(p.x), my(p.z), 2.7, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player arrow.
      const heading = G.player.car ? G.player.car.heading : G.player.facing;
      const searching2 = G.police.stars > 0 && !G.police.seen;
      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
      ctx.fillStyle = searching2 ? '#9aa3ad' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.4, 5);
      ctx.lineTo(0, 2.4);
      ctx.lineTo(-4.4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };

  return hud;
}
