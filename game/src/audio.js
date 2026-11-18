// All sound is synthesised with WebAudio — no audio files. The context is created lazily on
// the first user gesture (the start click); every effect guards on it existing. A quiet
// ambient pad plays under everything; engine and siren gains follow the game state.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // Ambient pad: two detuned triangles through a lowpass, very quiet.
    const padGain = ctx.createGain();
    padGain.gain.value = 0.028;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420;
    padGain.connect(padFilter).connect(master);
    for (const [freq, detune] of [[110, 0], [164.8, 4], [220, -3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(padGain);
      osc.start();
    }

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 800;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
  }

  function blip(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  return {
    init,
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    shot() {
      noiseBurst(0.09, 0.5, 1800);
      blip(220, 0.06, 'square', 0.2, 0, 60);
    },
    punch() {
      blip(150, 0.09, 'sine', 0.5, 0, 55);
      noiseBurst(0.05, 0.2, 500);
    },
    cash() {
      blip(880, 0.09, 'sine', 0.22);
      blip(1318, 0.14, 'sine', 0.22, 0.07);
    },
    sting() {
      blip(523, 0.12, 'triangle', 0.25);
      blip(659, 0.12, 'triangle', 0.25, 0.1);
      blip(784, 0.22, 'triangle', 0.28, 0.2);
    },
    busted() {
      blip(392, 0.16, 'square', 0.18);
      blip(311, 0.16, 'square', 0.18, 0.15);
      blip(233, 0.3, 'square', 0.18, 0.3);
    },
    /** Per-frame: engine pitch/gain from the player's car, siren from the nearest police. */
    update(G) {
      if (!ctx) return;
      const car = G.player.car;
      if (car) {
        const frac = Math.min(1, Math.abs(car.speed) / 42);
        engineOsc.frequency.value = 55 + frac * 105 + Math.abs(car.speed) * 0.4;
        engineGain.gain.value = 0.05 + frac * 0.075;
      } else {
        engineGain.gain.value = 0;
      }
      let nearest = Infinity;
      for (const unit of G.police.units) {
        if (unit.dead) continue;
        const d = unit.car.group.position.distanceTo(G.player.pos());
        if (d < nearest) nearest = d;
      }
      if (nearest < 75 && G.police.stars > 0) {
        sirenOsc.frequency.value = Math.sin(G.time * 5.2) > 0 ? 735 : 968;
        sirenGain.gain.value = 0.055 * (1 - nearest / 75);
      } else {
        sirenGain.gain.value = 0;
      }
    },
  };
}
