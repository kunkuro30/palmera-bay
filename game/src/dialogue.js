// Portrait dialogue (build 12): flat vector-style portrait boxes — a
// canvas portrait drawn in code from coloured shapes (no external
// assets), the speaker's name + role, and their line. Missions show one
// at every job start and completion; lines queue so a completion line
// and the next job's opener never talk over each other.

export const PEOPLE = {
  rio: {
    name: 'RIO', role: 'The kiosk kid · Palmera Bay',
    skin: '#c68863', top: '#fb8b24', accent: '#f5f0e6', hair: 'hair', hairColor: '#3a2a1a', bg: '#31536e',
  },
  marco: {
    name: 'MARCO', role: "Rio's best friend",
    skin: '#9c6644', top: '#5b8c5a', accent: '#3e6b3e', hair: 'cap', hairColor: '#d42427', bg: '#2c4a34',
  },
  ana: {
    name: 'ANA', role: 'Nurse · Bay Clinic',
    skin: '#c68863', top: '#39b5a8', accent: '#2a7f74', hair: 'nurse', hairColor: '#14100c', bg: '#1f4a4a',
  },
  reyes: {
    name: 'OFFICER REYES', role: 'Palmera PD',
    skin: '#e0ac7e', top: '#1d3fbf', accent: '#141c3a', hair: 'police', hairColor: '#16294f', bg: '#1c2f55',
  },
  lita: {
    name: 'TIA LITA', role: 'Cold-drinks kiosk · the row',
    skin: '#9c6644', top: '#2e86c8', accent: '#f7f0dd', hair: 'cap', hairColor: '#2e86c8', bg: '#274b63',
  },
  duarte: {
    name: 'SGT. DUARTE', role: 'Palmera Garrison',
    skin: '#7a4b2a', top: '#556b2f', accent: '#44542a', hair: 'cap', hairColor: '#556b2f', bg: '#37402a',
  },
};

function drawPortrait(canvas, p) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  const u = S / 96;
  // Backdrop: the speaker's colour, a sun disc and a horizon band.
  g.fillStyle = p.bg; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,210,62,.85)';
  g.beginPath(); g.arc(76 * u, 20 * u, 9 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, 66 * u, S, 30 * u);
  // Shoulders / torso.
  g.fillStyle = p.top;
  g.beginPath();
  g.moveTo(18 * u, 96 * u);
  g.quadraticCurveTo(20 * u, 64 * u, 48 * u, 62 * u);
  g.quadraticCurveTo(76 * u, 64 * u, 78 * u, 96 * u);
  g.closePath(); g.fill();
  g.fillStyle = p.accent;
  g.fillRect(43 * u, 66 * u, 10 * u, 30 * u);
  // Neck + head.
  g.fillStyle = p.skin;
  g.fillRect(43 * u, 52 * u, 10 * u, 12 * u);
  g.beginPath(); g.arc(48 * u, 40 * u, 17 * u, 0, Math.PI * 2); g.fill();
  // Face: two eyes and a flat smile.
  g.fillStyle = '#26221e';
  g.beginPath(); g.arc(42 * u, 40 * u, 1.7 * u, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(54 * u, 40 * u, 1.7 * u, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#26221e'; g.lineWidth = 1.6 * u;
  g.beginPath(); g.arc(48 * u, 45 * u, 6 * u, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
  // Headgear / hair by kind.
  if (p.hair === 'hair') {
    g.fillStyle = p.hairColor;
    g.beginPath(); g.arc(48 * u, 36 * u, 17.5 * u, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    g.fillRect(30.5 * u, 30 * u, 35 * u, 5 * u);
  } else if (p.hair === 'cap') {
    g.fillStyle = p.hairColor;
    g.beginPath(); g.arc(48 * u, 37 * u, 17.5 * u, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(46 * u, 33 * u, 26 * u, 4.5 * u);
  } else if (p.hair === 'police') {
    g.fillStyle = p.hairColor;
    g.fillRect(30 * u, 22 * u, 36 * u, 12 * u);
    g.fillRect(26 * u, 33 * u, 44 * u, 4 * u);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(48 * u, 28 * u, 3 * u, 0, Math.PI * 2); g.fill();
  } else if (p.hair === 'nurse') {
    g.fillStyle = p.hairColor;
    g.beginPath(); g.arc(48 * u, 42 * u, 18 * u, Math.PI * 0.95, Math.PI * 2.05); g.fill();
    g.fillStyle = '#f7f7f2';
    g.fillRect(33 * u, 21 * u, 30 * u, 9 * u);
    g.fillStyle = '#d42a2a';
    g.fillRect(46 * u, 23 * u, 4 * u, 5 * u);
    g.fillRect(44.5 * u, 24.5 * u, 7 * u, 2 * u);
  }
}

export function createDialogue(G) {
  const box = document.getElementById('dialogue');
  const canvas = document.getElementById('dlgPortrait');
  const nameEl = document.getElementById('dlgName');
  const lineEl = document.getElementById('dlgLine');
  const queue = [];
  let timer = null;
  let pinned = null;

  function render(who, line) {
    const p = PEOPLE[who] || PEOPLE.marco;
    drawPortrait(canvas, p);
    nameEl.innerHTML = `${p.name} <span>${p.role}</span>`;
    lineEl.textContent = line;
    box.classList.add('show');
  }

  function step() {
    if (pinned) return;
    const item = queue.shift();
    if (!item) { box.classList.remove('show'); timer = null; return; }
    render(item.who, item.line);
    timer = setTimeout(step, item.ms || 5400);
  }

  return {
    // Queue a line (mission starts / completions).
    show(who, line, ms) {
      queue.push({ who, line, ms });
      if (!timer && !pinned) step();
    },
    // Sticky display for staged screenshot scenes: no queue, no timer.
    pin(who, line) {
      pinned = { who, line };
      if (timer) { clearTimeout(timer); timer = null; }
      queue.length = 0;
      render(who, line);
    },
    hide() {
      pinned = null;
      queue.length = 0;
      if (timer) { clearTimeout(timer); timer = null; }
      box.classList.remove('show');
    },
    get busy() { return !!timer || !!pinned || queue.length > 0; },
  };
}
