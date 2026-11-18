// audio.js — the whole soundtrack is oscillators: a four-chord sunset pad,
// an engine that follows the revs, a two-tone siren, and one-shot effects.
// Nothing is a file, and nothing starts until the player's first click.

const CHORDS = [
  [220.0, 261.63, 329.63], // A minor
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
  [164.81, 196.0, 246.94], // E minor
];
const CHORD_LEN = 4.6;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenGain = null;
  let noiseBuf = null;
  let chordIdx = 0;
  let nextChordAt = 0;

  function playChord(freqs, at) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.045, at + 1.3);
    g.gain.setValueAtTime(0.045, at + CHORD_LEN - 1.4);
    g.gain.linearRampToValueAtTime(0, at + CHORD_LEN + 0.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    g.connect(filter);
    filter.connect(master);
    for (const f of freqs) {
      for (const det of [0, 4]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(g);
        o.start(at);
        o.stop(at + CHORD_LEN + 0.3);
      }
    }
  }

  function schedulePad() {
    if (!ctx) return;
    while (nextChordAt < ctx.currentTime + 2.5) {
      playChord(CHORDS[chordIdx % CHORDS.length], Math.max(nextChordAt, ctx.currentTime + 0.05));
      chordIdx++;
      nextChordAt += CHORD_LEN;
    }
  }

  function noise(dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.loopEnd = Math.min(dur, noiseBuf.duration);
    return src;
  }

  function burst({ type = 'sine', from = 440, to = null, dur = 0.15, gain = 0.15, at = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseHit(dur, freq, gain) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noise(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    start() {
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

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      // engine: a saw through a lowpass, silent until setEngine says otherwise
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // siren: a square wave whose pitch an LFO swings up and down
      const sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 820;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      lfo.start();

      nextChordAt = ctx.currentTime + 0.1;
      schedulePad();
      window.setInterval(schedulePad, 900);
    },

    setEngine(norm, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.03 + norm * 0.028 : 0, t, 0.12);
      engineOsc.frequency.setTargetAtTime(55 + norm * 170, t, 0.1);
      engineFilter.frequency.setTargetAtTime(300 + norm * 950, t, 0.15);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.026 : 0, ctx.currentTime, 0.2);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },

    shot() {
      noiseHit(0.13, 2600, 0.22);
      burst({ type: 'square', from: 210, to: 42, dur: 0.1, gain: 0.12 });
    },
    punch() {
      burst({ type: 'sine', from: 150, to: 55, dur: 0.09, gain: 0.2 });
    },
    swing() {
      noiseHit(0.06, 1200, 0.05);
    },
    pickup() {
      burst({ type: 'sine', from: 660, dur: 0.08, gain: 0.12 });
      burst({ type: 'sine', from: 880, dur: 0.12, gain: 0.12, at: 0.07 });
    },
    cash() {
      burst({ type: 'triangle', from: 880, dur: 0.09, gain: 0.12 });
      burst({ type: 'triangle', from: 1174, dur: 0.09, gain: 0.12, at: 0.06 });
      burst({ type: 'triangle', from: 1568, dur: 0.16, gain: 0.12, at: 0.12 });
    },
    sting() {
      for (const f of [220, 261.63, 311.13]) {
        burst({ type: 'sawtooth', from: f, dur: 0.5, gain: 0.05 });
      }
    },
    crash() {
      noiseHit(0.28, 420, 0.3);
    },
    door() {
      burst({ type: 'sine', from: 320, to: 190, dur: 0.07, gain: 0.1 });
    },
  };
}
