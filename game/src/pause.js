// The pause suite (build 12): ESC or P freezes the bay and opens a
// four-tab panel — MAP (the full island with named districts, service
// icons and the player marker), MISSIONS (all eight jobs with giver,
// brief, payout and state), STATS (the career counters from save.js)
// and CONTROLS. Opening the panel flushes the save.

import { WORLD, coastRadius, highwayLoopPoints, FREEWAY_PTS } from './config.js';
import { DISTRICTS } from './districts.js';
import { PEOPLE } from './dialogue.js';
import { repLevel } from './save.js';

const ICONS = [
  { ch: 'H', x: -128, z: 182, color: '#d42a2a', title: 'Bay Clinic' },
  { ch: 'P', x: 120, z: 96, color: '#3d7bff', title: 'Palmera PD' },
  { ch: 'F', x: 75, z: 22, color: '#e4572e', title: 'Palmera FD' },
  { ch: '★', x: 143, z: -38, color: '#7ac74f', title: 'Palmera Garrison' },
  { ch: '✈', x: -190, z: 124, color: '#118ab2', title: 'Bay Airport' },
  { ch: '$', x: -108, z: 182, color: '#b98a0e', title: 'Kiosk row' },
  { ch: '$', x: 108, z: 182, color: '#b98a0e', title: 'Kiosk row' },
  { ch: 'M', x: 120, z: 141, color: '#5a7186', title: 'Palmera Motors' },
];

export function createPause(G) {
  const root = document.getElementById('pause');
  const mapCanvas = document.getElementById('pauseMap');
  const missionsEl = document.getElementById('pauseMissions');
  const statsEl = document.getElementById('pauseStats');
  const tabs = [...root.querySelectorAll('.pause-tabs button')];
  const panels = {
    map: document.getElementById('ptab-map'),
    missions: document.getElementById('ptab-missions'),
    stats: document.getElementById('ptab-stats'),
    controls: document.getElementById('ptab-controls'),
  };
  let openState = false;
  let curTab = 'map';

  function drawMap() {
    const c = mapCanvas.getContext('2d');
    const S = mapCanvas.width;
    const half = 330;
    const px = (x) => ((x + half) / (half * 2)) * S;
    const pz = (z) => ((z + half) / (half * 2)) * S;
    const C = WORLD.centre;
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#0d5a74';
    c.fillRect(0, 0, S, S);
    // Island body + beach ring.
    c.beginPath();
    for (let th = 0; th <= Math.PI * 2 + 0.01; th += 0.03) {
      const r = coastRadius(th);
      const x = px(C.x + r * Math.cos(th)), y = pz(C.z + r * Math.sin(th));
      if (th === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
    c.fillStyle = '#79c25e';
    c.fill();
    c.strokeStyle = '#f2d492';
    c.lineWidth = 9;
    c.stroke();
    // Desert, lake, mountain.
    c.beginPath();
    c.ellipse(px(108), pz(-108), 74 * (S / (half * 2)), 50 * (S / (half * 2)), 0, 0, Math.PI * 2);
    c.fillStyle = '#dcb87f';
    c.fill();
    c.beginPath();
    c.arc(px(WORLD.lake.x), pz(WORLD.lake.z), WORLD.lake.waterR * (S / (half * 2)), 0, Math.PI * 2);
    c.fillStyle = '#3fa7c4';
    c.fill();
    for (const [mx, mz, w] of [[WORLD.mountain.x, WORLD.mountain.z, 26], [-120, -120, 15]]) {
      c.beginPath();
      c.moveTo(px(mx) - w, pz(mz) + w * 0.7);
      c.lineTo(px(mx), pz(mz) - w);
      c.lineTo(px(mx) + w, pz(mz) + w * 0.7);
      c.closePath();
      c.fillStyle = '#8d8578';
      c.fill();
    }
    // Airport plateau + runway.
    c.fillStyle = '#9aa0a8';
    c.fillRect(px(WORLD.airport.x0), pz(WORLD.airport.z0),
      px(WORLD.airport.x1) - px(WORLD.airport.x0), pz(WORLD.airport.z1) - pz(WORLD.airport.z0));
    c.fillStyle = '#2c2f36';
    c.fillRect(px(-247), pz(60), px(-229) - px(-247), pz(196) - pz(60));
    // Park.
    c.fillStyle = '#5da24b';
    c.fillRect(px(WORLD.park.x0), pz(WORLD.park.z0), px(WORLD.park.x1) - px(WORLD.park.x0), pz(WORLD.park.z1) - pz(WORLD.park.z0));
    // Roads.
    c.strokeStyle = 'rgba(230,238,245,.55)';
    c.lineWidth = 2.5;
    c.beginPath();
    highwayLoopPoints().forEach((p, i) => { if (i === 0) c.moveTo(px(p.x), pz(p.z)); else c.lineTo(px(p.x), pz(p.z)); });
    c.closePath();
    c.stroke();
    c.beginPath();
    FREEWAY_PTS.forEach((p, i) => { if (i === 0) c.moveTo(px(p.x), pz(p.z)); else c.lineTo(px(p.x), pz(p.z)); });
    c.stroke();
    c.strokeStyle = 'rgba(240,244,248,.9)';
    c.lineWidth = 2;
    for (const x of WORLD.avenues) { c.beginPath(); c.moveTo(px(x), pz(18)); c.lineTo(px(x), pz(196)); c.stroke(); }
    for (const z of WORLD.streets.concat([WORLD.oceanDrive])) { c.beginPath(); c.moveTo(px(-166), pz(z)); c.lineTo(px(156), pz(z)); c.stroke(); }
    // District names — BUILD 15: with Rio's standing in each, the
    // territory percentage the top games show on their maps.
    c.textAlign = 'center';
    for (const d of DISTRICTS) {
      const pct = G.standing ? G.standing.percent(d.id) : 0;
      const label = `${d.name} · ${pct}%`;
      c.font = '900 25px "Trebuchet MS", sans-serif';
      c.fillStyle = 'rgba(6,24,40,.55)';
      c.fillText(label, px(d.label.x) + 2, pz(d.label.z) + 2);
      c.fillStyle = '#fff6d8';
      c.fillText(label, px(d.label.x), pz(d.label.z));
    }
    c.font = '700 17px "Trebuchet MS", sans-serif';
    c.fillStyle = 'rgba(255,246,216,.85)';
    c.fillText('PALMERA PARK', px(88), pz(70));
    c.fillText('THE BEACH', px(30), pz(228));
    // Service icons.
    for (const ic of ICONS) {
      c.beginPath();
      c.arc(px(ic.x), pz(ic.z), 13, 0, Math.PI * 2);
      c.fillStyle = ic.color;
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.9)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#fff';
      c.font = '900 16px "Trebuchet MS", sans-serif';
      c.fillText(ic.ch, px(ic.x), pz(ic.z) + 6);
    }
    // Objective.
    const obj = G.missions ? G.missions.objective : null;
    if (obj && obj.x !== null && obj.x !== undefined) {
      c.beginPath(); c.arc(px(obj.x), pz(obj.z), 9, 0, Math.PI * 2);
      c.fillStyle = '#ffd23e'; c.fill();
      c.strokeStyle = '#7a5b00'; c.lineWidth = 2.5; c.stroke();
    }
    // Player arrow.
    const pp = G.playerPos();
    const heading = G.playerHeading();
    c.save();
    c.translate(px(pp.x), pz(pp.z));
    c.rotate(Math.PI - heading);
    c.fillStyle = '#ff5964';
    c.beginPath();
    c.moveTo(0, -13); c.lineTo(9, 11); c.lineTo(-9, 11); c.closePath(); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.restore();
  }

  function renderMissions() {
    const rows = G.missions.jobsState().map((j) => {
      const giver = PEOPLE[j.giver];
      const state = j.state === 'done' ? '<span class="st done">DONE</span>'
        : j.state === 'current' ? '<span class="st cur">ACTIVE</span>'
        : '<span class="st lock">LOCKED</span>';
      return `<div class="job ${j.state}"><div class="job-head"><span class="job-name">${j.name}</span>${state}<span class="job-pay">$${j.payout.toLocaleString('en-US')}</span></div>` +
        `<div class="job-meta">${j.chapter} · for ${giver ? giver.name : j.giver}</div><div class="job-brief">${j.brief}</div></div>`;
    }).join('');
    missionsEl.innerHTML = rows;
  }

  function fmtTime(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, '0')}`;
  }

  function renderStats() {
    const s = G.save;
    const mins = Math.floor((s.playTime || 0) / 60);
    const play = mins >= 60 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
    const lv = repLevel(s);
    const ownedNames = ['PISTOL'];
    if ((s.weapons || 1) & 2) ownedNames.push('SMG');
    if ((s.weapons || 1) & 4) ownedNames.push('RIFLE');
    const rows = [
      ['Day in the bay', 'DAY ' + (s.day || 1)],
      ['Cash earned', '$' + Math.floor(s.cashEarned || 0).toLocaleString('en-US')],
      ['Cash on hand', '$' + s.cash.toLocaleString('en-US')],
      ['Jobs done', `${s.jobsDone} / 8`],
      ['BAY REP', 'Lv ' + lv],
      ['RESPECT', `${s.respect || 0} · next level at ${lv * 100}`],
      ['Weapons owned', ownedNames.join(' · ')],
      ['The Comet', `ENGINE Lv ${s.upgEngine || 0} · ARMOUR Lv ${s.upgArmor || 0} · ${(s.upgNitro || 0) ? 'NITRO' : 'no nitro'}`],
      ['Safehouse', (s.houseOwned || 0) ? 'Palmera Heights — yours' : 'not bought yet'],
      ['Ocean Sprint — best', fmtTime(s.raceBest1)],
      ['Island Loop — best', fmtTime(s.raceBest2)],
      ['Cars driven', String(s.carsDriven || 0)],
      ['Cars stolen', String(s.carsStolen || 0)],
      ['Cars sold to Motors', String(s.carsSold || 0)],
      ['Cops evaded', String(s.copsEvaded || 0)],
      ['Distance driven', ((s.distance || 0) / 1000).toFixed(1) + ' km'],
      ['Golden shells', `${s.shells || 0} / 15`],
      ['Time in the bay', play],
    ];
    statsEl.innerHTML = rows.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function selectTab(name) {
    curTab = name;
    for (const b of tabs) b.classList.toggle('active', b.dataset.tab === name);
    for (const [k, el] of Object.entries(panels)) el.classList.toggle('hidden', k !== name);
    if (name === 'map') drawMap();
    if (name === 'missions') renderMissions();
    if (name === 'stats') renderStats();
  }

  function setOpen(v) {
    if (v === openState) return;
    if (v && (!G.started || G.shotMode)) return;
    openState = v;
    root.classList.toggle('hidden', !v);
    if (v) { G.persist(); selectTab(curTab); }
  }

  for (const b of tabs) b.addEventListener('click', () => selectTab(b.dataset.tab));
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') setOpen(!openState);
  });

  return {
    get open() { return openState; },
    toggle() { setOpen(!openState); },
    selectTab,
  };
}
