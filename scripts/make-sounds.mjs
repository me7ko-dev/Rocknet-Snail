// Creates all sound effects and the background music from code (simple synthesis),
// so the game has no third-party audio files.
//
//   npm run sounds   → writes assets/sounds/*.wav
import fs from 'node:fs';
import path from 'node:path';

const RATE = 22050;
const OUT = path.join(process.cwd(), 'assets', 'sounds');

// ---------------------------------------------------------------- basics

let seed = 12345;
function noise() {
  // deterministic white noise, so the files are the same every time
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 2 - 1;
}

const note = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

const wave = {
  sine: (ph) => Math.sin(ph * 2 * Math.PI),
  triangle: (ph) => 1 - 4 * Math.abs((ph % 1) - 0.5),
  square: (ph) => ((ph % 1) < 0.5 ? 1 : -1) * 0.6,
  soft: (ph) => Math.sin(ph * 2 * Math.PI) * 0.75 + Math.sin(ph * 4 * Math.PI) * 0.18 + Math.sin(ph * 6 * Math.PI) * 0.07,
};

function buffer(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/** Adds a tone with a quick attack and an exponential fade. Frequency can slide from f0 to f1. */
function tone(buf, start, dur, f0, { f1 = f0, type = 'soft', vol = 0.5, attack = 0.005, decay = 4 } = {}) {
  let ph = 0;
  const s0 = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const k = i / n;
    const f = f0 * (f1 / f0) ** k;
    ph += f / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * k) * Math.min(1, (n - i) / (RATE * 0.004));
    buf[s0 + i] += wave[type](ph) * env * vol;
  }
}

/** Adds filtered noise (low = darker). */
function hiss(buf, start, dur, { vol = 0.3, low = 0.2, decay = 4, attack = 0.005, rise = false } = {}) {
  const s0 = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  let lp = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const k = i / n;
    const cut = rise ? low * (0.3 + k) : low;
    lp += (noise() - lp) * cut;
    const env = Math.min(1, t / attack) * Math.exp(-decay * k) * Math.min(1, (n - i) / (RATE * 0.004));
    buf[s0 + i] += lp * env * vol;
  }
}

function writeWav(name, buf, gain = 1) {
  // normalise gently so nothing clips
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? (0.89 / peak) * gain : 0;
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i] * k)) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([h, data]));
  console.log(`  wrote assets/sounds/${name}.wav (${Math.round((44 + data.length) / 1024)} KB)`);
}

// ---------------------------------------------------------------- effects

function coin() {
  const b = buffer(0.3);
  tone(b, 0, 0.07, note('B5'), { type: 'square', vol: 0.35, decay: 1 });
  tone(b, 0.06, 0.24, note('E6'), { type: 'square', vol: 0.35, decay: 5 });
  return b;
}

function crash() {
  const b = buffer(0.6);
  tone(b, 0, 0.45, 520, { f1: 90, type: 'triangle', vol: 0.7, decay: 3 });
  hiss(b, 0, 0.18, { vol: 0.7, low: 0.35, decay: 6 });
  tone(b, 0.12, 0.35, 260, { f1: 150, type: 'sine', vol: 0.3, decay: 4 });
  return b;
}

function best() {
  const b = buffer(0.75);
  ['C6', 'E6', 'G6'].forEach((n, i) => tone(b, i * 0.08, 0.12, note(n), { type: 'triangle', vol: 0.5, decay: 2 }));
  tone(b, 0.24, 0.5, note('C7'), { type: 'triangle', vol: 0.5, decay: 3.5 });
  tone(b, 0.24, 0.5, note('E6'), { type: 'triangle', vol: 0.25, decay: 3.5 });
  return b;
}

function buy() {
  const b = buffer(0.6);
  tone(b, 0, 0.1, note('G6'), { type: 'square', vol: 0.3, decay: 2 });
  tone(b, 0.08, 0.45, note('C7'), { type: 'square', vol: 0.3, decay: 4 });
  hiss(b, 0.08, 0.4, { vol: 0.12, low: 0.9, decay: 5 });
  return b;
}

function tap() {
  const b = buffer(0.08);
  tone(b, 0, 0.07, 900, { f1: 500, type: 'sine', vol: 0.6, decay: 5, attack: 0.001 });
  return b;
}

function nope() {
  const b = buffer(0.35);
  tone(b, 0, 0.13, note('E4'), { type: 'square', vol: 0.3, decay: 1.5 });
  tone(b, 0.14, 0.2, note('C4'), { type: 'square', vol: 0.3, decay: 3 });
  return b;
}

/** Seamless rocket hiss for looping while the finger is held */
function thrust() {
  const len = 1.2;
  const b = buffer(len + 0.2);
  hiss(b, 0, len + 0.2, { vol: 0.6, low: 0.12, decay: 0, attack: 0.001 });
  tone(b, 0, len + 0.2, 70, { type: 'sine', vol: 0.12, decay: 0, attack: 0.001 });
  // cross-fade the extra tail into the start so the loop has no click
  const n = Math.floor(len * RATE);
  const fade = b.length - n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b[i];
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = b[n + i] * (1 - k) + b[i] * k;
  }
  return out;
}

// ---------------------------------------------------------------- music

/** A short, cheerful, looping tune: C – Am – F – G, twice, at 128 BPM */
function music() {
  const bpm = 128;
  const beat = 60 / bpm;
  const bars = 8;
  const b = buffer(bars * 4 * beat);
  const chords = [
    ['C3', ['C4', 'E4', 'G4']],
    ['A2', ['A3', 'C4', 'E4']],
    ['F2', ['F3', 'A3', 'C4']],
    ['G2', ['G3', 'B3', 'D4']],
  ];
  const melody = [
    ['E5', 'G5', 'C6', 'G5'],
    ['A5', 'G5', 'E5', 'C5'],
    ['F5', 'A5', 'C6', 'A5'],
    ['G5', 'B5', 'D6', 'B5'],
    ['C6', 'B5', 'C6', 'E6'],
    ['D6', 'C6', 'A5', 'E5'],
    ['F5', 'G5', 'A5', 'C6'],
    ['B5', 'D6', 'G5', '-'],
  ];
  for (let bar = 0; bar < bars; bar++) {
    const t0 = bar * 4 * beat;
    const [root, chord] = chords[bar % 4];
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      // bass: root on the beat, octave on the off-beat
      tone(b, t, beat * 0.45, note(root), { type: 'triangle', vol: 0.42, decay: 2 });
      tone(b, t + beat / 2, beat * 0.4, note(root) * 2, { type: 'triangle', vol: 0.25, decay: 2.5 });
      // bouncy chord on the off-beat
      for (const n of chord) tone(b, t + beat / 2, beat * 0.3, note(n), { type: 'square', vol: 0.045, decay: 4 });
      // drums: kick on 1 and 3, snare on 2 and 4, hi-hat on off-beats
      if (q % 2 === 0) tone(b, t, 0.16, 150, { f1: 45, type: 'sine', vol: 0.55, decay: 3, attack: 0.001 });
      else hiss(b, t, 0.12, { vol: 0.22, low: 0.5, decay: 6, attack: 0.001 });
      hiss(b, t + beat / 2, 0.04, { vol: 0.08, low: 0.95, decay: 5, attack: 0.001 });
      // melody
      const m = melody[bar][q];
      if (m !== '-') tone(b, t, beat * 0.8, note(m), { type: 'soft', vol: 0.22, decay: 2.2, attack: 0.01 });
    }
  }
  return b;
}

fs.mkdirSync(OUT, { recursive: true });
console.log('Sounds:');
writeWav('coin', coin(), 0.8);
writeWav('crash', crash(), 0.95);
writeWav('best', best(), 0.8);
writeWav('buy', buy(), 0.8);
writeWav('tap', tap(), 0.5);
writeWav('nope', nope(), 0.6);
writeWav('thrust', thrust(), 0.7);
writeWav('music', music(), 0.8);
