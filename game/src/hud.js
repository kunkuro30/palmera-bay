// hud.js — everything the player reads: the wanted stars, money, health bar,
// clock, mission banner, prompts, toasts, the speedometer and the scrolling
// minimap. main.js feeds it a plain state object each frame; it owns the DOM.

import { CITY } from './config.js';
import { avenuePositions, COAST_ROAD_Z } from './world.js';

const MAP_RANGE = 150; // metres of world shown from centre to edge of the minimap

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud'), wanted = el('wanted'), money = el('money'),
    healthBar = el('health-bar'), clockBox = el('clock-box'),
    banner = el('mission-banner'), prompt = el('prompt'), toast = el('toast'),
    speedo = el('speedo'), speedNum = speedo.querySelector('.num'),
    mapCtx = el('minimap').getContext('2d');
  const avenues = avenuePositions();
  let toastTimer = 0;

  const starSpans = [];
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.textContent = '★';
    wanted.appendChild(s);
    starSpans.push(s);
  }

  function drawMinimap(s) {
    const W = 188, C = W / 2, scale = C / MAP_RANGE;
    mapCtx.fillStyle = '#274b63';
    mapCtx.fillRect(0, 0, W, W);
    const px = s.player.x, pz = s.player.z;
    const toMap = (x, z) => [C + (x - px) * scale, C + (z - pz) * scale];
    // sand + coast line
    const [, sandTop] = toMap(0, CITY.half + 6);
    if (sandTop < W) {
      mapCtx.fillStyle = '#c9a86a';
      mapCtx.fillRect(0, Math.max(0, sandTop), W, W - Math.max(0, sandTop));
    }
    // blocks
    mapCtx.fillStyle = '#4a5a48';
    for (let bx = 0; bx < CITY.blocksPerSide; bx++) {
      for (let bz = 0; bz < CITY.blocksPerSide; bz++) {
        const [x, y] = toMap(-CITY.half + bx * CITY.pitch, -CITY.half + bz * CITY.pitch);
        const size = CITY.blockSize * scale;
        if (x + size < 0 || y + size < 0 || x > W || y > W) continue;
        mapCtx.fillRect(x, y, size, size);
      }
    }
    // roads
    mapCtx.strokeStyle = '#20202a';
    mapCtx.lineWidth = Math.max(2, CITY.roadWidth * scale);
    for (const a of avenues) {
      let [x] = toMap(a, 0);
      mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, W); mapCtx.stroke();
      let [, y] = toMap(0, a);
      mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(W, y); mapCtx.stroke();
    }
    const [, cy] = toMap(0, COAST_ROAD_Z);
    mapCtx.beginPath(); mapCtx.moveTo(0, cy); mapCtx.lineTo(W, cy); mapCtx.stroke();
    // blips: mission markers, cars, police
    for (const mk of s.markers || []) {
      const [x, y] = toMap(mk.x, mk.z);
      if (x < -6 || y < -6 || x > W + 6 || y > W + 6) continue;
      mapCtx.fillStyle = mk.color;
      mapCtx.beginPath(); mapCtx.arc(x, y, 5, 0, Math.PI * 2); mapCtx.fill();
      mapCtx.strokeStyle = '#fff'; mapCtx.lineWidth = 1.5; mapCtx.stroke();
    }
    for (const c of s.blips || []) {
      const [x, y] = toMap(c.x, c.z);
      if (x < 0 || y < 0 || x > W || y > W) continue;
      mapCtx.fillStyle = c.police ? '#3a7bff' : '#e8e8e8';
      mapCtx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    // player arrow, rotated to heading (heading 0 = north = -z)
    mapCtx.save();
    mapCtx.translate(C, C);
    mapCtx.rotate(-s.player.heading);
    mapCtx.fillStyle = '#ffd94a';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -8); mapCtx.lineTo(5.5, 6); mapCtx.lineTo(0, 2.5); mapCtx.lineTo(-5.5, 6);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.strokeStyle = '#7a5200'; mapCtx.lineWidth = 1; mapCtx.stroke();
    mapCtx.restore();
  }

  return {
    show() { hud.style.display = 'block'; },
    hide() { hud.style.display = 'none'; },
    showBanner(html) {
      if (html) { banner.innerHTML = html; banner.style.display = 'block'; }
      else banner.style.display = 'none';
    },
    showPrompt(text) {
      if (text) { prompt.textContent = text; prompt.style.display = 'block'; }
      else prompt.style.display = 'none';
    },
    toast(text) {
      toast.textContent = text;
      toast.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2800);
    },
    // s: { money, health, stars, hour, speedKmh (null on foot), player, markers, blips }
    update(s) {
      money.textContent = '$' + Math.max(0, Math.floor(s.money)).toLocaleString('en-US');
      healthBar.style.width = Math.max(0, Math.min(100, s.health)) + '%';
      for (let i = 0; i < 5; i++) starSpans[i].className = i < s.stars ? '' : 'off';
      const hh = Math.floor(s.hour) % 24;
      const mm = Math.floor((s.hour - Math.floor(s.hour)) * 60);
      clockBox.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      if (s.speedKmh === null || s.speedKmh === undefined) speedo.style.display = 'none';
      else {
        speedo.style.display = 'block';
        speedNum.textContent = String(Math.round(Math.abs(s.speedKmh)));
      }
      drawMinimap(s);
    },
  };
}
