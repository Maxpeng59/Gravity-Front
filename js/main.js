// ---------- GRAVITY FRONT — entry point ----------
// Menu flow, campaign state, custom battle setup, save/load, render loop.
import * as THREE from 'three';
import { el, RNG, sfx, noise2D, clamp } from './util.js';
import { SUITS, AIRCRAFT, suitById, ENVIRONMENTS, START_DAY } from './data.js?v=74groundgmloadouts1';
import { genGalaxy, clearDetails, observe, news } from './galaxy.js';
import { startBattle } from './battle.js?v=78playablema1';
import { buildMech } from './mecha.js?v=77meleedeflect1';
import { buildCanonicalSpaceShip } from './canonical-space-ships.js?v=57shipordnance1';
import { buildCanonicalLandship } from './canonical-landships.js';
import { MAPS } from './maps.js';
import { MAX_PVP_PLAYERS, PvpRoom, pvpSeatId, pvpSpawnPoint } from './pvp.js';
import { enterBridge, leaveBridge } from './bridge.js';
import { music } from './music.js';
import { preloadModels } from './models.js';
import { ANIME, installAnimePost, setVisualStyle } from './anime-render.js';
import { formatClock } from './mission-objectives.js';
import {
  applyWeaponLoadout, normalizeRestrictedWeaponLoadout, normalizeWeaponLoadout,
} from './loadouts.js?v=74groundgmloadouts1';
import { renderEquipmentPanel } from './equipment-ui.js';
import { CHALLENGE_RUNS, challengeForEquipment, readPvpProgress } from './challenge-runs.js';
import { canUseHoverCraft, hoverCraftEquipped, hoverCraftSpaceCapable } from './hovercraft.js';
import { landshipProfile } from './landship-balance.js';
import { spaceShipProfile } from './space-ship-balance.js?v=57shipordnance1';
import { assignRequestedSquadIds } from './squad-doctrine.js';
import {
  CUSTOM_SIDE_CAP, customSquadTraits as customSquadTraitsForUnit, expandCustomRoster,
} from './custom-roster.js?v=55playership1';
import {
  STATIONARY_BATTERIES, STATIONARY_BATTERY_IDS, stationaryBatteryById,
} from './stationary-batteries.js';
import {
  MOBILE_ARMORS, MOBILE_ARMOR_IDS, buildMobileArmor, mobileArmorById, mobileArmorProfile,
} from './mobile-armors.js?v=78mobilearmorlore2';

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
installAnimePost(renderer); // anime grade + bloom on every full-screen frame (menu, bridge, battle)
{
  const styleButton = $('btn-style');
  const labelStyle = () => { if (styleButton) styleButton.textContent = `VISUAL STYLE · ${ANIME.enabled ? 'ANIME CEL' : 'CLASSIC'}`; };
  labelStyle();
  if (styleButton) styleButton.onclick = () => { setVisualStyle(ANIME.enabled ? 'classic' : 'anime'); labelStyle(); sfx('ui', 0.1); };
}

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
  let rr = null, scene = null, cam = null, holder = null, curKey = null, spin = 0.6;
  function disposeModel(group){
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(o => {
      if (o.geometry && !o.geometry.userData?.shared) geometries.add(o.geometry);
      const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const material of list){
        if (material.userData?.shared) continue;
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
  function setSuit(id, loadout = null, shipKind = null){
    const key = shipKind ? `ship:${shipKind}` : `${id}:${loadout?.primary || 'stock'}:${loadout?.support || 'stock'}`;
    if (!ensure() || key === curKey) return;
    curKey = key;
    if (holder){ scene.remove(holder); disposeModel(holder); holder = null; }
    let root;
    try {
      if (shipKind){
        const glow = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x4aa3ff, emissiveIntensity: 1.1 });
        const thrust = new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0.82 });
        root = mobileArmorProfile(shipKind)
          ? buildMobileArmor(shipKind, glow, thrust, () => 0)?.root
          : landshipProfile(shipKind)
            ? buildCanonicalLandship(shipKind, glow, () => 0)?.root
            : buildCanonicalSpaceShip(shipKind, glow, thrust, () => 0)?.root;
      } else {
        const baseSuit = suitById(id); if (!baseSuit) return;
        root = buildMech(applyWeaponLoadout(baseSuit, loadout)).root;
      }
    } catch (e){ return; }
    if (!root) return;
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    root.position.sub(c);                                   // centre the model on the turntable
    holder = new THREE.Group(); holder.add(root); scene.add(holder);
    const reach = Math.max(sz.x, sz.y, sz.z) || 20;
    // The RTX-440-B's thin cannon and radio whips extend far beyond its visual mass. Give this hero
    // mesh a tighter inspection framing so its track, arm and casemate detail stays readable.
    const framing = shipKind ? (mobileArmorProfile(shipKind) ? 1.45 : 1.15) : id === 'guntankmk2' ? 1.6 : id === 'weasel' ? 1.4 : 1.75;
    cam.position.set(shipKind ? reach * 0.72 : 0, sz.y * (shipKind ? 0.7 : 0.12), reach * framing);
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
    ['TACTICAL VALUE', Number(suit.value || 0).toLocaleString()],
    ['INTEGRITY', suit.hp],
    ['ARMOR', suit.armor != null ? suit.armor : '—'],
    [suit.air ? 'AIRSPEED' : 'WALK', suit.air ? suit.boost : (suit.walk != null ? suit.walk : '—')],
    ['BOOST', suit.boost],
  ];
  if (suit.mobilityMultiplier != null) rows.push(['LOADOUT MOVE', `${Math.round(suit.mobilityMultiplier * 100)}%`]);
  if (suit.troopCapacity) rows.push(['TROOPS', suit.troopCapacity]);
  let html = `<div class="nm">${suit.name}</div><div class="cd">${suit.code || ''}</div>`;
  for (const [k, v] of rows) html += `<div class="sl"><span>${k}</span><b>${v}</b></div>`;
  const wl = suit.weapons.map(w => `▸ <b>${w.name}</b>`);
  if (suit.saber && suit.saber.dmg > 0) wl.push(`▸ <b>${suit.saber.name}</b> · melee`);
  html += `<div class="wl">${wl.join('<br>')}</div>`;
  box.innerHTML = html;
}

function renderShipStats(kind){
  const box = $('ms-stats'), profile = mobileArmorProfile(kind) || landshipProfile(kind) || spaceShipProfile(kind);
  const ship = mobileArmorById(kind) || shipById(kind);
  if (!box || !profile || !ship) return;
  const rows = [
    ['CLASS', profile.role],
    ['FACTION', ship.faction === 'FED' ? 'E.F.S.F.' : 'ZEON'],
    ['INTEGRITY', profile.hp.toLocaleString()],
    ['CRUISE', profile.speed],
    ['TURN RATE', profile.turnRate],
    ['BATTERY RANGE', profile.mainRange],
  ];
  if (mobileArmorProfile(kind)){
    rows.push(['DIMENSIONS', profile.dimensions]);
    rows.push(['COMBAT MASS', profile.mass]);
    rows.push(['I-FIELD', profile.iField ? 'ACTIVE · BEAM DEFENSE' : 'NONE']);
  }
  let html = `<div class="nm">${ship.name}</div><div class="cd">${ship.code}</div>`;
  for (const [k, v] of rows) html += `<div class="sl"><span>${k}</span><b>${v}</b></div>`;
  html += mobileArmorProfile(kind)
    ? `<div class="wl">${profile.weapons.map(weapon => `▸ <b>${weapon}</b>`).join('<br>')}<br>▸ ${profile.activeTurretLimit} SECONDARY BANKS MAY FIRE TOGETHER<br>▸ ALL-ENVIRONMENT DEPLOYMENT<br>▸ FIRES WHILE MANEUVERING</div>`
    : profile === landshipProfile(kind)
    ? '<div class="wl">▸ <b>LANDSHIP HELM</b><br>▸ MANUAL MAIN BATTERY<br>▸ MANUAL MACHINE-GUN BURST<br>▸ AUTOMATIC DEFENSIVE BATTERIES</div>'
    : '<div class="wl">▸ <b>CAPITAL-SHIP HELM</b><br>▸ AUTOMATIC MAIN BATTERIES<br>▸ AUTOMATIC SIDE BATTERIES</div>';
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
  let clearLocalBattleDebug = () => {};
  battleHandle = startBattle(renderer, opts, res => {
    const h = battleHandle; battleHandle = null;
    clearLocalBattleDebug();
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
      : `${opts.objective || 'SORTIE'}\n\nCONFIRMED KILLS: ${res.kills}\nUNIT INTEGRITY: ${Math.round(res.hpFrac * 100)}%`
        + `\nMISSION TIME: ${formatClock(res.elapsed || 0)}`
        + (res.secondary?.length ? '\n\nBONUS OBJECTIVES\n' + res.secondary.map(g => `${g.met ? '✔' : '✘'} ${g.label}`).join('\n') : '');
    show('result');
    $('btn-result-ok').onclick = () => { music.play('requiem'); show(null); after(res); };
  });
  // The battle module already exposes deterministic QA hooks. Make them reachable
  // only on localhost so combat can be verified without browser pointer lock.
  if (['localhost', '127.0.0.1', '::1'].includes(location.hostname)) {
    globalThis.__gravityBattle = battleHandle;
    const unpause = () => battleHandle?._debugUnpause();
    const colonyFlight = () => battleHandle?._debugInput({ position: [0, 60, 0], velocity: [0, 6, 0] });
    const colonySurface = () => battleHandle?._debugColonySurface?.(1200);
    const colonyTurn = () => battleHandle?._debugInput({ yaw: Math.PI / 2, bodyYaw: Math.PI / 2 });
    const colonyRoll = () => battleHandle?._debugInput({ keys: ['e'] });
    const missileRack = () => battleHandle?._debugInput({ weapon: 2, ready: true });
    const fireOn = () => battleHandle?._debugInput({ fire: true });
    const fireOff = () => battleHandle?._debugInput({ fire: false });
    const viewShip = kind => battleHandle?._debugViewShip?.(kind);
    const forceFedRam = () => {
      document.documentElement.dataset.gravityFedRam = JSON.stringify(battleHandle?._debugForceFedShipCharge?.() || null);
    };
    const publishState = () => {
      document.documentElement.dataset.gravityBattleState = JSON.stringify(battleHandle?._debugState?.() || null);
    };
    const qaUnpause = document.createElement('button');
    const qaColonyFlight = document.createElement('button');
    const qaColonySurface = document.createElement('button');
    const qaColonyTurn = document.createElement('button');
    const qaColonyRoll = document.createElement('button');
    const qaMissileRack = document.createElement('button');
    const qaFireOn = document.createElement('button');
    const qaFireOff = document.createElement('button');
    const qaState = document.createElement('button');
    const qaFedRam = document.createElement('button');
    const qaHelm = document.createElement('button');
    const qaShipCombat = document.createElement('button');
    const qaBeamCharge = document.createElement('button');
    const qaAmmo = document.createElement('button');
    const qaMeleeDefense = document.createElement('button');
    const qaMobileArmorFallback = document.createElement('button');
    const qaShipViews = ['salamis', 'magellan', 'musai'].map((kind, index) => {
      const button = document.createElement('button');
      button.id = `gravity-debug-view-${kind}`;
      button.textContent = `QA ${kind.toUpperCase()}`;
      button.dataset.qaShipIndex = String(index);
      button.onclick = () => viewShip(kind);
      return button;
    });
    qaUnpause.id = 'gravity-debug-unpause';
    qaColonyFlight.id = 'gravity-debug-colony-flight';
    qaColonySurface.id = 'gravity-debug-colony-surface';
    qaColonyTurn.id = 'gravity-debug-colony-turn';
    qaColonyRoll.id = 'gravity-debug-colony-roll';
    qaMissileRack.id = 'gravity-debug-missile-rack';
    qaFireOn.id = 'gravity-debug-fire-on';
    qaFireOff.id = 'gravity-debug-fire-off';
    qaState.id = 'gravity-debug-state';
    qaState.textContent = 'QA STATE';
    qaState.dataset.qaShipIndex = '4';
    qaFedRam.id = 'gravity-debug-fed-ram';
    qaFedRam.textContent = 'QA FED RAM';
    qaFedRam.dataset.qaShipIndex = '3';
    qaHelm.id = 'gravity-debug-ship-helm';
    qaHelm.textContent = 'QA HELM';
    qaHelm.dataset.qaShipIndex = '5';
    qaShipCombat.id = 'gravity-debug-ship-combat';
    qaShipCombat.textContent = 'QA SHIP ARMS';
    qaShipCombat.dataset.qaShipIndex = '6';
    qaBeamCharge.id = 'gravity-debug-beam-charge';
    qaBeamCharge.textContent = 'QA BEAM CHARGE';
    qaBeamCharge.dataset.qaShipIndex = '7';
    qaAmmo.id = 'gravity-debug-ammo';
    qaAmmo.textContent = 'QA AMMO LIMIT';
    qaAmmo.dataset.qaShipIndex = '8';
    qaMeleeDefense.id = 'gravity-debug-melee-defense';
    qaMeleeDefense.textContent = 'QA MELEE DEFLECT';
    qaMeleeDefense.dataset.qaShipIndex = '9';
    qaMobileArmorFallback.id = 'gravity-debug-mobile-armor-fallback';
    qaMobileArmorFallback.textContent = 'QA MA FALLBACK';
    qaMobileArmorFallback.dataset.qaShipIndex = '10';
    for (const button of [qaUnpause, qaColonyFlight, qaColonySurface, qaColonyTurn, qaColonyRoll, qaMissileRack, qaFireOn, qaFireOff, qaState, qaFedRam, qaHelm, qaShipCombat, qaBeamCharge, qaAmmo, qaMeleeDefense, qaMobileArmorFallback, ...qaShipViews]) {
      button.type = 'button';
      if (button.dataset.qaShipIndex) {
        const top = 8 + Number(button.dataset.qaShipIndex) * 32;
        button.style.cssText = `position:fixed;left:8px;top:${top}px;width:120px;height:26px;opacity:.85;z-index:99999`;
      } else {
        button.tabIndex = -1;
        button.setAttribute('aria-hidden', 'true');
        button.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;z-index:-1';
      }
      document.body.appendChild(button);
    }
    qaUnpause.onclick = unpause;
    qaColonyFlight.onclick = colonyFlight;
    qaColonySurface.onclick = colonySurface;
    qaColonyTurn.onclick = colonyTurn;
    qaColonyRoll.onclick = colonyRoll;
    qaMissileRack.onclick = missileRack;
    qaFireOn.onclick = fireOn;
    qaFireOff.onclick = fireOff;
    qaState.onclick = publishState;
    qaFedRam.onclick = forceFedRam;
    qaHelm.onclick = () => {
      document.documentElement.dataset.gravityHelm = JSON.stringify(battleHandle?._debugCommandShip?.('salamis', true) || null);
    };
    qaShipCombat.onclick = () => {
      document.documentElement.dataset.gravityShipCombat = JSON.stringify(battleHandle?._debugShipCombat?.() || null);
    };
    qaBeamCharge.onclick = () => {
      document.documentElement.dataset.gravityBeamCharge = JSON.stringify(battleHandle?._debugBeamCharge?.(1.13, true) || null);
    };
    qaAmmo.onclick = () => {
      battleHandle?._debugUnpause?.();
      battleHandle?._debugInput?.({ exhaustAmmo: true });
      battleHandle?._debugEnemy?.(0, { exhaustAmmo: true, targetPlayer: true });
      setTimeout(() => {
        const state = battleHandle?._debugState?.() || null;
        document.documentElement.dataset.gravityAmmo = JSON.stringify(state);
        const enemy = state?.enemies?.[0];
        qaAmmo.textContent = `QA AMMO P${state?.pRangedAmmoRemaining ?? '?'} · E${enemy?.ammoDry ? 'DRY' : 'ARMED'} · M${state?.meleeRuns ?? '?'}`;
      }, 700);
    };
    qaMeleeDefense.onclick = () => {
      document.documentElement.dataset.gravityMeleeDefense = JSON.stringify(battleHandle?._debugMeleeDefense?.() || null);
    };
    qaMobileArmorFallback.onclick = () => {
      const result = battleHandle?._debugDestroyPlayerMobileArmor?.() || null;
      document.documentElement.dataset.gravityMobileArmorFallback = JSON.stringify(result);
      qaMobileArmorFallback.textContent = result?.sortieContinues && result?.secondaryVisible
        ? `QA ${String(result.secondarySuit || 'MS').toUpperCase()} DEPLOYED`
        : 'QA MA FALLBACK';
    };
    document.addEventListener('gravity-debug-unpause', unpause);
    document.addEventListener('gravity-debug-state', publishState);
    clearLocalBattleDebug = () => {
      document.removeEventListener('gravity-debug-unpause', unpause);
      document.removeEventListener('gravity-debug-state', publishState);
      qaUnpause.remove();
      qaColonyFlight.remove();
      qaColonySurface.remove();
      qaColonyTurn.remove();
      qaColonyRoll.remove();
      qaMissileRack.remove();
      qaFireOn.remove();
      qaFireOff.remove();
      qaState.remove();
      qaFedRam.remove();
      qaHelm.remove();
      qaShipCombat.remove();
      qaBeamCharge.remove();
      qaAmmo.remove();
      qaMeleeDefense.remove();
      qaMobileArmorFallback.remove();
      for (const button of qaShipViews) button.remove();
      delete document.documentElement.dataset.gravityBattleState;
      delete document.documentElement.dataset.gravityFedRam;
      delete document.documentElement.dataset.gravityHelm;
      delete document.documentElement.dataset.gravityShipCombat;
      delete document.documentElement.dataset.gravityBeamCharge;
      delete document.documentElement.dataset.gravityAmmo;
      delete document.documentElement.dataset.gravityMobileArmorFallback;
      delete document.documentElement.dataset.gravityMeleeDefense;
      delete globalThis.__gravityBattle;
    };
  }
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
    worlds: genGalaxy(seed), challengeClears: [],
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
  if (!Array.isArray(S.challengeClears)) S.challengeClears = [];
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

// ---------- direct room PvP ----------
// A static public host cannot run an authoritative game server. The lobby
// therefore exchanges one WebRTC offer/answer per guest; the host relays the
// live room over ordered browser-to-browser data channels.
// Bump this whenever networked combat state changes so cached/older Pages
// clients fail clearly instead of entering a silently divergent match.
const PVP_PROTOCOL = 6;
const PVP_CALLSIGN_KEY = 'gravityFront.pvp.callsign';
const PVP_SUIT_KEY = 'gravityFront.pvp.suit';
const PVP_LOADOUT_KEY = 'gravityFront.pvp.loadouts.v1';
const PVP_MAP_IDS = new Set(['clearcity', 'odessa']);
const PVP_DEFAULT_MAP_ID = 'clearcity';
const pvpSession = {
  room: null, role: null, peers: new Map(), busy: false, inBattle: false,
  initialized: false, generation: 0, loadouts: {}, unlockedEquipment: new Set(),
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
  for (const suit of SUITS.filter(unit => !unit.supportOnly)){
    const option = document.createElement('option');
    option.value = suit.id;
    option.textContent = `${suit.faction} · ${suit.name}`;
    suitSelect.appendChild(option);
  }
  for (const map of MAPS.filter(item => PVP_MAP_IDS.has(item.id))){
    const option = document.createElement('option');
    option.value = map.id;
    option.textContent = map.name;
    mapSelect.appendChild(option);
  }
  let savedCallsign = '', savedSuit = '', savedLoadouts = {};
  try {
    savedCallsign = localStorage.getItem(PVP_CALLSIGN_KEY) || '';
    savedSuit = localStorage.getItem(PVP_SUIT_KEY) || '';
    savedLoadouts = JSON.parse(localStorage.getItem(PVP_LOADOUT_KEY) || '{}');
  } catch {}
  pvpSession.loadouts = savedLoadouts && typeof savedLoadouts === 'object' ? savedLoadouts : {};
  $('pvp-callsign').value = savedCallsign || `PILOT-${Math.floor(100 + Math.random() * 900)}`;
  suitSelect.value = pvpSuit(savedSuit) ? savedSuit : 'rx78';
  mapSelect.value = PVP_DEFAULT_MAP_ID;
  renderPvpEquipment();
  renderPvpLobby();
}
function currentPvpLoadout(suit){
  return normalizeRestrictedWeaponLoadout(suit, pvpSession.loadouts[suit.id], pvpSession.unlockedEquipment);
}
function savePvpLoadouts(){
  try { localStorage.setItem(PVP_LOADOUT_KEY, JSON.stringify(pvpSession.loadouts)); } catch {}
}
function renderPvpEquipment(){
  if (!pvpSession.initialized) return;
  const progress = readPvpProgress();
  pvpSession.unlockedEquipment = new Set(progress.unlocked);
  const suit = pvpSuit($('pvp-suit').value) || pvpSuit('rx78') || SUITS[0];
  const loadout = currentPvpLoadout(suit);
  if (loadout.primary === 'stock') delete pvpSession.loadouts[suit.id];
  else pvpSession.loadouts[suit.id] = loadout;
  savePvpLoadouts();
  const total = new Set(CHALLENGE_RUNS.flatMap(challenge => challenge.unlocks)).size;
  $('pvp-progression').textContent = progress.cleared.length
    ? `CHALLENGE CLEARANCE ${progress.cleared.length}/6 · EQUIPMENT ${progress.unlocked.length}/${total}`
    : 'STOCK EQUIPMENT ONLY · CLEAR CAMPAIGN CHALLENGE RUNS TO UNLOCK PVP ARMAMENTS';
  renderEquipmentPanel($('pvp-equipment'), suit, loadout, next => {
    const normalized = normalizeRestrictedWeaponLoadout(suit, next, pvpSession.unlockedEquipment);
    if (normalized.primary === 'stock') delete pvpSession.loadouts[suit.id];
    else pvpSession.loadouts[suit.id] = normalized;
    savePvpLoadouts();
    renderPvpEquipment();
    sendPvpHello();
  }, {
    unlockedIds: pvpSession.unlockedEquipment,
    lockedLabel: item => {
      const source = challengeForEquipment(item.id);
      return source ? `LOCKED · CLEAR ${source.title}` : 'LOCKED · CAMPAIGN CHALLENGE REWARD';
    },
  });
}
function renderPvpLobby(){
  if (!pvpSession.initialized) return;
  const room = pvpSession.room;
  const connected = !!room?.connected;
  const occupied = !!room;
  const hostCanInvite = pvpSession.role === 'host' && room?.canInvite;
  $('btn-pvp-host').disabled = pvpSession.busy || pvpSession.inBattle
    || (occupied && !hostCanInvite);
  $('btn-pvp-host').textContent = connected ? 'ADD ANOTHER PILOT' : '1 · CREATE HOST INVITE';
  $('btn-pvp-join').disabled = pvpSession.busy || pvpSession.inBattle || occupied;
  $('btn-pvp-apply-answer').disabled = pvpSession.busy || pvpSession.role !== 'host' || !room?.pending;
  $('btn-pvp-copy').disabled = !$('pvp-outgoing-code').value;
  $('btn-pvp-reset').disabled = pvpSession.busy || pvpSession.inBattle || !occupied;
  $('btn-pvp-launch').disabled = pvpSession.busy || pvpSession.inBattle
    || pvpSession.role !== 'host' || !connected || pvpSession.peers.size < 1;
  $('pvp-map').disabled = pvpSession.inBattle || pvpSession.role === 'guest';
  $('pvp-suit').disabled = pvpSession.inBattle;
  $('pvp-callsign').disabled = pvpSession.inBattle;
  const peers = [...pvpSession.peers.values()];
  $('pvp-peer').textContent = peers.length
    ? `ROOM ${peers.length + 1}/${MAX_PVP_PLAYERS} · ` + peers.map(peer => `${peer.callsign} · ${peer.suit.name}`).join('  |  ')
    : `ROOM 1/${MAX_PVP_PLAYERS} · NO OTHER PILOTS CONNECTED`;
}
function setPvpBusy(busy){
  pvpSession.busy = busy;
  renderPvpLobby();
}
function discardPvpLink(clearCodes = true){
  const old = pvpSession.room;
  pvpSession.room = null;
  pvpSession.role = null;
  pvpSession.peers.clear();
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
  const loadout = currentPvpLoadout(suit);
  return { callsign, suitId: suit.id, loadout };
}
function sendPvpHello(){
  const room = pvpSession.room;
  if (!room?.connected) return;
  try {
    room.send({ type: 'hello', protocol: PVP_PROTOCOL, ...pvpLocalIdentity() });
  } catch (error){
    pvpStatus(`LINK ERROR · ${error.message}`, 'error');
  }
}
function handlePvpMessage(room, message){
  if (room !== pvpSession.room || !message || typeof message !== 'object') return;
  if (message.type === 'hello'){
    if (message.protocol !== PVP_PROTOCOL) {
      pvpStatus('INCOMPATIBLE GAME VERSION · BOTH PLAYERS MUST USE THE SAME BUILD', 'error');
      return;
    }
    let pilot;
    try { pilot = validatePvpPilot(message, 'Opponent'); } catch { return; }
    const peerId = String(message.senderId || (pvpSession.role === 'guest' ? pvpSeatId(0) : ''));
    if (!peerId) return;
    pvpSession.peers.set(peerId, pilot);
    if (pvpSession.role === 'host'){
      try { room.sendTo(peerId, { type: 'seat', protocol: PVP_PROTOCOL, peerId, host: pvpLocalIdentity() }); } catch {}
    }
    pvpStatus(`ROOM READY · ${pvpSession.peers.size + 1}/${MAX_PVP_PLAYERS} PILOTS CONNECTED`, 'connected');
    renderPvpLobby();
    return;
  }
  if (message.type === 'seat' && pvpSession.role === 'guest'){
    if (message.protocol !== PVP_PROTOCOL) return;
    room.setLocalId(message.peerId);
    try { pvpSession.peers.set(pvpSeatId(0), validatePvpPilot(message.host, 'Host')); } catch { return; }
    pvpStatus(`ROOM READY · ASSIGNED ${String(message.peerId).toUpperCase()}`, 'connected');
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
  if (pvpSession.room){
    throw new Error('Reset the current PvP link before starting another connection.');
  }
  discardPvpLink(false);
  const room = new PvpRoom(role);
  pvpSession.room = room;
  pvpSession.role = role;
  const generation = ++pvpSession.generation;
  const current = () => pvpSession.room === room && pvpSession.generation === generation;
  room.addEventListener('status', event => {
    if (!current() || pvpSession.inBattle) return;
    pvpStatus(event.detail.message.toUpperCase(), event.detail.state);
  });
  room.addEventListener('open', () => {
    if (!current()) return;
    pvpStatus('DIRECT DATA LINK OPEN · EXCHANGING PILOT DATA', 'connected');
    sendPvpHello();
    renderPvpLobby();
  });
  room.addEventListener('message', event => {
    if (current()) handlePvpMessage(room, event.detail);
  });
  room.addEventListener('warning', event => {
    if (current() && !pvpSession.inBattle && !$('pvp-outgoing-code').value)
      pvpStatus(`NETWORK WARNING · ${event.detail.message}`, 'warning');
  });
  room.addEventListener('error', event => {
    if (current() && !pvpSession.inBattle) pvpStatus(`LINK ERROR · ${event.detail.message}`, 'error');
  });
  room.addEventListener('peerclose', event => {
    if (!current() || pvpSession.inBattle) return;
    pvpSession.peers.delete(event.detail?.peerId);
    pvpStatus(pvpSession.peers.size ? `PILOT DISCONNECTED · ${pvpSession.peers.size + 1}/${MAX_PVP_PLAYERS} REMAIN` : 'ROOM EMPTY · ADD OR JOIN A PILOT', 'warning');
    renderPvpLobby();
  });
  renderPvpLobby();
  return room;
}
function validatePvpPilot(value, label){
  const suit = pvpSuit(value?.suitId);
  if (!suit) throw new Error(`${label} selected an unknown mobile suit.`);
  const loadout = normalizeWeaponLoadout(suit, value?.loadout || null);
  return { callsign: cleanCallsign(value.callsign), suitId: suit.id, suit, loadout };
}
function startPvpBattle(packet){
  if (packet?.protocol !== PVP_PROTOCOL) throw new Error('The launch packet uses an incompatible game version.');
  if (!pvpSession.room?.connected) throw new Error('The direct peer room is no longer connected.');
  if (pvpSession.role !== 'host' && pvpSession.role !== 'guest') throw new Error('Choose Host or Join before launching.');
  if (!PVP_MAP_IDS.has(packet.mapId)) throw new Error('The selected PvP battlefield is unavailable.');
  const map = pvpMap(packet.mapId);
  if (!map) throw new Error('The selected PvP battlefield is unavailable.');
  if (!Array.isArray(packet.roster) || packet.roster.length < 2 || packet.roster.length > MAX_PVP_PLAYERS)
    throw new Error('The launch roster is invalid.');
  const ids = new Set();
  const roster = packet.roster.map((entry, index) => {
    const id = String(entry?.id || '');
    if (!id || ids.has(id)) throw new Error('The launch roster contains duplicate or missing pilot IDs.');
    ids.add(id);
    return { id, ...validatePvpPilot(entry, `Pilot ${index + 1}`) };
  });
  const localId = String(packet.youId || pvpSession.room.localId || '');
  const localIndex = roster.findIndex(pilot => pilot.id === localId);
  if (localIndex < 0) throw new Error('Your pilot seat is missing from the launch roster.');
  const local = roster[localIndex];
  const remotes = roster.filter(pilot => pilot.id !== localId);
  const localPoint = pvpSpawnPoint(localIndex, roster.length, map.id);
  const terrainSeed = Number.isFinite(Number(packet.terrainSeed))
    ? Math.trunc(Number(packet.terrainSeed)) : 790079;
  pvpSession.inBattle = true;
  pvpSession.room.setLocalId(localId);
  pvpSession.room.beginBattle();
  renderPvpLobby();
  runBattle({
    env: 'ground',
    biome: 'verdant',
    mapId: map.id,
    terrainSeed,
    playerSuitId: local.suitId,
    playerHp: 1,
    playerLoadout: local.loadout,
    playerYaw: localPoint.yaw,
    enemies: remotes.map(remote => {
      const index = roster.findIndex(pilot => pilot.id === remote.id);
      const point = pvpSpawnPoint(index, roster.length, map.id);
      return { suitId: remote.suitId, loadout: remote.loadout, name: remote.callsign,
        networkId: remote.id, pos: { x: point.x, z: point.z }, exactPos: true, networkRemote: true };
    }),
    allies: [],
    spawn: { player: { x: localPoint.x, z: localPoint.z } },
    mission: { type: 'pvp', pvp: true, aircraftCore: true },
    multiplayer: {
      link: pvpSession.room,
      role: pvpSession.role,
      localId,
      localName: local.callsign,
      totalPlayers: roster.length,
    },
    objective: `PVP BATTLE ROYALE · ${roster.length} PILOTS · ${map.name}`,
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
  renderPvpEquipment();
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
  let room;
  try { room = pvpSession.room || createPvpLink('host'); }
  catch (error){ pvpStatus(error.message.toUpperCase(), 'error'); return; }
  setPvpBusy(true);
  $('pvp-incoming-code').value = '';
  $('pvp-outgoing-code').value = '';
  try {
    const code = await room.createHostOffer();
    if (pvpSession.room !== room) return;
    $('pvp-outgoing-code').value = code;
    pvpStatus('HOST INVITE READY · SEND THIS CODE TO THE JOINER', 'offer-ready');
  } catch (error){
    if (pvpSession.room === room && !room.connected) discardPvpLink(false);
    pvpStatus(`COULD NOT CREATE INVITE · ${error.message}`, 'error');
  } finally {
    if (pvpSession.room === room) setPvpBusy(false);
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
  let room;
  try { room = createPvpLink('guest'); }
  catch (error){ pvpStatus(error.message.toUpperCase(), 'error'); return; }
  setPvpBusy(true);
  $('pvp-outgoing-code').value = '';
  try {
    const code = await room.acceptHostOffer(offerCode);
    if (pvpSession.room !== room) return;
    $('pvp-outgoing-code').value = code;
    pvpStatus('ANSWER READY · SEND THIS CODE BACK TO THE HOST', 'answer-ready');
  } catch (error){
    if (pvpSession.room === room) discardPvpLink(false);
    pvpStatus(`COULD NOT JOIN INVITE · ${error.message}`, 'error');
  } finally {
    if (pvpSession.room === room) setPvpBusy(false);
    renderPvpLobby();
  }
};
$('btn-pvp-apply-answer').onclick = async () => {
  const room = pvpSession.room;
  const answerCode = $('pvp-incoming-code').value.trim();
  if (!room || pvpSession.role !== 'host') return;
  if (!answerCode){
    pvpStatus('PASTE THE JOINER ANSWER CODE FIRST', 'error');
    return;
  }
  setPvpBusy(true);
  try {
    await room.acceptGuestAnswer(answerCode);
    if (pvpSession.room === room) pvpStatus('ANSWER APPLIED · ESTABLISHING DIRECT LINK', 'connecting');
  } catch (error){
    pvpStatus(`COULD NOT APPLY ANSWER · ${error.message}`, 'error');
  } finally {
    if (pvpSession.room === room) setPvpBusy(false);
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
  if (pvpSession.role !== 'host' || !pvpSession.room?.connected || !pvpSession.peers.size) return;
  const host = pvpLocalIdentity();
  const map = pvpMap($('pvp-map').value) || pvpMap(PVP_DEFAULT_MAP_ID);
  if (!map) return;
  sendPvpHello();
  const seedArray = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(seedArray);
  else seedArray[0] = Math.floor(Math.random() * 0xffffffff);
  const roster = [
    { id: pvpSeatId(0), ...host },
    ...[...pvpSession.peers].map(([id, pilot]) => ({ id, callsign: pilot.callsign, suitId: pilot.suitId, loadout: pilot.loadout })),
  ].slice(0, MAX_PVP_PLAYERS);
  const basePacket = {
    type: 'launch', protocol: PVP_PROTOCOL, mapId: map.id,
    terrainSeed: seedArray[0],
    roster,
  };
  try {
    for (const pilot of roster.slice(1)) pvpSession.room.sendTo(pilot.id, { ...basePacket, youId: pilot.id });
    startPvpBattle({ ...basePacket, youId: pvpSeatId(0) });
  } catch (error){
    pvpStatus(`LAUNCH FAILED · ${error.message}`, 'error');
  }
};
$('pvp-suit').addEventListener('change', () => { renderPvpEquipment(); sendPvpHello(); });
$('pvp-callsign').addEventListener('change', sendPvpHello);
$('pvp-map').addEventListener('change', renderPvpLobby);
$('pvp-incoming-code').addEventListener('input', renderPvpLobby);
addEventListener('beforeunload', () => pvpSession.room?.close());

// ---------- custom battle ----------
// enemies/allies: each entry is a { id, n, dist } — a unit TYPE, how many, and its spawn
// range from the player (near | normal | far)
// EACH enemy/ally entry carries its OWN deployment point (pos {x,z}; +z = front); the player has one marker.
const PER_SIDE_CAP = CUSTOM_SIDE_CAP, ENTRY_MAX = CUSTOM_SIDE_CAP, CUSTOM_SQUAD_COUNT = 40;
const customSquadTraits = id => customSquadTraitsForUnit(suitById(id));
// localhost-only: ?qa-objectives=fast compresses objective timers for automated walkthroughs
function localQaTuning(){
  if (!['localhost', '127.0.0.1', '::1'].includes(location.hostname)) return undefined;
  if (new URLSearchParams(location.search).get('qa-objectives') !== 'fast') return undefined;
  return { scanTime: 1, plantTime: 1, fuseTime: 3, lzHoldTime: 10, dropHoldTime: 3 };
}

// Custom Battle operation types. The staged ones run the same objective rules as campaign contracts.
const CUSTOM_OPERATIONS = [
  { id: 'sortie', name: 'SORTIE', brief: 'Destroy every hostile unit, capital ship and battery on the field.' },
  { id: 'recon', name: 'RECON', brief: 'Survey three sites (hold inside each ring), then return to the extraction point.' },
  { id: 'sabotage', name: 'DEMOLITION', groundOnly: true, brief: 'Hold still beside each target to set charges, then clear the blast zone before the fuse runs out.' },
  { id: 'extraction', name: 'PILOT RESCUE', groundOnly: true, brief: 'Reach the downed pilot and hold the landing zone for 60 s while Zeon closes in.' },
  { id: 'breakthrough', name: 'BREAKTHROUGH', groundOnly: true, brief: 'Three phases: destroy the AA sites, hold the drop zone, then kill the sector commander.' },
];

const custom = { op: 'sortie', suit: 'rx78', playerShip: null, playerMobileArmor: null, env: 'ground', biome: 'random', map: null, enemies: [{ id: 'zaku2', n: 3, pos: { x: 0, z: 1150 } }], allies: [], army: 0, loadouts: {}, hoverCrafts: {},
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
const ARMY_FED = ['gm', 'gmii', 'gmiii', 'jegan', 'gmbazooka', 'guncannon', 'rgm79sp'];
const BIOME_LIST = ['verdant', 'desert', 'ice', 'regolith', 'crimson'];
// Capital hulls you can field as enemies/allies in a custom sortie. Surface
// landships and space warships are deliberately separated by environment.
const SHIPS = [
  { id: 'bigtray', name: 'Big Tray-class', code: 'hover land battleship', faction: 'FED', env: 'ground' },
  { id: 'gallop',  name: 'Gallop-class',   code: 'hover ground transport', faction: 'ZEON', env: 'ground' },
  { id: 'dabude',  name: 'DOBDAY-class',   code: 'tracked land cruiser', faction: 'ZEON', env: 'ground' },
  { id: 'salamis', name: 'Salamis-class', code: 'EFSF mass-production cruiser', faction: 'FED', env: 'space' },
  { id: 'magellan', name: 'Magellan-class', code: 'EFSF fleet flagship', faction: 'FED', env: 'space' },
  { id: 'columbus', name: 'Columbus-class', code: 'EFSF supply and MS carrier', faction: 'FED', env: 'space' },
  { id: 'musai', name: 'Musai-class', code: 'Zeon mobile-suit cruiser', faction: 'ZEON', env: 'space' },
  { id: 'chivvay', name: 'Chivvay-class', code: 'Zeon high-speed heavy cruiser', faction: 'ZEON', env: 'space' },
];
const SHIP_IDS = new Set(SHIPS.map(s => s.id));
const CUSTOM_PROP_IDS = new Set([...SHIP_IDS, ...MOBILE_ARMOR_IDS, ...STATIONARY_BATTERY_IDS]);
const shipById = id => SHIPS.find(ship => ship.id === id) || null;
const unitFaction = id => shipById(id)?.faction || mobileArmorById(id)?.faction || stationaryBatteryById(id)?.faction || suitById(id)?.faction || null;
const opposingFaction = faction => faction === 'ZEON' ? 'FED' : 'ZEON';
const secondarySuitEligible = suit => !!suit && !suit.air && !suit.vehicle && !suit.supportOnly;
const defaultSecondarySuit = faction => faction === 'ZEON' ? 'zaku2' : 'gm';
const customPlayerFaction = () => custom.playerMobileArmor
  ? mobileArmorById(custom.playerMobileArmor).faction
  : custom.playerShip ? shipById(custom.playerShip).faction : suitById(custom.suit)?.faction || 'FED';
function normalizeCustomSidesForPlayer(){
  const friendly = customPlayerFaction(), hostile = opposingFaction(friendly);
  custom.enemies = custom.enemies.filter(entry => unitFaction(entry.id) === hostile);
  custom.allies = custom.allies.filter(entry => unitFaction(entry.id) === friendly);
  if (!custom.enemies.length){
    const id = hostile === 'FED' ? 'gm' : 'zaku2';
    custom.enemies.push({ id, n: 1, pos: defaultPos('enemy', 0) });
  }
}
function normalizeCustomRosterForEnvironment(){
  const allowed = entry => {
    const ship = shipById(entry.id);
    if (ship) return ship.env === custom.env;
    if (MOBILE_ARMOR_IDS.has(entry.id)) return true;
    if (STATIONARY_BATTERY_IDS.has(entry.id)) return custom.env === 'ground';
    return true;
  };
  custom.enemies = custom.enemies.filter(allowed);
  custom.allies = custom.allies.filter(allowed);
}
// One row for every selectable combat type. The roster panels scroll, so the
// full catalogue remains usable without pushing the launch controls off-screen.
const ROWS_MAX = SUITS.length + AIRCRAFT.length
  + Math.max(...['FED', 'ZEON'].map(faction =>
    SHIPS.filter(ship => ship.faction === faction).length
    + MOBILE_ARMORS.filter(unit => unit.faction === faction).length
    + STATIONARY_BATTERIES.filter(battery => battery.faction === faction).length));

function applyRecommendedMapForces(map){
  const preset = map?.recommendedForces;
  if (!preset) return;
  custom.army = 0;
  if (pvpSuit(preset.playerSuitId) && !custom.playerShip && !custom.playerMobileArmor) custom.suit = preset.playerSuitId;
  custom.enemies = preset.enemies.map(entry => ({ ...entry, pos: { ...entry.pos } }));
  custom.allies = preset.allies.map(entry => ({ ...entry, pos: { ...entry.pos } }));
  if (map.spawn?.player) custom.spawn.player = { ...map.spawn.player };
}

function statBar(label, frac){
  const line = el('div', 'statline');
  line.appendChild(el('span', '', label));
  const bar = el('div', 'statbar'); bar.style.flex = '1';
  const fill = el('i'); fill.style.width = Math.round(Math.min(1, frac) * 100) + '%';
  bar.appendChild(fill); line.appendChild(bar);
  return line;
}

function renderCustomLoadout(){
  const box = $('custom-loadout'); if (!box) return;
  if (custom.playerShip){
    const landship = !!landshipProfile(custom.playerShip);
    box.innerHTML = `<div class="hovercraft-card"><div class="hovercraft-copy"><b>${landship ? 'LANDSHIP FIRE CONTROL' : 'NAVAL FIRE CONTROL'}</b><span>${landship ? 'Move the mouse to traverse and elevate the main turrets without turning the hull. Use 1/2 to select the main battery or machine-gun burst, N for the turret sight, and LMB to fire.' : 'Missiles and torpedoes fire from the hull sight while the main and side batteries engage automatically.'}</span></div></div>`;
    return;
  }
  const suit = suitById(custom.suit);
  renderEquipmentPanel(box, suit, custom.loadouts[suit.id], next => {
    if (!next) delete custom.loadouts[suit.id];
    else custom.loadouts[suit.id] = next;
    sfx('ui', 0.1);
    renderCustom();
  });
  if (custom.playerMobileArmor){
    const notice = el('div', 'hovercraft-card');
    notice.innerHTML = `<div class="hovercraft-copy"><b>SECONDARY MOBILE SUIT · ${suit.name}</b><span>Its loadout is carried in reserve. If the mobile armor is destroyed, control transfers immediately to this MS and the sortie continues.</span></div>`;
    box.prepend(notice);
  }
}

function renderCustomHoverCraft(){
  const box = $('custom-hovercraft'); if (!box) return;
  if (custom.playerShip || custom.playerMobileArmor){
    if (custom.playerMobileArmor){
      box.innerHTML = `<div class="hovercraft-card unavailable"><div class="hovercraft-copy"><b>INTEGRAL MOBILE-ARMOR PROPULSION</b><span>The reserve mobile suit deploys without a hover craft when the mobile armor is destroyed.</span></div></div>`;
      return;
    }
    const landship = !!landshipProfile(custom.playerShip);
    box.innerHTML = `<div class="hovercraft-card unavailable"><div class="hovercraft-copy"><b>${landship ? 'INTEGRAL LANDSHIP DRIVE' : 'INTEGRAL CAPITAL-SHIP DRIVE'}</b><span>${landship ? 'Use W/S to drive or reverse, A/D to steer only the hull, Shift for flank speed, and the mouse to control the turret view.' : 'Use W/S thrust, A/D turn, Space/C vertical verniers, and Shift for flank speed.'}</span></div></div>`;
    return;
  }
  const suit = suitById(custom.suit), eligible = canUseHoverCraft(suit);
  const equipped = hoverCraftEquipped(suit, custom.hoverCrafts[suit.id]);
  box.replaceChildren();
  box.classList.toggle('unavailable', !eligible);
  const card = el('div', 'hovercraft-card');
  const copy = el('div', 'hovercraft-copy');
  copy.appendChild(el('b', '', 'MS HOVER CRAFT · 5,000 HP'));
  copy.appendChild(el('span', '', eligible
    ? 'Independent support deck · space-capable · 1.5× movement speed · Space ascends · C descends · destructive blast if lost'
    : 'Unavailable: this platform requires a standing mobile-suit frame.'));
  const toggle = el('button', `small equipment-action${equipped ? ' equipped' : ''}`, equipped ? 'EQUIPPED' : 'EQUIP');
  toggle.disabled = !eligible;
  toggle.onclick = () => { custom.hoverCrafts[suit.id] = !equipped; sfx('ui', 0.1); renderCustom(); };
  card.append(copy, toggle); box.appendChild(card);
}

function renderCustom(){
  const grid = $('suit-grid'); grid.innerHTML = '';
  for (const armor of MOBILE_ARMORS){
    const profile = mobileArmorProfile(armor.id);
    const card = el('div', 'suit-card' + (custom.playerMobileArmor === armor.id ? ' sel' : ''));
    const top = el('div', '');
    top.appendChild(el('span', 'fac ' + armor.faction, 'MOBILE ARMOR'));
    card.appendChild(top);
    card.appendChild(el('div', 'nm', armor.name));
    card.appendChild(el('div', 'cd', armor.code));
    card.appendChild(statBar('HULL', profile.hp / 52000));
    card.appendChild(statBar('SPD', profile.speed / 28));
    card.appendChild(statBar('PWR', profile.mainDamage / 520));
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Pilot ${armor.name} with secondary mobile suit`);
    const selectArmor = () => {
      custom.playerMobileArmor = armor.id;
      custom.playerShip = null;
      const current = suitById(custom.suit);
      if (!secondarySuitEligible(current) || current.faction !== armor.faction)
        custom.suit = defaultSecondarySuit(armor.faction);
      custom.op = 'sortie';
      normalizeCustomSidesForPlayer();
      sfx('ui', 0.1);
      renderCustom();
      setFold('readout', true);
    };
    card.onclick = selectArmor;
    card.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' '){ event.preventDefault(); selectArmor(); }
    };
    grid.appendChild(card);
  }
  for (const ship of SHIPS.filter(unit => unit.env === custom.env)){
    const profile = landshipProfile(ship.id) || spaceShipProfile(ship.id);
    const card = el('div', 'suit-card' + (custom.playerShip === ship.id ? ' sel' : ''));
    const top = el('div', '');
    top.appendChild(el('span', 'fac ' + ship.faction, ship.env === 'ground' ? 'LANDSHIP' : 'CAPITAL SHIP'));
    card.appendChild(top);
    card.appendChild(el('div', 'nm', ship.name));
    card.appendChild(el('div', 'cd', ship.code));
    card.appendChild(statBar('HULL', profile.hp / 52000));
    card.appendChild(statBar('SPD', profile.speed / 15));
    card.appendChild(statBar('PWR', profile.mainDamage / 440));
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Pilot ${ship.name}`);
    const selectShip = () => {
      custom.playerShip = ship.id;
      custom.playerMobileArmor = null;
      custom.op = 'sortie';
      normalizeCustomSidesForPlayer();
      sfx('ui', 0.1);
      renderCustom();
      setFold('readout', true);
    };
    card.onclick = selectShip;
    card.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' '){ event.preventDefault(); selectShip(); }
    };
    grid.appendChild(card);
  }
  // mobile suits, then every fighter you can also pilot
  for (const s of [...SUITS.filter(unit => !unit.supportOnly), ...AIRCRAFT]){
    const reserveChoice = custom.playerMobileArmor && secondarySuitEligible(s)
      && s.faction === mobileArmorById(custom.playerMobileArmor)?.faction;
    const card = el('div', 'suit-card' + (!custom.playerShip && custom.suit === s.id ? ' sel' : ''));
    const top = el('div', '');
    top.appendChild(el('span', 'fac ' + s.faction, reserveChoice ? 'SECONDARY MS' : s.air ? 'FIGHTER' : s.faction));
    card.appendChild(top);
    card.appendChild(el('div', 'nm', s.name));
    card.appendChild(el('div', 'cd', s.code));
    card.appendChild(statBar('ARMR', s.hp / 5500));
    card.appendChild(statBar('SPD', s.boost / 240));
    card.appendChild(statBar('PWR', Math.max(...s.weapons.map(w => w.dmg * Math.min(w.rof, 3))) / 900));
    card.onclick = () => {
      custom.suit = s.id;
      custom.playerShip = null;
      if (!reserveChoice) custom.playerMobileArmor = null;
      normalizeCustomSidesForPlayer();
      sfx('ui', 0.1);
      renderCustom();
      setFold('readout', true);
    };
    grid.appendChild(card);
  }

  const envBox = $('env-picker'); envBox.innerHTML = '';
  for (const e of ENVIRONMENTS){
    const b = el('button', 'small' + (custom.env === e.id ? ' sel' : ''), e.name);
    b.onclick = () => {
      custom.env = e.id;
      if (custom.playerShip && shipById(custom.playerShip)?.env !== custom.env) custom.playerShip = null;
      if (custom.env !== 'ground') custom.map = null;
      normalizeCustomRosterForEnvironment();
      normalizeCustomSidesForPlayer();
      renderCustom();
    };
    envBox.appendChild(b);
  }
  // operation type: a plain sortie or one of the staged objective missions
  const opBox = $('op-picker');
  if (opBox){
    opBox.innerHTML = '';
    for (const op of CUSTOM_OPERATIONS){
      const blocked = op.groundOnly && custom.env !== 'ground';
      const b = el('button', 'small' + (custom.op === op.id ? ' sel' : ''), op.name);
      b.disabled = blocked || custom.army > 0 || (!!(custom.playerShip || custom.playerMobileArmor) && op.id !== 'sortie');
      b.title = op.brief;
      b.onclick = () => { custom.op = op.id; renderCustom(); };
      opBox.appendChild(b);
    }
    const current = CUSTOM_OPERATIONS.find(op => op.id === custom.op) || CUSTOM_OPERATIONS[0];
    if ((current.groundOnly && custom.env !== 'ground') || custom.army > 0) custom.op = 'sortie';
    const sub = $('op-sub'); if (sub) sub.textContent = (CUSTOM_OPERATIONS.find(op => op.id === custom.op) || current).brief;
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
      b.onclick = () => {
        const changed = custom.map !== m.id;
        custom.map = m.id; custom.env = 'ground';
        if (custom.playerShip && shipById(custom.playerShip)?.env !== 'ground') custom.playerShip = null;
        normalizeCustomRosterForEnvironment();
        normalizeCustomSidesForPlayer();
        if (changed) applyRecommendedMapForces(m);
        renderCustom();
      }; // maps are ground-only; authored scenarios can load their canonical force package
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
    const friendlyFaction = customPlayerFaction();
    const faction = team === 'enemy' ? opposingFaction(friendlyFaction) : friendlyFaction;
    const shortFaction = faction === 'ZEON' ? 'Z' : 'F';
    const deployedRows = [];
    arr.forEach((entry, rowIndex) => {
      if (CUSTOM_PROP_IDS.has(entry.id)) return;
      for (let unit = 0; unit < entry.n && deployedRows.length < PER_SIDE_CAP; unit++)
        deployedRows.push({ rowIndex, id: entry.id, requestedSquad: entry.squad || 0, ...customSquadTraits(entry.id) });
    });
    const mobileSuitRows = deployedRows.filter(unit => !suitById(unit.id).air);
    const squadRows = new Map();
    for (const assignment of assignRequestedSquadIds(mobileSuitRows, faction)){
      if (!squadRows.has(assignment.rowIndex)) squadRows.set(assignment.rowIndex, new Set());
      squadRows.get(assignment.rowIndex).add(Number(assignment.squadId.split('-').at(-1)));
    }
    arr.forEach((entry, i) => {
      if (!entry.pos) entry.pos = defaultPos(team, i);           // ensure every entry has a map spawn point
      const row = el('div', 'enemy-row');
      const badge = el('span', 'mk', '' + (i + 1));              // numbered to match this entry's marker on the map
      badge.style.color = team === 'enemy' ? '#ff5d5d' : '#49d67a';
      row.appendChild(badge);
      const sel = document.createElement('select');
      const canonicalShipFaction = faction;
      for (const s of [
        ...SUITS.filter(unit => unit.faction === faction), ...AIRCRAFT.filter(unit => unit.faction === faction),
        ...MOBILE_ARMORS.filter(unit => unit.faction === canonicalShipFaction),
        ...SHIPS.filter(ship => ship.faction === canonicalShipFaction && ship.env === custom.env),
        ...(custom.env === 'ground' ? STATIONARY_BATTERIES.filter(battery => battery.faction === canonicalShipFaction) : []),
      ]){
        const o = document.createElement('option');
        const mobileArmorStats = mobileArmorProfile(s.id);
        const shipStats = landshipProfile(s.id) || spaceShipProfile(s.id);
        const battery = STATIONARY_BATTERY_IDS.has(s.id);
        o.value = s.id; o.textContent = `${MOBILE_ARMOR_IDS.has(s.id) ? '◉ ' : SHIP_IDS.has(s.id) ? '⚓ ' : battery ? '▣ ' : s.air ? '✈ ' : ''}${s.name} (${s.faction})${mobileArmorStats ? ` · ${mobileArmorStats.dimensions} · ${mobileArmorStats.hp.toLocaleString()} HP · SPD ${mobileArmorStats.speed} · ${mobileArmorStats.turretCount} HARDPOINTS / ${mobileArmorStats.activeTurretLimit} ACTIVE` : shipStats ? ` · ${shipStats.hp.toLocaleString()} HP · SPD ${shipStats.speed} · RNG ${shipStats.mainRange}` : battery ? ` · ${s.code}` : ''}`; o.selected = s.id === entry.id;
        sel.appendChild(o);
      }
      const maxForEntry = () => ENTRY_MAX;
      sel.onchange = () => {
        entry.id = sel.value; entry.n = Math.min(entry.n, maxForEntry());
        renderCustom();
      };
      row.appendChild(sel);
      const cnt = document.createElement('input');               // how many of this unit to field
      cnt.type = 'number'; cnt.min = '1'; cnt.max = '' + maxForEntry(); cnt.value = Math.min(entry.n, maxForEntry()); cnt.title = 'count';
      cnt.oninput = () => {
        const next = Math.round(Number(cnt.value));
        if (Number.isFinite(next) && next >= 1) entry.n = Math.min(maxForEntry(), next);
      };
      cnt.onchange = () => { entry.n = Math.max(1, Math.min(maxForEntry(), Math.round(+cnt.value || 1))); renderCustom(); };
      row.appendChild(cnt);
      const suit = CUSTOM_PROP_IDS.has(entry.id) ? null : suitById(entry.id);
      const squadNumbers = [...(squadRows.get(i) || [])].sort((a, b) => a - b);
      const squadPick = document.createElement('select');
      squadPick.className = 'squad-pick';
      const nonSquad = MOBILE_ARMOR_IDS.has(entry.id) ? 'MOBILE ARMOR'
        : SHIP_IDS.has(entry.id) ? 'SHIP'
        : STATIONARY_BATTERY_IDS.has(entry.id) ? 'BATTERY'
        : suit?.air ? 'AIR' : !squadNumbers.length ? 'CAP' : null;
      if (nonSquad){
        const option = document.createElement('option'); option.textContent = nonSquad; option.value = '0';
        squadPick.appendChild(option); squadPick.disabled = true;
      } else {
        const automatic = document.createElement('option');
        automatic.value = '0'; automatic.textContent = squadNumbers.length === 1
          ? `AUTO · ${shortFaction}-${squadNumbers[0]}` : `AUTO · ${shortFaction}-${squadNumbers[0]}–${squadNumbers.at(-1)}`;
        squadPick.appendChild(automatic);
        for (let squad = 1; squad <= CUSTOM_SQUAD_COUNT; squad++){
          const option = document.createElement('option');
          option.value = '' + squad; option.textContent = `SQUAD ${squad}`; option.selected = Number(entry.squad) === squad;
          squadPick.appendChild(option);
        }
        squadPick.onchange = () => { entry.squad = Math.max(0, Math.trunc(Number(squadPick.value)) || 0); renderCustom(); };
      }
      squadPick.title = squadNumbers.length
        ? `Assigned to ${faction}-${squadNumbers[0]}${squadNumbers.length > 1 ? ` through ${faction}-${squadNumbers.at(-1)}` : ''}`
        : MOBILE_ARMOR_IDS.has(entry.id) ? 'Mobile armor — independent heavy combat unit deployable in every environment'
        : SHIP_IDS.has(entry.id) ? 'Capital ship — outside the mobile-suit squad net'
        : STATIONARY_BATTERY_IDS.has(entry.id) ? 'Stationary artillery — position set by its numbered deployment marker'
        : suit?.air ? 'Aircraft flight — outside the ground mobile-suit squad net' : `Outside the ${PER_SIDE_CAP}-unit deployment cap`;
      row.appendChild(squadPick);
      const x = el('span', 'x', '✕');
      x.onclick = () => { arr.splice(i, 1); renderCustom(); };
      row.appendChild(x);
      box.appendChild(row);
    });
    const count = $(`${team}-roster-count`);
    const squadCount = new Set([...squadRows.values()].flatMap(ids => [...ids])).size;
    if (count) count.textContent = `${arr.length} / ${ROWS_MAX} TYPES · ${squadCount} SQUADS`;
    return { faction };
  };
  mkList('enemy-list', custom.enemies, 'enemy');
  mkList('ally-list', custom.allies, 'ally');
  const squadWarning = $('squad-warning');
  if (squadWarning){
    const massBattle = custom.army > 0;
    squadWarning.classList.remove('error');
    squadWarning.textContent = massBattle ? 'Mass Battle uses automatic 5–7 MS squads.'
      : 'Manual squads have no member cap. AUTO examines the formation and builds balanced squads of no more than 7 units.';
  }
  const capitalAllowed = custom.env === 'ground' || custom.env === 'space';
  const enemyCapitalButton = $('btn-add-enemy-landships');
  const allyCapitalButton = $('btn-add-ally-landships');
  const friendlyFaction = customPlayerFaction(), hostileFaction = opposingFaction(friendlyFaction);
  enemyCapitalButton.textContent = custom.env === 'space' ? `+ ${hostileFaction === 'FED' ? 'EFSF' : 'ZEON'} SPACE SHIP GROUP ×3` : `+ ${hostileFaction} LANDSHIP GROUP ×3`;
  allyCapitalButton.textContent = custom.env === 'space' ? `+ ${friendlyFaction === 'FED' ? 'EFSF' : 'ZEON'} SPACE SHIP GROUP ×3` : `+ ${friendlyFaction} LANDSHIP GROUP ×3`;
  enemyCapitalButton.hidden = !capitalAllowed;
  allyCapitalButton.hidden = !capitalAllowed;
  enemyCapitalButton.disabled = !capitalAllowed || custom.enemies.length >= ROWS_MAX;
  allyCapitalButton.disabled = !capitalAllowed || custom.allies.length >= ROWS_MAX;
  $('btn-add-enemy').disabled = custom.enemies.length >= ROWS_MAX;
  $('btn-add-ally').disabled = custom.allies.length >= ROWS_MAX;
  $('btn-launch-custom').disabled = custom.army === 0 && !custom.enemies.length;
  // right column: spinning model + stat readout + deployment map
  renderCustomLoadout();
  renderCustomHoverCraft();
  const loadout = custom.loadouts[custom.suit] || null;
  const primaryHeavy = custom.playerMobileArmor || custom.playerShip;
  msPreview.setSuit(custom.suit, loadout, primaryHeavy);
  if (primaryHeavy){
    renderShipStats(primaryHeavy);
    if (custom.playerMobileArmor){
      const reserve = suitById(custom.suit);
      $('ms-stats').insertAdjacentHTML('beforeend', `<div class="wl">SECONDARY MS ON DESTRUCTION<br>▸ <b>${reserve.name}</b><br>▸ ${reserve.code}</div>`);
    }
  }
  else renderMsStats(applyWeaponLoadout(suitById(custom.suit), loadout));
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
$('btn-add-enemy').onclick = () => { if (custom.enemies.length < ROWS_MAX){ custom.enemies.push({ id: opposingFaction(customPlayerFaction()) === 'FED' ? 'gm' : 'zaku2', n: 1, pos: defaultPos('enemy', custom.enemies.length) }); renderCustom(); } };
$('btn-add-enemy-landships').onclick = () => {
  const faction = opposingFaction(customPlayerFaction());
  const kind = custom.env === 'space' ? (faction === 'FED' ? 'salamis' : 'musai')
    : custom.env === 'ground' ? (faction === 'FED' ? 'bigtray' : 'dabude') : null;
  if (kind && custom.enemies.length < ROWS_MAX){
    custom.enemies.push({ id: kind, n: 3, pos: defaultPos('enemy', custom.enemies.length) });
    renderCustom();
  }
};
$('btn-clear-enemy').onclick = () => { custom.enemies = []; renderCustom(); };
$('btn-add-ally').onclick = () => { if (custom.allies.length < ROWS_MAX){ custom.allies.push({ id: customPlayerFaction() === 'FED' ? 'gm' : 'zaku2', n: 1, pos: defaultPos('ally', custom.allies.length) }); renderCustom(); } };
$('btn-add-ally-landships').onclick = () => {
  const faction = customPlayerFaction();
  const kind = custom.env === 'space' ? (faction === 'FED' ? 'salamis' : 'musai')
    : custom.env === 'ground' ? (faction === 'FED' ? 'bigtray' : 'dabude') : null;
  if (kind && custom.allies.length < ROWS_MAX){
    custom.allies.push({ id: kind, n: 3, pos: defaultPos('ally', custom.allies.length) });
    renderCustom();
  }
};
$('btn-clear-ally').onclick = () => { custom.allies = []; renderCustom(); };
// foldable readout / map accordion — at most ONE panel open, so the preview column never scrolls.
// Toggling: click an open header/button to fold it away; opening one folds the other.
function setFold(which, forceOpen = false){
  const p = $('fold-' + which); if (!p) return;
  const willOpen = forceOpen || !p.classList.contains('open');
  for (const w of ['readout', 'map']){ const q = $('fold-' + w); if (q) q.classList.toggle('open', w === which && willOpen); }
  if (which === 'map' && willOpen) spawnMap.show();        // draw once the canvas has real dimensions
}
document.querySelectorAll('#menu-custom .fold-h').forEach(h => h.addEventListener('click', () => setFold(h.dataset.fold)));
$('btn-fold-readout').addEventListener('click', () => setFold('readout'));
$('btn-fold-map').addEventListener('click', () => setFold('map'));
$('btn-launch-custom').onclick = () => {
  const rng = new RNG('custom' + Date.now());
  const playerFaction = customPlayerFaction(), enemyFaction = opposingFaction(playerFaction);
  // a land-only suit can't deploy in space — drop the sortie to the surface
  let env = custom.env;
  if (!custom.playerShip && !custom.playerMobileArmor && env === 'space' && !hoverCraftSpaceCapable(suitById(custom.suit), custom.hoverCrafts[custom.suit])){
    env = 'ground';
    modal('GROUND-ONLY UNIT', `${suitById(custom.suit).name} cannot operate in space. Sortie redirected to a planetary surface.`, [{ label: 'UNDERSTOOD' }]);
  }
  const activeMap = custom.map ? MAPS.find(m => m.id === custom.map) : null;
  if (activeMap) env = 'ground'; // named battlefields are ground-only
  // mass battle: generate N-per-side armies from random pools; otherwise use the manual lists
  const zPool = ['zaku2', 'zaku2b', 'gouf', 'dom', 'gelgoog', 'goufnh', 'acguy', 'weasel', 'weasel'];
  const enemyPool = enemyFaction === 'FED' ? ARMY_FED : zPool;
  const allyPool = playerFaction === 'FED' ? ARMY_FED : zPool;
  // expand the { id, n, pos } entries into a flat { id, pos } list, capped per side (LOD keeps big fields performant)
  const enemyEx = expandCustomRoster(custom.enemies), allyEx = expandCustomRoster(custom.allies);
  const assignGroundSquads = (specs, faction) => {
    const ground = assignRequestedSquadIds(specs.filter(spec => !suitById(spec.suitId).air)
      .map(spec => ({ ...spec, ...customSquadTraits(spec.suitId) })), faction);
    let groundIndex = 0;
    return specs.map(spec => suitById(spec.suitId).air ? spec : ground[groundIndex++]);
  };
  const enemySpecs = custom.army > 0
    ? Array.from({ length: custom.army }, () => ({ suitId: rng.pick(enemyPool), ace: rng.chance(0.04) }))
    : enemyEx.filter(o => !CUSTOM_PROP_IDS.has(o.id)).map(o => ({ suitId: o.id, pos: o.pos, requestedSquad: o.requestedSquad }));
  const allySpecs = custom.army > 0
    ? Array.from({ length: custom.army - 1 }, () => ({ suitId: rng.pick(allyPool) }))
    : allyEx.filter(o => !CUSTOM_PROP_IDS.has(o.id)).map(o => ({ suitId: o.id, pos: o.pos, requestedSquad: o.requestedSquad }));
  const enemies = assignGroundSquads(enemySpecs, enemyFaction);
  const allies = assignGroundSquads(allySpecs, playerFaction);
  // Capital hulls retain canonical faction identity. Each roster follows the selected
  // player's faction, including when the player launches aboard a Zeon hull.
  const customShips = custom.army > 0 ? [] : [
    ...enemyEx.filter(o => SHIP_IDS.has(o.id) || MOBILE_ARMOR_IDS.has(o.id)),
    ...allyEx.filter(o => SHIP_IDS.has(o.id) || MOBILE_ARMOR_IDS.has(o.id)),
  ].map(o => ({
    kind: o.id,
    team: (shipById(o.id) || mobileArmorById(o.id)).faction,
    pos: o.pos ? {
      x: o.pos.x + ((o.formationIndex % 3) - 1) * (custom.env === 'space' ? 130 : 90),
      z: o.pos.z + Math.floor(o.formationIndex / 3) * (custom.env === 'space' ? 110 : 80),
    } : null,
  }));
  if (custom.playerShip) customShips.unshift({
    kind: custom.playerShip,
    team: playerFaction,
    playerControlled: true,
    pos: { ...custom.spawn.player },
  });
  if (custom.playerMobileArmor) customShips.unshift({
    kind: custom.playerMobileArmor,
    team: playerFaction,
    playerControlled: true,
    pos: { ...custom.spawn.player },
  });
  const customBatteries = custom.army > 0 ? [] : [
    ...enemyEx.filter(o => STATIONARY_BATTERY_IDS.has(o.id)),
    ...allyEx.filter(o => STATIONARY_BATTERY_IDS.has(o.id)),
  ].map(o => ({ team: stationaryBatteryById(o.id).faction, pos: o.pos }));
  const stagedOp = CUSTOM_OPERATIONS.find(op => op.id === custom.op && op.id !== 'sortie');
  const staged = stagedOp && custom.army === 0 && !(stagedOp.groundOnly && env !== 'ground') ? stagedOp : null;
  runBattle({
    env,
    biome: custom.biome === 'random' ? rng.pick(BIOME_LIST) : custom.biome,
    mapId: activeMap ? activeMap.id : null,     // authored battlefield
    terrainSeed: custom.terrainSeed,            // the exact seed previewed on the deployment map → WYSIWYG terrain
    playerSuitId: custom.suit, playerHp: 1, playerLoadout: custom.loadouts[custom.suit] || null,
    playerTeam: playerFaction, playerShipKind: custom.playerShip,
    ...(custom.playerMobileArmor ? { playerShipKind: custom.playerMobileArmor } : {}),
    playerMobileArmorKind: custom.playerMobileArmor,
    hoverCraft: !custom.playerShip && !custom.playerMobileArmor && hoverCraftEquipped(suitById(custom.suit), custom.hoverCrafts[custom.suit]),
    enemies, allies,
    spawn: custom.army > 0 ? null : custom.spawn, // deployment-map centres (manual sorties only; mass battle keeps its own spread)
    mission: staged
      ? { type: staged.id, customShips, customBatteries, tuning: localQaTuning() }
      : { aircraftCore: true, customShips, customBatteries }, // fielded fighters, landships and batteries count toward the win
    objective: staged ? `CUSTOM OPERATION — ${staged.name}`
      : custom.army > 0 ? `MASS BATTLE — ${custom.army} HOSTILES`
      : activeMap ? activeMap.mission.summary : 'CUSTOM SORTIE — DESTROY ALL HOSTILES',
  }, () => show('menu-custom'));
};

// ---------- boot ----------
refreshContinue();
show('menu-main');
