// ---------- GRAVITY FRONT — entry point ----------
// Menu flow, campaign state, custom battle setup, save/load, render loop.
import * as THREE from 'three';
import { el, RNG, sfx, noise2D, clamp } from './util.js';
import { SUITS, AIRCRAFT, suitById, ENVIRONMENTS, START_DAY } from './data.js';
import { genGalaxy, clearDetails, observe, news } from './galaxy.js';
import { startBattle } from './battle.js';
import { buildMech } from './mecha.js';
import { MAPS } from './maps.js';
import { PvpLink } from './pvp.js';
import { enterBridge, leaveBridge } from './bridge.js';
import { music } from './music.js';
import { preloadModels } from './models.js';

preloadModels(); // real mech models load in the background; procedural fallback until ready

const $ = id => document.getElementById(id);
const SAVE_KEY = 'gravityFront.save';
const SCREENS = ['menu-main', 'menu-custom', 'menu-pvp', 'intro', 'bridge', 'result'];

function show(id){
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}

// ---------- renderer + menu backdrop ----------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const bg = (() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060b);
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 1, 8000);
  const group = new THREE.Group(); scene.add(group);
  const rng = new RNG('menu');
  const pos = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++){
    const v = new THREE.Vector3().randomDirection().multiplyScalar(rng.range(900, 2400));
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaebed4, size: 1.6, sizeAttenuation: false })));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a5d9f, emissive: 0x07111e, roughness: 0.85 }));
  planet.position.set(-480, -160, -1100); group.add(planet);
  scene.add(new THREE.HemisphereLight(0x88aacc, 0x101418, 0.8));
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.2); sun.position.set(400, 200, 100); scene.add(sun);
  return {
    update(dt){
      group.rotation.y += 0.0045 * dt;
      planet.rotation.y += 0.01 * dt;
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
      renderer.render(scene, cam);
    },
  };
})();

// ---------- custom battle: spinning MS preview (own tiny renderer) ----------
const msPreview = (() => {
  let rr = null, scene = null, cam = null, holder = null, curId = null, spin = 0.6;
  function disposeModel(group){
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(o => {
      if (o.geometry && !o.geometry.userData?.shared) geometries.add(o.geometry);
      const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const material of list){
        materials.add(material);
        for (const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'])
          if (material[key]) textures.add(material[key]);
      }
    });
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  function ensure(){
    if (rr) return true;
    const cv = $('ms-preview'); if (!cv) return false;
    rr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    rr.setPixelRatio(Math.min(devicePixelRatio, 2));
    rr.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
    scene.add(new THREE.HemisphereLight(0x9fc0e0, 0x1a2632, 1.15));
    const s = new THREE.DirectionalLight(0xfff2dd, 1.7); s.position.set(35, 55, 30); scene.add(s);
    const f = new THREE.DirectionalLight(0xbcd0e8, 0.5); f.position.set(-30, 18, -22); scene.add(f);
    return true;
  }
  function setSuit(id){
    if (!ensure() || id === curId) return;
    curId = id;
    if (holder){ scene.remove(holder); disposeModel(holder); holder = null; }
    const suit = suitById(id); if (!suit) return;
    let root;
    try { root = buildMech(suit).root; } catch (e){ return; }
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    root.position.sub(c);                                   // centre the model on the turntable
    holder = new THREE.Group(); holder.add(root); scene.add(holder);
    const reach = Math.max(sz.x, sz.y, sz.z) || 20;
    // The RTX-440-B's thin cannon and radio whips extend far beyond its visual mass. Give this hero
    // mesh a tighter inspection framing so its track, arm and casemate detail stays readable.
    const framing = id === 'guntankmk2' ? 1.6 : id === 'weasel' ? 1.4 : 1.75;
    cam.position.set(0, sz.y * 0.12, reach * framing);
    cam.lookAt(0, 0, 0);
  }
  function render(dt){
    if (!rr || !holder) return;
    const cv = rr.domElement, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;                                   // hidden → nothing to draw
    const pr = rr.getPixelRatio();
    if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)){
      rr.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    spin += dt; holder.rotation.y = spin;
    rr.render(scene, cam);
  }
  return { setSuit, render };
})();

function renderMsStats(suit){
  const box = $('ms-stats'); if (!box || !suit) return;
  const rows = [
    ['CLASS', suit.air ? 'FIGHTER' : suit.apc ? `${suit.faction} APC` : suit.faction],
    ['INTEGRITY', suit.hp],
    ['ARMOR', suit.armor != null ? suit.armor : '—'],
    [suit.air ? 'AIRSPEED' : 'WALK', suit.air ? suit.boost : (suit.walk != null ? suit.walk : '—')],
    ['BOOST', suit.boost],
  ];
  if (suit.troopCapacity) rows.push(['TROOPS', suit.troopCapacity]);
  let html = `<div class="nm">${suit.name}</div><div class="cd">${suit.code || ''}</div>`;
  for (const [k, v] of rows) html += `<div class="sl"><span>${k}</span><b>${v}</b></div>`;
  const wl = suit.weapons.map(w => `▸ <b>${w.name}</b>`);
  if (suit.saber && suit.saber.dmg > 0) wl.push(`▸ <b>${suit.saber.name}</b> · melee`);
  html += `<div class="wl">${wl.join('<br>')}</div>`;
  box.innerHTML = html;
}

// ---------- custom battle: top-down deployment map (drag YOU / ALLIES / ENEMIES) ----------
const spawnMap = (() => {
  const R = 1900;                                           // world half-extent the map spans (units)
  const COLS = { player: '#5aa9ff', ally: '#49d67a', enemy: '#ff5d5d' };
  let cv = null, ctx = null, drag = null, wired = false;
  function ensure(){
    if (!cv){ cv = $('spawn-map'); if (!cv) return false; ctx = cv.getContext('2d'); }
    if (!wired){
      cv.addEventListener('pointerdown', onDown);
      cv.addEventListener('pointermove', onMove);
      addEventListener('pointerup', () => { drag = null; });
      wired = true;
    }
    return true;
  }
  const dims = () => { const w = cv.clientWidth, h = cv.clientHeight; return { w, h, s: Math.min(w, h) * 0.44 }; };
  function w2m(p){ const { w, h, s } = dims(); return { x: w / 2 + p.x / R * s, y: h / 2 - p.z / R * s }; }
  function m2w(px, py){ const { w, h, s } = dims(); return { x: (px - w / 2) / s * R, z: -(py - h / 2) / s * R }; }
  const xy = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }; // robust vs offsetX quirks
  // one marker for the player, plus one per enemy/ally ENTRY (each unit type gets its own spawn point)
  function markers(){
    const out = [{ kind: 'player', p: custom.spawn.player, col: COLS.player, sym: '▲' }];
    custom.enemies.forEach((e, i) => { if (e.pos) out.push({ kind: 'enemy', idx: i, p: e.pos, col: COLS.enemy, label: '' + (i + 1) }); });
    custom.allies.forEach((a, i) => { if (a.pos) out.push({ kind: 'ally', idx: i, p: a.pos, col: COLS.ally, label: '' + (i + 1) }); });
    return out;
  }
  function onDown(e){
    const [px, py] = xy(e);
    let best = 22, hit = null;
    for (const m of markers()){ const s = w2m(m.p); const d = Math.hypot(s.x - px, s.y - py); if (d < best){ best = d; hit = m; } }
    if (hit){ drag = hit; move(px, py); e.preventDefault(); }
  }
  function onMove(e){ if (drag){ const [px, py] = xy(e); move(px, py); } }
  function move(px, py){
    const p = m2w(px, py);
    const cl = { x: Math.max(-R, Math.min(R, Math.round(p.x))), z: Math.max(-R, Math.min(R, Math.round(p.z))) };
    if (drag.kind === 'player') custom.spawn.player = cl;
    else if (drag.kind === 'enemy'){ if (custom.enemies[drag.idx]) custom.enemies[drag.idx].pos = cl; }
    else if (custom.allies[drag.idx]) custom.allies[drag.idx].pos = cl;
    draw();
  }
  function draw(){
    if (!ensure()) return;
    const dpr = Math.min(devicePixelRatio, 2), { w, h, s } = dims();
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)){ cv.width = w * dpr; cv.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (reliefOn()) ctx.drawImage(buildRelief(w, h, R), 0, 0, w, h); // terrain relief underlay (mountains/hills)
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = reliefOn() ? 'rgba(255,255,255,.25)' : 'rgba(60,110,160,.22)'; ctx.lineWidth = 1;
    for (const f of [0.34, 0.67, 1]){ ctx.beginPath(); ctx.arc(cx, cy, s * f, 0, 7); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.stroke();
    ctx.fillStyle = 'rgba(120,150,180,.45)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('FRONT', cx, cy - s - 4);
    for (const m of markers()){
      const q = w2m(m.p);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = m.col; ctx.strokeStyle = m.col;
      ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      if (m.sym){ ctx.font = 'bold 15px monospace'; ctx.fillText(m.sym, q.x, q.y); }
      else { ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, 7); ctx.stroke(); ctx.font = 'bold 10px monospace'; ctx.fillText(m.label, q.x, q.y); }
    }
    ctx.textBaseline = 'alphabetic';
  }
  function show(){ if (ensure()) draw(); }
  return { show, draw };
})();

let battleHandle = null;
// Automated smoke hooks stay available on local development hosts, but are not
// exposed by the public GitHub Pages build.
const LOCAL_DEBUG = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
if (LOCAL_DEBUG) Object.defineProperty(window, '__gfBattle', { get: () => battleHandle });
let last = performance.now();
function loop(t){
  const dt = Math.min((t - last) / 1000, 0.1); last = t;
  if (battleHandle) battleHandle.update(dt);
  else { bg.update(dt); if (!$('menu-custom').classList.contains('hidden')) msPreview.render(dt); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  battleHandle?.resize(innerWidth, innerHeight);
});

// first interaction starts the requiem; M mutes or restores every game sound
document.addEventListener('pointerdown', () => music.play('requiem'), { once: true });
document.addEventListener('keydown', e => {
  if (e.repeat || e.key.toLowerCase() !== 'm') return;
  const muted = music.toggle();
  $('audio-status').classList.toggle('hidden', !muted);
});

// ---------- modal ----------
function modal(title, body, buttons = [{ label: 'OK' }]){
  const root = $('modal-root'); root.innerHTML = '';
  const back = el('div', 'modal-back'), m = el('div', 'modal');
  m.appendChild(el('div', 'h', title));
  m.appendChild(el('div', 'b', body));
  const btns = el('div', 'btns');
  for (const b of buttons){
    const bb = el('button', b.cls || '', b.label);
    bb.onclick = () => { root.innerHTML = ''; sfx('ui', 0.1); b.fn && b.fn(); };
    btns.appendChild(bb);
  }
  m.appendChild(btns); back.appendChild(m); root.appendChild(back);
}

// ---------- battle runner (shared by campaign + custom) ----------
function runBattle(opts, after){
  show(null);
  music.play('battle');
  battleHandle = startBattle(renderer, opts, res => {
    const h = battleHandle; battleHandle = null;
    h.dispose();
    music.play(res.victory ? 'victory' : res.retreat ? 'retreat' : 'defeat');
    const pvpDuel = !!opts.multiplayer;
    $('result-title').textContent = pvpDuel
      ? res.victory ? (res.disconnected ? 'DUEL WON · FORFEIT' : 'DUEL WON')
        : res.retreat ? 'DUEL ABORTED' : 'DUEL LOST'
      : res.victory ? 'MISSION ACCOMPLISHED'
        : res.retreat ? 'TACTICAL WITHDRAWAL' : 'UNIT LOST';
    $('result-title').style.color = res.victory ? 'var(--ok)' : 'var(--zeon)';
    $('result-body').textContent = pvpDuel
      ? `${opts.objective || 'PVP DUEL'}\n\nOPPONENT: ${opts.multiplayer.remoteName}\n` +
        `RESULT: ${res.victory ? 'VICTORY' : res.retreat ? 'CONNECTION ENDED' : 'DEFEAT'}\n` +
        `UNIT INTEGRITY: ${Math.round(res.hpFrac * 100)}%`
      : `${opts.objective || 'SORTIE'}\n\nCONFIRMED KILLS: ${res.kills}\nUNIT INTEGRITY: ${Math.round(res.hpFrac * 100)}%`;
    show('result');
    $('btn-result-ok').onclick = () => { music.play('requiem'); show(null); after(res); };
  });
}

// ---------- campaign ----------
let S = null;

const ctx = {
  get S(){ return S; },
  modal,
  save(){
    if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    refreshContinue();
  },
  launchBattle: runBattle,
  toMenu(){
    leaveBridge();
    music.play('requiem');
    show('menu-main');
    refreshContinue();
  },
  endCampaign(){
    S.flags.victory = true;
    ctx.save();
    music.play('finale');
    $('result-title').textContent = 'THE ONE YEAR WAR IS OVER';
    $('result-title').style.color = 'var(--acc)';
    $('result-body').textContent =
      `U.C. 0079.12.31 — A Baoa Qu has fallen. The Principality of Zeon sues for peace.\n\n` +
      `Across ${150} worlds, the frontier remembers the pilot of the ${S.shipName}.\n\n` +
      `CONFIRMED KILLS: ${S.kills}\nRENOWN: ${S.renown}\nCREDITS: ${Math.round(S.credits).toLocaleString()} cr\n\n` +
      `Your save remains — the frontier sphere is yours to roam.`;
    show('result');
    $('btn-result-ok').onclick = () => ctx.toMenu();
  },
};

function newCampaign(){
  const seed = 'UC0079-' + Math.floor(Math.random() * 1e9);
  S = {
    v: 1, seed, day: START_DAY, credits: 8000, renown: 0, kills: 0,
    shipName: 'GREY PHANTOM', hull: 100,
    modules: { engine: 0, armor: 0, radar: 0, hangar: 0, quarters: 0, guns: 0 },
    suits: [{ id: 'rx78', hp: 1 }], active: 'rx78',
    air: [{ id: 'saberfish', hp: 1 }], // the air wing starts with a single Saberfish
    crew: [{ name: 'Astra Holt', role: 'mechanic', skill: 2, wage: 150, job: 'MAINTAIN MS' }],
    locId: 'c2', travel: null,
    worlds: genGalaxy(seed),
    mods: { fed: 1, zeon: 1 }, flags: {}, eventsSeen: [], news: [],
  };
  clearDetails();
  observe(S);
  news(S, 'Side 7 attacked. Prototype RX-78-2 entrusted to militia command. Independent operating authority granted.', 'warn');
  showIntro();
}

const INTRO = [
  `U.C. 0079 — SEPTEMBER 18\n\nNine months into the One Year War, half of humanity is dead.\n\nToday, Zeon recon suits breached the colony at SIDE 7 — and found the Federation's secret: Project V. In the chaos, a militia pilot — you — climbed into the prototype RX-78-2 GUNDAM and drove them off.`,
  `The Federation cannot spare a fleet for the FRONTIER SPHERE: one hundred and fifty worlds, colonies and outposts scattered between Earth and the deep territories now burning under Zeon occupation.\n\nSo they spare one ship. The Pegasus-class carrier GREY PHANTOM — and the Gundam — are yours, under independent command.\n\nUnderstand this about the frontier: no fleet can watch it all. Beyond your sensor bubble, worlds carry on as statistics — garrisons clash, fronts shift, colonies fall — and they only take solid form where you stand. Intel goes stale the moment you leave.`,
  `YOUR ORDERS\n\n· Take contracts at any world — defend, raid, assault — and shift the front.\n· Earn credits. Refit the ship. Hire crew and assign their jobs.\n· Salvage or buy new mobile suits for your hangar.\n· Watch the war dispatches. When the final operation is called at A BAOA QU in December, be there.\n\nGodspeed, Lieutenant. The White Devil of the frontier rides today.`,
];
let introPage = 0;
function showIntro(){
  introPage = 0;
  $('intro-text').textContent = INTRO[0];
  show('intro');
}
$('btn-intro-next').onclick = () => {
  introPage++;
  if (introPage < INTRO.length){ $('intro-text').textContent = INTRO[introPage]; }
  else { show('bridge'); enterBridge(ctx); ctx.save(); }
};

function loadCampaign(){
  try {
    S = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!S || !S.worlds) throw new Error('bad save');
  } catch {
    modal('SAVE CORRUPTED', 'Could not load the saved operation.', [{ label: 'OK' }]);
    return;
  }
  // migrate: drop hangar suits whose ids no longer exist (roster changes) and keep an active unit valid
  if (Array.isArray(S.suits)){
    S.suits = S.suits.filter(s => suitById(s.id));
    if (!S.suits.length) S.suits = [{ id: 'rx78', hp: 1 }];
    if (!suitById(S.active)) S.active = S.suits[0].id;
  }
  // air wing: old saves predate it; seed a starting Saberfish, drop unknown craft
  if (!Array.isArray(S.air)) S.air = [{ id: 'saberfish', hp: 1 }];
  else S.air = S.air.filter(a => suitById(a.id));
  clearDetails();
  show('bridge');
  enterBridge(ctx);
}

function refreshContinue(){
  $('btn-continue').disabled = !localStorage.getItem(SAVE_KEY);
}

$('btn-campaign').onclick = () => {
  music.play('requiem');
  if (localStorage.getItem(SAVE_KEY)){
    modal('NEW OPERATION', 'Starting a new campaign will overwrite the existing save.', [
      { label: 'BEGIN ANYWAY', cls: 'accent', fn: newCampaign }, { label: 'CANCEL' }]);
  } else newCampaign();
};
$('btn-continue').onclick = () => { music.play('requiem'); loadCampaign(); };
$('btn-save').onclick = () => { ctx.save(); sfx('ui', 0.15); };
$('btn-quit').onclick = () => modal('RETURN TO MENU', 'Progress is saved automatically at key moments. Save now before quitting?', [
  { label: 'SAVE & QUIT', cls: 'accent', fn: () => { ctx.save(); ctx.toMenu(); } },
  { label: 'QUIT', fn: () => ctx.toMenu() },
  { label: 'CANCEL' }]);

// ---------- direct 1v1 PvP ----------
// GitHub Pages can serve the game but cannot run a signaling/game server. The
// lobby therefore exchanges one WebRTC offer and answer manually, then carries
// the actual duel over a reliable browser-to-browser data channel.
// Bump this whenever networked combat state changes so cached/older Pages
// clients fail clearly instead of entering a silently divergent duel.
const PVP_PROTOCOL = 2;
const PVP_CALLSIGN_KEY = 'gravityFront.pvp.callsign';
const PVP_SUIT_KEY = 'gravityFront.pvp.suit';
const pvpSession = {
  link: null, role: null, peer: null, busy: false, inBattle: false,
  initialized: false, generation: 0,
};
if (LOCAL_DEBUG) Object.defineProperty(window, '__gfPvp', { get: () => pvpSession });

const pvpSuit = id => SUITS.find(s => s.id === id) || null;
const pvpMap = id => MAPS.find(m => m.id === id) || null;
function cleanCallsign(value){
  const clean = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
  return (clean || 'ANON PILOT').slice(0, 20);
}
function pvpStatus(message, state = 'idle'){
  const status = $('pvp-status');
  status.textContent = message;
  status.dataset.state = state;
}
function initPvpLobby(){
  if (pvpSession.initialized) return;
  pvpSession.initialized = true;
  const suitSelect = $('pvp-suit'), mapSelect = $('pvp-map');
  for (const suit of SUITS){
    const option = document.createElement('option');
    option.value = suit.id;
    option.textContent = `${suit.faction} · ${suit.name}`;
    suitSelect.appendChild(option);
  }
  for (const map of MAPS){
    const option = document.createElement('option');
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  let savedCallsign = '', savedSuit = '';
  try {
    savedCallsign = localStorage.getItem(PVP_CALLSIGN_KEY) || '';
    savedSuit = localStorage.getItem(PVP_SUIT_KEY) || '';
  } catch {}
  $('pvp-callsign').value = savedCallsign || `PILOT-${Math.floor(100 + Math.random() * 900)}`;
  suitSelect.value = pvpSuit(savedSuit) ? savedSuit : 'rx78';
  mapSelect.value = pvpMap('clearcity') ? 'clearcity' : MAPS[0]?.id || '';
  renderPvpLobby();
}
function renderPvpLobby(){
  if (!pvpSession.initialized) return;
  const link = pvpSession.link;
  const connected = !!link?.connected;
  const occupied = !!link;
  $('btn-pvp-host').disabled = pvpSession.busy || pvpSession.inBattle || occupied;
  $('btn-pvp-join').disabled = pvpSession.busy || pvpSession.inBattle || occupied;
  $('btn-pvp-apply-answer').disabled = pvpSession.busy || pvpSession.role !== 'host' || !occupied;
  $('btn-pvp-copy').disabled = !$('pvp-outgoing-code').value;
  $('btn-pvp-reset').disabled = pvpSession.busy || pvpSession.inBattle || !occupied;
  $('btn-pvp-launch').disabled = pvpSession.busy || pvpSession.inBattle
    || pvpSession.role !== 'host' || !connected || !pvpSession.peer;
  $('pvp-map').disabled = pvpSession.busy || pvpSession.inBattle || pvpSession.role === 'guest';
  $('pvp-suit').disabled = pvpSession.inBattle;
  $('pvp-callsign').disabled = pvpSession.inBattle;
  $('pvp-peer').textContent = pvpSession.peer
    ? `OPPONENT · ${pvpSession.peer.callsign} · ${pvpSession.peer.suit.name}`
    : 'OPPONENT · NOT CONNECTED';
}
function setPvpBusy(busy){
  pvpSession.busy = busy;
  renderPvpLobby();
}
function discardPvpLink(clearCodes = true){
  const old = pvpSession.link;
  pvpSession.link = null;
  pvpSession.role = null;
  pvpSession.peer = null;
  pvpSession.busy = false;
  pvpSession.generation++;
  if (old) old.close();
  if (clearCodes){
    $('pvp-incoming-code').value = '';
    $('pvp-outgoing-code').value = '';
  }
  renderPvpLobby();
}
function pvpLocalIdentity(){
  const callsign = cleanCallsign($('pvp-callsign').value);
  const suit = pvpSuit($('pvp-suit').value) || SUITS[0];
  $('pvp-callsign').value = callsign;
  try {
    localStorage.setItem(PVP_CALLSIGN_KEY, callsign);
    localStorage.setItem(PVP_SUIT_KEY, suit.id);
  } catch {}
  return { callsign, suitId: suit.id };
}
function sendPvpHello(){
  const link = pvpSession.link;
  if (!link?.connected) return;
  try {
    link.send({ type: 'hello', protocol: PVP_PROTOCOL, ...pvpLocalIdentity() });
  } catch (error){
    pvpStatus(`LINK ERROR · ${error.message}`, 'error');
  }
}
function handlePvpMessage(link, message){
  if (link !== pvpSession.link || !message || typeof message !== 'object') return;
  if (message.type === 'hello'){
    if (message.protocol !== PVP_PROTOCOL) {
      pvpStatus('INCOMPATIBLE GAME VERSION · BOTH PLAYERS MUST USE THE SAME BUILD', 'error');
      return;
    }
    const suit = pvpSuit(message.suitId);
    if (!suit) return;
    pvpSession.peer = { callsign: cleanCallsign(message.callsign), suitId: suit.id, suit };
    pvpStatus(`DIRECT LINK READY · ${pvpSession.peer.callsign} CONNECTED`, 'connected');
    renderPvpLobby();
    return;
  }
  if (message.type === 'launch' && pvpSession.role === 'guest' && !pvpSession.inBattle){
    try {
      startPvpBattle(message);
    } catch (error){
      pvpStatus(`LAUNCH REJECTED · ${error.message}`, 'error');
      modal('PVP LAUNCH REJECTED', error.message, [{ label: 'OK' }]);
    }
  }
}
function createPvpLink(role){
  if (pvpSession.link){
    throw new Error('Reset the current PvP link before starting another connection.');
  }
  discardPvpLink(false);
  const link = new PvpLink();
  pvpSession.link = link;
  pvpSession.role = role;
  const generation = ++pvpSession.generation;
  const current = () => pvpSession.link === link && pvpSession.generation === generation;
  link.addEventListener('status', event => {
    if (!current() || pvpSession.inBattle) return;
    pvpStatus(event.detail.message.toUpperCase(), event.detail.state);
  });
  link.addEventListener('open', () => {
    if (!current()) return;
    pvpStatus('DIRECT DATA LINK OPEN · EXCHANGING PILOT DATA', 'connected');
    sendPvpHello();
    renderPvpLobby();
  });
  link.addEventListener('message', event => {
    if (current()) handlePvpMessage(link, event.detail);
  });
  link.addEventListener('warning', event => {
    if (current() && !pvpSession.inBattle && !$('pvp-outgoing-code').value)
      pvpStatus(`NETWORK WARNING · ${event.detail.message}`, 'warning');
  });
  link.addEventListener('error', event => {
    if (current() && !pvpSession.inBattle) pvpStatus(`LINK ERROR · ${event.detail.message}`, 'error');
  });
  link.addEventListener('close', () => {
    if (!current() || pvpSession.inBattle) return;
    pvpSession.peer = null;
    pvpStatus('OPPONENT DISCONNECTED · RESET THE LINK TO RECONNECT', 'error');
    renderPvpLobby();
  });
  renderPvpLobby();
  return link;
}
function validatePvpPilot(value, label){
  const suit = pvpSuit(value?.suitId);
  if (!suit) throw new Error(`${label} selected an unknown mobile suit.`);
  return { callsign: cleanCallsign(value.callsign), suitId: suit.id, suit };
}
function startPvpBattle(packet){
  if (packet?.protocol !== PVP_PROTOCOL) throw new Error('The launch packet uses an incompatible game version.');
  if (!pvpSession.link?.connected) throw new Error('The direct peer link is no longer connected.');
  if (pvpSession.role !== 'host' && pvpSession.role !== 'guest') throw new Error('Choose Host or Join before launching.');
  const map = pvpMap(packet.mapId);
  if (!map) throw new Error('The host selected an unknown battle map.');
  const host = validatePvpPilot(packet.host, 'Host');
  const guest = validatePvpPilot(packet.guest, 'Guest');
  const local = pvpSession.role === 'host' ? host : guest;
  const remote = pvpSession.role === 'host' ? guest : host;
  const hostSpawn = { x: 0, z: -650 };
  const guestSpawn = { x: 0, z: 1450 };
  const localSpawn = pvpSession.role === 'host' ? hostSpawn : guestSpawn;
  const remoteSpawn = pvpSession.role === 'host' ? guestSpawn : hostSpawn;
  const terrainSeed = Number.isFinite(Number(packet.terrainSeed))
    ? Math.trunc(Number(packet.terrainSeed)) : 790079;
  pvpSession.inBattle = true;
  pvpSession.peer = { callsign: remote.callsign, suitId: remote.suitId, suit: remote.suit };
  renderPvpLobby();
  runBattle({
    env: 'ground',
    biome: 'verdant',
    mapId: map.id,
    terrainSeed,
    playerSuitId: local.suitId,
    playerHp: 1,
    playerYaw: pvpSession.role === 'host' ? 0 : Math.PI,
    enemies: [{
      suitId: remote.suitId,
      name: remote.callsign,
      pos: remoteSpawn,
      exactPos: true,
      networkRemote: true,
    }],
    allies: [],
    spawn: { player: localSpawn },
    mission: { type: 'duel', pvp: true, aircraftCore: true },
    multiplayer: {
      link: pvpSession.link,
      role: pvpSession.role,
      localName: local.callsign,
      remoteName: remote.callsign,
    },
    objective: `PVP DUEL · ${local.callsign} VS ${remote.callsign} · ${map.name}`,
  }, () => {
    pvpSession.inBattle = false;
    discardPvpLink(true);
    pvpStatus('LINK OFFLINE · CREATE A NEW INVITE FOR A REMATCH', 'idle');
    renderPvpLobby();
    show('menu-pvp');
  });
}

$('btn-pvp').onclick = () => {
  music.play('requiem');
  initPvpLobby();
  discardPvpLink(true);
  pvpStatus('LINK OFFLINE · CHOOSE HOST OR JOIN', 'idle');
  show('menu-pvp');
};
$('btn-pvp-back').onclick = () => {
  discardPvpLink(true);
  pvpStatus('LINK OFFLINE · CHOOSE HOST OR JOIN', 'idle');
  show('menu-main');
};
$('btn-pvp-reset').onclick = () => {
  if (pvpSession.inBattle) return;
  discardPvpLink(true);
  pvpStatus('LINK RESET · CHOOSE HOST OR JOIN', 'idle');
  renderPvpLobby();
};
$('btn-pvp-host').onclick = async () => {
  if (!('RTCPeerConnection' in window)){
    modal('PVP UNAVAILABLE', 'This browser does not support WebRTC peer connections.', [{ label: 'OK' }]);
    return;
  }
  let link;
  try { link = createPvpLink('host'); }
  catch (error){ pvpStatus(error.message.toUpperCase(), 'error'); return; }
  setPvpBusy(true);
  $('pvp-incoming-code').value = '';
  $('pvp-outgoing-code').value = '';
  try {
    const code = await link.createHostOffer();
    if (pvpSession.link !== link) return;
    $('pvp-outgoing-code').value = code;
    pvpStatus('HOST INVITE READY · SEND THIS CODE TO THE JOINER', 'offer-ready');
  } catch (error){
    if (pvpSession.link === link) discardPvpLink(false);
    pvpStatus(`COULD NOT CREATE INVITE · ${error.message}`, 'error');
  } finally {
    if (pvpSession.link === link) setPvpBusy(false);
    renderPvpLobby();
  }
};
$('btn-pvp-join').onclick = async () => {
  const offerCode = $('pvp-incoming-code').value.trim();
  if (!offerCode){
    pvpStatus('PASTE THE HOST INVITE CODE FIRST', 'error');
    return;
  }
  if (!('RTCPeerConnection' in window)){
    modal('PVP UNAVAILABLE', 'This browser does not support WebRTC peer connections.', [{ label: 'OK' }]);
    return;
  }
  let link;
  try { link = createPvpLink('guest'); }
  catch (error){ pvpStatus(error.message.toUpperCase(), 'error'); return; }
  setPvpBusy(true);
  $('pvp-outgoing-code').value = '';
  try {
    const code = await link.acceptHostOffer(offerCode);
    if (pvpSession.link !== link) return;
    $('pvp-outgoing-code').value = code;
    pvpStatus('ANSWER READY · SEND THIS CODE BACK TO THE HOST', 'answer-ready');
  } catch (error){
    if (pvpSession.link === link) discardPvpLink(false);
    pvpStatus(`COULD NOT JOIN INVITE · ${error.message}`, 'error');
  } finally {
    if (pvpSession.link === link) setPvpBusy(false);
    renderPvpLobby();
  }
};
$('btn-pvp-apply-answer').onclick = async () => {
  const link = pvpSession.link;
  const answerCode = $('pvp-incoming-code').value.trim();
  if (!link || pvpSession.role !== 'host') return;
  if (!answerCode){
    pvpStatus('PASTE THE JOINER ANSWER CODE FIRST', 'error');
    return;
  }
  setPvpBusy(true);
  try {
    await link.acceptGuestAnswer(answerCode);
    if (pvpSession.link === link) pvpStatus('ANSWER APPLIED · ESTABLISHING DIRECT LINK', 'connecting');
  } catch (error){
    const expired = link.peer?.signalingState === 'closed' || link.connectionState === 'closed';
    if (expired && pvpSession.link === link){
      discardPvpLink(true);
      pvpStatus('HOST LINK EXPIRED · CREATE A FRESH INVITE', 'error');
    } else {
      pvpStatus(`COULD NOT APPLY ANSWER · ${error.message}`, 'error');
    }
  } finally {
    if (pvpSession.link === link) setPvpBusy(false);
  }
};
$('btn-pvp-copy').onclick = async () => {
  const output = $('pvp-outgoing-code'), code = output.value;
  if (!code) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else {
      output.focus(); output.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard permission denied.');
    }
    pvpStatus('CODE COPIED · SEND IT TO THE OTHER PILOT', 'ready');
  } catch (error){
    pvpStatus(`COPY FAILED · SELECT THE CODE MANUALLY · ${error.message}`, 'error');
  }
};
$('btn-pvp-launch').onclick = () => {
  if (pvpSession.role !== 'host' || !pvpSession.link?.connected || !pvpSession.peer) return;
  const host = pvpLocalIdentity();
  const map = pvpMap($('pvp-map').value);
  if (!map) return;
  sendPvpHello();
  const seedArray = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(seedArray);
  else seedArray[0] = Math.floor(Math.random() * 0xffffffff);
  const packet = {
    type: 'launch',
    protocol: PVP_PROTOCOL,
    mapId: map.id,
    terrainSeed: seedArray[0],
    host,
    guest: { callsign: pvpSession.peer.callsign, suitId: pvpSession.peer.suitId },
  };
  try {
    pvpSession.link.send(packet);
    startPvpBattle(packet);
  } catch (error){
    pvpStatus(`LAUNCH FAILED · ${error.message}`, 'error');
  }
};
$('pvp-suit').addEventListener('change', sendPvpHello);
$('pvp-callsign').addEventListener('change', sendPvpHello);
$('pvp-incoming-code').addEventListener('input', renderPvpLobby);
addEventListener('beforeunload', () => pvpSession.link?.close());

// ---------- custom battle ----------
// enemies/allies: each entry is a { id, n, dist } — a unit TYPE, how many, and its spawn
// range from the player (near | normal | far)
// EACH enemy/ally entry carries its OWN deployment point (pos {x,z}; +z = front); the player has one marker.
const PER_SIDE_CAP = 200, ENTRY_MAX = 200, ROWS_MAX = 12, LANDSHIP_CAP = 12; // 12 Big Trays fought at Odessa; capital props have no mech LOD
const custom = { suit: 'rx78', env: 'ground', biome: 'random', map: null, enemies: [{ id: 'zaku2', n: 3, pos: { x: 0, z: 1150 } }], allies: [], army: 0,
  spawn: { player: { x: 0, z: -260 } }, terrainSeed: Math.floor(Math.random() * 1e9) };
// ---- terrain preview for the deployment map: replicates battle.js's stock ground hfn from the SAME seed, so the
// relief you see IS the battlefield (mountains/hills/valleys). Only for random biomes (no authored map) + ground.
// Structures are scattered procedurally in-battle, not individually plotted. Toggle the relief filter / reroll. ----
const BIOME_COL = { // [lowland rgb, highland rgb] mirroring battle.js BIOMES lo/hi
  verdant: [[46, 77, 42], [138, 143, 122]], desert: [[138, 111, 69], [210, 176, 120]],
  ice: [[159, 184, 200], [238, 244, 248]], regolith: [[74, 74, 80], [154, 154, 160]], crimson: [[110, 58, 42], [176, 122, 85]],
};
let terrainNoise = noise2D(custom.terrainSeed), showRelief = true, reliefCache = null, reliefKey = '';
const reliefOn = () => showRelief && custom.env === 'ground' && !custom.map;   // authored maps have their own terrain
function terrainH(x, z){
  const n = terrainNoise, d = Math.hypot(x, z);
  const rolling = (n(x * 0.0011 + 5, z * 0.0011 + 5, 4) - 0.5) * 150;
  const ridge = Math.pow(1 - Math.abs(n(x * 0.0006 + 40, z * 0.0006 + 40, 3) * 2 - 1), 3) * 55;
  return (rolling + ridge) * clamp((d - 90) / 300, 0.1, 1);
}
function buildRelief(w, h, R){ // shaded elevation minimap, cached per seed/biome/size (dragging markers stays cheap)
  const key = [custom.terrainSeed, custom.biome, w, h].join(':');
  if (reliefKey === key && reliefCache) return reliefCache;
  const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
  const g = oc.getContext('2d'), s = Math.min(w, h) * 0.44;
  const ramp = BIOME_COL[custom.biome] || BIOME_COL.verdant, lo = ramp[0], hi = ramp[1];
  const cells = 46, cw = w / cells, chh = h / cells;
  for (let iy = 0; iy < cells; iy++) for (let ix = 0; ix < cells; ix++){
    const wx = (ix * cw + cw / 2 - w / 2) / s * R, wz = -(iy * chh + chh / 2 - h / 2) / s * R;
    const hgt = terrainH(wx, wz), t = clamp(hgt / 70 + 0.35, 0, 1);
    const hN = terrainH(wx, wz + 130), sh = clamp(0.8 + (hgt - hN) / 55, 0.58, 1.22); // hillshade toward the front
    const c = i => clamp((lo[i] + (hi[i] - lo[i]) * t) * sh, 0, 255) | 0;
    g.fillStyle = `rgb(${c(0)},${c(1)},${c(2)})`;
    g.fillRect(ix * cw, iy * chh, cw + 1, chh + 1);
  }
  reliefCache = oc; reliefKey = key; return oc;
}
function rerollTerrain(){ custom.terrainSeed = Math.floor(Math.random() * 1e9); terrainNoise = noise2D(custom.terrainSeed); reliefCache = null; spawnMap.show(); }
const defaultPos = (team, k) => team === 'enemy'                    // fan new entries across the field
  ? { x: ((k % 5) - 2) * 340, z: 1050 + Math.floor(k / 5) * 300 }
  : { x: ((k % 5) - 2) * 300, z: 120 + Math.floor(k / 5) * 220 };
// mass-battle preset sizes (per side); 0 = use the manual enemy/ally lists above
const ARMY_SIZES = [0, 50, 100, 200, 300];
const ARMY_FED = ['gm', 'gmbazooka', 'guncannon', 'rgm79sp'];
const BIOME_LIST = ['verdant', 'desert', 'ice', 'regolith', 'crimson'];
// capital landships you can field as enemies/allies in a custom sortie — these deploy as
// destructible props (full combatants with gun batteries), not piloted units
const SHIPS = [
  { id: 'bigtray', name: 'Big Tray-class', code: 'hover land battleship', faction: 'FED' },
  { id: 'gallop',  name: 'Gallop-class',   code: 'hover ground transport', faction: 'ZEON' },
  { id: 'dabude',  name: 'DOBDAY-class',   code: 'tracked land cruiser', faction: 'ZEON' },
];
const SHIP_IDS = new Set(SHIPS.map(s => s.id));

function statBar(label, frac){
  const line = el('div', 'statline');
  line.appendChild(el('span', '', label));
  const bar = el('div', 'statbar'); bar.style.flex = '1';
  const fill = el('i'); fill.style.width = Math.round(Math.min(1, frac) * 100) + '%';
  bar.appendChild(fill); line.appendChild(bar);
  return line;
}

function renderCustom(){
  const grid = $('suit-grid'); grid.innerHTML = '';
  // mobile suits, then every fighter you can also pilot
  for (const s of [...SUITS, ...AIRCRAFT]){
    const card = el('div', 'suit-card' + (custom.suit === s.id ? ' sel' : ''));
    const top = el('div', '');
    top.appendChild(el('span', 'fac ' + s.faction, s.air ? 'FIGHTER' : s.faction));
    card.appendChild(top);
    card.appendChild(el('div', 'nm', s.name));
    card.appendChild(el('div', 'cd', s.code));
    card.appendChild(statBar('ARMR', s.hp / 5500));
    card.appendChild(statBar('SPD', s.boost / 240));
    card.appendChild(statBar('PWR', Math.max(...s.weapons.map(w => w.dmg * Math.min(w.rof, 3))) / 900));
    card.onclick = () => { custom.suit = s.id; sfx('ui', 0.1); renderCustom(); };
    grid.appendChild(card);
  }

  const envBox = $('env-picker'); envBox.innerHTML = '';
  for (const e of ENVIRONMENTS){
    const b = el('button', 'small' + (custom.env === e.id ? ' sel' : ''), e.name);
    b.onclick = () => { custom.env = e.id; renderCustom(); };
    envBox.appendChild(b);
  }
  const hordeBox = $('horde-picker');
  if (hordeBox){
    hordeBox.innerHTML = '';
    for (const n of ARMY_SIZES){
      const b = el('button', 'small' + (custom.army === n ? ' sel' : ''), n === 0 ? 'OFF' : `${n}v${n}`);
      b.onclick = () => { custom.army = n; renderCustom(); };
      hordeBox.appendChild(b);
    }
  }
  if (custom.env === 'ground'){
    const row = el('div', 'pill-row');
    for (const bm of ['random', ...BIOME_LIST]){
      const cls = 'small' + (!custom.map && custom.biome === bm ? ' sel' : '') + (custom.map ? ' dim' : '');
      const b = el('button', cls, bm.toUpperCase());
      b.onclick = () => { custom.map = null; custom.biome = bm; renderCustom(); }; // picking a biome clears the named map
      row.appendChild(b);
    }
    envBox.appendChild(row);
  }
  // named authored battlefields — override terrain, palette and scenery
  const mapBox = $('map-picker');
  if (mapBox){
    mapBox.innerHTML = '';
    const none = el('button', 'small' + (!custom.map ? ' sel' : ''), 'NONE');
    none.onclick = () => { custom.map = null; renderCustom(); };
    mapBox.appendChild(none);
    for (const m of MAPS){
      const b = el('button', 'small' + (custom.map === m.id ? ' sel' : ''), m.name);
      b.onclick = () => { custom.map = m.id; custom.env = 'ground'; renderCustom(); }; // maps are ground-only
      mapBox.appendChild(b);
    }
    const sub = $('map-sub');
    if (sub){
      const sel = custom.map && MAPS.find(m => m.id === custom.map);
      sub.textContent = sel ? sel.subtitle : 'Fight on an authored battlefield instead of a random biome.';
    }
  }

  const mkList = (boxId, arr, team) => {
    const box = $(boxId); box.innerHTML = '';
    arr.forEach((entry, i) => {
      if (!entry.pos) entry.pos = defaultPos(team, i);           // ensure every entry has a map spawn point
      const row = el('div', 'enemy-row');
      const badge = el('span', 'mk', '' + (i + 1));              // numbered to match this entry's marker on the map
      badge.style.color = team === 'enemy' ? '#ff5d5d' : '#49d67a';
      row.appendChild(badge);
      const sel = document.createElement('select');
      const canonicalShipFaction = team === 'enemy' ? 'ZEON' : 'FED';
      for (const s of [...SUITS, ...AIRCRAFT, ...SHIPS.filter(ship => ship.faction === canonicalShipFaction)]){
        const o = document.createElement('option');
        o.value = s.id; o.textContent = `${SHIP_IDS.has(s.id) ? '⚓ ' : s.air ? '✈ ' : ''}${s.name} (${s.faction})`; o.selected = s.id === entry.id;
        sel.appendChild(o);
      }
      const maxForEntry = () => SHIP_IDS.has(entry.id) ? LANDSHIP_CAP : ENTRY_MAX;
      sel.onchange = () => {
        entry.id = sel.value; entry.n = Math.min(entry.n, maxForEntry());
        cnt.max = '' + maxForEntry(); cnt.value = entry.n;
      };
      row.appendChild(sel);
      const cnt = document.createElement('input');               // how many of this unit to field
      cnt.type = 'number'; cnt.min = '1'; cnt.max = '' + maxForEntry(); cnt.value = Math.min(entry.n, maxForEntry()); cnt.title = 'count';
      cnt.onchange = () => { entry.n = Math.max(1, Math.min(maxForEntry(), Math.round(+cnt.value || 1))); cnt.value = entry.n; };
      row.appendChild(cnt);
      const x = el('span', 'x', '✕');
      x.onclick = () => { arr.splice(i, 1); renderCustom(); };
      row.appendChild(x);
      box.appendChild(row);
    });
  };
  mkList('enemy-list', custom.enemies, 'enemy');
  mkList('ally-list', custom.allies, 'ally');
  $('btn-launch-custom').disabled = custom.army === 0 && !custom.enemies.length;
  // right column: spinning model + stat readout + deployment map
  msPreview.setSuit(custom.suit);
  renderMsStats(suitById(custom.suit));
  ensureMapControls();
  spawnMap.show();
}
// deployment-map filter/reroll controls (built once, inside the map fold panel)
function ensureMapControls(){
  const body = document.querySelector('#fold-map .fold-b');
  if (!body || document.getElementById('map-ctrls')) return;
  const row = el('div', 'pill-row'); row.id = 'map-ctrls'; row.style.marginTop = '6px';
  const relief = el('button', 'small' + (showRelief ? ' sel' : ''), '⛰ RELIEF');
  relief.title = 'show battlefield terrain height (mountains/hills)';
  relief.onclick = () => { showRelief = !showRelief; relief.classList.toggle('sel', showRelief); spawnMap.show(); };
  const reroll = el('button', 'small', '⟳ NEW TERRAIN');
  reroll.title = 'preview a different battlefield (rerolls the seed the sortie will use)';
  reroll.onclick = rerollTerrain;
  row.appendChild(relief); row.appendChild(reroll);
  const hint = document.getElementById('map-hint');
  body.insertBefore(row, hint || null);
}

$('btn-custom').onclick = () => { music.play('requiem'); show('menu-custom'); renderCustom(); }; // show first so canvases have dimensions
$('btn-custom-back').onclick = () => show('menu-main');
$('btn-add-enemy').onclick = () => { if (custom.enemies.length < ROWS_MAX){ custom.enemies.push({ id: 'zaku2', n: 1, pos: defaultPos('enemy', custom.enemies.length) }); renderCustom(); } };
$('btn-clear-enemy').onclick = () => { custom.enemies = []; renderCustom(); };
$('btn-add-ally').onclick = () => { if (custom.allies.length < ROWS_MAX){ custom.allies.push({ id: 'gm', n: 1, pos: defaultPos('ally', custom.allies.length) }); renderCustom(); } };
$('btn-clear-ally').onclick = () => { custom.allies = []; renderCustom(); };
// foldable readout / map accordion — at most ONE panel open, so the preview column never scrolls.
// Toggling: click an open header/button to fold it away; opening one folds the other.
function setFold(which){
  const p = $('fold-' + which); if (!p) return;
  const willOpen = !p.classList.contains('open');
  for (const w of ['readout', 'map']){ const q = $('fold-' + w); if (q) q.classList.toggle('open', w === which && willOpen); }
  if (which === 'map' && willOpen) spawnMap.show();        // draw once the canvas has real dimensions
}
document.querySelectorAll('#menu-custom .fold-h').forEach(h => h.addEventListener('click', () => setFold(h.dataset.fold)));
$('btn-fold-readout').addEventListener('click', () => setFold('readout'));
$('btn-fold-map').addEventListener('click', () => setFold('map'));
$('btn-launch-custom').onclick = () => {
  const rng = new RNG('custom' + Date.now());
  // a land-only suit can't deploy in space — drop the sortie to the surface
  let env = custom.env;
  if (env === 'space' && suitById(custom.suit).groundOnly){
    env = 'ground';
    modal('GROUND-ONLY UNIT', `${suitById(custom.suit).name} cannot operate in space. Sortie redirected to a planetary surface.`, [{ label: 'UNDERSTOOD' }]);
  }
  const activeMap = custom.map ? MAPS.find(m => m.id === custom.map) : null;
  if (activeMap) env = 'ground'; // named battlefields are ground-only
  // mass battle: generate N-per-side armies from random pools; otherwise use the manual lists
  const zPool = ['zaku2', 'zaku2b', 'gouf', 'dom', 'gelgoog', 'goufnh', 'acguy', 'weasel', 'weasel'];
  // expand the { id, n, pos } entries into a flat { id, pos } list, capped per side (LOD keeps big fields performant)
  const expand = list => { const out = []; for (const e of list) for (let k = 0; k < e.n; k++) out.push({ id: e.id, pos: e.pos }); return out.slice(0, PER_SIDE_CAP); };
  const enemyEx = expand(custom.enemies), allyEx = expand(custom.allies);
  const enemies = custom.army > 0
    ? Array.from({ length: custom.army }, () => ({ suitId: rng.pick(zPool), ace: rng.chance(0.04) }))
    : enemyEx.filter(o => !SHIP_IDS.has(o.id)).map(o => ({ suitId: o.id, pos: o.pos }));
  const allies = custom.army > 0
    ? Array.from({ length: custom.army - 1 }, () => ({ suitId: rng.pick(ARMY_FED) }))
    : allyEx.filter(o => !SHIP_IDS.has(o.id)).map(o => ({ suitId: o.id, pos: o.pos }));
  // Landships retain canonical faction identity; the picker exposes Zeon hulls only to the enemy
  // list and Federation hulls only to the ally list. Cap capital props because they do not use mech LOD.
  const customShips = custom.army > 0 ? [] : [
    ...enemyEx.filter(o => SHIP_IDS.has(o.id)).slice(0, LANDSHIP_CAP).map(o => ({ kind: o.id, team: SHIPS.find(s => s.id === o.id).faction, pos: o.pos })),
    ...allyEx.filter(o => SHIP_IDS.has(o.id)).slice(0, LANDSHIP_CAP).map(o => ({ kind: o.id, team: SHIPS.find(s => s.id === o.id).faction, pos: o.pos })),
  ];
  runBattle({
    env,
    biome: custom.biome === 'random' ? rng.pick(BIOME_LIST) : custom.biome,
    mapId: activeMap ? activeMap.id : null,     // authored battlefield
    terrainSeed: custom.terrainSeed,            // the exact seed previewed on the deployment map → WYSIWYG terrain
    playerSuitId: custom.suit, playerHp: 1,
    enemies, allies,
    spawn: custom.army > 0 ? null : custom.spawn, // deployment-map centres (manual sorties only; mass battle keeps its own spread)
    mission: { aircraftCore: true, customShips }, // fielded fighters & landships count toward the win
    objective: custom.army > 0 ? `MASS BATTLE — ${custom.army} HOSTILES`
      : activeMap ? activeMap.mission.summary : 'CUSTOM SORTIE — DESTROY ALL HOSTILES',
  }, () => show('menu-custom'));
};

// ---------- boot ----------
refreshContinue();
show('menu-main');
