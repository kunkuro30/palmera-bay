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

  return {
    unlock() { ensure(); },
    thud() { noise(0.12, 0.25); blip(90, 0.12, 'sine', 0.2, -40); },
    whoosh() { noise(0.08, 0.06); },
    pickup() { blip(660, 0.09, 'square', 0.1); setTimeout(() => blip(990, 0.12, 'square', 0.1), 70); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.14), i * 95)); },
    busted() { blip(320, 0.4, 'sawtooth', 0.12, -180); },
    blast() { noise(0.16, 0.32); blip(70, 0.12, 'sine', 0.25, -30); },
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
