// ---------- GRAVITY FRONT original procedural score ----------
// This score uses a new motif, harmony and arrangement written for the game. It deliberately
// evokes broad exhausted-war-drama qualities without reproducing music from any Gundam production.
//
// Cues:
//   requiem — quiet violin-and-cello duet (menus / bridge)
//   battle  — a transforming 3+3+2 low-string pulse with metal and heavy drums
//   victory / retreat / defeat — short original aftermath pieces
//   finale   — extended campaign resolution
import { audio, audioOutput, isAudioMuted, toggleAudioMuted } from './util.js';

const EPS = 0.0001;
const MASTER_LEVEL = 0.19;
const SCHEDULE_AHEAD = 1.25;
const CLOCK_GAP = 6;
const TRANSITION_FADE = 0.32;
const f = midi => 440 * Math.pow(2, (midi - 69) / 12);

let context = null, master = null, limiter = null;
let cur = null, cueBus = null, nextBar = 0, barIdx = 0, cueEndTime = null;
let timer = null, muted = isAudioMuted(), fileActive = false, filePending = false;
let generation = 0, lastPumpTime = null;
const activeSources = new Set();
const noiseBuffers = new Map();
const periodicWaves = new Map();

// Optional user-supplied, legally licensed files. Disabled in the shipped game: every audible cue
// below is generated locally and no copyrighted soundtrack is bundled or downloaded.
const USE_FILE_SOUNDTRACK = false;
// The menu cue is intentionally absent here so its violin/cello contract cannot be bypassed
// later by dropping in an unknown pre-rendered arrangement.
const FILE_TRACKS = { battle: 'assets/music/battle.mp3' };
const fileEls = {};

function ctx(){
  const c = audio();
  if (!c) return null;
  context = c;
  if (!master){
    master = c.createGain();
    limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.008;
    limiter.release.value = 0.22;
    master.gain.value = muted ? 0 : MASTER_LEVEL; // mute-before-first-click must be respected
    master.connect(limiter); limiter.connect(audioOutput(c));
  }
  return c;
}

function fileTrack(name, cue){
  if (!USE_FILE_SOUNDTRACK || !(name in FILE_TRACKS)) return null;
  if (name in fileEls) return fileEls[name];
  const el = new Audio(FILE_TRACKS[name]);
  el.loop = !!cue.loop;
  el.preload = 'auto';
  el.volume = 0.52;
  el.addEventListener('error', () => { fileEls[name] = null; });
  fileEls[name] = el;
  return el;
}

function trackSource(source, bus, onDone){
  activeSources.add(source);
  bus.sources.add(source);
  source.onended = () => {
    activeSources.delete(source);
    bus.sources.delete(source);
    try { source.disconnect(); } catch (e) {}
    if (onDone) onDone();
  };
}

function makeBus(c, cue, t){
  const node = c.createGain();
  node.gain.setValueAtTime(EPS, t);
  node.gain.exponentialRampToValueAtTime(cue.gain ?? 1, t + 0.24);
  node.connect(master);
  return { node, sources: new Set(), retired: false };
}

function retireBus(c, bus, t, fade = TRANSITION_FADE){
  if (!bus || bus.retired) return;
  bus.retired = true;
  const gain = bus.node.gain;
  if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(t);
  else {
    const held = Math.max(EPS, gain.value || EPS);
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(held, t);
  }
  gain.exponentialRampToValueAtTime(EPS, t + fade);
  for (const source of bus.sources){
    try { source.stop(t + fade + 0.03); } catch (e) {}
  }
  setTimeout(() => {
    try { bus.node.disconnect(); } catch (e) {}
  }, Math.ceil((fade + 0.12) * 1000));
}

function oscVoice(c, bus, t, midi, dur, opts = {}){
  if (!bus || bus.retired || dur <= 0) return;
  const o = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  const attack = Math.min(opts.attack ?? 0.035, dur * 0.42);
  const release = Math.min(opts.release ?? 0.16, dur * 0.48);
  const peak = Math.max(EPS, opts.vol ?? 0.04);
  o.type = opts.type || 'triangle';
  o.frequency.setValueAtTime(f(midi), t);
  if (opts.endMidi != null) o.frequency.exponentialRampToValueAtTime(f(opts.endMidi), t + dur);
  o.detune.value = opts.detune || 0;
  filter.type = opts.filterType || 'lowpass';
  filter.frequency.value = opts.cut || 900;
  filter.Q.value = opts.q ?? 0.55;
  gain.gain.setValueAtTime(EPS, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.006, attack));
  gain.gain.setValueAtTime(peak, Math.max(t + attack, t + dur - release));
  gain.gain.exponentialRampToValueAtTime(EPS, t + dur);
  o.connect(filter); filter.connect(gain); gain.connect(bus.node);
  trackSource(o, bus, () => { try { filter.disconnect(); gain.disconnect(); } catch (e) {} });
  o.start(t); o.stop(t + dur + 0.02);
}

function acousticWave(c, name, harmonics){
  if (periodicWaves.has(name)) return periodicWaves.get(name);
  if (typeof c.createPeriodicWave !== 'function') return null;
  const real = new Float32Array(harmonics.length + 1);
  const imag = new Float32Array(harmonics.length + 1);
  for (let i = 0; i < harmonics.length; i++) imag[i + 1] = harmonics[i];
  const wave = c.createPeriodicWave(real, imag, { disableNormalization: false });
  periodicWaves.set(name, wave);
  return wave;
}

// A restrained additive voice for the two menu instruments. It deliberately avoids noise,
// distortion and raw saw/square oscillators; the filter breathes slowly and vibrato fades in.
function acousticVoice(c, bus, t, midi, dur, spec, vol){
  if (!bus || bus.retired || dur <= 0) return;
  const oscillator = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  const wave = acousticWave(c, spec.name, spec.harmonics);
  if (wave && typeof oscillator.setPeriodicWave === 'function') oscillator.setPeriodicWave(wave);
  else oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(f(midi), t);
  oscillator.detune.value = spec.detune || 0;

  filter.type = 'lowpass';
  filter.Q.value = spec.q ?? 0.35;
  filter.frequency.setValueAtTime(spec.cutStart, t);
  filter.frequency.exponentialRampToValueAtTime(spec.cutPeak, t + Math.min(dur * 0.38, spec.attack + 0.34));
  filter.frequency.exponentialRampToValueAtTime(spec.cutEnd, t + dur);

  const attack = Math.min(spec.attack, dur * 0.4);
  const release = Math.min(spec.release, dur * 0.46);
  gain.gain.setValueAtTime(EPS, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.012, attack));
  gain.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release));
  gain.gain.exponentialRampToValueAtTime(EPS, t + dur);
  oscillator.connect(filter); filter.connect(gain); gain.connect(bus.node);
  let formant = null, formantGain = null;
  if (spec.formant){
    formant = c.createBiquadFilter(); formant.type = 'bandpass';
    formant.frequency.value = spec.formant; formant.Q.value = spec.formantQ || 1;
    formantGain = c.createGain(); formantGain.gain.value = spec.formantLevel || .1;
    oscillator.connect(formant); formant.connect(formantGain); formantGain.connect(gain);
  }
  trackSource(oscillator, bus, () => {
    try {
      filter.disconnect(); gain.disconnect();
      if (formant) formant.disconnect();
      if (formantGain) formantGain.disconnect();
    } catch (e) {}
  });

  let vibrato = null, vibratoDepth = null;
  if (spec.vibratoDepth > 0){
    vibrato = c.createOscillator();
    vibratoDepth = c.createGain();
    vibrato.type = 'sine'; vibrato.frequency.value = spec.vibratoRate;
    vibratoDepth.gain.setValueAtTime(0, t);
    vibratoDepth.gain.linearRampToValueAtTime(spec.vibratoDepth, t + Math.min(dur * 0.45, 0.42));
    vibratoDepth.gain.setValueAtTime(spec.vibratoDepth, Math.max(t + 0.42, t + dur - release));
    vibratoDepth.gain.linearRampToValueAtTime(0, t + dur);
    vibrato.connect(vibratoDepth); vibratoDepth.connect(oscillator.detune);
    trackSource(vibrato, bus, () => { try { vibratoDepth.disconnect(); } catch (e) {} });
    vibrato.start(t); vibrato.stop(t + dur + 0.02);
  }
  oscillator.start(t); oscillator.stop(t + dur + 0.02);
}

function noiseBurst(c, bus, t, dur, opts = {}){
  if (!bus || bus.retired || dur <= 0) return;
  const length = Math.max(1, Math.floor(c.sampleRate * dur));
  let seed = (opts.seed ?? 0x47524654) >>> 0;
  const decay = opts.decay ?? 1.8;
  const cacheKey = `${c.sampleRate}:${length}:${seed}:${decay}`;
  let buffer = noiseBuffers.get(cacheKey);
  if (!buffer){
    buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++){
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      data[i] = white * Math.pow(1 - i / length, decay);
    }
    noiseBuffers.set(cacheKey, buffer);
  }
  const source = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  source.buffer = buffer;
  filter.type = opts.filterType || 'bandpass';
  filter.frequency.value = opts.cut || 1400;
  filter.Q.value = opts.q ?? 0.8;
  gain.gain.setValueAtTime(Math.max(EPS, opts.vol ?? 0.1), t);
  gain.gain.exponentialRampToValueAtTime(EPS, t + dur);
  source.connect(filter); filter.connect(gain); gain.connect(bus.node);
  trackSource(source, bus, () => { try { filter.disconnect(); gain.disconnect(); } catch (e) {} });
  source.start(t);
}

// ----- soft menu string duet: violin and cello only -----
const ACOUSTIC = Object.freeze({
  violin:  Object.freeze({ name: 'violin',  harmonics: [1, .55, .32, .21, .14, .09, .055], cutStart: 1450, cutPeak: 2550, cutEnd: 1650, q: .35, attack: .22, release: .68, vibratoRate: 5.1, vibratoDepth: 3.6 }),
  cello:   Object.freeze({ name: 'cello',   harmonics: [1, .38, .23, .14, .085, .05],      cutStart: 720,  cutPeak: 1320, cutEnd: 860,  q: .4,  attack: .32, release: .9,  vibratoRate: 4.6, vibratoDepth: 3.0 }),
});

function violin(c, bus, t, midi, dur, vol = 0.013){ acousticVoice(c, bus, t, midi, dur, ACOUSTIC.violin, vol); }
function cello(c, bus, t, midi, dur, vol = 0.013){ acousticVoice(c, bus, t, midi, dur, ACOUSTIC.cello, vol); }

// ----- battle / result orchestral and mechanical colors -----
function lowStrings(c, bus, t, chord, dur, vol = 0.052){
  const perVoice = vol / Math.max(1, chord.length);
  for (const midi of chord){
    oscVoice(c, bus, t, midi, dur * 1.08, { type: 'sawtooth', detune: -5, cut: 510, vol: perVoice * 0.58, attack: 0.7, release: 0.8 });
    oscVoice(c, bus, t, midi, dur * 1.08, { type: 'triangle', detune: 4, cut: 760, vol: perVoice, attack: 0.85, release: 0.9 });
  }
}

function soloString(c, bus, t, midi, dur, vol = 0.055){
  oscVoice(c, bus, t, midi, dur, { type: 'sawtooth', detune: -7, cut: 1050, q: 0.9, vol: vol * 0.48, attack: 0.12, release: 0.42 });
  oscVoice(c, bus, t, midi + 0.015, dur, { type: 'triangle', detune: 5, cut: 1450, vol, attack: 0.09, release: 0.46 });
}

function choir(c, bus, t, chord, dur, vol = 0.024){
  for (const midi of chord){
    oscVoice(c, bus, t, midi, dur, { type: 'sine', filterType: 'bandpass', cut: 760, q: 0.7, vol, attack: 0.8, release: 0.9 });
    oscVoice(c, bus, t, midi + 12, dur, { type: 'triangle', filterType: 'bandpass', cut: 1180, q: 1.1, vol: vol * 0.28, attack: 1.0, release: 0.8 });
  }
}

function bassPulse(c, bus, t, midi, dur, vol = 0.13){
  oscVoice(c, bus, t, midi, dur, { type: 'sawtooth', cut: 235, q: 0.75, vol, attack: 0.009, release: dur * 0.36 });
  oscVoice(c, bus, t, midi - 12, dur, { type: 'sine', cut: 150, vol: vol * 0.54, attack: 0.006, release: dur * 0.45 });
}

function drum(c, bus, t, vol = 0.22, seed = 1){
  oscVoice(c, bus, t, 43, 0.34, { type: 'sine', endMidi: 28, cut: 150, vol, attack: 0.006, release: 0.3 });
  noiseBurst(c, bus, t, 0.32, { filterType: 'lowpass', cut: 115, vol: vol * 0.7, decay: 2.6, seed });
}

function fieldSnare(c, bus, t, vol = 0.105, seed = 2){
  noiseBurst(c, bus, t, 0.17, { filterType: 'bandpass', cut: 1650, q: 0.72, vol, decay: 1.5, seed });
  oscVoice(c, bus, t, 55, 0.1, { type: 'triangle', cut: 620, vol: vol * 0.35, attack: 0.004, release: 0.08 });
}

function metalHit(c, bus, t, midi = 76, vol = 0.055){
  for (const [ratio, level, tail] of [[1, 1, 1.5], [1.414, 0.48, 1.15], [2.73, 0.25, 0.8]]){
    const note = 69 + 12 * Math.log2(f(midi) * ratio / 440);
    oscVoice(c, bus, t, note, tail, { type: 'sine', filterType: 'highpass', cut: 420, vol: vol * level, attack: 0.004, release: tail * 0.92 });
  }
}

function battleBrass(c, bus, t, chord, dur = 0.52, vol = 0.032){
  for (const midi of chord){
    oscVoice(c, bus, t, midi, dur, { type: 'sawtooth', cut: 720, q: 0.6, vol, attack: 0.035, release: dur * 0.64 });
    oscVoice(c, bus, t, midi - 12, dur, { type: 'square', cut: 390, vol: vol * 0.33, attack: 0.028, release: dur * 0.65 });
  }
}

function radioDust(c, bus, t, dur, seed){
  noiseBurst(c, bus, t, dur, { filterType: 'bandpass', cut: 2450, q: 2.8, vol: 0.012, decay: 0.35, seed });
}

// ----- wholly original themes / arrangements -----
// Menu chamber theme: a gentle D–F–G–E-flat arc over a G-minor / B-flat-major field.
// It is newly written for Gravity Front; the linked recording is used only as a broad mood reference.
const MENU_CELLO = [43, 39, 46, 41, 43, 38, 39, 41, 46, 39, 41, 43];
const MENU_CELLO_INNER = [50, 46, 53, 48, 50, 45, 46, 48, 53, 46, 48, 50];
const MENU_VIOLIN = [
  [[.16, 62, .38], [.60, 65, .26]], [[.14, 67, .32], [.52, 65, .32]],
  [[.18, 70, .34], [.60, 69, .24]], [[.18, 65, .55]],
  [[.12, 70, .62]], [[.15, 69, .30], [.52, 67, .30]],
  [[.12, 65, .66]], [[.20, 67, .52]], [[.10, 69, .44], [.58, 74, .22]],
  [[.13, 72, .42]], [[.15, 70, .28], [.50, 67, .32]], [[.15, 62, .65]],
];
const BATTLE_BASS = [40, 40, 41, 35, 40, 38, 41, 35];
const BATTLE_CHORDS = [[52, 59, 65], [53, 59, 64], [50, 57, 65], [47, 53, 60]];

const TRACKS = {
  requiem: {
    loop: true, bars: 12, dur: 60 / 52 * 3, gain: 1.0,
    instruments: Object.freeze(['violin', 'cello']),
    bar(c, bus, t, i){
      const p = i % 12, dur = this.dur;
      cello(c, bus, t + dur * .02, MENU_CELLO[p], dur * .94, .021);
      cello(c, bus, t + dur * .08, MENU_CELLO_INNER[p], dur * .82, .0105);
      const violinLine = MENU_VIOLIN[p];
      if (violinLine) for (const [off, note, length] of violinLine) violin(c, bus, t + dur * off + .012, note, dur * length, .023);
    },
  },
  battle: {
    loop: true, bars: 16, dur: 60 / 124 * 4, gain: 0.9,
    bar(c, bus, t, i){
      const p = i % 16, dur = this.dur, eighth = dur / 8;
      const intensity = p < 4 ? 0 : p < 8 ? 1 : p < 12 ? 2 : 3;
      lowStrings(c, bus, t, [28, 35, 40, p >= 12 ? 41 : 47], dur * 1.02, 0.035 + intensity * 0.004);
      for (let k = 0; k < 8; k++){
        const accent = k === 0 || k === 3 || k === 6;
        bassPulse(c, bus, t + k * eighth, BATTLE_BASS[k] + (p >= 12 ? 2 : 0), eighth * 0.82, accent ? 0.135 : 0.085);
      }
      drum(c, bus, t, 0.25, 2000 + p);
      drum(c, bus, t + sixth(dur, 3), 0.14 + intensity * 0.015, 2100 + p);
      if (intensity >= 1){
        fieldSnare(c, bus, t + dur * 0.375, 0.09, 2200 + p);
        fieldSnare(c, bus, t + dur * 0.875, 0.11, 2300 + p);
      }
      if (intensity >= 2 && p % 2 === 0) battleBrass(c, bus, t + eighth * 0.1, BATTLE_CHORDS[Math.floor(p / 2) % 4], dur * 0.34, 0.026);
      if (intensity >= 3){
        metalHit(c, bus, t + dur * 0.5, 69 + (p % 3), 0.035);
        if (p % 2 === 1) choir(c, bus, t + dur * 0.1, [47, 52, 53], dur * 0.92, 0.009);
      }
      if (p === 15){
        for (let k = 0; k < 4; k++) fieldSnare(c, bus, t + dur * (0.75 + k * 0.0625), 0.07 + k * 0.012, 2400 + k);
      }
    },
  },
  victory: {
    loop: false, bars: 4, next: 'requiem', tail: 1.5, dur: 60 / 70 * 4, gain: 0.94,
    bar(c, bus, t, i){
      const chords = [[28, 40, 47, 52, 55], [24, 36, 43, 52, 55], [31, 43, 50, 55, 59], [28, 40, 47, 52, 59]];
      lowStrings(c, bus, t, chords[i], this.dur, 0.062);
      choir(c, bus, t + 0.18, chords[i].slice(2), this.dur * 0.92, i === 3 ? 0.02 : 0.013);
      soloString(c, bus, t + this.dur * 0.15, [64, 67, 71, 76][i], this.dur * 0.54, 0.048);
      drum(c, bus, t, i === 3 ? 0.2 : 0.12, 3100 + i);
      if (i === 3) metalHit(c, bus, t + this.dur * 0.58, 76, 0.045);
    },
  },
  retreat: {
    loop: false, bars: 4, next: 'requiem', tail: 1.1, dur: 60 / 58 * 4, gain: 0.88,
    bar(c, bus, t, i){
      const chords = [[28, 40, 47, 52], [26, 38, 45, 50], [24, 36, 43, 47], [23, 35, 42, 53]];
      lowStrings(c, bus, t, chords[i], this.dur, 0.05);
      soloString(c, bus, t + this.dur * 0.2, [64, 62, 59, 53][i], this.dur * 0.48, 0.04);
      drum(c, bus, t + this.dur * 0.04, 0.1 - i * 0.012, 3200 + i);
      radioDust(c, bus, t + this.dur * 0.55, this.dur * 0.28, 3250 + i);
    },
  },
  defeat: {
    loop: false, bars: 4, next: 'requiem', tail: 1.8, dur: 60 / 46 * 4, gain: 0.9,
    bar(c, bus, t, i){
      const chords = [[28, 40, 47, 53], [27, 39, 46, 52], [24, 36, 43, 50], [23, 35, 41, 47]];
      lowStrings(c, bus, t, chords[i], this.dur, 0.055);
      choir(c, bus, t + 0.3, chords[i].slice(2), this.dur * 0.82, 0.011);
      soloString(c, bus, t + this.dur * 0.24, [64, 65, 59, 53][i], this.dur * 0.34, 0.038);
      drum(c, bus, t + 0.05, 0.12, 3300 + i);
      metalHit(c, bus, t + this.dur * 0.66, 64 - i * 2, 0.026);
    },
  },
  finale: {
    loop: false, bars: 6, next: 'requiem', tail: 2.2, dur: 60 / 66 * 4, gain: 0.96,
    bar(c, bus, t, i){
      const chords = [[28, 40, 47, 52], [24, 36, 43, 52], [26, 38, 45, 50], [31, 43, 50, 55], [24, 36, 43, 55], [28, 40, 47, 52, 59, 64]];
      lowStrings(c, bus, t, chords[i], this.dur, 0.058 + i * 0.002);
      choir(c, bus, t + 0.2, chords[i].slice(2), this.dur * 0.9, 0.012 + i * 0.0015);
      soloString(c, bus, t + this.dur * 0.14, [52, 59, 64, 65, 67, 76][i], this.dur * 0.56, 0.045);
      drum(c, bus, t, i === 5 ? 0.21 : 0.12, 3400 + i);
      if (i === 5){ metalHit(c, bus, t + this.dur * 0.48, 76, 0.048); metalHit(c, bus, t + this.dur * 0.72, 83, 0.026); }
    },
  },
};

function sixth(value, count){ return value * count / 6; }

function ensureTimer(){
  if (!timer) timer = setInterval(pump, 220);
}

function resyncClock(c){
  nextBar = c.currentTime + 0.08;
  cueEndTime = null;
  lastPumpTime = c.currentTime;
}

function pump(){
  const c = context;
  if (!c || !cur || fileActive || filePending || document.hidden || !cueBus) return;
  if (c.state !== 'running') return; // do not duplicate bar zero while autoplay is still locked
  const cue = TRACKS[cur];
  if (!cue) return;
  const now = c.currentTime;

  if (cueEndTime != null){
    if (now >= cueEndTime){
      if (cue.next) music.play(cue.next); else music.stop();
    }
    return;
  }

  // AudioContext time may jump after a suspended/hidden tab. Never enqueue missed history.
  if (lastPumpTime == null || now - lastPumpTime > CLOCK_GAP || nextBar < now - 0.25){
    nextBar = now + 0.08;
  }
  lastPumpTime = now;

  while (nextBar < now + SCHEDULE_AHEAD){
    if (!cue.loop && barIdx >= cue.bars){
      cueEndTime = nextBar + (cue.tail || 0);
      break;
    }
    cue.bar(c, cueBus, nextBar, cue.loop ? barIdx % cue.bars : barIdx);
    nextBar += cue.dur;
    barIdx++;
  }
}

function startProcedural(c, cue, token){
  if (token !== generation || cur == null) return;
  filePending = false;
  fileActive = false;
  cueBus = makeBus(c, cue, c.currentTime);
  resyncClock(c);
  ensureTimer();
  pump();
}

function pauseFiles(except){
  for (const name in fileEls){
    const el = fileEls[name];
    if (el && name !== except) el.pause();
  }
}

function rampMaster(){
  if (!master || !context) return;
  const t = context.currentTime;
  master.gain.cancelScheduledValues(t);
  if (muted){
    master.gain.setValueAtTime(Math.max(0, master.gain.value || 0), t);
    master.gain.linearRampToValueAtTime(0, t + 0.045);
  } else {
    master.gain.setValueAtTime(Math.max(EPS, master.gain.value || EPS), t);
    master.gain.exponentialRampToValueAtTime(MASTER_LEVEL, t + 0.045);
  }
}

function onVisibilityChange(){
  if (!context || !cur || fileActive || filePending) return;
  if (document.hidden){
    // Cancel the look-ahead material too; otherwise a quick tab switch could leave one
    // pre-scheduled bar playing underneath the freshly resumed bar. Rewind only while
    // musical material is still in progress; once a one-shot reaches its intentional
    // silent tail, preserve that tail and its handoff deadline instead of replaying the finale.
    const inOneShotTail = cueEndTime != null && context.currentTime >= nextBar;
    retireBus(context, cueBus, context.currentTime, 0.08);
    cueBus = null;
    if (!inOneShotTail){
      barIdx = Math.max(0, barIdx - 1);
      cueEndTime = null;
    }
    lastPumpTime = null;
    return;
  }
  const cue = TRACKS[cur];
  if (!cue) return;
  const resumingTail = cueEndTime != null;
  cueBus = makeBus(context, cue, context.currentTime);
  // Preserve the musical form but restart the next unscheduled bar from "now".
  if (!resumingTail) nextBar = context.currentTime + 0.08;
  lastPumpTime = context.currentTime;
  pump();
}
document.addEventListener('visibilitychange', onVisibilityChange);

export const music = {
  play(name){
    const cue = TRACKS[name];
    if (!cue) return false;
    const c = ctx();
    if (!c) return false;
    if (cur === name && (cueBus || fileActive || filePending)) return true;

    const token = ++generation;
    const now = c.currentTime;
    retireBus(c, cueBus, now);
    cueBus = null;
    pauseFiles(name);
    cur = name;
    barIdx = 0;
    cueEndTime = null;
    lastPumpTime = now;
    fileActive = false;
    filePending = false;

    const el = fileTrack(name, cue);
    if (!el){
      startProcedural(c, cue, token);
      return true;
    }

    filePending = true;
    el.loop = !!cue.loop;
    el.muted = muted;
    try { el.currentTime = 0; } catch (e) {}
    const promise = el.play();
    if (!promise || !promise.then){
      if (token === generation){ filePending = false; fileActive = true; }
      return true;
    }
    promise.then(() => {
      if (token !== generation || cur !== name){ el.pause(); return; }
      filePending = false;
      fileActive = true;
      ensureTimer();
    }).catch(() => {
      if (token === generation && cur === name) startProcedural(c, cue, token);
    });
    return true;
  },
  stop(){
    const c = context;
    generation++;
    if (c) retireBus(c, cueBus, c.currentTime, 0.18);
    cueBus = null;
    cur = null;
    fileActive = false;
    filePending = false;
    cueEndTime = null;
    for (const name in fileEls){ const el = fileEls[name]; if (el) el.pause(); }
    if (timer){ clearInterval(timer); timer = null; }
  },
  toggle(){
    muted = toggleAudioMuted();
    rampMaster();
    for (const name in fileEls){ const el = fileEls[name]; if (el) el.muted = muted; }
    return muted;
  },
  _debugState(){
    return {
      cue: cur, muted, fileActive, filePending, generation, barIdx,
      instruments: cur ? (TRACKS[cur]?.instruments || null) : null,
      timerActive: !!timer, activeSources: activeSources.size,
      contextState: context ? context.state : null,
      masterGain: master ? master.gain.value : null,
      nextBar, cueEndTime, hidden: document.hidden,
      knownCues: Object.keys(TRACKS),
    };
  },
};
