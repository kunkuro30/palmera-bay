// HUD: DOM readouts (brand, wanted stars, cash, clock, health + armour,
// weapon and BAY REP chips), the mission card (chapter, job, stage pips,
// NEXT line), toasts, big centre cards (chapter titles, JOB COMPLETE),
// district title cards, the district+street caption, and a canvas
// minimap that draws the ISLAND — sea all around, the beach ring, the
// southern city grid, the airport plateau, the desert, the lake and the
// mountain — so one glance reads "GTA-style island map". All shapes come
// from the shared layout maths in config.js.

import { WORLD, coastRadius, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { districtAt, streetAt } from './districts.js';
import { repLevel } from './save.js';

export function createHud(G) {
  const starsEl = document.getElementById('stars');
  const cashEl = document.getElementById('cash');
  const clockEl = document.getElementById('clock');
  const healthEl = document.getElementById('health');
  const armourEl = document.getElementById('armour');
  const weaponEl = document.getElementById('weaponChip');
  const rankEl = document.getElementById('rankChip');
  const objEl = document.getElementById('objective');
  const toastEl = document.getElementById('toast');
  const promptEl = document.getElementById('prompt');
  const crossEl = document.getElementById('crosshair');
  const districtEl = document.getElementById('district');
  const gradeEl = document.getElementById('grade');
  const locCardEl = document.getElementById('locCard');
  const bigCardEl = document.getElementById('bigCard');
  const bigTitleEl = document.getElementById('bigCardTitle');
  const bigSubEl = document.getElementById('bigCardSub');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  let toastTimer = null;
  let lastStars = -1;
  let lastCash = -1;
  let lastObjKey = '';
  let lastClock = '';
  let lastWeapon = '';
  let lastRank = -1;
  let lastRawMins = -1;
  let lastCaption = '';
  let curDistrict = null;
  let locTimer = null;
  const cardQueue = [];
  let cardTimer = null;

  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, ms);
  }

  // BUILD 13: the approach prompt (sidejobs.js drives it) — a pill
  // above the objective card naming the offer and its price. Pass null
  // to clear. HTML is allowed for the <b> key hint; callers pass only
  // their own strings.
  let lastPrompt = undefined;
  function prompt(html) {
    if (html === lastPrompt) return;
    lastPrompt = html;
    if (!html) { promptEl.style.display = 'none'; return; }
    promptEl.innerHTML = html;
    promptEl.style.display = 'block';
  }

  // Big centre cards (chapter titles, JOB COMPLETE) — queued so two in
  // a row never stomp each other.
  function bigCard(title, sub, ms = 2400) {
    cardQueue.push({ title, sub, ms });
    if (!cardTimer) stepCard();
  }
  function stepCard() {
    const c = cardQueue.shift();
    if (!c) { bigCardEl.classList.remove('show'); cardTimer = null; return; }
    bigTitleEl.textContent = c.title;
    bigSubEl.textContent = c.sub || '';
    bigCardEl.classList.add('show');
    cardTimer = setTimeout(stepCard, c.ms);
  }

  function locCard(name) {
    locCardEl.textContent = name;
    locCardEl.classList.add('show');
    if (locTimer) clearTimeout(locTimer);
    locTimer = setTimeout(() => locCardEl.classList.remove('show'), 2300);
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
    // BUILD 14: the active race checkpoint rides the minimap in orange.
    const rm = G.races ? G.races.marker : null;
    if (rm) {
      ctx.fillStyle = '#fb8b24';
      ctx.beginPath(); ctx.arc(px(rm.x), pz(rm.z), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a3c00'; ctx.lineWidth = 1.5; ctx.stroke();
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

  function missionCard(obj) {
    if (!obj) return '';
    if (!obj.jobName) return obj.label || '';   // screenshot overrides stay plain
    let pips = '';
    for (let i = 0; i < obj.stageCount; i++) pips += i < obj.stageIdx ? '●' : (i === obj.stageIdx ? '◉' : '○');
    return `<div class="obj-chapter">${obj.chapterName}</div>` +
      `<div class="obj-job">${obj.letter ? obj.letter + ' · ' : ''}${obj.jobName}</div>` +
      `<div class="obj-stage">${obj.stageLabel}</div>` +
      (obj.stageCount ? `<div class="obj-row"><span class="obj-pips">${pips}</span><span class="obj-next">NEXT · ${obj.nextLabel}</span></div>` : '');
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
    // Clock: the bay's day starts at 09:30 and runs one game minute
    // per real second (the sun grade stays sunny — build 13 bends the
    // light, the clock already tells the time).
    // BUILD 15: the day counter rides the midnight wrap of the RAW
    // clock (the safehouse rest adds a display offset on top, and
    // bumps the day itself when it jumps to 08:00).
    const rawMins = (570 + Math.floor(G.time)) % 1440;
    if (!G.shotMode) {
      if (lastRawMins >= 0 && rawMins < lastRawMins - 720) {
        G.save.day = (G.save.day || 1) + 1;
        G.persist();
      }
      lastRawMins = rawMins;
    }
    const mins = (rawMins + (G.save.clockOff || 0)) % 1440;
    const clock = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    if (clock !== lastClock) { lastClock = clock; clockEl.textContent = clock; }
    // BUILD 15: the cinematic grade — a CSS vignette + warm wash over
    // the whole frame (no post-processing chain), breathing up to
    // full warmth across the golden hour, 17:00–19:00 on the clock.
    // BUILD 17 (resubmit): the base warmth is raised (0.38 → 0.55) so
    // the default midday look reads sun-soaked instead of pale.
    if (gradeEl) {
      const golden = Math.max(0, 1 - Math.abs(mins - 1080) / 90);
      gradeEl.style.opacity = (0.55 + 0.45 * golden).toFixed(2);
    }
    healthEl.style.width = Math.max(0, G.player.health) + '%';
    armourEl.style.width = Math.max(0, Math.min(100, G.player.armour || 0)) + '%';
    // BUILD 14: the weapon chip carries the current weapon's name and
    // the four slot pips — ◉ current, ● owned, ○ not yet bought. The
    // rank chip now shows the RESPECT total behind the level.
    // BUILD 15: guns also carry their magazine — "12 / ∞" (the
    // reserve really is infinite), RELOADING… while R works, EMPTY
    // when the mag runs dry.
    let weapon = 'FISTS';
    if (G.weapons) {
      const cur = G.weapons.def();
      const pips = G.weapons.WEAPONS.map((w) =>
        w.id === cur.id ? '◉' : (G.weapons.owned(w.id) ? '●' : '○')).join('');
      weapon = `${cur.name} ${pips}`;
      if (cur.mag) {
        if (G.weapons.reloading) weapon += ' · RELOADING…';
        else {
          const a = G.weapons.ammoOf(cur.id);
          weapon += ` · ${a} / ∞` + (a === 0 ? ' · EMPTY' : '');
        }
      }
    } else if (G.player.aiming) weapon = 'PISTOL';
    if (weapon !== lastWeapon) { lastWeapon = weapon; weaponEl.textContent = weapon; }
    const rank = repLevel(G.save);
    const rankText = `BAY REP Lv ${rank} · RESPECT ${G.save.respect || 0}`;
    if (rankText !== lastRank) { lastRank = rankText; rankEl.textContent = rankText; }
    if (crossEl) crossEl.style.opacity = (G.player.aiming || G.forceCrosshair) ? '1' : '0';
    const obj = G.missions ? G.missions.objective : null;
    const key = obj ? (obj.jobName ? `${obj.jobName}|${obj.stageIdx}|${obj.stageLabel}` : obj.label) : '';
    if (key !== lastObjKey) { lastObjKey = key; objEl.innerHTML = missionCard(obj); }
    // District + street caption, and the big title card on entry.
    const pp = G.playerPos();
    const d = districtAt(pp.x, pp.z);
    const st = streetAt(pp.x, pp.z);
    const caption = d ? (st && st.toUpperCase() !== d.name ? `${d.name} · ${st}` : d.name) : (st || 'PALMERA BAY');
    if (caption !== lastCaption) { lastCaption = caption; districtEl.textContent = caption; }
    const dId = d ? d.id : null;
    if (dId !== curDistrict) {
      const entered = curDistrict !== null && dId !== null;
      curDistrict = dId;
      if (entered && G.started && !G.shotMode) locCard(d.name);
    }
    drawMap();
  }

  return { toast, update, bigCard, prompt };
}
