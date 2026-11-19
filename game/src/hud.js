// HUD: DOM readouts (brand, wanted stars, cash, health), the objective
// banner, toasts, and a canvas minimap that draws the ISLAND — sea all
// around, the beach ring, the southern city grid, the airport plateau,
// the desert, the lake and the mountain — so one glance reads "GTA-style
// island map". All shapes come from the shared layout maths in config.js.

import { WORLD, coastRadius, highwayLoopPoints, FREEWAY_PTS } from './config.js';

export function createHud(G) {
  const starsEl = document.getElementById('stars');
  const cashEl = document.getElementById('cash');
  const healthEl = document.getElementById('health');
  const objEl = document.getElementById('objective');
  const toastEl = document.getElementById('toast');
  const crossEl = document.getElementById('crosshair');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  let toastTimer = null;
  let lastStars = -1;
  let lastCash = -1;
  let lastObj = '';

  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, ms);
  }

  function drawMap() {
    const S = map.width;
    const half = 320;   // the whole island plus a rim of sea
    const px = (x) => ((x + half) / (half * 2)) * S;
    const pz = (z) => ((z + half) / (half * 2)) * S;
    const C = WORLD.centre;
    ctx.clearRect(0, 0, S, S);
    // Sea everywhere.
    ctx.fillStyle = '#0d5a74';
    ctx.fillRect(0, 0, S, S);
    // The island: grass body with a thick sand ring for the beach.
    ctx.beginPath();
    for (let th = 0; th <= Math.PI * 2 + 0.01; th += 0.05) {
      const r = coastRadius(th);
      const x = px(C.x + r * Math.cos(th)), y = pz(C.z + r * Math.sin(th));
      if (th === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#79c25e';
    ctx.fill();
    ctx.strokeStyle = '#f2d492';
    ctx.lineWidth = 5;
    ctx.stroke();
    // The north-east desert.
    ctx.beginPath();
    ctx.ellipse(px(108), pz(-108), 74 * (S / (half * 2)), 50 * (S / (half * 2)), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dcb87f';
    ctx.fill();
    // The lake, with its little sand shore.
    ctx.beginPath();
    ctx.arc(px(WORLD.lake.x), pz(WORLD.lake.z), (WORLD.lake.r + 5) * (S / (half * 2)), 0, Math.PI * 2);
    ctx.fillStyle = '#f2d492';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px(WORLD.lake.x), pz(WORLD.lake.z), WORLD.lake.waterR * (S / (half * 2)), 0, Math.PI * 2);
    ctx.fillStyle = '#3fa7c4';
    ctx.fill();
    // The mountain and its shoulder: grey triangles in the north.
    function peak(x, z, w) {
      ctx.beginPath();
      ctx.moveTo(px(x) - w, pz(z) + w * 0.7);
      ctx.lineTo(px(x), pz(z) - w);
      ctx.lineTo(px(x) + w, pz(z) + w * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#8d8578';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    peak(WORLD.mountain.x, WORLD.mountain.z, 15);
    peak(-120, -120, 9);
    // Airport plateau + runway, south-west.
    ctx.fillStyle = '#9aa0a8';
    ctx.fillRect(px(WORLD.airport.x0), pz(WORLD.airport.z0),
      px(WORLD.airport.x1) - px(WORLD.airport.x0), pz(WORLD.airport.z1) - pz(WORLD.airport.z0));
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(px(-247), pz(60), px(-229) - px(-247), pz(196) - pz(60));
    // Roads: the coastal loop and the freeway first (faint), then the city grid.
    ctx.strokeStyle = 'rgba(230,238,245,.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    highwayLoopPoints().forEach((p, i) => { if (i === 0) ctx.moveTo(px(p.x), pz(p.z)); else ctx.lineTo(px(p.x), pz(p.z)); });
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    FREEWAY_PTS.forEach((p, i) => { if (i === 0) ctx.moveTo(px(p.x), pz(p.z)); else ctx.lineTo(px(p.x), pz(p.z)); });
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,244,248,.85)';
    ctx.lineWidth = 1.5;
    for (const x of WORLD.avenues) { ctx.beginPath(); ctx.moveTo(px(x), pz(18)); ctx.lineTo(px(x), pz(196)); ctx.stroke(); }
    for (const z of WORLD.streets.concat([WORLD.oceanDrive])) { ctx.beginPath(); ctx.moveTo(px(-166), pz(z)); ctx.lineTo(px(156), pz(z)); ctx.stroke(); }
    // Objective.
    const obj = G.missions ? G.missions.objective : null;
    if (obj && obj.x !== null && obj.x !== undefined) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(px(obj.x), pz(obj.z), 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Police.
    ctx.fillStyle = '#3d7bff';
    for (const unit of G.police.units) {
      const p = unit.car.group.position;
      ctx.fillRect(px(p.x) - 2.5, pz(p.z) - 2.5, 5, 5);
    }
    // Traffic hints.
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (const car of G.traffic.cars) {
      const p = car.group.position;
      ctx.fillRect(px(p.x) - 1.5, pz(p.z) - 1.5, 3, 3);
    }
    // Player arrow.
    const pp = G.playerPos();
    const heading = G.playerHeading();
    ctx.save();
    ctx.translate(px(pp.x), pz(pp.z));
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ff5964';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function update() {
    const stars = G.police.stars;
    if (stars !== lastStars) {
      lastStars = stars;
      let html = '';
      for (let i = 0; i < 5; i++) html += i < stars ? '★' : '<span class="off">★</span>';
      starsEl.innerHTML = html;
    }
    if (G.save.cash !== lastCash) {
      lastCash = G.save.cash;
      cashEl.textContent = '$' + G.save.cash.toLocaleString('en-US');
    }
    healthEl.style.width = Math.max(0, G.player.health) + '%';
    if (crossEl) crossEl.style.opacity = (G.player.aiming || G.forceCrosshair) ? '1' : '0';
    const obj = G.missions ? G.missions.objective : null;
    const label = obj ? obj.label : '';
    if (label !== lastObj) { lastObj = label; objEl.textContent = label; }
    drawMap();
  }

  return { toast, update };
}
