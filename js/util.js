// ---------- deterministic RNG / noise / misc helpers ----------

export function hashStr(s){
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed){ this.f = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed >>> 0); }
  next(){ return this.f(); }
  range(a, b){ return a + (b - a) * this.f(); }
  int(a, b){ return Math.floor(this.range(a, b + 1)); }
  pick(arr){ return arr[Math.floor(this.f() * arr.length)]; }
  chance(p){ return this.f() < p; }
}

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

// Seeded 2D value-noise with fbm octaves — used for terrain & planet textures.
export function noise2D(seed){
  const r = (x, y) => {
    let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + (seed | 0);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  };
  const sm = t => t * t * (3 - 2 * t);
  const base = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    return lerp(lerp(r(xi, yi), r(xi + 1, yi), u), lerp(r(xi, yi + 1), r(xi + 1, yi + 1), u), v);
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < oct; o++){ s += base(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}

// day 0 = U.C. 0079.01.01
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function ucDate(day){
  let d = Math.floor(day), m = 0, y = 79;
  while (d >= MONTH_DAYS[m]){ d -= MONTH_DAYS[m]; m++; if (m === 12){ m = 0; y++; } }
  const p = n => String(n).padStart(2, '0');
  return `U.C. 00${y}.${p(m + 1)}.${p(d + 1)}`;
}

export function el(tag, cls, text){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function fmtCr(n){ return Math.round(n).toLocaleString() + ' cr'; }

// ---------- tiny synth audio ----------
// Every in-game sound shares one output node so a single mute really silences
// music, UI feedback, weapons, impacts and explosions — including when muted
// before the AudioContext has been created.
let actx = null, audioMaster = null, audioMuted = false;
export function audio(){
  if (!actx){
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

export function audioOutput(ctx = audio()){
  if (!ctx) return null;
  if (!audioMaster){
    audioMaster = ctx.createGain();
    audioMaster.gain.value = audioMuted ? 0 : 1;
    audioMaster.connect(ctx.destination);
  }
  return audioMaster;
}

export function setAudioMuted(value){
  audioMuted = !!value;
  if (actx && audioMaster){
    const t = actx.currentTime, target = audioMuted ? 0 : 1;
    audioMaster.gain.cancelScheduledValues(t);
    audioMaster.gain.setValueAtTime(audioMaster.gain.value, t);
    audioMaster.gain.linearRampToValueAtTime(target, t + 0.045);
  }
  return audioMuted;
}

export function toggleAudioMuted(){ return setAudioMuted(!audioMuted); }
export function isAudioMuted(){ return audioMuted; }

export function sfx(kind, vol = 0.2){
  if (audioMuted) return;
  const ctx = audio(), output = audioOutput(ctx); if (!ctx || !output) return;
  const t = ctx.currentTime;
  const g = ctx.createGain(); g.connect(output);
  if (kind === 'beam'){
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); o.start(t); o.stop(t + 0.15);
  } else if (kind === 'mg'){
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.05);
    g.gain.setValueAtTime(vol * 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(g); o.start(t); o.stop(t + 0.07);
  } else if (kind === 'bazooka'){
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); o.start(t); o.stop(t + 0.3);
  } else if (kind === 'boom'){
    const len = 0.5, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.setValueAtTime(vol * 1.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f); f.connect(g); src.start(t);
  } else if (kind === 'saber'){
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.1);
    g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); o.start(t); o.stop(t + 0.2);
  } else if (kind === 'hit'){
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g); o.start(t); o.stop(t + 0.1);
  } else if (kind === 'ui'){
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); o.start(t); o.stop(t + 0.09);
  } else if (kind === 'boost'){
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(105, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.18);
    g.gain.setValueAtTime(vol * 0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.21);
  }
}
