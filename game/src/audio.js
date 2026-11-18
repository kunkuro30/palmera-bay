// audio.js — every sound is synthesised with WebAudio; there are no audio
// files. A low sunset pad loops under the game, and short one-shot voices
// cover the engine, the siren, gunshots, punches, pickups and stings.
// Nothing starts until the first user gesture (the Start button).

export function createAudio() {
  let ctx = null, master = null, muted = false;
  let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, musicTimer = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  // The sunset pad: two detuned triangles through a slow filter, cycling a
  // four-chord loop (Am – F – C – G in A=110 Hz land) every 16 seconds.
  const CHORDS = [[110, 164.8, 261.6], [87.3, 174.6, 220], [130.8, 196, 329.6], [98, 146.8, 246.9]];
  function scheduleChord(i) {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const freq of CHORDS[i % CHORDS.length]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.value = 620;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.055, t + 1.6);
      g.gain.setValueAtTime(0.055, t + 12.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 16);
      o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 16.1);
    }
  }

  return {
    start() {
      if (!ensure()) return;
      if (!musicTimer) {
        let bar = 0;
        scheduleChord(bar++);
        musicTimer = setInterval(() => scheduleChord(bar++), 16000);
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    engine(on, rpm) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator(); engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        engineGain.gain.value = 0.05;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      } else if (!on && engineOsc) {
        engineOsc.stop(); engineOsc = null; engineGain = null;
      }
      if (engineOsc) engineOsc.frequency.value = 55 + Math.min(1, Math.abs(rpm)) * 130;
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator(); sirenGain = ctx.createGain();
        sirenOsc.type = 'triangle';
        sirenGain.gain.value = 0.028;
        const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
        lfo.frequency.value = 0.55; lfoGain.gain.value = 190;
        lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 830;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        sirenOsc._lfo?.stop(); sirenOsc.stop(); sirenOsc = null; sirenGain = null;
      }
    },
    shot() { noiseBurst(0.14, 0.5, 2400); blip(160, 0.1, 'square', 0.18, 60); },
    punch() { noiseBurst(0.07, 0.3, 700); },
    pickup() { blip(660, 0.1, 'sine', 0.25); setTimeout(() => blip(990, 0.16, 'sine', 0.25), 70); },
    cash() { blip(880, 0.09, 'square', 0.14); setTimeout(() => blip(1320, 0.18, 'square', 0.14), 80); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    sting() { [392, 370, 349, 311].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 150)); },
    crash(intensity) { noiseBurst(0.2, Math.min(0.6, 0.2 + intensity * 0.4), 900); },
  };
}
