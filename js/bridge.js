// ---------- the bridge: campaign hub ----------
// Star map (snapshot intel — worlds are shown as last observed, not as they
// are), operations/contracts, hangar, ship refit, crew management, war intel.
import * as THREE from 'three';
import { el, ucDate, fmtCr, RNG } from './util.js';
import { suitById, AIRCRAFT, isAircraft, SHIP_MODULES, CREW_ROLES, TIMELINE } from './data.js';
import {
  worldById, dist, controlOf, materialize, dematerialize, intelRadius,
  shipSpeed, maxHull, hangarBays, airCap, crewCap, simDay, news, applyOutcome,
  rollSalvage, activeWorldCount, zeonPoolFor, WORLD_COUNT,
} from './galaxy.js';

const $ = id => document.getElementById(id);
const TABS = ['STAR MAP', 'OPERATIONS', 'HANGAR', 'SHIP', 'CREW', 'INTEL'];
let ctx = null, tab = 'STAR MAP', selectedId = null;

export function enterBridge(c){
  ctx = c;
  $('bridge').classList.remove('hidden');
  // a save made mid-journey (e.g. before an ambush) leaves a pending course —
  // resume it, otherwise the ship is stranded with travel locked out forever
  if (ctx.S.travel){
    if (ctx.S.travel.target === ctx.S.locId || !worldById(ctx.S, ctx.S.travel.target)){
      ctx.S.travel = null;
    } else {
      news(ctx.S, 'Resuming course — drives back to full burn.');
      stepTravel();
      return;
    }
  }
  const here = worldById(ctx.S, ctx.S.locId);
  here.visited = true;
  materialize(ctx.S, here);
  renderTabs();
  refreshBridge();
}

export function leaveBridge(){
  stopShipView();
  $('bridge').classList.add('hidden');
}

export function refreshBridge(){
  topbar();
  renderNews();
  renderPane();
}

function topbar(){
  const S = ctx.S;
  $('b-date').textContent = ucDate(S.day);
  $('b-loc').textContent = '⌖ ' + (S.travel ? 'IN TRANSIT' : worldById(S, S.locId).name);
  $('b-credits').textContent = fmtCr(S.credits);
  $('b-hull').textContent = `HULL ${Math.round(S.hull)}/${maxHull(S)}`;
}

function renderTabs(){
  const box = $('bridge-tabs'); box.innerHTML = '';
  for (const t of TABS){
    const b = el('button', t === tab ? 'sel' : '', t);
    b.onclick = () => { tab = t; renderTabs(); renderPane(); };
    box.appendChild(b);
  }
}

function renderNews(){
  const box = $('b-news'); box.innerHTML = '';
  const items = ctx.S.news.slice(-40).reverse();
  for (const n of items){
    const d = el('div', n.cls);
    d.innerHTML = `<span class="day">${ucDate(n.day)}</span> — ${n.text}`;
    box.appendChild(d);
  }
}

function renderPane(){
  stopShipView();
  const pane = $('bridge-pane'); pane.innerHTML = '';
  ({ 'STAR MAP': paneMap, OPERATIONS: paneOps, HANGAR: paneHangar, SHIP: paneShip, CREW: paneCrew, INTEL: paneIntel })[tab](pane);
}

// ---------- ship exterior view (SHIP tab) ----------
let shipView = null;

function stopShipView(){
  if (!shipView) return;
  cancelAnimationFrame(shipView.raf);
  shipView.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
  shipView.renderer.dispose();
  shipView = null;
}

// Pegasus-class assault carrier, White Base silhouette: twin forward hangar
// "legs", shoulder catapult decks, neck-mounted bridge, twin drive block.
function buildShipMesh(S){
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.5, metalness: 0.35 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x2456b8, roughness: 0.5, metalness: 0.35 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc23a30, roughness: 0.5, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x112233, emissive: 0x66aaff, emissiveIntensity: 1.2 + S.modules.engine * 0.6,
  });
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };
  // central hull + drive block
  box(10, 7, 28, white, 0, 0, -3);
  box(8, 5, 10, blue, 0, 0.5, -21);
  for (const sx of [-2.4, 2.4]){
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 3.5, 10), dark);
    noz.rotation.x = Math.PI / 2; noz.position.set(sx, 0.5, -27); g.add(noz);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 1.2, 10), glow);
    fl.rotation.x = Math.PI / 2; fl.position.set(sx, 0.5, -29); g.add(fl);
  }
  // neck + command bridge
  box(4, 5, 7, white, 0, 6, -7);
  box(8, 3.5, 6, blue, 0, 10, -6);
  box(6, 1.2, 3, white, 0, 12.3, -6);
  // forward hangar legs with red bow tips — MS bays live here
  for (const sx of [-8, 8]){
    box(6, 5, 20, white, sx, -4, 12);
    box(6.2, 5.2, 4, red, sx, -4, 24);
    box(2, 1.5, 10, blue, sx, -0.8, 12);
  }
  // shoulder catapult decks
  for (const sx of [-8.5, 8.5]){
    box(6.5, 2.2, 14, white, sx, 3.2, 0);
    box(6.5, 0.8, 4, dark, sx, 4.0, 6);
  }
  // gun turrets scale with SHIP BATTERIES level
  for (let i = 0; i < S.modules.guns * 2; i++){
    const sx = i % 2 === 0 ? -3 : 3, sz = 6 - Math.floor(i / 2) * 6;
    box(2.2, 1.2, 2.8, dark, sx, 4.2, sz);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 8), dark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(sx, 4.6, sz + 2.6); g.add(barrel);
  }
  // sensor mast scales with SENSOR ARRAY level
  const mastH = 3 + S.modules.radar * 1.5;
  box(0.4, mastH, 0.4, dark, 0, 12.3 + mastH / 2, -8);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1 + S.modules.radar * 0.3, 10, 8, 0, Math.PI), white);
  dish.position.set(0, 12.3 + mastH, -8); dish.rotation.x = -Math.PI / 2; g.add(dish);
  g.rotation.x = 0.1;
  return g;
}

function startShipView(canvas, S){
  stopShipView();
  const w = canvas.clientWidth || 720, h = 250;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(38, w / h, 0.1, 500);
  cam.position.set(0, 20, 72); cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0x9db8d8, 0x141b26, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.5);
  sun.position.set(50, 60, 40); scene.add(sun);
  const ship = buildShipMesh(S);
  scene.add(ship);
  const view = { renderer, scene, raf: 0 };
  const tick = () => {
    ship.rotation.y += 0.005;
    renderer.render(scene, cam);
    view.raf = requestAnimationFrame(tick);
  };
  tick();
  shipView = view;
}

// ================= STAR MAP =================
function paneMap(pane){
  const S = ctx.S;
  const wrap = el('div', 'map-wrap');
  const cv = el('canvas'); cv.id = 'starmap'; cv.width = 820; cv.height = 560;
  const side = el('div', 'map-side');
  wrap.appendChild(cv); wrap.appendChild(side); pane.appendChild(wrap);

  const here = worldById(S, S.locId);
  const scale = Math.min(cv.width, cv.height) / 1190;
  const toPx = w => [cv.width / 2 + w.x * scale, cv.height / 2 + w.z * scale];

  function draw(){
    const g = cv.getContext('2d');
    g.fillStyle = '#04060b'; g.fillRect(0, 0, cv.width, cv.height);
    g.save();
    // sensor bubble
    const [hx, hy] = toPx(here);
    g.strokeStyle = 'rgba(74,163,255,.25)'; g.setLineDash([4, 5]);
    g.beginPath(); g.arc(hx, hy, intelRadius(S) * scale, 0, 7); g.stroke();
    g.setLineDash([]);
    // travel line
    if (selectedId && selectedId !== S.locId){
      const t = worldById(S, selectedId); const [tx, ty] = toPx(t);
      g.strokeStyle = 'rgba(255,210,74,.5)'; g.setLineDash([3, 6]);
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    }
    for (const w of S.worlds){
      const [x, y] = toPx(w);
      const known = w.lastSeen >= 0;
      const ctl = known ? w.snap.control : null;
      g.fillStyle = !known ? 'rgba(110,130,150,.35)'
        : ctl === 'FED' ? '#4aa3ff' : ctl === 'ZEON' ? '#ff5d5d'
        : ctl === 'CONTESTED' ? '#ffd24a' : '#8c9aa8';
      const r = w.canon ? 4 : 2.6;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (w.canon && known){
        g.fillStyle = 'rgba(207,228,247,.75)'; g.font = '9px monospace';
        g.fillText(w.name, x + 6, y + 3);
      }
      if (w.id === S.locId){
        g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.stroke();
      }
      if (w.id === selectedId){
        g.strokeStyle = '#ffd24a'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.stroke();
      }
    }
    g.restore();
  }

  cv.onclick = e => {
    const rect = cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (cv.width / rect.width);
    const my = (e.clientY - rect.top) * (cv.height / rect.height);
    let best = null, bd = 14;
    for (const w of S.worlds){
      const [x, y] = toPx(w);
      const d = Math.hypot(x - mx, y - my);
      if (d < bd){ bd = d; best = w; }
    }
    if (best){ selectedId = best.id; draw(); sidePanel(); }
  };

  function sidePanel(){
    side.innerHTML = '';
    const info = el('div', 'panel');
    if (!selectedId){
      info.innerHTML = `<div class="h">FRONTIER SPHERE</div>
        <div class="kv"><span>CHARTED WORLDS</span><b>${WORLD_COUNT}</b></div>
        <div class="kv"><span>MATERIALIZED (EXIST NOW)</span><b>${activeWorldCount()}</b></div>
        <div class="kv"><span>DORMANT (STATISTICAL)</span><b>${WORLD_COUNT - activeWorldCount()}</b></div>
        <div style="margin-top:8px;color:var(--dim);font-size:10px;line-height:1.6">
        Worlds outside your sensor bubble are simulated statistically and shown
        as last observed. They only fully exist while you stand on them.<br><br>
        Select a world to plot a course.</div>`;
      side.appendChild(info); return;
    }
    const w = worldById(S, selectedId);
    const known = w.lastSeen >= 0;
    const stale = S.day - w.lastSeen;
    const d = dist(w, here);
    const eta = Math.max(1, Math.ceil(d / shipSpeed(S)));
    info.innerHTML = `<div class="h">${known ? w.name : 'UNCHARTED SIGNAL'}</div>
      <div class="kv"><span>TYPE</span><b>${known ? w.type.toUpperCase() : '???'}</b></div>
      <div class="kv"><span>CONTROL</span><b class="ctl-${known ? w.snap.control : ''}">${known ? w.snap.control : 'UNKNOWN'}</b></div>
      <div class="kv"><span>GARRISON (FED/ZEON)</span><b>${known ? w.snap.fed + ' / ' + w.snap.zeon : '??? / ???'}</b></div>
      <div class="kv"><span>INTEL</span><b>${!known ? 'NONE' : stale === 0 ? 'LIVE' : stale + ' DAYS STALE'}</b></div>
      <div class="kv"><span>DISTANCE</span><b>${Math.round(d)} Mm</b></div>
      <div class="kv"><span>ETA</span><b>${eta} DAY${eta > 1 ? 'S' : ''}</b></div>`;
    side.appendChild(info);
    if (w.id !== S.locId && !S.travel){
      const go = el('button', 'big accent', `▸ PLOT COURSE — ${eta} DAY${eta > 1 ? 'S' : ''}`);
      go.onclick = () => beginTravel(w.id, eta);
      side.appendChild(go);
    }
  }

  draw(); sidePanel();
}

// ================= TRAVEL =================
function beginTravel(targetId, eta){
  const S = ctx.S;
  const t = worldById(S, targetId);
  const wages = S.crew.reduce((a, c) => a + c.wage, 0);
  ctx.modal('PLOT COURSE',
    `Course to ${t.lastSeen >= 0 ? t.name : 'uncharted signal'}.\nETA ${eta} days · crew wages ${fmtCr(wages * eta)} en route.\nInterception risk in contested space.`,
    [{ label: 'DEPART', cls: 'accent', fn: () => {
      dematerialize(worldById(S, S.locId)); // the world you leave stops existing
      S.travel = { target: targetId, left: eta };
      stepTravel();
    } }, { label: 'CANCEL' }]);
}

export function stepTravel(){
  const S = ctx.S;
  while (S.travel && S.travel.left > 0){
    simDay(S);
    S.travel.left--;
    const rng = new RNG(S.seed + ':amb:' + S.day);
    let p = 0.06;
    if (S.flags.charHunts && !S.flags.charDown) p += 0.05;
    const scout = S.crew.find(c => c.role === 'scout' && c.job === 'ROUTE PLOTTING');
    if (scout) p -= scout.skill * 0.009;
    if (S.travel.left > 0 && rng.chance(Math.max(0.01, p))){
      const isChar = S.flags.charHunts && !S.flags.charDown && rng.chance(0.4);
      const pool = zeonPoolFor(S.day);
      const enemies = isChar
        ? [{ suitId: 'zaku2s', ace: true, name: 'CRIMSON LIGHTNING' }]
        : Array.from({ length: rng.int(2, 3) }, () => ({ suitId: rng.pick(pool) }));
      news(S, isChar ? 'A crimson mobile suit is closing fast. Three times the normal speed…' : 'Zeon patrol on intercept course.', 'warn');
      ctx.save();
      // a space interception can't be answered by a land-only active suit — fly a
      // space-capable frame from the hangar, or let the carrier's batteries handle it
      let flyId = S.active;
      if (suitById(flyId).groundOnly){
        const alt = S.suits.find(s => !suitById(s.id).groundOnly && s.hp >= 0.15);
        if (alt) flyId = alt.id;
        else {
          S.hull = Math.max(1, S.hull - (isChar ? 40 : 18));
          news(S, `Only ground units aboard — the ${S.shipName}'s batteries drove off the attackers. Hull took damage.`, 'warn');
          stepTravel();
          return;
        }
      }
      launchSortie({
        env: 'space', objective: isChar ? 'SURVIVE THE RED COMET' : 'REPEL INTERCEPTORS',
        enemies, allies: [], playerSuitId: flyId,
      }, res => {
        if (res.victory){
          S.credits += 400 + res.kills * 250;
          if (isChar){ S.flags.charDown = true; S.renown += 6; news(S, 'The Crimson Lightning withdraws, trailing fire. Bounty collected.', 'good'); }
          else news(S, `Interceptors destroyed. Bounty ${fmtCr(400 + res.kills * 250)}.`, 'good');
        } else if (!res.retreat){
          S.credits -= 1200;
          news(S, 'Driven off by interceptors. Suit recovered by the crew.', 'warn');
        }
        stepTravel();
      });
      return;
    }
  }
  if (S.travel){
    S.locId = S.travel.target;
    S.travel = null;
    const w = worldById(S, S.locId);
    w.visited = true; w.lastSeen = S.day;
    w.snap = { fed: Math.round(w.fed), zeon: Math.round(w.zeon), control: controlOf(w) };
    materialize(S, w);
    news(S, `Arrived at ${w.name}. World materialized: garrison, contracts and population now exist.`);
    ctx.save();
  }
  selectedId = null;
  enterBridge(ctx);
}

// ================= OPERATIONS =================
function paneOps(pane){
  const S = ctx.S;
  const w = worldById(S, S.locId);
  const d = materialize(S, w);
  const ctl = controlOf(w);

  const head = el('div', 'panel');
  head.innerHTML = `<div class="h">${w.name} — ${ctl}</div>
    <div style="font-size:12px;line-height:1.7;color:var(--txt)">${d.desc}</div>
    <div class="kv" style="margin-top:6px"><span>LOCAL GARRISON (FED / ZEON)</span><b>${Math.round(w.fed)} / ${Math.round(w.zeon)}</b></div>`;
  pane.appendChild(head);
  pane.appendChild(el('h3', '', 'AVAILABLE OPERATIONS'));

  if (!d.contracts.length)
    pane.appendChild(el('div', 'row-card', 'No operations available here at present.'));

  for (const c of d.contracts){
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', c.title));
    grow.appendChild(el('div', 'sub', `${c.desc}`));
    grow.appendChild(el('div', 'sub', `THEATER: ${c.env.toUpperCase()} · HOSTILES: ${c.enemies.length} · ALLIES: ${c.allies.length} · RISK: ${'☠'.repeat(c.danger)}`));
    card.appendChild(grow);
    card.appendChild(el('div', '', fmtCr(c.pay)));
    const go = el('button', 'accent', 'LAUNCH');
    go.onclick = () => confirmLaunch(w, d, c);
    card.appendChild(go);
    pane.appendChild(card);
  }
}

function confirmLaunch(w, d, c){
  const S = ctx.S;
  const suit = S.suits.find(s => s.id === S.active);
  if (!suit){ ctx.modal('NO ACTIVE UNIT', 'Assign an active mobile suit in the HANGAR first.', [{ label: 'OK' }]); return; }
  if (suit.hp < 0.15){ ctx.modal('UNIT NOT COMBAT-READY', 'Your active suit is below 15% integrity. Repair it in the HANGAR.', [{ label: 'OK' }]); return; }
  if (c.env === 'space' && suitById(S.active).groundOnly){
    ctx.modal('GROUND-ONLY UNIT', `${suitById(S.active).name} cannot operate in space. This is a space operation — switch to a space-capable suit in the HANGAR.`, [{ label: 'OK' }]); return;
  }
  const solo = !!(c.mission && c.mission.solo);          // lone-wolf contracts: no hangar support launches
  const nWing = solo ? 0 : S.suits.filter(s => s !== suit && s.hp >= 0.2).length;
  ctx.modal(c.title, `Sortie in ${suitById(S.active).name} (${Math.round(suit.hp * 100)}% integrity)?\n`
    + (nWing ? `${nWing} hangar unit${nWing > 1 ? 's' : ''} will launch alongside you.\n` : solo ? 'SOLO SORTIE — no support will launch.\n' : '')
    + `Reward: ${fmtCr(c.pay)}`,
    [{ label: 'SORTIE', cls: 'accent', fn: () => {
      if (c.kind === 'INVASION'){ launchInvasion(w, d, c); return; }
      if (c.kind === 'SOLOMON'){ launchSolomon(w, d, c); return; }
      const gunner = S.crew.find(cr => cr.role === 'gunner' && cr.job === 'FIRE SUPPORT');
      const bigOp = ['ASSAULT', 'HOLD', 'FINALE', 'DEFEND'].includes(c.kind);
      launchSortie({
        env: c.env, biome: w.biome, terrainSeed: d.terrainSeed,
        objective: c.title.split('·')[0].trim(),
        enemies: c.enemies, allies: c.allies, mission: c.mission,
        sim: bigOp ? { fed: w.fed, zeon: w.zeon } : null,
        zeonPool: zeonPoolFor(S.day),
        shipSupport: gunner && S.modules.guns > 0 ? S.modules.guns : 0,
        shipName: S.shipName, finale: c.kind === 'FINALE',
      }, res => settle(w, c, res));
    } }, { label: 'ABORT' }]);
}

// shared post-battle settlement: outcome, salvage, save, back to the bridge
function settle(w, c, res){
  const S = ctx.S;
  applyOutcome(S, w, c, res);
  const rng = new RNG(S.seed + ':sal:' + S.day + ':' + res.kills);
  if (res.victory){
    const sal = rollSalvage(S, res.destroyedIds, rng);
    if (sal?.captured?.length) news(S, sal.captured.length > 1
      ? `Massive haul — salvage crews recovered ${sal.captured.length} intact machines: ${sal.captured.join(', ')}! Added at 30% integrity.`
      : `Salvage crew recovered an intact ${sal.captured[0]}! Added to the hangar at 30% integrity.`, 'good');
    if (sal?.scrapped?.length) news(S, `Recovered ${sal.scrapped.join(', ')} wreck${sal.scrapped.length > 1 ? 's' : ''} scrapped for ${fmtCr(sal.cr)}.`, 'good');
  }
  if (c.kind === 'FINALE' && res.victory){ ctx.endCampaign(); return; }
  ctx.save();
  enterBridge(ctx);
}

// ================= INVASION: two-phase planetary liberation =================
// Phase 1 (orbit): sink the Musai picket with the Salamis at your side.
// Phase 2 (surface): surviving phase-1 allies drop with you, reinforced by
// 10 Type 61 tanks, against the occupation garrison (13 MS + 20 Magella).
function launchInvasion(w, d, c){
  const S = ctx.S;
  const gunner = S.crew.find(cr => cr.role === 'gunner' && cr.job === 'FIRE SUPPORT');
  const common = {
    biome: w.biome, terrainSeed: d.terrainSeed, zeonPool: zeonPoolFor(S.day),
    shipSupport: gunner && S.modules.guns > 0 ? S.modules.guns : 0,
    shipName: S.shipName,
  };
  launchSortie(Object.assign({}, common, {
    env: 'space',
    objective: 'INVASION 1/2 — BREAK THE BLOCKADE',
    enemies: c.enemies, allies: c.allies,
    mission: { type: 'shipkill', ship: 'musai', allyShip: 'salamis' },
  }), res1 => {
    if (!res1.victory){ settle(w, c, res1); return; }
    const survivors = (res1.allies || []).filter(a => a.alive)
      .map(a => ({ suitId: a.suitId, hpFrac: a.hpFrac }));
    const tanks = Array.from({ length: 10 }, () => ({ suitId: 'type61' }));
    const rng = new RNG(S.seed + ':inv:' + S.day);
    const pool = zeonPoolFor(S.day);
    const garrison = [
      ...Array.from({ length: 13 }, () => ({ suitId: rng.pick(pool), ace: rng.chance(0.08) })),
      ...Array.from({ length: 20 }, () => ({ suitId: 'magella' })),
    ];
    news(S, `Blockade at ${w.name} broken. ${survivors.length} allied units ready for the drop.`, 'good');
    ctx.save();
    ctx.modal('PHASE TWO — SURFACE ASSAULT',
      `The Musai is down and the drop corridor is open.\n${survivors.length} allied unit${survivors.length === 1 ? '' : 's'} from the orbital battle descend with you, and 10 Type 61 tanks land in support.\nOccupation garrison: 13 mobile suits, 20 Magella Attack tanks.`,
      [{ label: 'BEGIN THE DROP', cls: 'accent', fn: () => {
        launchSortie(Object.assign({}, common, {
          env: 'ground',
          objective: 'INVASION 2/2 — CRUSH THE GARRISON',
          enemies: garrison, allies: [...survivors, ...tanks],
          sim: { fed: w.fed, zeon: w.zeon },
          mission: { type: 'destroy' },
        }), res2 => {
          settle(w, c, {
            victory: res2.victory, retreat: res2.retreat,
            kills: res1.kills + res2.kills,
            destroyedIds: [...res1.destroyedIds, ...res2.destroyedIds],
            hpFrac: res2.hpFrac,
          });
        });
      } }]);
  });
}

// Operation Solomon: two-phase decisive battle — fleet engagement, then storm the fortress
function launchSolomon(w, d, c){
  const S = ctx.S;
  const gunner = S.crew.find(cr => cr.role === 'gunner' && cr.job === 'FIRE SUPPORT');
  const common = {
    biome: w.biome, terrainSeed: d.terrainSeed, zeonPool: zeonPoolFor(S.day),
    shipSupport: gunner && S.modules.guns > 0 ? S.modules.guns : 0,
    shipName: S.shipName,
  };
  launchSortie(Object.assign({}, common, {
    env: 'space', objective: 'SOLOMON 1/2 — BREAK THE FLEET',
    enemies: c.enemies, allies: c.allies, mission: c.mission,
  }), res1 => {
    if (!res1.victory){ settle(w, c, res1); return; }
    const survivors = (res1.allies || []).filter(a => a.alive).map(a => ({ suitId: a.suitId, hpFrac: a.hpFrac }));
    const fleetLeft = res1.allyFleet || {};                      // whatever hulls survived phase one sail on
    const nShips = Object.values(fleetLeft).reduce((a, b) => a + b, 0);
    // fewer than 3 surviving hulls stay back with the transports — a token remnant joining the
    // bombardment would just hand Zeon a 'FLEET IS LOST' defeat the moment the fortress focuses it
    const fleetJoins = nShips >= 3;
    // fresh assault wave staged for the storming: a company of standard assault GMs joins the drop
    const assaultGMs = Array.from({ length: 16 }, () => ({ suitId: 'gm' }));
    const rng = new RNG(S.seed + ':sol:' + S.day);
    const pool = zeonPoolFor(S.day);
    const garrison = [
      { suitId: 'gelgoogs', ace: true, name: 'FORTRESS COMMANDER' },
      { suitId: 'gelgoogs', ace: true, name: 'SOLOMON ACE' },
      ...Array.from({ length: 24 }, () => ({ suitId: 'gelgoog' })),
      ...Array.from({ length: 20 }, () => ({ suitId: 'zaku2' })),
      ...Array.from({ length: 8 }, () => ({ suitId: 'dom' })),
      ...Array.from({ length: 6 }, () => ({ suitId: rng.pick(pool) })),
    ];
    news(S, `The fleet screen is shattered. ${survivors.length} allied units and ${nShips} surviving hull${nShips === 1 ? '' : 's'} make the assault run on the fortress.`, 'good');
    ctx.save();
    ctx.modal('PHASE TWO — STORM SOLOMON',
      `The Zeon fleet is wreckage and the fortress lies exposed.\n${survivors.length} surviving unit${survivors.length === 1 ? '' : 's'} press the assault with you, reinforced by a fresh company of ${assaultGMs.length} assault GMs`
      + (fleetJoins ? `,\nand the ${nShips} surviving ships of the battle line move up to bombard the fortress.`
                    : nShips ? `.\n(The ${nShips} battered hull${nShips === 1 ? '' : 's'} left afloat hold${nShips === 1 ? 's' : ''} station with the transports.)` : '.')
      + '\nDestroy the Solomon fortress and break its garrison.',
      [{ label: 'STORM THE FORTRESS', cls: 'accent', fn: () => {
        launchSortie(Object.assign({}, common, {
          env: 'space', objective: 'SOLOMON 2/2 — BREAK THE FORTRESS',
          enemies: garrison, allies: [...survivors, ...assaultGMs],
          mission: { type: 'fleet', allyShips: fleetJoins ? fleetLeft : {}, enemyShips: { solfortress: 1 },
            winMsg: 'SOLOMON HAS FALLEN — THE WAR TURNS' },
        }), res2 => {
          settle(w, c, {
            victory: res2.victory, retreat: res2.retreat,
            kills: res1.kills + res2.kills,
            destroyedIds: [...res1.destroyedIds, ...res2.destroyedIds],
            hpFrac: res2.hpFrac,
          });
        });
      } }]);
  });
}

// launch a battle with the player's persistent suit state;
// every other combat-ready suit in the hangar sorties as a wingman
function launchSortie(opts, after){
  const S = ctx.S;
  const activeId = opts.playerSuitId || S.active;     // opts may override the suit (e.g. space-safe swap)
  const suit = S.suits.find(s => s.id === activeId);
  const solo = !!(opts.mission && opts.mission.solo);  // lone-wolf contract: the hangar stays home
  const wingmen = solo ? [] : S.suits.filter(s => s !== suit && s.hp >= 0.2);
  const airwing = solo ? [] : (S.air || []).filter(a => a.hp >= 0.2);   // the air wing sorties independently
  // war-production HP buff on ALL Federation capital ships: above ×1.0 production they get a flat
  // +700, then +1000 for every further +0.25 of production (Odessa/Jaburo/Solomon each raise it)
  const prod = S.mods.fed;
  const fedShipHp = prod > 1.0 ? 700 + 1000 * Math.floor((prod - 1.0) / 0.25 + 1e-6) : 0;
  leaveBridge();
  ctx.launchBattle(Object.assign({
    playerSuitId: activeId, playerHp: suit ? suit.hp : 1, fedShipHp,
    wingmen: wingmen.map((s, i) => ({ suitId: s.id, name: suitById(s.id).name.toUpperCase(), hpFrac: s.hp, wingId: i })),
    aircraft: airwing.map((a, i) => ({ suitId: a.id, name: suitById(a.id).name.toUpperCase(), hpFrac: a.hp, airId: i })),
  }, opts), res => {
    if (suit) suit.hp = res.victory || res.retreat ? Math.max(0.05, res.hpFrac) : 0.25;
    for (const wr of res.wing || []){
      const ws = wingmen[wr.wingId];
      if (ws) ws.hp = wr.alive ? Math.max(0.05, wr.hpFrac) : 0.08; // shot-down frames come home wrecked
    }
    for (const ar of res.aircraft || []){
      const a = airwing[ar.airId];
      if (a) a.hp = ar.alive ? Math.max(0.05, ar.hpFrac) : 0.08;   // downed fighters return as wrecks
    }
    after(res);
  });
}

// ================= HANGAR =================
const suitValue = s => s.cost || 32000;

function paneHangar(pane){
  const S = ctx.S;
  const w = worldById(S, S.locId);
  const d = materialize(S, w);
  const ctl = controlOf(w);
  const mech = S.crew.find(c => c.role === 'mechanic' && c.job === 'FIELD KIT');
  const qm = S.crew.find(c => c.role === 'quartermaster' && c.job === 'PROCUREMENT');
  const repDisc = mech ? 1 - mech.skill * 0.05 : 1;
  const buyDisc = qm ? 1 - qm.skill * 0.04 : 1;

  pane.appendChild(el('h3', '', `MS BAYS — ${S.suits.length}/${hangarBays(S)} OCCUPIED`));
  for (const su of S.suits){
    const def = suitById(su.id);
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', `${def.name} ${su.id === S.active ? ' — ACTIVE' : ''}`));
    grow.appendChild(el('div', 'sub', `${def.code} · INTEGRITY ${Math.round(su.hp * 100)}%`));
    const bar = el('div', 'statbar'); const fill = el('i');
    fill.style.width = su.hp * 100 + '%';
    fill.style.background = su.hp < 0.3 ? 'var(--zeon)' : 'var(--ok)';
    bar.appendChild(fill); grow.appendChild(bar);
    card.appendChild(grow);
    if (su.id !== S.active){
      const sel = el('button', 'small', 'SELECT');
      sel.onclick = () => { S.active = su.id; ctx.save(); renderPane(); };
      card.appendChild(sel);
    }
    if (su.hp < 1){
      const cost = Math.round((1 - su.hp) * suitValue(def) * 0.22 * repDisc);
      const rep = el('button', 'small', `REPAIR ${fmtCr(cost)}`);
      rep.disabled = S.credits < cost || ctl === 'ZEON';
      rep.onclick = () => { S.credits -= cost; su.hp = 1; ctx.save(); topbar(); renderPane(); };
      card.appendChild(rep);
    }
    if (def.cost > 0 && S.suits.length > 1){
      const price = Math.round(def.cost * 0.45 * su.hp);
      const sell = el('button', 'small', `SELL ${fmtCr(price)}`);
      sell.onclick = () => ctx.modal('SELL UNIT', `Sell ${def.name} for ${fmtCr(price)}?`, [
        { label: 'SELL', cls: 'accent', fn: () => {
          S.suits = S.suits.filter(x => x !== su);
          if (S.active === su.id) S.active = S.suits[0]?.id || null;
          S.credits += price; ctx.save(); topbar(); renderPane();
        } }, { label: 'CANCEL' }]);
      card.appendChild(sell);
    }
    pane.appendChild(card);
  }

  pane.appendChild(el('h3', '', 'LOCAL MARKET' + (qm ? ` (QUARTERMASTER −${qm.skill * 4}%)` : '')));
  if (ctl === 'ZEON') pane.appendChild(el('div', 'row-card', 'Hostile territory — no market access.'));
  else if (!d.market.length) pane.appendChild(el('div', 'row-card', 'No mobile suits for sale here at present.'));
  for (const m of d.market){
    const def = suitById(m.suitId);
    const price = Math.round(m.price * buyDisc);
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', def.name));
    grow.appendChild(el('div', 'sub', `${def.code} · ${def.faction} · HP ${def.hp} · BOOST ${def.boost}`));
    card.appendChild(grow);
    const buy = el('button', 'small accent', `BUY ${fmtCr(price)}`);
    buy.disabled = S.credits < price || S.suits.length >= hangarBays(S);
    buy.onclick = () => {
      S.credits -= price;
      S.suits.push({ id: m.suitId, hp: 1 });
      d.market = d.market.filter(x => x !== m);
      ctx.save(); topbar(); renderPane();
    };
    card.appendChild(buy);
    pane.appendChild(card);
  }

  // ---------- AIR WING (independent of MS bays) ----------
  if (!S.air) S.air = [];
  pane.appendChild(el('h3', '', `AIR WING — ${S.air.length}/${airCap(S)} SLOTS`));
  for (const ac of S.air){
    const def = suitById(ac.id);
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', def.name));
    grow.appendChild(el('div', 'sub', `${def.code} · FIGHTER · INTEGRITY ${Math.round(ac.hp * 100)}%`));
    const bar = el('div', 'statbar'); const fill = el('i');
    fill.style.width = ac.hp * 100 + '%';
    fill.style.background = ac.hp < 0.3 ? 'var(--zeon)' : 'var(--ok)';
    bar.appendChild(fill); grow.appendChild(bar);
    card.appendChild(grow);
    if (ac.hp < 1){
      const cost = Math.round((1 - ac.hp) * (def.cost || 6000) * 0.22 * repDisc);
      const rep = el('button', 'small', `REPAIR ${fmtCr(cost)}`);
      rep.disabled = S.credits < cost || ctl === 'ZEON';
      rep.onclick = () => { S.credits -= cost; ac.hp = 1; ctx.save(); topbar(); renderPane(); };
      card.appendChild(rep);
    }
    const price = Math.round(def.cost * 0.45 * ac.hp);
    const sell = el('button', 'small', `SELL ${fmtCr(price)}`);
    sell.onclick = () => ctx.modal('SCRAP FIGHTER', `Sell ${def.name} for ${fmtCr(price)}?`, [
      { label: 'SELL', cls: 'accent', fn: () => {
        S.air = S.air.filter(x => x !== ac);
        S.credits += price; ctx.save(); topbar(); renderPane();
      } }, { label: 'CANCEL' }]);
    card.appendChild(sell);
    pane.appendChild(card);
  }
  // aircraft hangar (Federation craft sell at any non-hostile port)
  if (ctl !== 'ZEON'){
    for (const def of AIRCRAFT){
      if (def.faction !== 'FED') continue;                  // cheap fighters: buy as many as you like, up to the bay cap
      const price = Math.round(def.cost * buyDisc);
      const card = el('div', 'row-card');
      const grow = el('div', 'grow');
      grow.appendChild(el('div', 'ttl', def.name + ' — FIGHTER'));
      grow.appendChild(el('div', 'sub', `${def.code} · HP ${def.hp} · SPEED ${def.boost} · missiles + vulcans`));
      card.appendChild(grow);
      const buy = el('button', 'small accent', `BUY ${fmtCr(price)}`);
      buy.disabled = S.credits < price || S.air.length >= airCap(S);
      buy.onclick = () => {
        S.credits -= price; S.air.push({ id: def.id, hp: 1 });
        ctx.save(); topbar(); renderPane();
      };
      card.appendChild(buy);
      pane.appendChild(card);
    }
  }
}

// ================= SHIP =================
function paneShip(pane){
  const S = ctx.S;
  const ctl = controlOf(worldById(S, S.locId));
  const dockOK = ctl !== 'ZEON';

  const head = el('div', 'panel');
  head.innerHTML = `<div class="h">${S.shipName} — PEGASUS-CLASS ASSAULT CARRIER</div>
    <div class="kv"><span>HULL</span><b>${Math.round(S.hull)} / ${maxHull(S)}</b></div>
    <div class="kv"><span>CRUISE SPEED</span><b>${Math.round(shipSpeed(S))} Mm/DAY</b></div>
    <div class="kv"><span>SENSOR RADIUS</span><b>${Math.round(intelRadius(S))} Mm</b></div>`;
  pane.appendChild(head);

  pane.appendChild(el('h3', '', 'EXTERNAL VIEW'));
  const viewPanel = el('div', 'panel');
  const cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;height:250px;display:block';
  viewPanel.appendChild(cv);
  pane.appendChild(viewPanel);
  startShipView(cv, S);

  if (S.hull < maxHull(S)){
    const cost = Math.round((maxHull(S) - S.hull) * 18);
    const rep = el('button', 'small', `REPAIR HULL — ${fmtCr(cost)}`);
    rep.disabled = !dockOK || S.credits < cost;
    rep.onclick = () => { S.credits -= cost; S.hull = maxHull(S); ctx.save(); topbar(); renderPane(); };
    pane.appendChild(rep);
  }

  pane.appendChild(el('h3', '', 'REFIT — MODULES' + (dockOK ? '' : ' (NO DOCK ACCESS IN HOSTILE TERRITORY)')));
  for (const [key, mod] of Object.entries(SHIP_MODULES)){
    const lvl = S.modules[key];
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', `${mod.name} — MK ${lvl + 1} ${'▰'.repeat(lvl + 1)}${'▱'.repeat(3 - lvl)}`));
    grow.appendChild(el('div', 'sub', `${mod.desc} · current: ${mod.levels ? mod.levels[lvl] : mod.base + mod.per * lvl}`));
    card.appendChild(grow);
    if (lvl < 3){
      const cost = mod.costs[lvl + 1];
      const up = el('button', 'small accent', `UPGRADE ${fmtCr(cost)}`);
      up.disabled = !dockOK || S.credits < cost;
      up.onclick = () => {
        S.credits -= cost; S.modules[key]++;
        if (key === 'armor') S.hull = maxHull(S);
        ctx.save(); topbar(); renderPane();
      };
      card.appendChild(up);
    } else card.appendChild(el('span', '', 'MAX'));
    pane.appendChild(card);
  }
}

// ================= CREW =================
function paneCrew(pane){
  const S = ctx.S;
  const w = worldById(S, S.locId);
  const d = materialize(S, w);

  pane.appendChild(el('h3', '', `CREW — ${S.crew.length}/${crewCap(S)} · DAILY WAGES ${fmtCr(S.crew.reduce((a, c) => a + c.wage, 0))}`));
  for (const cr of S.crew){
    const role = CREW_ROLES[cr.role];
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', `${cr.name} — ${role.name} ${'★'.repeat(cr.skill)}`));
    grow.appendChild(el('div', 'sub', `${role.desc} · WAGE ${fmtCr(cr.wage)}/day`));
    card.appendChild(grow);
    const sel = document.createElement('select');
    for (const j of role.jobs){
      const o = document.createElement('option');
      o.value = j; o.textContent = 'JOB: ' + j; o.selected = cr.job === j;
      sel.appendChild(o);
    }
    sel.onchange = () => { cr.job = sel.value; ctx.save(); };
    card.appendChild(sel);
    const dis = el('button', 'small', 'DISMISS');
    dis.onclick = () => { S.crew = S.crew.filter(x => x !== cr); ctx.save(); renderPane(); };
    card.appendChild(dis);
    pane.appendChild(card);
  }

  pane.appendChild(el('h3', '', 'LOCAL RECRUITS'));
  if (!d.recruits.length) pane.appendChild(el('div', 'row-card', 'Nobody here is looking for ship work.'));
  for (const r of d.recruits){
    const role = CREW_ROLES[r.role];
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', `${r.name} — ${role.name} ${'★'.repeat(r.skill)}`));
    grow.appendChild(el('div', 'sub', `${role.desc} · WAGE ${fmtCr(r.wage)}/day`));
    card.appendChild(grow);
    const hire = el('button', 'small accent', `HIRE ${fmtCr(r.fee)}`);
    hire.disabled = S.credits < r.fee || S.crew.length >= crewCap(S);
    hire.onclick = () => {
      S.credits -= r.fee;
      S.crew.push({ name: r.name, role: r.role, skill: r.skill, wage: r.wage, job: r.job });
      d.recruits = d.recruits.filter(x => x !== r);
      ctx.save(); topbar(); renderPane();
    };
    card.appendChild(hire);
    pane.appendChild(card);
  }
}

// ================= INTEL =================
function paneIntel(pane){
  const S = ctx.S;
  const counts = { FED: 0, ZEON: 0, CONTESTED: 0, NEUTRAL: 0, UNCHARTED: 0 };
  for (const w of S.worlds){
    if (w.lastSeen < 0) counts.UNCHARTED++;
    else counts[w.snap.control]++;
  }
  const grid = el('div', 'grid2');

  const war = el('div', 'panel');
  war.innerHTML = `<div class="h">WAR SITUATION (AS OBSERVED)</div>
    <div class="kv"><span class="ctl-FED">FEDERATION WORLDS</span><b>${counts.FED}</b></div>
    <div class="kv"><span class="ctl-ZEON">ZEON-HELD WORLDS</span><b>${counts.ZEON}</b></div>
    <div class="kv"><span class="ctl-CONTESTED">CONTESTED FRONTS</span><b>${counts.CONTESTED}</b></div>
    <div class="kv"><span class="ctl-NEUTRAL">NEUTRAL</span><b>${counts.NEUTRAL}</b></div>
    <div class="kv"><span>UNCHARTED</span><b>${counts.UNCHARTED}</b></div>
    <div class="kv" style="margin-top:8px"><span>FED PRODUCTION</span><b>×${S.mods.fed.toFixed(2)}</b></div>
    <div class="kv"><span>ZEON PRODUCTION</span><b>×${S.mods.zeon.toFixed(2)}</b></div>
    <div style="margin-top:8px;color:var(--dim);font-size:10px;line-height:1.6">
    Counts reflect your last observation of each world — intel decays. The other
    ${WORLD_COUNT - activeWorldCount()} worlds currently exist only as statistics.</div>`;
  grid.appendChild(war);

  const you = el('div', 'panel');
  you.innerHTML = `<div class="h">SERVICE RECORD</div>
    <div class="kv"><span>CALLSIGN RENOWN</span><b>${S.renown}</b></div>
    <div class="kv"><span>CONFIRMED KILLS</span><b>${S.kills}</b></div>
    <div class="kv"><span>RED COMET BOUNTY</span><b>${S.flags.charDown ? 'CLAIMED' : S.flags.charHunts ? 'ACTIVE — BEWARE' : '—'}</b></div>
    <div class="kv"><span>FINAL OPERATION</span><b>${S.flags.victory ? 'VICTORY' : S.flags.finaleOpen ? 'A BAOA QU — GO NOW' : 'NOT YET ISSUED'}</b></div>`;
  grid.appendChild(you);
  pane.appendChild(grid);

  pane.appendChild(el('h3', '', 'WAR TIMELINE — DISPATCHES RECEIVED'));
  for (const id of [...S.eventsSeen].reverse()){
    const ev = TIMELINE.find(e => e.id === id);
    if (!ev) continue;
    const card = el('div', 'row-card');
    const grow = el('div', 'grow');
    grow.appendChild(el('div', 'ttl', `${ucDate(ev.day)} — ${ev.title}`));
    grow.appendChild(el('div', 'sub', ev.text));
    card.appendChild(grow);
    pane.appendChild(card);
  }
  if (!S.eventsSeen.length) pane.appendChild(el('div', 'row-card', 'No major war dispatches received yet.'));
}
