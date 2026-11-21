// GO RIO RIO · audio.js — all sound is synthesized WebAudio; there are no audio files.
// WebAudio synth: no audio files, everything is oscillators and noise.
// The context is created lazily on the first user gesture (browser policy).

export function createAudio() {
  let ctx = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function noise(dur, vol = 0.15) {
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g).connect(c.destination);
    src.start();
  }

  // ---- BUILD 14: the car radio -------------------------------------
  // Three procedural stations, no files and no network — every note is
  // an oscillator scheduled a step ahead, exactly like the SFX above.
  //   1 BAY FM      — synthwave: a driving saw bass + minor arp.
  //   2 PALMERA POP — brighter triangle pop in a major pentatonic.
  //   3 SOL KEYS    — sparse piano-ish sine chords, slow.
  // (-1 in a pattern is a rest.) The bus sits well under the SFX.
  const RADIO = [
    null,
    { name: 'BAY FM', step: 60 / 100 / 2, wave: 'sawtooth', kind: 'arp', bassVol: 0.14, leadVol: 0.045,
      bassBase: 55, bass: [0, -1, 0, -1, 12, -1, 0, -1, 0, -1, 0, -1, 10, -1, 12, -1],
      leadBase: 220, lead: [12, -1, -1, 15, -1, -1, 12, -1, 10, -1, -1, 12, -1, -1, -1, -1] },
    { name: 'PALMERA POP', step: 60 / 124 / 2, wave: 'triangle', kind: 'arp', bassVol: 0.11, leadVol: 0.055,
      bassBase: 65.41, bass: [0, -1, 7, -1, 9, -1, 7, -1, 5, -1, 7, -1, 4, -1, 7, -1],
      leadBase: 261.63, lead: [0, -1, 4, -1, 7, -1, 4, -1, 9, -1, 7, -1, 4, -1, 2, -1] },
    { name: 'SOL KEYS', step: 1.7, wave: 'sine', kind: 'chords', vol: 0.05,
      chords: [[174.61, 220.0, 261.63], [130.81, 164.81, 196.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63]] },
  ];
  let radioTimer = null;
  let radioPlaying = 0;
  let radioStep = 0;
  let radioNextAt = 0;

  function radioNote(freq, t, dur, type, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (type === 'sawtooth') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1100;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function radioSchedule() {
    if (!ctx || !radioPlaying) return;
    const st = RADIO[radioPlaying];
    while (radioNextAt < ctx.currentTime + 0.30) {
      const t = Math.max(radioNextAt, ctx.currentTime + 0.02);
      if (st.kind === 'arp') {
        const b = st.bass[radioStep % st.bass.length];
        if (b >= 0) radioNote(st.bassBase * Math.pow(2, b / 12), t, st.step * 1.8, st.wave, st.bassVol);
        const l = st.lead[radioStep % st.lead.length];
        if (l >= 0) radioNote(st.leadBase * Math.pow(2, l / 12), t, st.step * 1.6, st.wave, st.leadVol);
      } else {
        const chord = st.chords[radioStep % st.chords.length];
        for (const f of chord) radioNote(f, t, st.step * 1.9, 'sine', st.vol);
        radioNote(chord[0] / 2, t, st.step * 1.9, 'triangle', st.vol * 0.7);
      }
      radioStep += 1;
      radioNextAt += st.step;
    }
  }

  function radioSet(i) {
    if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
    radioPlaying = 0;
    if (!i || !RADIO[i]) return;
    const c = ensure();
    if (!c) return;
    radioPlaying = i;
    radioStep = 0;
    radioNextAt = c.currentTime + 0.06;
    radioTimer = setInterval(radioSchedule, 90);
    radioSchedule();
  }

  return {
    unlock() { ensure(); },
    radioSet,
    radioStop() { radioSet(0); },
    radioNow() { return radioPlaying; },
    stationName(i) { return RADIO[i] ? RADIO[i].name : 'OFF'; },
    thud() { noise(0.12, 0.25); blip(90, 0.12, 'sine', 0.2, -40); },
    whoosh() { noise(0.08, 0.06); },
    pickup() { blip(660, 0.09, 'square', 0.1); setTimeout(() => blip(990, 0.12, 'square', 0.1), 70); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.14), i * 95)); },
    busted() { blip(320, 0.4, 'sawtooth', 0.12, -180); },
    blast() { noise(0.16, 0.32); blip(70, 0.12, 'sine', 0.25, -30); },
    // BUILD 15: the empty trigger's dry click and the reload's two
    // mechanical snaps (mag out, mag in) — small square blips, no files.
    dryClick() { blip(1400, 0.03, 'square', 0.07); noise(0.03, 0.05); },
    reload() { blip(500, 0.05, 'square', 0.09, -160); setTimeout(() => blip(760, 0.05, 'square', 0.09, 120), 950); },
    door() { blip(180, 0.08, 'square', 0.08, -60); },
    // Two-tone siren that follows the nearest police unit's distance.
    siren(on, level) {
      const c = ensure();
      if (!c) return;
      if (on && !sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenGain = c.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      if (sirenOsc) {
        const t = c.currentTime;
        sirenOsc.frequency.setValueAtTime(650 + Math.sin(t * 4.5) * 160, t);
        sirenGain.gain.setTargetAtTime(on ? Math.min(0.07, level) : 0, t, 0.2);
        if (!on && level <= 0) { /* keep node; gain is at 0 */ }
      }
    },
  };
}
