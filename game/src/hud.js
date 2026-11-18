// hud.js — everything drawn over the 3D view: money, health, wanted stars,
// the clock, mission banners and prompts, the speedometer, and the scrolling
// minimap with its markers and blips.

import { CITY, AVENUES } from './config.js';

const BLOCK_CENTERS = [-150, -90, -30, 30, 90, 150];
const MAP_RANGE = 150;
const STREETS = [...AVENUES, CITY.coastZ];

function nearestOf(list, v) {
  let best = list[0];
  for (const a of list) if (Math.abs(a - v) < Math.abs(best - v)) best = a;
  return best;
}

// a Manhattan route over the road grid: out to the player's avenue, along it
// to the marker's street, along that to the marker's avenue, then in
export function routePoints(px, pz, mx, mz) {
  const a1 = nearestOf(AVENUES, px);
  const s2 = nearestOf(STREETS, mz);
  const a2 = nearestOf(AVENUES, mx);
  const raw = [[px, pz], [a1, pz], [a1, s2], [a2, s2], [mx, mz]];
  const pts = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.5) pts.push(p);
  }
  return pts;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const root = el('hud');
  const mapEl = el('minimap');
  const map = mapEl.getContext('2d');
  const distEl = document.createElement('div');
  distEl.style.cssText = 'margin-top:4px;width:188px;text-align:center;font-size:14px;font-weight:800;letter-spacing:1px;color:#ffd94a;text-shadow:0 1px 5px rgba(0,0,0,.9);';
  el('minimap-wrap').appendChild(distEl);
  const clockEl = el('clock');
  const starsEl = el('stars');
  const moneyEl = el('money');
  const healthEl = el('health-fill');
  const bannerEl = el('banner');
  const promptEl = el('prompt');
  const toastEl = el('toast');
  const speedoEl = el('speedo');
  const speedValEl = el('speed-val');
  const weaponEl = el('weapon');
  const crosshairEl = el('crosshair');

  const starSpans = [];
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.className = 'star';
    s.textContent = '★';
    starsEl.appendChild(s);
    starSpans.push(s);
  }

  let bannerTime = 0;
  let toastTime = 0;
  let lastStars = -1;
  let lastMoney = null;
  let hudTime = 0;

  function drawMap(state) {
    const S = 188;
    const half = S / 2;
    const scale = S / (MAP_RANGE * 2);
    const px = state.player.x;
    const pz = state.player.z;
    const X = (wx) => half + (wx - px) * scale;
    const Y = (wz) => half + (wz - pz) * scale;
    map.save();
    map.beginPath();
    map.arc(half, half, half - 2, 0, Math.PI * 2);
    map.clip();
    map.fillStyle = '#262a33';
    map.fillRect(0, 0, S, S);
    // sand and sea to the south
    map.fillStyle = '#c9a86a';
    map.fillRect(0, Y(CITY.sandFrom), S, S - Y(CITY.sandFrom));
    map.fillStyle = '#17607e';
    map.fillRect(0, Y(CITY.sandFrom + CITY.beachDepth), S, S - Y(CITY.sandFrom + CITY.beachDepth));
    // city blocks
    map.fillStyle = '#3d4356';
    const bs = CITY.blockSize * scale;
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const x = X(bx) - bs / 2;
        const y = Y(bz) - bs / 2;
        if (x + bs < 0 || y + bs < 0 || x > S || y > S) continue;
        map.fillRect(x, y, bs, bs);
      }
    }
    // the GPS route to the active marker, following the road grid
    if (state.markers && state.markers.length) {
      const m = state.markers[0];
      const pts = routePoints(px, pz, m.x, m.z);
      map.strokeStyle = 'rgba(255,217,74,0.9)';
      map.lineWidth = 2.5;
      map.lineJoin = 'round';
      map.beginPath();
      pts.forEach(([wx, wz], i) => {
        if (i === 0) map.moveTo(X(wx), Y(wz));
        else map.lineTo(X(wx), Y(wz));
      });
      map.stroke();
    }
    // while the player is hidden, every cruiser shows its vision cone
    if (state.searching) {
      map.fillStyle = 'rgba(77,141,255,0.16)';
      for (const b of state.blips) {
        if (!b.police || b.heading === undefined) continue;
        const x = X(b.x);
        const y = Y(b.z);
        const dx = Math.sin(b.heading);
        const dy = Math.cos(b.heading);
        const L = 26 * scale;
        const a = 0.49;
        const e1x = dx * Math.cos(-a) - dy * Math.sin(-a);
        const e1y = dx * Math.sin(-a) + dy * Math.cos(-a);
        const e2x = dx * Math.cos(a) - dy * Math.sin(a);
        const e2y = dx * Math.sin(a) + dy * Math.cos(a);
        map.beginPath();
        map.moveTo(x, y);
        map.lineTo(x + e1x * L, y + e1y * L);
        map.lineTo(x + e2x * L, y + e2y * L);
        map.closePath();
        map.fill();
      }
    }
    // blips: traffic white, police blue
    for (const b of state.blips) {
      const x = X(b.x);
      const y = Y(b.z);
      if (x < -4 || y < -4 || x > S + 4 || y > S + 4) continue;
      map.fillStyle = b.police ? '#4d8dff' : '#e8e8e8';
      map.beginPath();
      map.arc(x, y, b.police ? 3 : 2, 0, Math.PI * 2);
      map.fill();
    }
    // objective markers
    for (const m of state.markers) {
      const x = X(m.x);
      const y = Y(m.z);
      map.fillStyle = m.color;
      map.strokeStyle = '#fff';
      map.lineWidth = 1.4;
      map.beginPath();
      map.arc(Math.max(6, Math.min(S - 6, x)), Math.max(6, Math.min(S - 6, y)), 4.4, 0, Math.PI * 2);
      map.fill();
      map.stroke();
    }
    // the player arrow: gold, or gray while the law is searching blind
    const h = state.player.heading;
    const dx = Math.sin(h);
    const dy = Math.cos(h);
    map.fillStyle = state.searching ? '#9aa0a8' : '#ffd94a';
    map.strokeStyle = '#20242e';
    map.lineWidth = 1.2;
    map.beginPath();
    map.moveTo(half + dx * 9, half + dy * 9);
    map.lineTo(half - dx * 6 - dy * 5, half - dy * 6 + dx * 5);
    map.lineTo(half - dx * 6 + dy * 5, half - dy * 6 - dx * 5);
    map.closePath();
    map.fill();
    map.stroke();
    map.restore();
  }

  return {
    setVisible(v) {
      root.classList.toggle('hidden', !v);
    },
    showBanner(html, seconds = 7) {
      bannerEl.innerHTML = html;
      bannerEl.classList.add('show');
      bannerTime = seconds;
    },
    hideBanner() {
      bannerEl.classList.remove('show');
      bannerTime = 0;
    },
    toast(text, seconds = 3) {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      toastTime = seconds;
    },
    showPrompt(text) {
      if (text) {
        promptEl.textContent = text;
        promptEl.classList.remove('hidden');
      } else {
        promptEl.classList.add('hidden');
      }
    },
    setWeapon(name) {
      weaponEl.textContent = name;
    },
    setCrosshair(v) {
      crosshairEl.style.opacity = v ? '1' : '0';
    },
    update(state, dt) {
      hudTime += dt;
      // wanted signatures: seen → stars solid and the map frame strobes
      // red/blue; unseen and decaying → the stars blink at the same beat
      const phase = Math.floor(hudTime * 2) % 2 === 0;
      if (state.stars > 0 && state.seenByPolice) {
        starsEl.style.visibility = 'visible';
        mapEl.style.borderColor = phase ? '#ff3b30' : '#2d6bff';
      } else if (state.searching) {
        starsEl.style.visibility = phase ? 'visible' : 'hidden';
        mapEl.style.borderColor = 'rgba(255,255,255,0.75)';
      } else {
        starsEl.style.visibility = 'visible';
        mapEl.style.borderColor = 'rgba(255,255,255,0.75)';
      }
      if (state.markers && state.markers.length) {
        const m = state.markers[0];
        const d = Math.hypot(m.x - state.player.x, m.z - state.player.z);
        distEl.textContent = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
      } else {
        distEl.textContent = '';
      }
      if (bannerTime > 0) {
        bannerTime -= dt;
        if (bannerTime <= 0) bannerEl.classList.remove('show');
      }
      if (toastTime > 0) {
        toastTime -= dt;
        if (toastTime <= 0) toastEl.classList.remove('show');
      }
      if (state.stars !== lastStars) {
        lastStars = state.stars;
        starSpans.forEach((s, i) => s.classList.toggle('on', i < state.stars));
      }
      if (state.money !== lastMoney) {
        lastMoney = state.money;
        moneyEl.textContent = '$' + Math.floor(state.money).toLocaleString('en-US');
      }
      healthEl.style.width = Math.max(0, Math.min(100, state.health)) + '%';
      const hh = Math.floor(state.hour) % 24;
      const mm = Math.floor((state.hour % 1) * 60);
      clockEl.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (state.speedKmh === null || state.speedKmh === undefined) {
        speedoEl.classList.add('hidden');
        weaponEl.classList.remove('hidden');
      } else {
        speedoEl.classList.remove('hidden');
        weaponEl.classList.add('hidden');
        speedValEl.textContent = String(Math.round(Math.abs(state.speedKmh)));
      }
      drawMap(state);
    },
  };
}
