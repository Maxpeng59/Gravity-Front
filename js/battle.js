// ---------- 3D battle engine ----------
// Third-person mobile suit combat in space / planetary / colony environments.
// Implements battlefield-level observer simulation: beyond ~1.6 km units are
// abstract "blips" resolved statistically; they materialize into fully
// simulated mechs only inside the player's observation bubble, and full
// mechs that drift out of it collapse back into blips.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { RNG, noise2D, clamp, lerp, sfx } from './util.js';
import { suitById } from './data.js';
import { buildMech, poseWalk, poseAim, buildWeaponMesh } from './mecha.js';
import { modelFor } from './models.js';
import { MAP_BY_ID } from './maps.js';
import { buildCanonicalLandship } from './canonical-landships.js';

const UP = new THREE.Vector3(0, 1, 0);

// ---------- family-correct low-detail silhouettes for far-LOD instancing ----------
// Distant armor must not turn into a humanoid just because its full mesh left the near-detail pool.
// Five tiny merged silhouettes preserve the important chassis read for hundreds of units at five calls.
const makeLiteGeo = parts => {
  const tint = (g, shade) => {
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){ col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv'); // keep attributes consistent for the merge
    return g;
  };
  const b = (w, h, d, x, y, z, shade) => tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), shade);
  const geo = mergeGeometries(parts.map(p => b(...p)), false);
  geo.userData.shared = true; // never dispose: reused across battles
  return geo;
};
const HUMANOID_LITE = [
  [5,3.6,3,0,13,0,.95], [2.1,2,2.1,0,16.2,0,.88], [2.4,4.8,2.6,-3.4,12.2,0,.78],
  [2.4,4.8,2.6,3.4,12.2,0,.78], [2.4,9.6,2.6,-1.8,4.8,0,.6], [2.4,9.6,2.6,1.8,4.8,0,.6],
  [3.2,2.4,1.4,0,13,-2.2,.5],
];
const LITE_GEOS = {
  humanoid: makeLiteGeo(HUMANOID_LITE),
  acguy: makeLiteGeo([
    [6.5,7,4.8,0,11,0,.92], [5.2,3,4,-3.8,10.5,0,.72], [5.2,3,4,3.8,10.5,0,.72],
    [2.8,7,3,-2.1,3.5,0,.58], [2.8,7,3,2.1,3.5,0,.58], [5.2,1.2,1.4,0,14.8,1.9,.88],
  ]),
  guntank: makeLiteGeo([
    [3,3.2,10,-2.5,1.6,0,.55], [3,3.2,10,2.5,1.6,0,.55], [6.2,2.6,6.8,0,4.2,0,.7],
    [5.4,5,4.2,0,7.4,0,.92], [1,8,.8,-1.9,12.3,2.4,.65], [1,8,.8,1.9,12.3,2.4,.65],
    [2.5,2,2.2,0,10.5,1.1,.84],
  ]),
  zakutank: makeLiteGeo([
    [3.5,3.8,12,-3.6,2,0,.55], [3.5,3.8,12,3.6,2,0,.55], [7,3.2,8,0,5.1,0,.68],
    [5.2,4.2,3.8,0,10,0,.92], [2.2,4.4,2.4,-3.5,9.7,0,.72], [2.2,4.4,2.4,3.5,9.7,0,.72],
    [2.4,2,2.2,0,13.2,1,.86], [1,9,1,-2.8,15,1.5,.6],
  ]),
  tank: makeLiteGeo([
    [8,2.2,13,0,1.3,0,.58], [7,1.8,8,0,3.1,0,.76], [5,2.2,5,0,4.5,1,.94],
    [.7,.7,9,-1.2,5.1,6,.62], [.7,.7,9,1.2,5.1,6,.62],
  ]),
  apc: makeLiteGeo([
    [3.8,1.05,6.9,0,.72,0,.62], [3.05,.75,4.75,0,1.45,-.15,.82],
    [.95,.55,1.05,0,2.02,.72,.94], [.18,.18,3.2,0,2.28,2.65,.55],
    [.42,1.5,1.5,-1.68,.76,-2.18,.42], [.42,1.5,1.5,-1.68,.76,0,.42], [.42,1.5,1.5,-1.68,.76,2.18,.42],
    [.42,1.5,1.5,1.68,.76,-2.18,.42], [.42,1.5,1.5,1.68,.76,0,.42], [.42,1.5,1.5,1.68,.76,2.18,.42],
  ]),
  air: makeLiteGeo([
    [2.8,1.5,13,0,0,0,.92], [15,.45,5,0,0,-1.5,.72], [1.1,3.2,3,0,1.5,-4.5,.62],
    [.55,.55,5,-.55,-.35,6,.55], [.55,.55,5,.55,-.35,6,.55], [5,1.1,4,0,0,-6,.5],
  ]),
};
const liteKind = suit => suit.style === 'fighter' ? 'air' : suit.style === 'tank' ? 'tank' : suit.style === 'apc' ? 'apc'
  : suit.style === 'guntank' || suit.style === 'crane' ? 'guntank'
  : suit.style === 'zakutank' ? 'zakutank' : suit.style === 'acguy' ? 'acguy' : 'humanoid';
const FED_POOL = ['gm', 'gm', 'gmbazooka', 'guncannon'];
const SHIELDED_IDS = new Set([
  'rx78','fa78','rx79g','ez8','nt1','gp01','mk2','gm','gmbazooka','gmg_a','gmg_b','rgm79sp',
  'zaku2','zaku2g','zaku2b','zaku2s','gouf','goufnh','gelgoog','gelgoogs',
]);
// ground-only suits get swapped for a space-capable equivalent when fielded in orbit
const SPACE_SUB = { gouf: 'zaku2', goufnh: 'zaku2b', guntank: 'guncannon', type61: 'gm', magella: 'zaku2', weasel: 'zaku2' };

const BIOMES = {
  verdant:  { lo: 0x2e4d2a, hi: 0x8a8f7a, sky: 0x9db8d8, fog: 0xa8bccc, airless: false },
  desert:   { lo: 0x8a6f45, hi: 0xd2b078, sky: 0xd8c3a0, fog: 0xd8c8a8, airless: false },
  ice:      { lo: 0x9fb8c8, hi: 0xeef4f8, sky: 0xcfe0ea, fog: 0xdfe9f0, airless: false },
  regolith: { lo: 0x4a4a50, hi: 0x9a9aa0, sky: 0x05070d, fog: 0x0a0c12, airless: true },
  crimson:  { lo: 0x6e3a2a, hi: 0xb07a55, sky: 0xd8a890, fog: 0xd0a088, airless: false },
};

const OBS_RADIUS = 1600;   // inside this, things are real
const DROP_RADIUS = 2600;  // outside this, real things collapse to statistics

export function startBattle(renderer, opts, onEnd){
  const env = opts.env || 'space';
  const rng = new RNG(opts.terrainSeed || 'battle');
  const multiplayer = opts.multiplayer || null;
  const pvpLink = multiplayer?.link || null;
  const PVP = !!(pvpLink && typeof pvpLink.send === 'function');
  let networkRemote = null;
  let pvpLocalSeq = 0, pvpRemoteSeq = -1, pvpStateT = 0;
  let pvpLastSnapshotAt = 0, pvpLastMessageAt = 0;
  let pvpDisconnectedAt = 0;
  let pvpShotsSent = 0, pvpShotsReceived = 0, pvpHitsSent = 0, pvpHitsReceived = 0;
  let pvpForfeit = false, pvpListenersAttached = false;
  const PVP_DISCONNECT_GRACE_MS = 12000;
  const PVP_SILENCE_LIMIT_MS = 30000;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 60000);
  scene.add(camera); // so the cockpit weapon viewmodel (a camera child) renders
  const canvas = renderer.domElement;

  // ---------- open cockpit tub + weapon viewmodel ----------
  // The upper view is completely unobstructed. All physical cockpit geometry lives on the low,
  // peripheral control decks; there is no glass, canopy, monitor frame, hood or window pillar.
  const cockpitInterior = new THREE.Group();
  cockpitInterior.name = 'cockpit-interior';
  cockpitInterior.visible = false;
  camera.add(cockpitInterior);
  const cockpitGaugeNeedles = [];
  {
    const refSuit = suitById(opts.playerSuitId);
    const zeonPit = refSuit?.faction === 'ZEON';
    const shell = new THREE.MeshStandardMaterial({ color: zeonPit ? 0x111a14 : 0x111b22, roughness: 0.74, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: zeonPit ? 0x263126 : 0x263741, roughness: 0.62, metalness: 0.4 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.94, metalness: 0.03 });
    const panel = new THREE.MeshStandardMaterial({ color: zeonPit ? 0x182319 : 0x17262e, roughness: 0.72, metalness: 0.3 });
    const cyan = new THREE.MeshBasicMaterial({ color: zeonPit ? 0x8ee26b : 0x4ae2ff, toneMapped: false });
    const mint = new THREE.MeshBasicMaterial({ color: zeonPit ? 0xa3ed7c : 0x68efcf, toneMapped: false });
    const red = new THREE.MeshBasicMaterial({ color: 0xff4350, toneMapped: false });
    const coolButton = new THREE.MeshStandardMaterial({ color: 0x74838b, roughness: 0.58, metalness: 0.24 });
    const darkFace = new THREE.MeshBasicMaterial({ color: 0x02070a, toneMapped: false });
    const addBox = (w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0, part = 'structure') => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.userData.cockpitPart = part;
      cockpitInterior.add(mesh); return mesh;
    };
    const addCyl = (r, h, material, x, y, z, rx = 0, rz = 0, part = 'control') => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), material);
      mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); mesh.userData.cockpitPart = part;
      cockpitInterior.add(mesh); return mesh;
    };
    const addPanel = (points, depth, material, z, part = 'console') => {
      const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: .035, bevelThickness: .035,
      });
      geo.translate(0, 0, -depth * .5);
      const mesh = new THREE.Mesh(geo, material); mesh.position.z = z; mesh.userData.cockpitPart = part;
      cockpitInterior.add(mesh); return mesh;
    };
    const mirror = points => points.map(([x, y]) => [-x, y]).reverse();

    // The lower tub stays outside the center sight corridor.
    const leftTub = [[-3.08,-.56],[-1.54,-.64],[-1.3,-2.08],[-3.14,-2.08]];
    addPanel(leftTub, .48, shell, -3.02, 'tub');
    addPanel(mirror(leftTub), .48, shell, -3.02, 'tub');
    addPanel([[-.62,-1.56],[.62,-1.56],[.82,-2.12],[-.82,-2.12]], .5, shell, -2.92, 'footwell');
    const leftDeck = [[-2.78,-.8],[-1.55,-.72],[-1.42,-1.72],[-2.9,-1.66]];
    const rightDeck = mirror(leftDeck);
    addPanel(leftDeck, .24, panel, -2.58, 'switch-deck');
    addPanel(rightDeck, .24, panel, -2.58, 'switch-deck');

    // Peripheral gauges keep the flight data readable without blocking the forward approach view.
    const addGauge = (x, y, r, needleAngle = 0) => {
      const face = new THREE.Mesh(new THREE.CircleGeometry(r, 28), darkFace);
      face.position.set(x, y, -2.43); face.userData.cockpitPart = 'gauge'; cockpitInterior.add(face);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .9, r * .075, 8, 28), cyan);
      ring.position.set(x, y, -2.36); ring.userData.cockpitPart = 'gauge'; cockpitInterior.add(ring);
      const inner = new THREE.Mesh(new THREE.TorusGeometry(r * .67, r * .025, 6, 24), mint);
      inner.position.set(x, y, -2.35); inner.userData.cockpitPart = 'gauge'; cockpitInterior.add(inner);
      const needle = addBox(r * .07, r * 1.05, .035, red, x, y, -2.31, 0, 0, needleAngle, 'gauge');
      needle.position.y += Math.cos(needleAngle) * r * .22;
      needle.position.x -= Math.sin(needleAngle) * r * .22;
      needle.userData.gaugePivot = { x, y, r }; cockpitGaugeNeedles.push(needle);
      addCyl(r * .095, .045, coolButton, x, y, -2.28, Math.PI / 2, 0, 'gauge');
    };
    addGauge(-2.05, -1.02, .14, -.78);
    addGauge(-1.72, -.97, .2, .42);
    addGauge(1.72, -.97, .2, .72);
    addGauge(2.05, -1.02, .14, -.58);

    // Twin 4x4 switch decks occupy only the far left/right periphery.
    const buttonGeo = new THREE.BoxGeometry(.11, .07, .065);
    for (const side of [-1, 1]){
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++){
        const material = row === 3 && col < 2 ? red : (row + col) % 5 === 0 ? mint : coolButton;
        const key = new THREE.Mesh(buttonGeo, material);
        const x = side < 0 ? -2.8 + col * .17 : 2.29 + col * .17;
        key.position.set(x, -1.04 - row * .135, -2.38);
        key.rotation.z = side * .075; key.userData.cockpitPart = 'button'; cockpitInterior.add(key);
      }
    }

    // Outboard control sticks hug the side consoles instead of crowding the center.
    for (const side of [-1, 1]){
      const x = side * 2.18;
      addCyl(.24, .13, rubber, x, -1.57, -2.48, Math.PI / 2, 0, 'control');
      addCyl(.07, .64, rubber, x - side * .04, -1.28, -2.39, 0, -side * .1, 'control');
      addBox(.23, .29, .16, metal, x - side * .075, -.98, -2.32, 0, 0, -side * .08, 'control');
      addBox(.09, .08, .055, red, x - side * .16, -.94, -2.21, 0, 0, 0, 'control');
    }

    // Reference-defining asymmetric side equipment: vent/lamp bank left, warning strip right.
    addBox(.82, .5, .09, metal, -2.52, -.76, -2.49, 0, 0, -.04, 'side-panel');
    for (let i = 0; i < 7; i++) addBox(.045, .34, .035, rubber, -2.76 + i * .08, -.75, -2.42, 0, 0, -.04, 'vent');
    for (let i = 0; i < 6; i++) addBox(.065, .055, .04, red, -2.78 + i * .12, -1.04, -2.4, 0, 0, 0, 'lamp');
    addBox(.38, .18, .055, mint, -2.4, -1.28, -2.38, 0, 0, -.03, 'status-screen');
    addBox(.82, .18, .08, metal, 2.5, -1.1, -2.5, 0, 0, .04, 'side-panel');
    for (let i = 0; i < 6; i++) addBox(.065, .055, .04, red, 2.2 + i * .12, -1.08, -2.4, 0, 0, 0, 'lamp');

    // The only center control is tucked against the bottom edge.
    addCyl(.16, .07, rubber, 0, -1.92, -2.4, Math.PI / 2, 0, 'control');
    const actuatorRing = new THREE.Mesh(new THREE.TorusGeometry(.105, .02, 8, 20), red);
    actuatorRing.position.set(0, -1.92, -2.3); actuatorRing.userData.cockpitPart = 'control'; cockpitInterior.add(actuatorRing);
  }

  // Cockpit weapon viewmodel (bottom-right of the view).
  let vgKick = 0, vgSwing = 0, vgMeleeOverride = false;
  const viewGun = new THREE.Group();
  // Keep the weapon behind the physical cockpit shell. The extra depth margin is
  // intentional: even maximum firing recoil must not push it through the console.
  viewGun.position.set(3.3, -2.3, -5);
  viewGun.visible = false;
  camera.add(viewGun);
  // cockpit shield viewmodel — swings up in front when guarding in first person
  const viewShield = new THREE.Group();
  viewShield.visible = false;
  camera.add(viewShield);
  function buildViewShield(){
    viewShield.clear();
    const c = player.suit.colors || { main: 0xdfe4ea, accent: 0x3a4250, trim: 0xc7a23c };
    const fed = player.suit.faction === 'FED';
    const style = player.suit.style;
    viewShield.userData.screenSide = style === 'zaku' ? 'right' : 'left';
    const classicFed = fed && (style === 'gundam' || style === 'gm');
    const groundFed = new Set(['rx79g','ez8','gmg_a','gmg_b']).has(player.suit.id);
    const fedCrossShield = new Set(['rx78','gm','gmbazooka']).has(player.suit.id);
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.38 });
    const edge = mat(classicFed ? 0xe5e8e3 : fed ? (c.chest || 0x41566b) : 0x252a2e);
    const face = mat(fedCrossShield ? 0xb92731 : groundFed ? (c.chest || c.main) : classicFed ? (c.chest || c.accent || c.main) : c.main);
    const trim = mat(c.trim || c.accent || 0xc7a23c);
    const dark = mat(0x242a2f);
    const addProfile = (points, depth, material, scale = 1, z = 0) => {
      const shape = new THREE.Shape(); shape.moveTo(points[0][0] * scale, points[0][1] * scale);
      for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0] * scale, points[i][1] * scale);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.035, bevelThickness: 0.035 });
      geo.translate(0, 0, -depth / 2 + z);
      const mesh = new THREE.Mesh(geo, material); viewShield.add(mesh); return mesh;
    };
    let outline;
    if (style === 'gelgoog'){
      outline = Array.from({ length: 20 }, (_, i) => {
        const a = Math.PI / 2 + i / 20 * Math.PI * 2;
        return [Math.cos(a) * 0.82, Math.sin(a) * 1.18];
      });
    } else if (style === 'gouf'){
      outline = [[-.62,1.05],[.62,1.05],[.8,.62],[.72,-.65],[0,-1.2],[-.72,-.65],[-.8,.62]];
    } else if (!fed){
      outline = [[-.68,1.14],[.68,1.14],[.8,.82],[.76,-1.08],[-.76,-1.08],[-.8,.82]];
    } else if (groundFed){
      outline = [[-.64,.78],[.64,.78],[.78,.55],[.7,-.62],[.42,-.86],[-.42,-.86],[-.7,-.62],[-.78,.55]];
    } else {
      outline = [[-.58,1.16],[.58,1.16],[.78,.78],[.64,-.72],[.3,-1.18],[-.3,-1.18],[-.64,-.72],[-.78,.78]];
    }
    const outer = addProfile(outline, 0.2, edge);
    const inner = addProfile(outline, 0.16, face, 0.84, 0.13);
    const addBox = (w, h, d, material, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z); viewShield.add(mesh); return mesh;
    };
    if (fedCrossShield || groundFed){
      // RX/RGM family shield: white raised rim, red plate and the narrow yellow Federation cross.
      addBox(.18, 1.38 * (groundFed ? .75 : 1), .12, trim, 0, .16, .22);
      addBox(.88 * (groundFed ? .68 : 1), .17, .12, trim, 0, groundFed ? .25 : .46, .22);
    } else if (fed){
      // Later Federation plates keep a restrained structural spine; never reuse Zeon fasteners.
      addBox(.13, 1.52, .11, dark, 0, -.02, .21);
      addBox(.66, .11, .11, edge, 0, .52, .21);
    } else {
      // Zeon shields use structural ribs and fasteners, never a fabricated Federation cross.
      addBox(.14, 1.75, .12, dark, 0, -.02, .21);
      for (const [x, y] of [[-.48,.72],[.48,.72],[-.48,-.62],[.48,-.62]]){
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .08, 10), trim);
        bolt.rotation.x = Math.PI / 2; bolt.position.set(x, y, .24); viewShield.add(bolt);
      }
    }
  }
  const vgDark = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.55, metalness: 0.45 });
  const vgGrip = new THREE.MeshStandardMaterial({ color: 0x444c58, roughness: 0.7, metalness: 0.3 });
  const vgSteel = new THREE.MeshStandardMaterial({ color: 0x5a6472, roughness: 0.4, metalness: 0.6 });
  const vgAccent = new THREE.MeshStandardMaterial({ color: 0x7a4646, roughness: 0.5, metalness: 0.35 });
  const vgGlow = new THREE.MeshStandardMaterial({ color: 0x113333, emissive: 0x55ffee, emissiveIntensity: 1.6 });
  const vgBlade = new THREE.MeshStandardMaterial({ color: 0x220022, emissive: 0xff9ae0, emissiveIntensity: 3.0, transparent: true, opacity: 0.82 });
  const vgBladeCore = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.4, transparent: true, opacity: 0.95 });
  function clearViewGun(){
    // Quick-melee temporarily swaps the ranged cockpit model for a saber. Dispose the
    // detached model's unique geometry each time; its cached/shared materials stay alive.
    const geometries = new Set();
    viewGun.traverse(o => {
      if (o !== viewGun && o.geometry && !o.geometry.userData?.shared) geometries.add(o.geometry);
    });
    for (const geometry of geometries) geometry.dispose();
    viewGun.clear();
  }
  // cockpit weapon viewmodels: the saber hilt and head-weapon fire-control pod are cockpit-only;
  // every HELD weapon mounts the SHARED buildWeaponMesh so it matches the third-person gun exactly.
  function buildViewGun(forceSaber = false){
    clearViewGun();
    viewGun.scale.setScalar(1);
    vgAccent.color.setHex((player.suit.colors && player.suit.colors.accent) || 0x7a4646);
    const add = (geo, m, x, y, z, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z); mesh.rotation.x = rx; mesh.rotation.z = rz;
      viewGun.add(mesh);
      return mesh;
    };
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const C = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
    const RX = Math.PI / 2;
    if (forceSaber || player.wi === SABER_SLOT){
      // beam saber hilt: knurled grip, ring bands, activation stud, guard disc, pommel — plus the blade
      add(C(0.09, 0.105, 0.55), vgGrip, 0, -0.22, 0);
      add(C(0.11, 0.11, 0.05), vgSteel, 0, -0.02, 0);                    // upper band
      add(C(0.11, 0.11, 0.05), vgSteel, 0, -0.42, 0);                    // lower band
      add(C(0.145, 0.145, 0.05), vgDark, 0, 0.06, 0);                    // guard disc
      add(C(0.125, 0.125, 0.1), vgDark, 0, 0.13, 0);                     // emitter housing
      add(C(0.06, 0.06, 0.03), vgGlow, 0, 0.19, 0);                      // emitter lens
      add(B(0.04, 0.07, 0.045), vgAccent, 0.1, -0.18, 0);                // activation stud
      add(C(0.1, 0.085, 0.09), vgSteel, 0, -0.54, 0);                    // pommel
      add(new THREE.CylinderGeometry(0.075, 0.03, 2.1, 8), vgBlade, 0, 1.25, 0);
      add(new THREE.CylinderGeometry(0.03, 0.012, 2.1, 6), vgBladeCore, 0, 1.25, 0);
      return;
    }
    const w = player.suit.weapons[player.wi];
    const nm = w.name || '';
    if (player.suit.vehicle){ // compact cannon sight/control box, never a fake handheld gun
      viewGun.scale.setScalar(0.28);
      add(B(0.34, 0.2, 0.46), vgDark, 0, -0.02, 0.1);
      add(B(0.3, 0.025, 0.34), vgSteel, 0, 0.09, 0.08);
      add(C(0.055, 0.055, 0.04, 10), vgGlow, 0.08, 0.02, -0.15, RX);
      add(B(0.05, 0.04, 0.04), vgAccent, -0.09, -0.05, -0.16);
      return;
    }
    if (w.head){ // head vulcans / machine cannons: the fire-control pod slaved to them, not a hand weapon
      add(B(0.22, 0.16, 0.42), vgDark, 0, 0, 0.1);
      add(B(0.24, 0.05, 0.44), vgSteel, 0, 0.1, 0.1);                    // top plate
      for (const bx of [-0.05, 0.05]) add(C(0.024, 0.024, 0.5, 8), vgGrip, bx, 0.02, -0.3, RX); // twin gun-camera barrels
      add(C(0.05, 0.05, 0.03, 8), vgGlow, 0.07, -0.03, -0.12, RX);       // targeting lens
      return;
    }
    // the EXACT same weapon mesh the suit holds in third person, mounted in the cockpit:
    // buildWeaponMesh is shared with buildMech, so inside and outside always match (colors included).
    // Weapon-local +z (barrel) is turned to face camera-forward (-z).
    const gun = buildWeaponMesh(player.suit, w);
    gun.rotation.y = Math.PI;
    gun.scale.setScalar(0.2);
    gun.position.set(0, -0.05, 0.5);
    viewGun.add(gun);
  }

  // ---------- HUD refs ----------
  const $ = id => document.getElementById(id);
  const hud = $('hud'), cockpitEl = $('cockpit-frame'), killFeedEl = $('hud-killfeed'),
    hpBar = $('hud-hp'), hpNum = $('hud-hp-num'), boostBar = $('hud-boost'),
    wEl = $('hud-weapon'), objEl = $('hud-objective'), simEl = $('hud-sim'),
    msgEl = $('hud-msg'), hintEl = $('hud-hint'),
    radar = $('radar'), rctx = radar.getContext('2d'),
    loCanvas = $('lockon'), loCtx = loCanvas ? loCanvas.getContext('2d') : null;
  sizeLockon();
  hud.classList.remove('hidden');
  cockpitEl.classList.add('hidden');
  cockpitEl.dataset.faction = suitById(opts.playerSuitId)?.faction || 'FED';
  killFeedEl.replaceChildren();
  const hintSuit = suitById(opts.playerSuitId);
  const hintGroundManeuver = env === 'ground' && hintSuit && !hintSuit.air && !hintSuit.vehicle && !hintSuit.noJump
    && !['tank','guntank','zakutank','crane','apc','fighter'].includes(hintSuit.style);
  const hintHoverProfile = hintSuit?.landType ? 'E AUTO-HOVER 3× · 80% ENERGY' : 'E AUTO-HOVER 2×';
  hintEl.textContent = hintSuit && hintSuit.air
    ? `MOUSE STEER · LMB FIRE · SHIFT BOOST · S BRAKE · V VIEW · R RELOAD · Q/TAB/1-${hintSuit.weapons.length} WEAPON · P AIM SYSTEM · M MUTE ALL · ESC PAUSE`
    : hintSuit && hintSuit.vehicle
    ? 'WASD DRIVE/STEER · MOUSE TURRET · LMB FIRE · V PERISCOPE · SHIFT SPRINT · TAB/1-4 WEAPON · R RELOAD · P AIM · M MUTE ALL · ESC PAUSE'
    : hintGroundManeuver
    ? `WASD MOVE · ${hintHoverProfile} · Q SAND-KICK · SHIFT BOOST · TAB/1-4 WEAPON · V COCKPIT · F GUARD · RMB SABER · J STOMP · M MUTE ALL · ESC PAUSE`
    : 'WASD MOVE · MOUSE AIM · LMB FIRE · RMB SABER COMBO · F GUARD/PARRY · J STOMP (air) · V COCKPIT · SPACE ASCEND · SHIFT BOOST · C DESCEND · R RELOAD · Q/TAB/1-4 WEAPON · P AIM · M MUTE ALL · ESC PAUSE';

  let msgT = 0;
  const setMsg = (t, dur = 2.6) => { msgEl.textContent = t; msgT = dur; };
  const pvpSend = message => {
    if (!PVP || !pvpLink.connected) return false;
    try {
      pvpLink.send(message);
      return true;
    } catch {
      return false;
    }
  };

  const unitNoticeName = unit => {
    if (!unit) return 'UNKNOWN';
    if (unit.isPlayer) return 'YOU';
    return unit.name || unit.label || (unit.kind ? unit.kind.toUpperCase() : null) || unit.suit?.name || unit.team || 'UNKNOWN';
  };
  const weaponNoticeName = (attacker, melee = false, explicit = null) => explicit
    || (melee ? attacker?.suit?.saber?.name : attacker?.suit?.weapons?.[attacker?.wi]?.name)
    || (attacker?.isShip ? 'MAIN BATTERY' : attacker?.gunName)
    || 'UNKNOWN WEAPON';
  function addKillNotice(attacker, weaponName, victim){
    if (!attacker || !victim || attacker === victim) return;
    const row = document.createElement('div');
    row.className = `kill-notice ${attacker.team === player?.team ? 'friendly' : 'hostile'}`;
    row.textContent = `${unitNoticeName(attacker)} killed (${weaponName || 'UNKNOWN WEAPON'}) ${unitNoticeName(victim)}`;
    killFeedEl.prepend(row);
    while (killFeedEl.children.length > 5) killFeedEl.lastElementChild?.remove();
    setTimeout(() => row.remove(), 5100);
  }

  // ---------- environment ----------
  let hfn = null;            // terrain height fn, null in space
  const spinners = [];       // slowly rotating asteroids
  // A named authored battlefield overrides the biome palette,
  // terrain shape, fog + light and drapes an authored structure layout
  const activeMap = (opts.mapId && env === 'ground') ? MAP_BY_ID[opts.mapId] : null;
  const biome = activeMap ? activeMap.biome : (BIOMES[opts.biome] || BIOMES.verdant);

  function addStars(r0, r1, n){
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++){
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rng.range(r0, r1));
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 2.2, sizeAttenuation: false })));
  }

  if (env === 'ground'){
    const n = noise2D(opts.terrainSeed || 7);
    if (activeMap){
      // parametric terrain from the map spec: a flat fightable core, gentle rolling across
      // the combat zone, and (for 'valley' maps) a rim that climbs into hills past ~820 m
      const T = activeMap.terrain, flat = T.flattenRadius || 120;
      hfn = (x, z) => {
        const d = Math.hypot(x, z);
        const core = clamp((d - flat) / 260, 0, 1);
        const rolling = (n(x * 0.0012 + 5, z * 0.0012 + 5, 4) - 0.5) * (T.rollingAmp || 60);
        const ridge = Math.pow(1 - Math.abs(n(x * 0.0006 + 40, z * 0.0006 + 40, 3) * 2 - 1), 3) * (T.ridgeAmp || 0);
        let h = (rolling + ridge) * core;
        if (T.style === 'valley') h += Math.max(0, d - 820) * 0.17;
        return h;
      };
    } else {
      hfn = (x, z) => {
        const d = Math.hypot(x, z);
        const rolling = (n(x * 0.0011 + 5, z * 0.0011 + 5, 4) - 0.5) * 150;
        const ridge = Math.pow(1 - Math.abs(n(x * 0.0006 + 40, z * 0.0006 + 40, 3) * 2 - 1), 3) * 55;
        // keep the spawn area fightable, let the horizon get dramatic
        return (rolling + ridge) * clamp((d - 90) / 300, 0.1, 1);
      };
    }
    const geo = new THREE.PlaneGeometry(4400, 4400, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const lo = new THREE.Color(biome.lo), hi = new THREE.Color(biome.hi), tmpC = new THREE.Color();
    for (let i = 0; i < pos.count; i++){
      const h = hfn(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      tmpC.lerpColors(lo, hi, clamp(h / 70 + 0.35, 0, 1));
      colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })));
    scene.background = new THREE.Color(biome.sky);
    scene.fog = new THREE.Fog(biome.fog, activeMap ? activeMap.fog.near : 500, activeMap ? activeMap.fog.far : (biome.airless ? 2400 : 3400));
    if (biome.airless) addStars(5000, 9000, 1200);
    const rockMat = new THREE.MeshStandardMaterial({ color: biome.hi, roughness: 0.95 });
    // authored maps supply their own scenery (built later, once spawnProp exists); the
    // procedural rock/mesa/ruin scatter is only for the stock random biomes
    if (!activeMap){
      for (let i = 0; i < 70; i++){
        const r = rng.range(4, 16), x = rng.range(-1900, 1900), z = rng.range(-1900, 1900);
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
        rock.position.set(x, hfn(x, z) + r * 0.3, z);
        rock.rotation.set(rng.next() * 3, rng.next() * 3, 0);
        scene.add(rock);
      }
      // mech-scale cover in the combat zone: mesas and ruined wall segments
      for (let i = 0; i < 12; i++){
        const r = rng.range(16, 30), a = rng.range(0, Math.PI * 2), d = rng.range(220, 950);
        const x = Math.sin(a) * d, z = Math.cos(a) * d;
        const mesa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, r * 1.4, 7), rockMat);
        mesa.position.set(x, hfn(x, z) + r * 0.45, z);
        mesa.rotation.y = rng.next() * 3;
        scene.add(mesa);
      }
      const ruinMat = new THREE.MeshStandardMaterial({ color: 0x6b6f74, roughness: 0.9 });
      for (let i = 0; i < 14; i++){
        const a = rng.range(0, Math.PI * 2), d = rng.range(180, 900);
        const x = Math.sin(a) * d, z = Math.cos(a) * d;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(rng.range(28, 60), rng.range(10, 22), 4), ruinMat);
        wall.position.set(x, hfn(x, z) + 4, z);
        wall.rotation.y = rng.range(0, Math.PI);
        wall.rotation.z = rng.range(-0.12, 0.12);
        scene.add(wall);
      }
    } else if (!activeMap.urban) {
      // A distant hill-fringe keeps rural authored valleys from looking bare. Urban maps supply
      // their own skyline and deliberately omit this wilderness ring.
      for (let i = 0; i < 46; i++){
        const a = rng.range(0, Math.PI * 2), d = rng.range(1500, 2050);
        const x = Math.sin(a) * d, z = Math.cos(a) * d, r = rng.range(10, 22);
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
        rock.position.set(x, hfn(x, z) + r * 0.3, z);
        rock.rotation.set(rng.next() * 3, rng.next() * 3, 0);
        scene.add(rock);
      }
    }
  } else if (env === 'colony'){
    hfn = () => 0;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), new THREE.MeshStandardMaterial({ color: 0x707a70, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x8a93a0, roughness: 0.9 });
    const wMat = new THREE.MeshStandardMaterial({ color: 0x222831, emissive: 0xb8d0e0, emissiveIntensity: 0.5 });
    for (let i = 0; i < 70; i++){
      const w = rng.range(24, 70), h = rng.range(30, 170), x = rng.range(-1700, 1700), z = rng.range(-1700, 1700);
      if (Math.hypot(x, z) < 180) continue;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bMat);
      b.position.set(x, h / 2, z); scene.add(b);
      if (rng.chance(0.5)){
        const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.6, 1), wMat);
        win.position.set(x, h * 0.5, z + w / 2 + 0.6); scene.add(win);
      }
    }
    scene.background = new THREE.Color(0xbfd0d8);
    scene.fog = new THREE.Fog(0xc8d4da, 400, 3000);
  } else { // space
    scene.background = new THREE.Color(0x020409);
    addStars(6000, 9500, 2600);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a5d9f, emissive: 0x0a1a30, roughness: 0.8 }));
    earth.position.set(2400, 600, -5200); scene.add(earth);
    const aMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.95 });
    for (let i = 0; i < 42; i++){
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(8, 55), 0), aMat);
      a.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(rng.range(450, 2700)));
      a.rotation.set(rng.next() * 3, rng.next() * 3, rng.next() * 3);
      a.userData.spin = rng.range(0.02, 0.12);
      scene.add(a); spinners.push(a);
    }
  }
  scene.add(new THREE.HemisphereLight(biome.sky, biome.lo, env === 'space' ? 0.8 : (activeMap ? activeMap.light.ambient : 1.0)));
  // key light behind the player start so camera-facing surfaces read clearly
  const sun = new THREE.DirectionalLight(activeMap ? activeMap.light.sun : 0xfff2dd, activeMap ? activeMap.light.intensity : (env === 'space' ? 1.8 : 1.6));
  sun.position.set(300, 550, -380); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd0e8, 0.55);
  fill.position.set(-250, 300, 420); scene.add(fill);

  const groundY = (x, z) => hfn ? hfn(x, z) : -Infinity;
  const SPACE = env === 'space';

  // ---------- mechs ----------
  const mechs = [];
  const collisionGrid = new Map(); // reused each frame for broad-phase body separation

  // ---------- far-LOD instancing ----------
  // Only the nearest NEAR_CAP mechs carry a full detailed model; every other live
  // mech is one instance in its chassis-family InstancedMesh. Sim/AI/HP runs for all.
  const NEAR_CAP = 24, MAX_FAR = 600;
  const liteMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
  const farMeshes = new Map(Object.entries(LITE_GEOS).map(([key, geo]) => {
    const mesh = new THREE.InstancedMesh(geo, liteMat, MAX_FAR);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    mesh.setColorAt(0, new THREE.Color(0xffffff)); // allocate per-instance colour buffer
    scene.add(mesh); return [key, mesh];
  }));
  const detailPool = new Map(); // suitId -> reusable [{root, parts}] so near/far churn never rebuilds

  function disposeDetailRoot(root){
    if (!root || root.userData.sharedAsset) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(o => {
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

  function ensureDetail(m){
    if (m.parts) return;
    const pool = detailPool.get(m.suit.id);
    const d = (pool && pool.length) ? pool.pop() : buildMech(m.suit);
    m.root.add(d.root); m.detail = d.root; m.parts = d.parts;
    d.root.position.set(0, 0, 0); d.root.rotation.set(0, 0, 0); d.root.visible = true;
    if (m.parts.body) m.parts.body.rotation.set(0, 0, 0);
    for (const p of [m.parts.armL, m.parts.armR, m.parts.legL, m.parts.legR]) if (p) p.rotation.set(0, 0, 0);
    m.parts.rebuildGun?.(m.wi);
    if (m.parts.blade) m.parts.blade.visible = m.bladeT > 0;
    if (m.parts.shield) m.parts.shield.visible = m.parts.shieldKind === 'block' ? false : !m.shieldBroken;
    if (m.parts.eyeMat) m.parts.eyeMat.emissiveIntensity = 2.4;
    if (m.parts.monoeye) m.parts.monoeye.position.x = 0;
    if (m.parts.cannonSlide){ m.parts.cannonSlide.position.z = 0; m.parts.cannonSlide.rotation.x = 0; }
    if (m.parts.turretDock && m.parts.turret){
      const art = !!m.suit.weapons[m.wi]?.arc, dock = art ? m.parts.turretDock.art : m.parts.turretDock.dir;
      m.parts.turret.position.set(dock.x, dock.y, dock.z); m.parts.turret.userData.artillery = art;
    }
    for (const flame of m.parts.flames || []) flame.scale.y = 0.01;
    for (const turret of m.parts.turrets || []){ turret.yaw.rotation.set(0, 0, 0); turret.gun.rotation.set(0, 0, 0); turret.cd = 0; }
    for (const wheel of m.parts.wheels || []) wheel.rotation.x = 0;
    resetMuzzleCycle(m, m.wi);
    if (!m.root.parent) scene.add(m.root);
  }
  function releaseDetail(m){
    if (!m.parts) return;
    m.root.remove(m.detail);
    if (m.root.parent) scene.remove(m.root);
    let pool = detailPool.get(m.suit.id);
    if (!pool){ pool = []; detailPool.set(m.suit.id, pool); }
    if (pool.length < 6) pool.push({ root: m.detail, parts: m.parts });
    else disposeDetailRoot(m.detail);
    m.detail = null; m.parts = null;
  }

  // Infantry rendering is initialized after the opening deployment. Once it exists,
  // reinforcement APCs use this hook to dismount their own passenger squads too.
  let deployCarrierPassengers = null;
  function spawnMech(spec, team, pos, { isPlayer = false, core = true, fromBlip = false, hpFrac = 1 } = {}){
    let suit = suitById(typeof spec === 'string' ? spec : spec.suitId);
    const isNetworkRemote = PVP && typeof spec === 'object' && !!spec.networkRemote;
    if (SPACE && suit.groundOnly && !isPlayer) suit = suitById(SPACE_SUB[suit.id] || (suit.faction === 'ZEON' ? 'zaku2' : 'gm'));
    const air = !!suit.air;
    if (air && !mission.aircraftCore) core = false; // aircraft are support and don't gate a mission's win — except custom battles, which opt them in so a fielded air force must actually be destroyed
    const ace = typeof spec === 'object' && spec.ace;
    const root = new THREE.Group();            // transform/data holder; the detailed model is added lazily by LOD
    root.position.copy(pos);
    if (hfn && !SPACE) root.position.y = groundY(pos.x, pos.z);
    if (air) root.position.y = (SPACE ? pos.y : groundY(pos.x, pos.z)) + rng.range(95, 175); // fighters cruise at altitude
    const maxHp = suit.hp * (ace ? 1.2 : 1);
    const maxFuel = suit.boostFuel * (suit.faction === 'FED' ? 2 : 1); // Federation suits carry double thruster reserve
    const hasShield = !air && SHIELDED_IDS.has(suit.id);
    const shieldCap = hasShield ? clamp(Math.round(maxHp * 0.45), 1200, 2600) : 0;
    const m = {
      suit, team, root, parts: null, detail: null, lodNear: false, alwaysFull: isPlayer || isNetworkRemote,
      ace, core, fromBlip, isPlayer, networkRemote: isNetworkRemote, air,
      vip: typeof spec === 'object' && !!spec.vip,
      name: (typeof spec === 'object' && spec.name) || suit.name,
      vel: new THREE.Vector3(), yaw: isPlayer ? 0 : Math.PI, walkPhase: 0, pitch: 0, bank: 0,
      hp: maxHp * hpFrac, maxHp, fuel: maxFuel, maxFuel,
      wi: 0, clip: suit.weapons[0].clip, reloadT: 0, fireT: 0, meleeT: 0, bladeT: 0,
      muzzleCursors: [],
      swingT: 0, swingDir: 1, swingKind: 'diagonal', swingDuration: 0.4,
      meleeCombo: 0, meleeHits: 0, slashCounts: {}, pendingMelee: null,
      lockT: 0, lockTarget: null, lockCd: 0, lockedFlash: 0, // lock-on missile state
      // F-key shield guard: per-battle durability that self-restores (no repair)
      blocking: false, blockPose: 0,
      shieldMax: shieldCap, shieldHp: shieldCap, shieldBroken: false, shieldHitT: 99,
      legDmg: 0, sensorDmg: 0, alive: true, boosting: false, deadT: 0,
      hovering: false, groundHoverBlend: 0, groundHoverPhase: 0, hoverDustT: 0,
      hoverJetT: 0, hoverJetEmitted: 0,
      sandKickT: 0, sandKickDuration: 0.42, sandKickCd: 0, sandKickDustT: 0,
      sandKickDir: new THREE.Vector3(0, 0, 1),
      ai: (isPlayer || isNetworkRemote) ? null : {
        skill: ace ? 1.6 : rng.range(0.7, 1.15), err: ace ? 0.018 : 0.05,
        strafe: rng.chance(0.5) ? 1 : -1, tThink: 0, tStrafe: rng.range(1, 3),
        tDodge: rng.range(1, 3), target: null, meleeRun: null, meleeCd: rng.range(0, 3),
      },
    };
    if (air && !isPlayer){ // launch with forward momentum, nose toward the battlefield centre
      m.yaw = Math.atan2(-pos.x, -pos.z);
      m.vel.set(Math.sin(m.yaw), 0, Math.cos(m.yaw)).multiplyScalar(suit.boost * 0.6);
    }
    // GAW carrier is a roughly 159m-span flying wing in this scale — one sphere cannot cover it. String spheres across the
    // wingspan (x) plus nose/tail (z) so rounds register anywhere on the airframe (local: x=right, z=fwd).
    if (suit.id === 'gaw'){
      m.hitSphereBody = true;
      m.hitSpheres = [
        { x: -9, y: 0, z: 0, r: 3.7 }, { x: -4.5, y: 0, z: 0, r: 4 }, { x: 0, y: 0, z: 0, r: 4.2 },
        { x: 4.5, y: 0, z: 0, r: 4 }, { x: 9, y: 0, z: 0, r: 3.7 },
        { x: 0, y: 0, z: 6.5, r: 3.8 }, { x: 0, y: 0, z: -6.3, r: 3.8 },
      ];
    }
    if (suit.id === 'gfighter'){
      m.hitSphereBody = true;
      m.hitSpheres = [
        { x: 0, y: 0, z: 12, r: 3.8 }, { x: 0, y: 0, z: 3, r: 4.2 }, { x: 0, y: 0, z: -8, r: 4.2 },
        { x: -6, y: 0, z: -2.5, r: 3.4 }, { x: 6, y: 0, z: -2.5, r: 3.4 },
      ];
    }
    if (suit.id === 'guntankmk2') m.hitSpheres = [
      { x: 0, y: 3.2, z: 1.5, r: 6.6 },       // track pods + long centre hull
      { x: 0, y: 9.9, z: 0.2, r: 4.4 },       // waist and casemate
      { x: -5.2, y: 9.7, z: 2.6, r: 2.2 },    // right Bop-gun arm
      { x: 5.2, y: 9.7, z: 2.6, r: 2.2 },     // left flamethrower arm
      { x: -2.2, y: 11.7, z: 7.2, r: 1.0 },   // 220 mm barrel
      { x: 0, y: 1.8, z: -8.8, r: 4.7 },      // rear U-blade
    ];
    // Data-driven multi-sphere hulls let small non-humanoid vehicles keep their real proportions.
    if (suit.hitSpheres){
      m.hitSphereBody = true;
      m.hitSpheres = suit.hitSpheres.map(s => ({ ...s }));
    }
    // WEAK POINT (model-local units, ×scale at runtime): aircraft → rear engines; MS/tanks → cockpit (chest).
    // Hitting it deals 2.5× damage. The carrier's engine block is its rear thruster cluster.
    m.weakPoints = suit.weakPoints ? suit.weakPoints.map(w => ({ ...w }))
      : suit.id === 'gaw' ? [{ x: 0, y: -0.2, z: -7.3, r: 2.2, mult: 2.5 }] // rear thruster block, body-local
      : suit.id === 'gfighter' ? [{ x: 0, y: 0, z: -10.2, r: 2.4, mult: 2.3 }]
      : suit.id === 'guntankmk2' ? [{ x: 0.8, y: 10.9, z: 2.7, r: 2.2, mult: 2.5 }] // Type-B casemate/cockpit
      : air ? [{ x: 0, y: 0, z: -6, r: 3, mult: 2.2 }]                              // tail engines (reward getting on its six)
      : suit.id === 'type61' ? [{ x: 1.15, y: 5.45, z: 1.05, r: 1.2, mult: 2.5 }]   // commander's sight/cupola
      : suit.id === 'magella' ? [{ x: 0, y: 7.7, z: 1.25, r: 1.6, mult: 2.5 }]      // Magella-Top cockpit
      : suit.style === 'zakutank' ? [{ x: 0, y: 10.3, z: 1.5, r: 2.5, mult: 2.5 }]
      : suit.id === 'guntankmk1' ? [{ x: 0, y: 11.1, z: 1.7, r: 2.4, mult: 2.5 }]
      : suit.style === 'guntank' ? [{ x: 0, y: 9.6, z: 1.6, r: 2.3, mult: 2.5 }]
      : suit.style === 'acguy' ? [{ x: 0, y: 10.4, z: 2.6, r: 3.5, mult: 2.5 }]
      : [{ x: 0, y: 13, z: 1.8, r: 3.5, mult: 2.5 }];                               // humanoid cockpit (chest)
    mechs.push(m);
    if (m.alwaysFull){ ensureDetail(m); m.lodNear = true; } // the player is always full-detail
    if (deployCarrierPassengers) deployCarrierPassengers(m);
    return m;
  }

  function ringPos(angDeg, distM, ySpread = 0){
    const a = angDeg * Math.PI / 180;
    const p = new THREE.Vector3(Math.sin(a) * distM, 0, Math.cos(a) * distM);
    if (SPACE) p.y = rng.range(-ySpread, ySpread);
    return p;
  }

  // ---------- mission: objective type drives spawns, props and win conditions ----------
  // types: destroy (default) · defend · assault · escort · ambush · hunt · survive
  const mission = Object.assign({ type: 'destroy' }, opts.mission || {});
  // grand-battle reserves: only a capped vanguard fights live, the rest feed in
  const fedReserve = [], zeonReserve = [];
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--){
      const j = rng.int(0, i);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  if (mission.type === 'ambush'){
    const a = rng.range(20, 70);
    mission.start = ringPos(a, 1500, 60);
    mission.goal = ringPos(a + 180, 1600, 60);
  } else if (mission.type === 'escort'){
    mission.goal = ringPos(rng.range(-30, 30), 1700, 0);
  }

  // custom deployment map (world x,z; +z = front). opts.spawn.player sets the player's marker; each enemy/ally
  // unit spec carries its own entry pos. clusterAt fans the units sharing one point into a tidy grid (per-point count).
  const spawnCenters = opts.spawn || null;
  const clusterCount = new Map();
  const clusterAt = c => {
    const key = c.x + ',' + c.z, i = clusterCount.get(key) || 0; clusterCount.set(key, i + 1);
    return new THREE.Vector3(c.x + ((i % 5) - 2) * 70 + rng.range(-22, 22), 0, c.z - Math.floor(i / 5) * 70 + rng.range(-22, 22));
  };
  const player = spawnMech({ suitId: opts.playerSuitId }, 'FED',
    spawnCenters ? new THREE.Vector3(spawnCenters.player.x, 0, spawnCenters.player.z) : new THREE.Vector3(0, 0, 0),
    { isPlayer: true, hpFrac: opts.playerHp ?? 1 });
  if (PVP && multiplayer.localName) player.name = multiplayer.localName;
  if (PVP && Number.isFinite(Number(opts.playerYaw))) player.yaw = Number(opts.playerYaw);
  const SABER_SLOT = player.suit.weapons.length; // the saber rides as the final weapon slot
  const hasSaber = !player.air && !!(player.suit.saber && player.suit.saber.dmg > 0); // no melee weapon → no saber slot (aircraft, Zaku Tank)
  // perf budget: only a capped vanguard is fully simulated at once; the rest feed
  // in from reserves as units fall, so a grand battle stays a grand battle without
  // hundreds of live mechs tanking the frame rate
  const MAX_WING = 24, MAX_AIR = 8; // deploy the whole hangar army (max bays = 20) + air wing
  // custom-battle spawn range (per-unit): 'near'/'normal'/'far' from the player. Only set on
  // custom sorties — campaign specs have no .dist and keep their bespoke formation placement.
  const enemyDistBand = d => d === 'near' ? rng.range(320, 520) : d === 'far' ? rng.range(1350, 1850) : rng.range(600, 1050);
  const allyDistBand  = d => d === 'near' ? rng.range(520, 760) : d === 'far' ? rng.range(40, 120) : rng.range(230, 420); // near = pushed up toward the enemy line
  const allySpecs = (opts.allies || []).map(a => typeof a === 'string' ? { suitId: a } : a);
  if (mission.type === 'odessa' || mission.type === 'fleet') fedReserve.push(...shuffle(allySpecs).splice(mission.type === 'fleet' ? 30 : 60)); // LOD lets the whole army fight at once
  allySpecs.forEach((spec, i) => {
    const pos = spec.pos ? clusterAt(spec.pos)                                    // per-entry deployment marker
      : spec.dist
      ? ringPos(rng.range(-40, 40) + ((i % 5) - 2) * 8, allyDistBand(spec.dist), 20) // forward arc toward the enemy
      : ringPos(120 + i * 25, 40 + (i % 4) * 18, 20);
    spawnMech(spec, 'FED', pos, { core: false, hpFrac: spec.hpFrac ?? 1 });
  });
  // hangar wingmen: a capped squadron sorties (a full 20-bay hangar would swamp the field)
  (opts.wingmen || []).slice(0, MAX_WING).forEach((wsp, i) => {
    const m = spawnMech({ suitId: wsp.suitId, name: wsp.name }, 'FED',
      ringPos(195 + i * 38, 34, 16), { core: false, hpFrac: wsp.hpFrac ?? 1 });
    m.wingId = wsp.wingId;
  });
  // air wing: a capped flight sorties alongside the suits
  (opts.aircraft || []).slice(0, MAX_AIR).forEach((asp, i) => {
    const m = spawnMech({ suitId: asp.suitId, name: asp.name }, 'FED',
      ringPos(150 + i * 30, 240 + i * 40, 60), { hpFrac: asp.hpFrac ?? 1 });
    m.airId = asp.airId;
  });

  // defend missions hold back half the attackers as a delayed second wave
  let enemySpecs = (opts.enemies || []).slice();
  const waves = [];
  if (mission.type === 'defend' && enemySpecs.length > 2){
    const half = Math.ceil(enemySpecs.length / 2);
    waves.push({ t: 40, specs: enemySpecs.slice(half), msg: 'SECOND ATTACK WAVE INBOUND' });
    enemySpecs = enemySpecs.slice(0, half);
  }
  if (mission.type === 'odessa' || mission.type === 'fleet') zeonReserve.push(...shuffle(enemySpecs).splice(mission.type === 'fleet' ? 40 : 90)); // LOD lets the whole army fight at once
  enemySpecs.forEach((e, i) => {
    const pos = mission.type === 'ambush'
      ? mission.start.clone().add(new THREE.Vector3(rng.range(-90, 90), 0, rng.range(-90, 90)))
      : e.pos ? (PVP && e.networkRemote
        ? new THREE.Vector3(e.pos.x, e.pos.y || 0, e.pos.z)                       // PvP start markers are exact on both peers
        : clusterAt(e.pos))                                                       // per-entry deployment marker
      : ringPos(rng.range(-55, 55), e.dist ? enemyDistBand(e.dist) : rng.range(600, 1050), 220);
    const spawned = spawnMech(e, 'ZEON', pos, { core: true });
    if (PVP && e.networkRemote){
      networkRemote = spawned;
      networkRemote.name = multiplayer.remoteName || networkRemote.name;
    }
  });

  // ---------- props: destructible mission structures, vehicles & capital ships ----------
  const props = [];
  function spawnProp(kind, team, pos, hp){
    const isSpaceShip = kind === 'musai' || kind === 'chivvay' || kind === 'salamis' || kind === 'magellan' || kind === 'columbus' || kind === 'solfortress';
    const isLandShip = kind === 'bigtray' || kind === 'dabude' || kind === 'gallop';
    const isShip = isSpaceShip || isLandShip;
    // war-production HP buff — applies to every Federation capital ship (opts.fedShipHp is 0 in custom sorties)
    if (team === 'FED' && isShip) hp += (opts.fedShipHp || 0);
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: team === 'FED' ? 0x5a7d9a : 0x7d6a4a, roughness: 0.85, metalness: 0.25 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: team === 'FED' ? 0x4aa3ff : 0xff5d5d, emissiveIntensity: 1.4 });
    const thrust = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xff9a40, emissiveIntensity: 1.8 });
    const add = (geo, m, x, y, z, rx = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.x = rx; root.add(me); };
    // articulated turret: a yaw pivot (traverses) holding a gun cradle (elevates) with barrels + a muzzle.
    // updateShipTurrets aims & fires these independently. bw/bh/bl = turret box; bars = barrel x-offsets.
    const shipTurrets = [];
    const addTurret = (m, tx, ty, tz, bw, bh, bl, bars, barLen, barR) => {
      const yaw = new THREE.Group(); yaw.position.set(tx, ty, tz); root.add(yaw);
      yaw.add(new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.62, bw * 0.72, bh * 0.5, 12), m)); // ring base
      const gun = new THREE.Group(); gun.position.set(0, bh * 0.4, 0); yaw.add(gun);
      const head = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), m); gun.add(head);
      for (const bx of bars){
        const b = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, barLen, 8), m);
        b.position.set(bx, bh * 0.12, bl * 0.4 + barLen / 2); b.rotation.x = Math.PI / 2; gun.add(b);
      }
      const muz = new THREE.Object3D(); muz.position.set(0, bh * 0.12, bl * 0.4 + barLen); gun.add(muz);
      shipTurrets.push({ yaw, gun, muzzle: muz, cd: rng.range(0, 3), restYaw: 0 });
    };
    const canonicalLandship = isLandShip
      ? buildCanonicalLandship(kind, glow, () => rng.range(0, 3)) : null;
    if (canonicalLandship){
      root.add(canonicalLandship.root);
      shipTurrets.push(...canonicalLandship.turrets);
    } else if (kind === 'base'){
      add(new THREE.BoxGeometry(26, 14, 20), mat, 0, 7, 0);
      add(new THREE.CylinderGeometry(2, 2, 26, 8), mat, -9, 13, -6);
      add(new THREE.SphereGeometry(3.2, 10, 8), glow, -9, 27, -6);
      add(new THREE.BoxGeometry(10, 6, 14), mat, 13, 3, 4);
    } else if (kind === 'depot'){
      add(new THREE.CylinderGeometry(7, 7, 18, 10), mat, 0, 9, 0);
      add(new THREE.CylinderGeometry(7, 7, 18, 10), mat, 16, 9, 2);
      add(new THREE.SphereGeometry(2.2, 8, 6), glow, 8, 16, 1);
    } else if (kind === 'musai'){ // Zeon cruiser (ref: green hull, angular prow, forward triple-gun cluster, side nacelles, rear thrusters)
      const hull = new THREE.MeshStandardMaterial({ color: 0x586b4a, roughness: 0.55, metalness: 0.5 });
      const dk = new THREE.MeshStandardMaterial({ color: 0x39472f, roughness: 0.6, metalness: 0.5 });
      const prow = new THREE.Mesh(new THREE.ConeGeometry(4.6, 22, 4), hull);   // angular pyramid prow
      prow.rotation.set(Math.PI / 2, 0, Math.PI / 4); prow.position.set(0, 11, 50); root.add(prow);
      add(new THREE.BoxGeometry(13, 7, 58), hull, 0, 11, 8);                   // main hull
      add(new THREE.BoxGeometry(11, 4, 34), dk, 0, 15, 12);                    // dorsal spine
      // forward triple-gun cluster over the prow
      add(new THREE.BoxGeometry(7, 3, 11), dk, 0, 16.5, 26);
      for (const ox of [-1.7, 0, 1.7]) add(new THREE.CylinderGeometry(0.42, 0.55, 26, 6), dk, ox, 17, 42, Math.PI / 2);
      // bridge + mast
      add(new THREE.BoxGeometry(6, 5, 9), hull, 0, 17, -6);
      add(new THREE.SphereGeometry(1.5, 8, 6), glow, 0, 20, -2);
      add(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), dk, 0, 24, -6);
      // side engine nacelle booms with thrusters
      for (const sx of [-1, 1]){
        add(new THREE.BoxGeometry(2.4, 2.6, 20), hull, sx * 9, 11, -6);        // outrigger boom
        add(new THREE.CylinderGeometry(2.6, 3.0, 16, 10), hull, sx * 12.5, 11, -30, Math.PI / 2);
        add(new THREE.SphereGeometry(2.3, 8, 6), thrust, sx * 12.5, 11, -41);
      }
      // rear triple main thrusters
      add(new THREE.BoxGeometry(12, 6, 9), dk, 0, 11, -24);
      for (const ox of [-3.2, 0, 3.2]) add(new THREE.SphereGeometry(2.1, 8, 6), thrust, ox, 11, -31);
    } else if (kind === 'chivvay'){ // Zeon heavy cruiser: bulky stacked hull, tall tower bridge
      const hull = new THREE.MeshStandardMaterial({ color: 0x7d5648, roughness: 0.6, metalness: 0.45 });
      add(new THREE.BoxGeometry(26, 14, 78), hull, 0, 14, -4);
      add(new THREE.BoxGeometry(30, 8, 30), hull, 0, 13, -10);                 // side sponsons
      add(new THREE.BoxGeometry(17, 8, 42), hull, 0, 25, 0);                   // upper deck
      add(new THREE.BoxGeometry(8, 12, 10), hull, 0, 33, -12);                 // tower
      add(new THREE.BoxGeometry(11, 3, 7), hull, 0, 40, -11);                  // bridge cap
      add(new THREE.SphereGeometry(1.8, 8, 6), glow, 0, 40, -7);
      const prow = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 26), hull);
      prow.position.set(0, 13, 46); prow.rotation.x = 0.06; root.add(prow);    // raked prow
      add(new THREE.BoxGeometry(21, 12, 14), hull, 0, 14, -48);                // engine block
      for (const sx of [-1, 1]){
        add(new THREE.SphereGeometry(3.4, 8, 6), thrust, sx * 6, 14, -56);
        add(new THREE.BoxGeometry(6, 3, 9), hull, sx * 8, 30, 14);             // wing turrets
        add(new THREE.CylinderGeometry(0.6, 0.6, 8, 6), hull, sx * 8, 31, 24, Math.PI / 2);
      }
    } else if (kind === 'salamis'){ // EFSF battleship (ref: long slab hull, foredeck twin turrets, tall bridge tower, rear hangar deck)
      const hull = new THREE.MeshStandardMaterial({ color: 0x6a6480, roughness: 0.55, metalness: 0.5 });
      const dk = new THREE.MeshStandardMaterial({ color: 0x49445c, roughness: 0.6, metalness: 0.5 });
      add(new THREE.BoxGeometry(16, 8, 64), hull, 0, 11, 8);                   // main hull
      const bow = new THREE.Mesh(new THREE.BoxGeometry(11, 6, 18), hull);      // tapered bow
      bow.position.set(0, 11, 46); bow.scale.set(0.6, 0.8, 1); root.add(bow);
      add(new THREE.BoxGeometry(7, 3.5, 8), hull, 0, 10, 54);
      // foredeck twin-gun turrets (the battleship's main battery)
      for (const tz of [33, 23]){
        add(new THREE.CylinderGeometry(3, 3.4, 2.4, 10), dk, 0, 15.4, tz);     // barbette
        add(new THREE.BoxGeometry(5.4, 2.6, 5.4), hull, 0, 16.8, tz);          // turret
        for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.45, 0.45, 9, 6), dk, sx, 17.2, tz + 7, Math.PI / 2);
      }
      // tall central superstructure + bridge + masts
      add(new THREE.BoxGeometry(9, 6, 13), hull, 0, 18, 2);
      add(new THREE.BoxGeometry(7, 5, 8), hull, 0, 23, 1);
      add(new THREE.BoxGeometry(5, 4, 5), dk, 0, 28, 1);                       // bridge
      add(new THREE.SphereGeometry(1.6, 8, 6), glow, 0, 30, 3.5);
      for (const mx of [-1.6, 1.6]) add(new THREE.CylinderGeometry(0.25, 0.25, 10, 6), dk, mx, 35, 1);
      add(new THREE.CylinderGeometry(0.22, 0.22, 8, 6), dk, 0, 35, -2);        // radar mast
      // amidships secondary turrets
      for (const sx of [-1, 1]){
        add(new THREE.BoxGeometry(3.4, 2, 4), dk, sx * 6, 15.4, 4);
        add(new THREE.CylinderGeometry(0.35, 0.35, 5, 6), dk, sx * 6, 16, 8, Math.PI / 2);
      }
      // rear raised hangar / flight deck, angled up at the stern
      const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 28), dk);
      deck.position.set(0, 13, -32); deck.rotation.x = -0.13; root.add(deck);
      add(new THREE.BoxGeometry(14, 1, 24), hull, 0, 18, -33);                 // deck plating
      // engines
      add(new THREE.CylinderGeometry(6.5, 6.5, 8, 12), hull, 0, 11, -46, Math.PI / 2);
      add(new THREE.SphereGeometry(3.4, 8, 6), thrust, 0, 11, -52);
      for (const sx of [-1, 1]){
        add(new THREE.CylinderGeometry(2, 2, 6, 8), hull, sx * 6, 9, -45, Math.PI / 2);
        add(new THREE.SphereGeometry(1.8, 8, 6), thrust, sx * 6, 9, -49);
      }
    } else if (kind === 'magellan'){ // EFSF flagship battleship: heavier than a Salamis — big paired turrets fore AND aft, tall conning tower
      const hull = new THREE.MeshStandardMaterial({ color: 0x5c667e, roughness: 0.5, metalness: 0.55 });
      const dk = new THREE.MeshStandardMaterial({ color: 0x3e4557, roughness: 0.6, metalness: 0.5 });
      add(new THREE.BoxGeometry(20, 10, 78), hull, 0, 12, 2);                  // main hull
      add(new THREE.BoxGeometry(14, 4, 70), dk, 0, 18, 0);                     // upper deck strake
      const bow = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 20), hull);      // wedge bow
      bow.position.set(0, 12, 50); bow.scale.set(0.6, 0.75, 1); root.add(bow);
      // the Magellan signature: heavy twin-cannon turrets, two forward + one aft
      for (const [tz, ty] of [[36, 21], [26, 21], [-30, 21]]){
        add(new THREE.CylinderGeometry(3.6, 4, 2.6, 10), dk, 0, ty - 1.6, tz); // barbette
        add(new THREE.BoxGeometry(7, 3.2, 7), hull, 0, ty, tz);                // turret
        for (const sx of [-1.4, 1.4]) add(new THREE.CylinderGeometry(0.6, 0.65, 12, 6), dk, sx, ty + 0.5, tz + (tz > 0 ? 9 : -9), Math.PI / 2);
      }
      // tall stepped conning tower amidships
      add(new THREE.BoxGeometry(10, 7, 14), hull, 0, 22, -2);
      add(new THREE.BoxGeometry(8, 6, 9), hull, 0, 28, -3);
      add(new THREE.BoxGeometry(5.5, 4.5, 5.5), dk, 0, 33, -3);                // bridge
      add(new THREE.SphereGeometry(1.8, 8, 6), glow, 0, 35, 0);
      add(new THREE.CylinderGeometry(0.25, 0.25, 11, 6), dk, 0, 41, -4);       // mast
      // side sponsons
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(4, 5, 30), dk, sx * 11, 12, 2);
      // engines: triple thruster bank
      add(new THREE.BoxGeometry(18, 9, 12), hull, 0, 12, -42);
      for (const ex of [-6, 0, 6]){
        add(new THREE.CylinderGeometry(2.4, 2.4, 6, 8), dk, ex, 12, -50, Math.PI / 2);
        add(new THREE.SphereGeometry(2.2, 8, 6), thrust, ex, 12, -54);
      }
    } else if (kind === 'columbus'){ // EFSF fleet carrier / supply hull: fat rounded box, cargo spine, light guns
      const hull = new THREE.MeshStandardMaterial({ color: 0x7d8291, roughness: 0.65, metalness: 0.4 });
      const dk = new THREE.MeshStandardMaterial({ color: 0x565b68, roughness: 0.7, metalness: 0.4 });
      add(new THREE.BoxGeometry(26, 15, 62), hull, 0, 13, 0);                  // fat hold
      const nose = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 16), hull);    // rounded bow block
      nose.position.set(0, 13, 38); nose.scale.set(0.75, 0.8, 1); root.add(nose);
      add(new THREE.BoxGeometry(20, 3, 50), dk, 0, 21.5, -2);                  // container spine
      for (const cz of [-18, -4, 10]) add(new THREE.BoxGeometry(16, 4, 10), hull, 0, 24, cz); // cargo modules
      add(new THREE.BoxGeometry(6, 5, 7), dk, 0, 25, 20);                      // small bridge
      add(new THREE.SphereGeometry(1.5, 8, 6), glow, 0, 26, 23.5);
      // light self-defense guns
      for (const sx of [-1, 1]){
        add(new THREE.BoxGeometry(3, 2, 3.6), dk, sx * 10, 21.5, 22);
        add(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), dk, sx * 10, 22, 25.5, Math.PI / 2);
      }
      // twin engines
      add(new THREE.BoxGeometry(20, 10, 10), dk, 0, 13, -35);
      for (const sx of [-6, 6]){
        add(new THREE.CylinderGeometry(3, 3, 6, 8), hull, sx, 13, -42, Math.PI / 2);
        add(new THREE.SphereGeometry(2.6, 8, 6), thrust, sx, 13, -46);
      }
    } else if (kind === 'solfortress'){ // Solomon — a hollowed-asteroid space fortress bristling with batteries
      const rock = new THREE.MeshStandardMaterial({ color: 0x595048, roughness: 0.95, metalness: 0.1 });
      const steel = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6, metalness: 0.5 });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(46, 1), rock); // craggy asteroid body
      core.position.set(0, 16, 0); core.scale.set(1, 0.8, 1.25); root.add(core);
      add(new THREE.CylinderGeometry(10, 14, 10, 6), steel, 0, 16, 40, Math.PI / 2); // armored maw / dock
      add(new THREE.SphereGeometry(3, 10, 8), glow, 0, 16, 47);
      // gun emplacements studded over the surface
      for (const [gx, gy, gz] of [[-26, 26, 22], [26, 24, 18], [-20, 4, 30], [22, 6, 28], [0, 34, 6], [-30, 14, -8], [30, 16, -6]]){
        add(new THREE.BoxGeometry(6, 4, 6), steel, gx, gy, gz);
        add(new THREE.CylinderGeometry(0.6, 0.6, 9, 6), steel, gx, gy + 1, gz + 6, Math.PI / 2);
      }
      add(new THREE.CylinderGeometry(0.3, 0.3, 16, 6), steel, 0, 44, 4); // comm mast
    } else if (kind === 'bigtray'){ // Federation land battleship: stepped wedge decks, big forward cannons
      const hull = new THREE.MeshStandardMaterial({ color: 0x9a8f6a, roughness: 0.7, metalness: 0.35 });
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(8, 5, 86), mat, sx * 14, 2.5, 0); // tread blocks
      add(new THREE.BoxGeometry(34, 8, 88), hull, 0, 8, 0);
      add(new THREE.BoxGeometry(26, 6, 58), hull, 0, 15, -10);
      add(new THREE.BoxGeometry(16, 5, 30), hull, 0, 20.5, -18);
      add(new THREE.BoxGeometry(8, 6, 10), hull, 0, 26, -28);                 // bridge
      add(new THREE.SphereGeometry(1.6, 8, 6), glow, 0, 26, -22.6);
      addTurret(hull, 0, 14, 26, 12, 4, 12, [-2.4, 2.4], 22, 0.85);           // articulated twin main turret
    } else if (kind === 'dabude'){ // Zeon land battleship: hovercraft skirt, camo decks, triple-gun turrets, twin radar fins
      const camoA = new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 0.75, metalness: 0.3 });
      const camoB = new THREE.MeshStandardMaterial({ color: 0x5b6358, roughness: 0.75, metalness: 0.3 });
      const skirtM = new THREE.MeshStandardMaterial({ color: 0x4a4658, roughness: 0.9 });
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 7, 18), skirtM);
      skirt.position.set(0, 3.5, 0); skirt.scale.z = 1.8; root.add(skirt);    // hover apron
      add(new THREE.BoxGeometry(40, 6, 86), camoA, 0, 9, 0);                  // main deck
      add(new THREE.BoxGeometry(30, 5, 60), camoB, 0, 14, -6);                // mid deck camo band
      add(new THREE.BoxGeometry(20, 6, 34), camoA, 0, 19, -14);               // upper works
      add(new THREE.BoxGeometry(10, 5, 12), camoB, 0, 24.5, -20);             // bridge
      add(new THREE.SphereGeometry(1.4, 8, 6), glow, 0, 24.5, -14.4);
      for (const sx of [-1, 1]){                                              // twin tall radar fins
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 16, 6), camoB);
        fin.position.set(sx * 9, 27, -28); fin.rotation.x = -0.08; root.add(fin);
      }
      add(new THREE.CylinderGeometry(0.25, 0.25, 12, 6), camoA, 0, 30, -22);  // antenna mast
      for (const [tx, tz] of [[-9, 24], [8, 4]])                              // offset triple-gun turrets (articulated)
        addTurret(camoB, tx, 14.5, tz, 11, 4.5, 12, [-2.6, 0, 2.6], 16, 0.6);
      for (const sx of [-1, 1])                                               // sponson guns
        add(new THREE.CylinderGeometry(0.4, 0.45, 10, 6), camoB, sx * 18.5, 11, 22, Math.PI / 2);
    } else if (kind === 'gallop'){ // heavy Zeon hover land-battleship (Odessa counterstrike): wide skirt, triple main turrets, twin sail-fins
      const camoA = new THREE.MeshStandardMaterial({ color: 0x9a8651, roughness: 0.78, metalness: 0.28 });
      const camoB = new THREE.MeshStandardMaterial({ color: 0x55604c, roughness: 0.78, metalness: 0.28 });
      const skirtM = new THREE.MeshStandardMaterial({ color: 0x4a4658, roughness: 0.92 });
      // wide segmented hover-cushion skirt extending past the hull on every side
      add(new THREE.BoxGeometry(64, 5, 116), skirtM, 0, 2.5, 0);
      add(new THREE.BoxGeometry(58, 3, 110), camoB, 0, 5.5, 0);               // skirt top rim
      // stepped main hull, camo banding
      add(new THREE.BoxGeometry(40, 9, 92), camoA, 0, 11, 0);
      add(new THREE.BoxGeometry(32, 7, 66), camoB, 0, 18, -6);
      add(new THREE.BoxGeometry(22, 7, 40), camoA, 0, 24, -12);
      // central command tower
      add(new THREE.BoxGeometry(12, 11, 14), camoA, 0, 32, -16);
      add(new THREE.BoxGeometry(15, 3.5, 9), camoB, 0, 39, -16);
      add(new THREE.SphereGeometry(2, 8, 6), glow, 0, 39, -10.5);
      add(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), camoA, 0, 47, -16);    // antenna mast
      // two large angled sail-fins at the rear
      for (const sx of [-1, 1]){
        const fin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 11), camoB);
        fin.position.set(sx * 9, 44, -30); fin.rotation.x = -0.42; fin.rotation.z = sx * 0.22;
        root.add(fin);
      }
      // forward triple-cannon main turrets on side sponsons (the signature long barrels) — articulated
      for (const sx of [-1, 1])
        addTurret(camoA, sx * 24, 13, 24, 14, 8, 20, [-2.2, 0, 2.2], 30, 0.85);
      // secondary twin turrets on the upper deck — articulated
      for (const sx of [-1, 1])
        addTurret(camoB, sx * 7, 28.5, 2, 8, 4.5, 9, [-1.3, 1.3], 14, 0.5);
    } else { // truck / transport
      add(new THREE.BoxGeometry(7, 5, 16), mat, 0, 3.5, 0);
      add(new THREE.BoxGeometry(6, 3, 5), mat, 0, 2.6, 9);
      add(new THREE.SphereGeometry(1.1, 8, 6), glow, 0, 6.5, 7);
    }
    root.position.copy(pos);
    if (hfn && !SPACE) root.position.y = groundY(pos.x, pos.z) + (isSpaceShip ? 26 : 0); // space hulls hover, landships sit on treads
    // ships are modelled prow-toward +Z; Zeon hulls spawn ahead of the player (+Z) so turn them
    // to face the oncoming Federation line (−Z), prow and main guns forward
    if (isShip) root.rotation.y = team === 'ZEON' ? Math.PI : 0;
    scene.add(root);
    const p = { kind, team, root, vel: new THREE.Vector3(), hp, maxHp: hp, alive: true,
      isProp: true, isShip,
      radius: kind === 'truck' ? 8 : kind === 'solfortress' ? 58
        : kind === 'bigtray' ? 55 : kind === 'dabude' ? 50 : kind === 'gallop' ? 30
        : kind === 'magellan' ? 46 : kind === 'columbus' ? 44 : isShip ? 42 : 17,
      hitY: kind === 'truck' ? 3 : kind === 'solfortress' ? 16
        : kind === 'bigtray' ? 17 : kind === 'dabude' ? 18 : kind === 'gallop' ? 11
        : isShip ? 13 : 9,
      gunT: rng.range(2, 4),
      // The Gallop is a fast transport with one rear artillery mount, not a super-heavy landship.
      // The Magellan is the Federation's gun-line flagship; the Columbus barely defends itself.
      gunRange: kind === 'gallop' ? 1150 : kind === 'solfortress' ? 1600 : kind === 'magellan' ? 1600 : kind === 'columbus' ? 1000 : isLandShip ? 950 : 1400,
      gunDmg: kind === 'gallop' ? 280 : isLandShip ? 480 : kind === 'magellan' ? 440 : kind === 'columbus' ? 220 : 360,
      gunSplash: isLandShip ? 16 : 12,
      gunRof: kind === 'gallop' ? [2.8, 4.2] : kind === 'solfortress' ? [1.4, 2.6] : kind === 'columbus' ? [4.2, 6.0] : isLandShip ? [3.6, 5.6] : [2.6, 4.2],
      gunShots: kind === 'solfortress' ? 4 : kind === 'magellan' ? 2 : 1,
      speed: 0, goal: null, arrived: false, escaped: false };
    // landships are long hulls — swap the single fat ball for a chain of spheres along the keel
    // (local: x=beam, z=prow) so both the damage hitbox and the physical block match the silhouette.
    const LAND_HS = {
      bigtray: [{ x: 0, y: 13, z: -37, r: 23 }, { x: 0, y: 14, z: 0, r: 25 }, { x: 0, y: 12, z: 37, r: 23 }],
      dabude:  [{ x: 0, y: 14, z: -29, r: 25 }, { x: 0, y: 16, z: 0, r: 26 }, { x: 0, y: 14, z: 29, r: 25 }],
      gallop:  [{ x: 0, y: 10, z: -17, r: 19 }, { x: 0, y: 11, z: 2, r: 27 }, { x: 0, y: 10, z: 19, r: 19 }],
    };
    if (LAND_HS[kind]) p.hitSpheres = LAND_HS[kind];
    // WEAK POINTS (world units — props render unscaled): the bridge/command tower and engine blocks.
    // Hitting them deals 2.5× damage. (local x=beam, y=up, z=prow)
    const SHIP_WEAK = {
      bigtray: [{ x: 0, y: 33, z: -10, r: 8, mult: 2.5 }],
      dabude:  [{ x: -5, y: 37, z: -13, r: 8, mult: 2.5 }],
      gallop:  [{ x: -9, y: 14, z: 16, r: 5, mult: 2.5 }, { x: 9, y: 14, z: 16, r: 5, mult: 2.5 },
                { x: -23, y: 13, z: -2, r: 5, mult: 2.0 }, { x: 23, y: 13, z: -2, r: 5, mult: 2.0 }],
      musai:   [{ x: 0, y: 17, z: -6, r: 6, mult: 2.5 }, { x: 0, y: 11, z: -28, r: 7, mult: 2.5 }],
      chivvay: [{ x: 0, y: 36, z: -12, r: 7, mult: 2.5 }, { x: 0, y: 14, z: -50, r: 9, mult: 2.5 }],
      salamis: [{ x: 0, y: 28, z: 1, r: 6, mult: 2.5 }, { x: 0, y: 11, z: -50, r: 9, mult: 2.5 }],
      magellan: [{ x: 0, y: 33, z: -3, r: 7, mult: 2.5 }, { x: 0, y: 12, z: -50, r: 9, mult: 2.5 }],
      columbus: [{ x: 0, y: 25, z: 20, r: 6, mult: 2.5 }, { x: 0, y: 13, z: -43, r: 9, mult: 2.5 }],
      solfortress: [{ x: 0, y: 16, z: 40, r: 12, mult: 2.5 }],
    };
    if (SHIP_WEAK[kind]) p.weakPoints = SHIP_WEAK[kind];
    if (shipTurrets.length) p.turrets = shipTurrets;
    props.push(p);
    return p;
  }
  function damageProp(p, dmg, hitPoint, attacker, weaponName = null){
    if (!p.alive) return;
    if (p.indestructible) return;   // map landmarks (church tower, town houses) are solid cover — absorb fire, never fall
    if (hitPoint && p.weakPoints){ // bridge / engine weak point on ships & structures
      const wm = weakMult(hitPoint, p.root.position, p.root.rotation.y, 1, p.weakPoints);
      if (wm > 1){ dmg *= wm; critSpark(hitPoint, !!(attacker && attacker.isPlayer)); }
    }
    p.hp -= dmg;
    if (p.hp <= 0){
      p.alive = false;
      if (!p.scenery && attacker) addKillNotice(attacker, weaponNoticeName(attacker, false, weaponName), p);
      if (p.scenery){ // authored map structure: rubble it, and cook off fuel/ammo dumps
        const big = p.big;
        explosion(p.root.position.clone().add(tmpV.set(0, 6, 0)), big ? 30 : 20,
          clamp(460 / p.root.position.distanceTo(player.root.position), 0.06, 0.45));
        if (big){
          for (let i = 0; i < 2; i++)
            explosion(p.root.position.clone().add(tmpV.set(rng.range(-10, 10), rng.range(2, 12), rng.range(-10, 10))), 22, 0.3);
          splashDamage(p.root.position.clone().add(tmpV.set(0, 6, 0)), 20, 260, attacker, weaponName);
        }
        setMsg((p.label || 'STRUCTURE') + ' DESTROYED', 1.6);
        scene.remove(p.root);
        return;
      }
      if (p.isShip){
        for (let i = 0; i < 4; i++)
          explosion(p.root.position.clone().add(tmpV.set(rng.range(-30, 30), rng.range(4, 20), rng.range(-40, 40))), 32,
            clamp(700 / p.root.position.distanceTo(player.root.position), 0.12, 0.45));
        killSoldiersNear(p.root.position, 50);
        setMsg(p.team === 'FED' ? `THE ${p.kind.toUpperCase()} IS LOST` : `ENEMY ${p.kind.toUpperCase()} DESTROYED`, 3);
      } else {
        explosion(p.root.position.clone().add(tmpV.set(0, 6, 0)), p.kind === 'truck' ? 12 : 22,
          clamp(420 / p.root.position.distanceTo(player.root.position), 0.06, 0.4));
        setMsg(p.team === 'FED'
          ? (p.kind === 'truck' ? 'CONVOY UNIT LOST' : 'FRIENDLY STRUCTURE DESTROYED')
          : (p.kind === 'truck' ? 'TRANSPORT DESTROYED' : 'TARGET STRUCTURE DESTROYED'), 2);
      }
      scene.remove(p.root);
    }
  }

  // ---------- authored map structures ----------
  // Military structures and city blocks → destructible NEUTRAL props; historic landmarks →
  // indestructible solid cover; roads, rivers, rubble, vegetation and rocks → ground dressing.
  const DESTRUCT_KINDS = new Set(['wall', 'gate', 'guntower', 'watchtower', 'radar', 'fueltank', 'hangar', 'barracks', 'bunker', 'commandpost', 'base', 'depot', 'cityblock']);
  const SOLID_KINDS = new Set(['churchtower', 'townhouse']);
  function buildMapStructures(map){
    const M = {
      stone:    new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95 }),
      dstone:   new THREE.MeshStandardMaterial({ color: 0x5f5a52, roughness: 0.95 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x767b74, roughness: 0.95 }),
      metal:    new THREE.MeshStandardMaterial({ color: 0x565c60, roughness: 0.7, metalness: 0.4 }),
      dmetal:   new THREE.MeshStandardMaterial({ color: 0x33383b, roughness: 0.7, metalness: 0.5 }),
      roof:     new THREE.MeshStandardMaterial({ color: 0x7e3b2c, roughness: 0.9 }),
      slate:    new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.85 }),
      glass:    new THREE.MeshStandardMaterial({ color: 0x1a1512, emissive: 0xffb454, emissiveIntensity: 0.8, roughness: 0.4 }),
      dish:     new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.6, metalness: 0.3 }),
      fuel:     new THREE.MeshStandardMaterial({ color: 0x8a7f56, roughness: 0.8, metalness: 0.2 }),
      red:      new THREE.MeshStandardMaterial({ color: 0xb23a2a, roughness: 0.7 }),
      foliage:  new THREE.MeshStandardMaterial({ color: 0x2c3a26, roughness: 1 }),
      foliage2: new THREE.MeshStandardMaterial({ color: 0x384a2e, roughness: 1 }),
      trunk:    new THREE.MeshStandardMaterial({ color: 0x40311f, roughness: 1 }),
      water:    new THREE.MeshStandardMaterial({ color: 0x2c3f47, roughness: 0.3, metalness: 0.1, emissive: 0x0d1a1f, emissiveIntensity: 0.4 }),
      road:     new THREE.MeshStandardMaterial({ color: 0x39342b, roughness: 1 }),
      rubble:   new THREE.MeshStandardMaterial({ color: 0x6b6459, roughness: 1 }),
      asphalt:  new THREE.MeshStandardMaterial({ color: 0x30373b, roughness: 0.98 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: 0xa9ada9, roughness: 0.94 }),
      lane:     new THREE.MeshBasicMaterial({ color: 0xf0e6bd, toneMapped: false }),
      city:     new THREE.MeshStandardMaterial({ color: 0x7f898f, roughness: 0.78, metalness: 0.12 }),
      city2:    new THREE.MeshStandardMaterial({ color: 0xa39f93, roughness: 0.84, metalness: 0.08 }),
      cityWarm: new THREE.MeshStandardMaterial({ color: 0x9d897b, roughness: 0.82, metalness: 0.08 }),
      cityPale: new THREE.MeshStandardMaterial({ color: 0xaab1b3, roughness: 0.8, metalness: 0.1 }),
      cityTrim: new THREE.MeshStandardMaterial({ color: 0x4b555d, roughness: 0.66, metalness: 0.32 }),
      cityGlass:new THREE.MeshStandardMaterial({ color: 0x365d78, emissive: 0x183247, emissiveIntensity: 0.28, roughness: 0.2, metalness: 0.46 }),
      cityGlassDark: new THREE.MeshStandardMaterial({ color: 0x243c4c, emissive: 0x102331, emissiveIntensity: 0.2, roughness: 0.25, metalness: 0.4 }),
    };
    const PLASTER = [0xc9a86a, 0xb98b52, 0xcbb488, 0xa86f4b, 0xbfa06a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }));
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); e.position.set(x, y, z); return e; };
    const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 10) => { const e = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); e.position.set(x, y, z); return e; };
    const cone = (r, h, m, x = 0, y = 0, z = 0, seg = 8) => { const e = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); e.position.set(x, y, z); return e; };
    const ico = (r, m, x = 0, y = 0, z = 0, det = 0) => { const e = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), m); e.position.set(x, y, z); return e; };

    // build a structure's mesh; returns { g, radius, hitY, hp, big, label, hitSpheres }
    function build(kind, s, variant, spec = {}){
      const g = new THREE.Group();
      let radius = 12 * s, hitY = 8 * s, hp = 800, big = false, label = kind.toUpperCase(), hitSpheres = null;
      switch (kind){
        case 'wall': {
          const L = 42 * s, h = 16 * s, th = 6 * s;
          g.add(box(L, h, th, M.stone, 0, h / 2, 0));
          for (let x = -L / 2 + 3; x <= L / 2 - 3; x += 6) g.add(box(3.4, 3.2, th + 0.6, M.dstone, x, h + 1.4, 0)); // crenellations
          g.add(box(L, 2, th + 1.2, M.dstone, 0, h - 1, 0)); // wall-walk lip
          hitY = h * 0.5; hp = 720 * s; label = 'RAMPART WALL';
          hitSpheres = [{ x: -L * 0.32, y: h * 0.5, z: 0, r: 10 * s }, { x: 0, y: h * 0.5, z: 0, r: 10 * s }, { x: L * 0.32, y: h * 0.5, z: 0, r: 10 * s }];
          break;
        }
        case 'gate': {
          const h = 24 * s, px = 18 * s;
          for (const sx of [-1, 1]){
            g.add(box(11 * s, h, 11 * s, M.stone, sx * px, h / 2, 0));
            g.add(box(12 * s, 3, 12 * s, M.dstone, sx * px, h + 1, 0)); // pillar cap
          }
          g.add(box(px * 2 + 11 * s, 5 * s, 8 * s, M.stone, 0, h - 2, 0)); // lintel
          g.add(box(px * 2 - 4 * s, 3, 6 * s, M.dmetal, 0, h - 5, 0));     // portcullis header
          hitY = h * 0.5; hp = 960 * s; label = 'TOWN GATE';
          hitSpheres = [{ x: -px, y: h * 0.5, z: 0, r: 8 * s }, { x: px, y: h * 0.5, z: 0, r: 8 * s }];
          break;
        }
        case 'guntower': {
          const h = 28 * s;
          g.add(box(14 * s, 4 * s, 14 * s, M.dstone, 0, 2 * s, 0));       // plinth
          g.add(cyl(6 * s, 7 * s, h, M.concrete, 0, h / 2 + 3 * s, 0, 12));
          g.add(box(12 * s, 6 * s, 12 * s, M.metal, 0, h + 4 * s, 0));    // gun house
          for (const sx of [-1, 1]) g.add(cyl(0.7 * s, 0.7 * s, 12 * s, M.dmetal, sx * 2 * s, h + 4 * s, 6 * s, 6).rotateX(Math.PI / 2)); // twin barrels fwd
          radius = 8 * s; hitY = h * 0.55; hp = 700 * s; label = 'GUN TOWER';
          break;
        }
        case 'watchtower': {
          const h = 30 * s;
          g.add(cyl(1.3 * s, 2.4 * s, h, M.dmetal, 0, h / 2, 0, 6));
          g.add(box(7 * s, 1.6 * s, 7 * s, M.metal, 0, h - 1, 0));        // platform
          g.add(cyl(0.3 * s, 0.3 * s, 9 * s, M.dmetal, 0, h + 4 * s, 0, 5)); // antenna
          g.add(ico(0.9 * s, M.red, 0, h + 8.5 * s, 0));                  // warning light
          radius = 5 * s; hitY = h * 0.5; hp = 420 * s; label = 'COMMS MAST';
          break;
        }
        case 'radar': {
          g.add(box(11 * s, 7 * s, 11 * s, M.metal, 0, 3.5 * s, 0));
          g.add(cyl(1.3 * s, 1.3 * s, 8 * s, M.dmetal, 0, 8 * s, 0, 8));
          const dish = cyl(8.5 * s, 8.5 * s, 1.2 * s, M.dish, 0, 13 * s, 1 * s, 16); dish.rotation.x = -0.9; g.add(dish);
          g.add(cyl(0.4 * s, 0.4 * s, 5 * s, M.dmetal, 0, 13 * s, 3 * s)); // feed horn
          radius = 9 * s; hitY = 8 * s; hp = 460 * s; label = 'RADAR ARRAY';
          break;
        }
        case 'fueltank': {
          for (const [dx, dz] of [[-6, -5], [6, -5], [0, 6]]){
            g.add(cyl(4.6 * s, 4.6 * s, 16 * s, M.fuel, dx * s, 8 * s, dz * s, 12));
            g.add(cyl(4.8 * s, 4.8 * s, 1.4 * s, M.red, dx * s, 12 * s, dz * s, 12)); // red band
            g.add(cyl(4.7 * s, 4.7 * s, 1 * s, M.dmetal, dx * s, 16.4 * s, dz * s, 12)); // cap
          }
          g.add(box(20 * s, 1.4 * s, 18 * s, M.dmetal, 0, 0.7 * s, 0));   // bund pad
          radius = 12 * s; hitY = 9 * s; hp = 520 * s; big = true; label = 'FUEL TANKS';
          break;
        }
        case 'hangar': {
          const w = 44 * s, h = 20 * s, L = 62 * s;
          g.add(box(w, h, L, M.metal, 0, h / 2, 0));
          const roof = cyl(w / 2, w / 2, L, M.dmetal, 0, h, 0, 16); roof.rotation.x = Math.PI / 2; g.add(roof); // quonset barrel roof
          g.add(box(w * 0.68, h * 0.85, 2, M.dmetal, 0, h * 0.42, L / 2 + 0.4)); // blast door
          g.add(box(w * 0.68, 1.5, 2.2, M.red, 0, h * 0.85, L / 2 + 0.5));
          hitY = h * 0.7; hp = 1500 * s; label = 'MS HANGAR';
          hitSpheres = [{ x: 0, y: h * 0.6, z: -L * 0.3, r: 17 * s }, { x: 0, y: h * 0.6, z: 0, r: 18 * s }, { x: 0, y: h * 0.6, z: L * 0.3, r: 17 * s }];
          break;
        }
        case 'barracks': {
          const L = 42 * s;
          g.add(box(L, 11 * s, 15 * s, M.concrete, 0, 5.5 * s, 0));
          g.add(box(L + 2, 2.4 * s, 16 * s, M.roof, 0, 11.5 * s, 0));     // low roof
          for (let x = -L / 2 + 5; x < L / 2; x += 8) g.add(box(2.4, 2.4, 0.4, M.glass, x, 6 * s, 7.6 * s));
          g.add(cyl(0.25, 0.25, 8 * s, M.dmetal, L / 2 - 3, 15 * s, 0));  // whip antenna
          hitY = 6 * s; hp = 620 * s; label = 'BARRACKS';
          hitSpheres = [{ x: -L * 0.32, y: 6 * s, z: 0, r: 11 * s }, { x: 0, y: 6 * s, z: 0, r: 11 * s }, { x: L * 0.32, y: 6 * s, z: 0, r: 11 * s }];
          break;
        }
        case 'bunker': {
          g.add(box(22 * s, 9 * s, 22 * s, M.concrete, 0, 4.5 * s, 0));
          g.add(box(17 * s, 3.5 * s, 17 * s, M.dstone, 0, 10 * s, 0));    // sloped cap
          g.add(box(19 * s, 2.2 * s, 2, M.dmetal, 0, 6 * s, 11 * s));     // firing slit
          radius = 13 * s; hitY = 5 * s; hp = 860 * s; label = 'PILLBOX';
          break;
        }
        case 'commandpost': {
          g.add(box(24 * s, 13 * s, 20 * s, M.concrete, 0, 6.5 * s, 0));
          g.add(box(19 * s, 3 * s, 15 * s, M.dstone, 0, 14 * s, 0));      // roof deck
          g.add(cyl(1.6 * s, 1.6 * s, 22 * s, M.dmetal, -8 * s, 15 * s, -4 * s, 8)); // comms mast
          g.add(ico(1.6 * s, M.glass, -8 * s, 27 * s, -4 * s));           // beacon
          g.add(box(11 * s, 6 * s, 13 * s, M.metal, 12 * s, 3 * s, 4 * s)); // annex
          radius = 15 * s; hitY = 8 * s; hp = 1400 * s; label = 'COMMAND POST';
          break;
        }
        case 'base': {
          g.add(box(28 * s, 16 * s, 22 * s, M.metal, 0, 8 * s, 0));
          g.add(cyl(2.4 * s, 2.4 * s, 16 * s, M.dmetal, -9 * s, 15 * s, -6 * s, 8));
          g.add(ico(3 * s, M.glass, -9 * s, 25 * s, -6 * s));
          g.add(box(12 * s, 7 * s, 16 * s, M.concrete, 13 * s, 3.5 * s, 4 * s));
          radius = 18 * s; hitY = 9 * s; hp = 2000 * s; label = 'GARRISON HQ';
          break;
        }
        case 'depot': {
          for (const dx of [-8, 9]) g.add(cyl(6.5 * s, 6.5 * s, 16 * s, M.metal, dx * s, 9 * s, 2 * s, 12));
          for (const [dx, dz] of [[-2, -9], [5, -9], [1, 10]]) g.add(box(7 * s, 6 * s, 7 * s, M.dstone, dx * s, 3 * s, dz * s)); // crates
          g.add(ico(2.2 * s, M.glass, 8 * s, 16 * s, 1 * s));
          radius = 15 * s; hitY = 9 * s; hp = 1100 * s; big = true; label = 'SUPPLY DEPOT';
          break;
        }
        case 'churchtower': {
          if (variant === 'dome'){
            const h = 24 * s;
            g.add(box(16 * s, h, 16 * s, M.stone, 0, h / 2, 0));
            const dome = new THREE.Mesh(new THREE.SphereGeometry(11 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.metal);
            dome.position.set(0, h, 0); g.add(dome);
            g.add(cyl(2 * s, 2 * s, 5 * s, M.dstone, 0, h + 10 * s, 0, 10)); // lantern
            g.add(cyl(0.3, 0.3, 5 * s, M.dmetal, 0, h + 15 * s, 0));         // finial
            radius = 11 * s; hitY = 14 * s;
          } else if (variant === 'keep'){
            const h = 40 * s;
            g.add(box(16 * s, h, 16 * s, M.dstone, 0, h / 2, 0));
            for (let x = -7 * s; x <= 7 * s; x += 4.6 * s) for (const dz of [-1, 1]) g.add(box(2.6 * s, 3 * s, 2.4 * s, M.stone, x, h + 1.4 * s, dz * 7 * s)); // battlements
            g.add(cyl(0.3, 0.3, 8 * s, M.dmetal, 0, h + 6 * s, 0));
            radius = 11 * s; hitY = h * 0.5;
          } else { // 'spire' (Gothic) or 'lean' (leaning tower)
            const inner = new THREE.Group(); g.add(inner);
            if (variant === 'lean') inner.rotation.z = 0.06;
            const h = variant === 'lean' ? 58 * s : 52 * s;
            inner.add(box(15 * s, h, 15 * s, M.stone, 0, h / 2, 0));
            inner.add(box(16 * s, 3 * s, 16 * s, M.dstone, 0, h, 0));       // belfry cornice
            for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) inner.add(cone(2.2 * s, 8 * s, M.slate, sx * 6.5 * s, h + 4 * s, sz * 6.5 * s, 4)); // corner turrets
            inner.add(cone(11.5 * s, variant === 'lean' ? 20 * s : 34 * s, M.slate, 0, h + (variant === 'lean' ? 12 : 19) * s, 0, 4)); // spire
            inner.add(box(3.4 * s, 3.4 * s, 0.4, M.glass, 0, h * 0.62, 7.6 * s)); // clock face
            radius = 11 * s; hitY = h * 0.5;
          }
          hp = 999999; label = 'TOWER';
          break;
        }
        case 'townhouse': {
          const plaster = PLASTER[Math.floor(rng.next() * PLASTER.length)];
          const w = 16 * s, h = 22 * s, d = 16 * s;
          g.add(box(w, h, d, plaster, 0, h / 2, 0));
          const roof = cone(w * 0.82, 11 * s, M.roof, 0, h + 5 * s, 0, 4); roof.rotation.y = Math.PI / 4; g.add(roof); // steep hip roof
          g.add(box(2 * s, 4 * s, 2 * s, M.dstone, w * 0.28, h + 4 * s, -d * 0.28)); // chimney
          for (let yy = 6; yy < h - 3; yy += 7) for (const xx of [-w * 0.26, w * 0.26]) g.add(box(2.2, 3, 0.4, M.glass, xx, yy, d / 2 + 0.1)); // windows
          radius = 10 * s; hitY = 10 * s; hp = 999999; label = 'TOWNHOUSE';
          break;
        }
        case 'cityblock': {
          const w = (spec.w || 104) * s, d = (spec.d || 148) * s, h = (spec.h || 64) * s;
          const slab = 1.2 * s, facade = variant === 'civic' ? M.city2
            : variant === 'apartment' ? M.cityWarm : variant === 'office' ? M.cityPale : M.city;
          const glazing = variant === 'apartment' ? M.cityGlassDark : M.cityGlass;
          // Raised pavement slab makes every footprint read as a complete city block rather than
          // a box dropped on terrain. The four corner piers carry the visual mass at MS scale.
          g.add(box(w + 12 * s, slab, d + 12 * s, M.sidewalk, 0, slab / 2, 0));
          if (variant === 'tower'){
            const podiumH = Math.min(15 * s, h * 0.2), upperH = h - podiumH;
            g.add(box(w, podiumH, d, M.city2, 0, slab + podiumH / 2, 0));
            g.add(box(w * 0.74, upperH, d * 0.72, facade, 0, slab + podiumH + upperH / 2, 0));
          } else {
            g.add(box(w, h, d, facade, 0, slab + h / 2, 0));
          }

          const bodyW = variant === 'tower' ? w * 0.74 : w;
          const bodyD = variant === 'tower' ? d * 0.72 : d;
          const bodyBase = variant === 'tower' ? slab + Math.min(15 * s, h * 0.2) : slab;
          const bodyH = h - (bodyBase - slab);
          const faceY = bodyBase + bodyH * 0.53;
          const glassH = bodyH * (variant === 'civic' ? 0.52 : 0.72);
          g.add(box(bodyW * 0.76, glassH, .5 * s, glazing, 0, faceY, bodyD / 2 + .3 * s));
          g.add(box(bodyW * 0.76, glassH, .5 * s, glazing, 0, faceY, -bodyD / 2 - .3 * s));
          g.add(box(.5 * s, glassH, bodyD * 0.76, glazing, bodyW / 2 + .3 * s, faceY, 0));
          g.add(box(.5 * s, glassH, bodyD * 0.76, glazing, -bodyW / 2 - .3 * s, faceY, 0));
          for (const sx of [-1, 1]) for (const sz of [-1, 1])
            g.add(box(2.2 * s, bodyH, 2.2 * s, M.cityTrim,
              sx * (bodyW / 2 - 1.1 * s), bodyBase + bodyH / 2, sz * (bodyD / 2 - 1.1 * s)));

          // Strong horizontal floor bands keep the facade legible without hundreds of tiny windows.
          const floors = Math.max(3, Math.min(8, Math.round(bodyH / (12 * s))));
          for (let i = 1; i < floors; i++){
            const y = bodyBase + bodyH * i / floors;
            g.add(box(bodyW * .84, .55 * s, .75 * s, M.cityTrim, 0, y, bodyD / 2 + .5 * s));
            g.add(box(bodyW * .84, .55 * s, .75 * s, M.cityTrim, 0, y, -bodyD / 2 - .5 * s));
            if (variant === 'apartment'){
              g.add(box(bodyW * .72, .45 * s, 4.2 * s, M.city2, 0, y - 1.2 * s, bodyD / 2 + 2 * s));
              g.add(box(bodyW * .72, .45 * s, 4.2 * s, M.city2, 0, y - 1.2 * s, -bodyD / 2 - 2 * s));
            }
          }
          // Rooftop plant, water tank and aerial give each block a useful skyline silhouette.
          g.add(box(bodyW * .32, 5 * s, bodyD * .26, M.cityTrim, 0, slab + h + 2.5 * s, 0));
          if (variant === 'tower'){
            g.add(cyl(1.2 * s, 1.2 * s, 9 * s, M.dmetal, bodyW * .2, slab + h + 8.5 * s, 0, 8));
            g.add(cyl(.22 * s, .22 * s, 13 * s, M.dmetal, -bodyW * .18, slab + h + 10 * s, -bodyD * .12, 6));
            g.add(ico(.7 * s, M.red, -bodyW * .18, slab + h + 16.5 * s, -bodyD * .12));
          }
          radius = Math.max(w, d) * .47;
          hitY = slab + h * .5; hp = (1450 + h * 18) * Math.max(.72, s); big = h > 70;
          label = variant === 'civic' ? 'CIVIC BUILDING' : variant === 'apartment' ? 'APARTMENT BLOCK' : 'CITY BUILDING';
          const hitR = Math.min(bodyW, bodyD) * .4;
          hitSpheres = [
            { x: 0, y: slab + h * .22, z: 0, r: hitR },
            { x: 0, y: slab + h * .52, z: 0, r: hitR },
            { x: 0, y: slab + h * .82, z: 0, r: hitR },
          ];
          break;
        }
        case 'cityroad': {
          const L = (spec.length || 900) * s, w = (spec.width || 54) * s;
          g.add(box(w, .42 * s, L, M.asphalt, 0, .22 * s, 0));
          for (const sx of [-1, 1]){
            g.add(box(7 * s, .9 * s, L, M.sidewalk, sx * (w / 2 + 3.5 * s), .45 * s, 0));
            g.add(box(.52 * s, .08 * s, L * .98, M.lane, sx * w * .37, .48 * s, 0));
          }
          // Double center lines remain cheap to render and readable from both cockpit and chase views.
          g.add(box(.38 * s, .09 * s, L * .98, M.lane, -1.1 * s, .49 * s, 0));
          g.add(box(.38 * s, .09 * s, L * .98, M.lane, 1.1 * s, .49 * s, 0));
          return { g, mode: 'decor' };
        }
        case 'landingpad': {
          g.add(cyl(22 * s, 22 * s, 0.6, M.concrete, 0, 0.3, 0, 24));
          g.add(cyl(15 * s, 15 * s, 0.7, M.dmetal, 0, 0.4, 0, 24));
          for (let a = 0; a < 6; a++){ const th = a / 6 * Math.PI * 2; g.add(ico(1.1 * s, M.glass, Math.cos(th) * 19 * s, 0.8, Math.sin(th) * 19 * s)); }
          return { g, mode: 'decor' };
        }
        case 'road': {
          const L = 120 * s;
          g.add(box(16 + 4 * s, 0.5, L, M.road, 0, 0.3, 0)); // long axis = Z (assault/crossing)
          for (let z = -L / 2 + 10; z < L / 2; z += 20) g.add(box(1.2, 0.55, 6, M.dstone, 0, 0.35, z)); // centre dashes
          return { g, mode: 'decor' };
        }
        case 'river': {
          const L = 340 * s;
          const w = new THREE.Mesh(new THREE.BoxGeometry(L, 1.2, 34 * s), M.water); w.position.set(0, -0.9, 0); g.add(w); // long axis = X (E-W)
          for (const dz of [-1, 1]) g.add(box(L, 2.2, 3, M.rubble, 0, 0.4, dz * 18 * s)); // stone embankments
          return { g, mode: 'decor' };
        }
        case 'rubble': {
          const R = 22 * s;
          for (let i = 0; i < 14; i++){ const a = rng.next() * 7, d = rng.next() * R; g.add(ico(rng.range(1.4, 4) * s, M.rubble, Math.cos(a) * d, rng.range(0.4, 2.4) * s, Math.sin(a) * d, 0)); }
          for (let i = 0; i < 5; i++){ const a = rng.next() * 7, d = rng.next() * R; const b = box(rng.range(3, 7) * s, rng.range(3, 6) * s, rng.range(3, 7) * s, M.dstone, Math.cos(a) * d, 1.5 * s, Math.sin(a) * d); b.rotation.set(rng.next(), rng.next() * 3, rng.next()); g.add(b); }
          return { g, mode: 'decor' };
        }
        case 'treecluster': {
          const R = 42 * s;
          for (let i = 0; i < 16; i++){
            const a = rng.next() * 7, d = rng.next() * R, tx = Math.cos(a) * d, tz = Math.sin(a) * d, th = rng.range(10, 18);
            g.add(cyl(0.7, 1.1, th * 0.4, M.trunk, tx, th * 0.2, tz, 5));
            g.add(cone(rng.range(3.5, 5.5), th, rng.next() > 0.5 ? M.foliage : M.foliage2, tx, th * 0.55, tz, 6));
          }
          return { g, mode: 'decor' };
        }
        case 'rockcluster': {
          const R = 28 * s;
          for (let i = 0; i < 9; i++){ const a = rng.next() * 7, d = rng.next() * R; const r = rng.range(3, 9) * s; const e = ico(r, M.rubble, Math.cos(a) * d, r * 0.35, Math.sin(a) * d, 0); e.rotation.set(rng.next() * 3, rng.next() * 3, 0); g.add(e); }
          return { g, mode: 'decor' };
        }
        default: return { g, mode: 'decor' };
      }
      return { g, mode: SOLID_KINDS.has(kind) ? 'solid' : DESTRUCT_KINDS.has(kind) ? 'destruct' : 'decor', radius, hitY, hp, big, label, hitSpheres };
    }

    for (const st of map.structures){
      const s = st.scale || 1;
      const r = build(st.kind, s, st.variant, st);
      const gy = groundY(st.x, st.z);
      r.g.position.set(st.x, gy, st.z);
      r.g.rotation.y = st.rotY || 0;
      scene.add(r.g);
      if (r.mode === 'decor') continue;
      const destructible = r.mode === 'destruct';
      const p = { kind: 'struct', structKind: st.kind, team: 'NEUTRAL', root: r.g, alive: true,
        // Authored scenery is identical solid cover for both PvP pilots. Keeping it
        // indestructible in a duel prevents one client removing a building that the
        // other client still renders and collides with.
        isProp: true, isShip: false, scenery: true, indestructible: PVP || !destructible,
        radius: r.radius, hitY: r.hitY, hp: r.hp, maxHp: r.hp, big: r.big, label: r.label,
        vel: new THREE.Vector3(), goal: null };
      if (r.hitSpheres) p.hitSpheres = r.hitSpheres;
      props.push(p);
    }
  }
  if (activeMap) buildMapStructures(activeMap);

  const missionProps = [];
  if (mission.type === 'defend'){
    for (const [ang, d, kind] of [[150, 70, 'base'], [210, 95, 'depot'], [255, 60, 'base']])
      missionProps.push(spawnProp(kind, 'FED', ringPos(ang, d), 2600));
  } else if (mission.type === 'assault'){
    const ang = rng.range(-35, 35);
    for (let i = 0; i < 3; i++)
      missionProps.push(spawnProp(i === 1 ? 'base' : 'depot', 'ZEON',
        ringPos(ang + rng.range(-16, 16), rng.range(700, 920)), 2200));
  } else if (mission.type === 'escort'){
    for (let i = 0; i < 3; i++){
      const t = spawnProp('truck', 'FED', ringPos(170 + i * 25, 120 + i * 30), 1100);
      t.speed = 10; t.goal = mission.goal;
      missionProps.push(t);
    }
  } else if (mission.type === 'ambush'){
    for (let i = 0; i < (mission.transports || 3); i++){
      const t = spawnProp('truck', 'ZEON',
        mission.start.clone().add(new THREE.Vector3(rng.range(-70, 70), 0, rng.range(-70, 70))), 1100);
      t.speed = 13; t.goal = mission.goal;
      missionProps.push(t);
    }
  } else if (mission.type === 'shipkill'){
    missionProps.push(spawnProp(mission.ship || 'musai', 'ZEON',
      ringPos(rng.range(-35, 35), rng.range(850, 1000), 120),
      mission.ship === 'chivvay' ? 12000 : 10000));
  } else if (mission.type === 'shipdefend'){
    const ship = mission.ship || 'salamis';
    missionProps.push(spawnProp(ship, 'FED', ringPos(184, 165, 30), 10000),
                      spawnProp(ship, 'FED', ringPos(208, 165, 30), 10000));
    // a flight of four Saberfish flies escort for the cruisers
    for (let i = 0; i < 4; i++)
      spawnMech({ suitId: 'saberfish' }, 'FED', ringPos(178 + i * 14, 150, 55), { hpFrac: 1 });
  }
  // Odessa: two landships anchor each side of the front
  const landF = [], landZ = [];
  if (mission.type === 'odessa'){
    const zShip = mission.zeonShip || 'dabude';
    const zHp = zShip === 'gallop' ? 22000 : 20000;
    landF.push(spawnProp('bigtray', 'FED', ringPos(162, 640), 20000),
               spawnProp('bigtray', 'FED', ringPos(198, 640), 20000));
    landZ.push(spawnProp(zShip, 'ZEON', ringPos(-18, 1080), zHp),
               spawnProp(zShip, 'ZEON', ringPos(18, 1080), zHp));
    // rear-area bases behind the Zeon line (optional targets)
    for (const [ang, dd, kind] of [[-32, 1180, 'base'], [0, 1250, 'depot'], [32, 1180, 'base']])
      spawnProp(kind, 'ZEON', ringPos(ang, dd), 2600);
  }

  // Operation Solomon — opposing capital-ship fleets with fighter screens
  const fleetF = [], fleetZ = [];
  if (mission.type === 'fleet'){
    const placeFleet = (specMap, team, arr, baseAng, baseDist) => {
      const list = [];
      for (const [kind, n] of Object.entries(specMap)) for (let i = 0; i < n; i++) list.push(kind);
      list.forEach((kind, i) => {
        const ang = baseAng + ((i % 7) - 3) * 11, dist = baseDist + Math.floor(i / 7) * 115;
        // the fortress is the boss of the assault phase — tough, but a surviving battle line brings it down
        const hp = kind === 'solfortress' ? 40000 : kind === 'magellan' ? 14000 : kind === 'chivvay' ? 12000 : kind === 'columbus' ? 8000 : 10000;
        arr.push(spawnProp(kind, team, kind === 'solfortress' ? ringPos(0, 1050, 0) : ringPos(ang, dist, 280), hp));
      });
    };
    placeFleet(mission.allyShips || { salamis: 20 }, 'FED', fleetF, 180, 240);
    placeFleet(mission.enemyShips || { musai: 15, chivvay: 4 }, 'ZEON', fleetZ, 0, 980);
    // fighter screens (counts come from the contract; computed from war production)
    for (let i = 0; i < (mission.fighters && mission.fighters.fed || 0); i++)
      spawnMech({ suitId: 'saberfish' }, 'FED', ringPos(180 + ((i % 9) - 4) * 8, 200 + Math.floor(i / 9) * 45, 220), {});
    for (let i = 0; i < (mission.fighters && mission.fighters.zeon || 0); i++)
      spawnMech({ suitId: rng.chance(0.5) ? 'gattle' : 'dopp' }, 'ZEON', ringPos(((i % 9) - 4) * 8, 920 + Math.floor(i / 9) * 45, 240), {});
  }

  // custom sortie: landships fielded from the loadout screen fight as full combatants
  // (enemy → ZEON ahead of the line, ally → FED at the player's back)
  if (mission.customShips){
    for (const cs of mission.customShips){
      const hp = cs.kind === 'gallop' ? 22000 : 20000;
      const pos = cs.pos ? new THREE.Vector3(cs.pos.x, SPACE ? rng.range(-120, 120) : 0, cs.pos.z) // per-entry deployment marker
        : cs.team === 'ZEON'
        ? ringPos(rng.range(-30, 30), cs.dist ? enemyDistBand(cs.dist) : rng.range(720, 1000), 120)
        : ringPos(rng.range(165, 195), cs.dist ? allyDistBand(cs.dist) : rng.range(160, 300), 60);
      missionProps.push(spawnProp(cs.kind, cs.team, pos, hp));
    }
  }

  // ---------- infantry: thousands of instanced ground soldiers ----------
  const infantry = { units: [], meshes: null, aliveF: 0, aliveZ: 0, t: 0, fireT: 2, cursor: 0,
    nextIdx: { FED: 0, ZEON: 0 }, capacities: { FED: 0, ZEON: 0 },
    goalF: { x: 0, z: -640 }, goalZ: { x: 0, z: 1080 }, dummy: new THREE.Object3D() };
  // APC payloads deploy at battle start. Keep their soldiers close to the carrier instead of
  // scattering them through the mission's normal mass-infantry arcs.
  const carrierPassengers = { FED: [], ZEON: [] };
  if (hfn){
    for (const carrier of mechs){
      const capacity = carrier.suit.troopCapacity || 0;
      if (capacity) carrier.passengersDeployed = true;
      for (let i = 0; i < capacity; i++){
        const a = i / Math.max(1, capacity) * Math.PI * 2 + rng.range(-0.18, 0.18);
        const d = rng.range(4.5, 9);
        carrierPassengers[carrier.team].push({
          x: carrier.root.position.x + Math.sin(a) * d,
          z: carrier.root.position.z + Math.cos(a) * d,
        });
      }
    }
    const carriedF = carrierPassengers.FED.length, carriedZ = carrierPassengers.ZEON.length;
    if (carriedF || carriedZ){
      mission.soldiers = {
        fed: (mission.soldiers?.fed || 0) + carriedF,
        zeon: (mission.soldiers?.zeon || 0) + carriedZ,
      };
    }
  }
  if (landF.length){
    infantry.goalF = { x: (landF[0].root.position.x + landF[1].root.position.x) / 2,
                       z: (landF[0].root.position.z + landF[1].root.position.z) / 2 };
    infantry.goalZ = { x: (landZ[0].root.position.x + landZ[1].root.position.x) / 2,
                       z: (landZ[0].root.position.z + landZ[1].root.position.z) / 2 };
  }
  if (hfn){
    // Leave inexpensive instance slots for APCs arriving in reserves, delayed waves,
    // and survival reinforcements. Only live soldiers count/render, so the headroom
    // has negligible draw cost while supporting up to 64 later eight-seat carriers.
    const DYNAMIC_INFANTRY_SLOTS = 512;
    const mkArmy = (team, count, color, angLo, angHi, dLo, dHi) => {
      const maxInstances = count + DYNAMIC_INFANTRY_SLOTS;
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 1.9, 0.5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }), maxInstances);
      im.count = count;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      for (let i = 0; i < count; i++){
        const carried = carrierPassengers[team][i];
        const a = rng.range(angLo, angHi) * Math.PI / 180, dd = rng.range(dLo, dHi);
        const u = { team, idx: i, alive: true,
          x: carried ? carried.x : Math.sin(a) * dd + rng.range(-50, 50),
          z: carried ? carried.z : Math.cos(a) * dd + rng.range(-50, 50),
          hold: rng.range(140, 720), speed: rng.range(4, 8) };
        infantry.units.push(u);
        infantry.dummy.position.set(u.x, groundY(u.x, u.z) + 0.95, u.z);
        infantry.dummy.rotation.y = 0; infantry.dummy.scale.setScalar(1);
        infantry.dummy.updateMatrix();
        im.setMatrixAt(i, infantry.dummy.matrix);
      }
      infantry.nextIdx[team] = count;
      infantry.capacities[team] = maxInstances;
      im.instanceMatrix.needsUpdate = true;
      return im;
    };
    infantry.meshes = {
      FED: mkArmy('FED', mission.soldiers?.fed || 0, 0x3a516b, 115, 245, 120, 1000),
      ZEON: mkArmy('ZEON', mission.soldiers?.zeon || 0, 0x6b5a39, -55, 55, 450, 1350),
    };
    infantry.aliveF = mission.soldiers?.fed || 0;
    infantry.aliveZ = mission.soldiers?.zeon || 0;

    deployCarrierPassengers = carrier => {
      const count = carrier.suit.troopCapacity || 0;
      if (!count || carrier.passengersDeployed || !carrier.alive) return;
      carrier.passengersDeployed = true;
      const team = carrier.team, im = infantry.meshes[team];
      for (let i = 0; i < count; i++){
        const idx = infantry.nextIdx[team];
        if (idx >= infantry.capacities[team]) break;
        const a = i / Math.max(1, count) * Math.PI * 2 + rng.range(-0.18, 0.18);
        const d = rng.range(4.5, 9);
        const u = {
          team, idx, alive: true,
          x: carrier.root.position.x + Math.sin(a) * d,
          z: carrier.root.position.z + Math.cos(a) * d,
          hold: rng.range(140, 720), speed: rng.range(4, 8),
        };
        infantry.units.push(u);
        infantry.dummy.position.set(u.x, groundY(u.x, u.z) + 0.95, u.z);
        infantry.dummy.rotation.y = carrier.yaw;
        infantry.dummy.scale.setScalar(1);
        infantry.dummy.updateMatrix();
        im.setMatrixAt(idx, infantry.dummy.matrix);
        infantry.nextIdx[team] = idx + 1;
        im.count = infantry.nextIdx[team];
        if (team === 'FED') infantry.aliveF++; else infantry.aliveZ++;
      }
      // InstancedMesh caches its first rendered bounds. Reinforcement passengers
      // may spawn far from the opening army, so rebuild the cache after extending it.
      im.boundingBox = null;
      im.boundingSphere = null;
      im.computeBoundingSphere();
      im.instanceMatrix.needsUpdate = true;
    };
  }
  function killSoldier(u){
    if (!u.alive) return;
    u.alive = false;
    if (u.team === 'FED') infantry.aliveF--; else infantry.aliveZ--;
    infantry.dummy.position.set(u.x, -100, u.z);
    infantry.dummy.scale.setScalar(0.001);
    infantry.dummy.updateMatrix();
    infantry.meshes[u.team].setMatrixAt(u.idx, infantry.dummy.matrix);
    infantry.meshes[u.team].instanceMatrix.needsUpdate = true;
  }
  function killSoldiersNear(pos, r){
    if (!infantry.units.length) return;
    const r2 = r * r;
    for (const u of infantry.units){
      if (!u.alive) continue;
      const dx = u.x - pos.x, dz = u.z - pos.z;
      if (dx * dx + dz * dz < r2) killSoldier(u);
    }
  }
  function infantryUpdate(dt){
    const N = infantry.units.length;
    if (!N) return;
    const dummy = infantry.dummy;
    // advance a rotating slice of the armies toward the enemy landships
    const slice = Math.min(400, N);
    for (let k = 0; k < slice; k++){
      const u = infantry.units[(infantry.cursor + k) % N];
      if (!u.alive) continue;
      const tgt = u.team === 'FED' ? infantry.goalZ : infantry.goalF;
      const dx = tgt.x - u.x, dz = tgt.z - u.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > u.hold){
        const step = u.speed * dt * (N / slice);
        u.x += dx / d * step; u.z += dz / d * step;
      }
      dummy.position.set(u.x, groundY(u.x, u.z) + 0.95, u.z);
      dummy.rotation.y = Math.atan2(dx, dz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      infantry.meshes[u.team].setMatrixAt(u.idx, dummy.matrix);
    }
    infantry.cursor = (infantry.cursor + slice) % N;
    infantry.meshes.FED.instanceMatrix.needsUpdate = true;
    infantry.meshes.ZEON.instanceMatrix.needsUpdate = true;
    // front-line attrition where the armies meet
    infantry.t -= dt;
    if (infantry.t <= 0){
      infantry.t = 0.6;
      for (let i = 0; i < 40; i++){
        const u = infantry.units[rng.int(0, N - 1)];
        const v = infantry.units[rng.int(0, N - 1)];
        if (!u.alive || !v.alive || u.team === v.team) continue;
        if (Math.hypot(u.x - v.x, u.z - v.z) < 140){
          killSoldier(rng.chance(0.5) ? u : v);
          if (rng.chance(0.25)) dust(tmpV.set(u.x, groundY(u.x, u.z), u.z), 2);
        }
      }
    }
    // massed small-arms fire chips at any armor wading into the infantry
    infantry.fireT -= dt;
    if (infantry.fireT <= 0){
      infantry.fireT = 2;
      for (const m of mechs){
        if (!m.alive) continue;
        const mx = m.root.position.x, mz = m.root.position.z;
        let n = 0;
        for (const u of infantry.units)
          if (u.alive && u.team !== m.team && Math.abs(u.x - mx) < 200 && Math.abs(u.z - mz) < 200) n++;
        if (n){
          const team = m.team === 'FED' ? 'ZEON' : 'FED';
          damage(m, Math.min(60, n * 0.2),
            m.root.position.clone().setY(m.root.position.y + 5),
            { name: `${team} INFANTRY`, team }, false, 'SMALL ARMS');
        }
      }
    }
  }
  // allied capital ship riding with the player (e.g. the Salamis in an invasion);
  // it fights with its batteries and the operation fails if it is destroyed
  const allyShipProp = mission.allyShip
    ? spawnProp(mission.allyShip, 'FED', ringPos(200, 170, 30), 10000) : null;

  // staged assault waves (fleet defense): each commits as the previous one thins out
  const waveQueue = (mission.waves || []).map((specs, i) => ({
    specs, msg: `${['SECOND', 'THIRD', 'FOURTH'][i] || 'NEXT'} ATTACK WAVE INBOUND` }));
  const totalWaves = 1 + waveQueue.length;
  let waveCd = 0;
  let missionT = mission.type === 'survive' ? (mission.time || 120) : 0;
  let nextWaveT = 24;

  // ---------- abstract battlefield (blips) ----------
  const blips = [];
  if (opts.sim){
    const nF = clamp(Math.round(opts.sim.fed / 16), 2, 10);
    const nZ = clamp(Math.round(opts.sim.zeon / 16), 2, 10);
    const mkBlip = team => blips.push({
      team, hp: 1, tSkirmish: rng.range(3, 9),
      pos: new THREE.Vector3().randomDirection().setY(0).multiplyScalar(rng.range(2200, 4800))
        .add(new THREE.Vector3(0, SPACE ? rng.range(-400, 400) : 0, 0)),
    });
    for (let i = 0; i < nF; i++) mkBlip('FED');
    for (let i = 0; i < nZ; i++) mkBlip('ZEON');
  }
  const zeonPool = opts.zeonPool || ['zaku2', 'zaku2b', 'gouf', 'dom'];

  // ---------- projectiles & particles ----------
  // shapes are slim and velocity-aligned so what you see is the actual hit line
  const projectiles = [], particles = [];
  const FWD = new THREE.Vector3(0, 0, 1);
  const beamGeo = new THREE.BoxGeometry(0.24, 0.24, 12);   // beam bolt
  const mgGeo = new THREE.BoxGeometry(0.16, 0.16, 2.6);    // tracer round
  const bzGeo = new THREE.ConeGeometry(0.5, 2.6, 8);       // finned shell (apex forward)
  const missileGeo = new THREE.ConeGeometry(0.32, 3.4, 8); // guided missile (apex forward)
  const beamMatF = new THREE.MeshBasicMaterial({ color: 0xff9ae0 });
  const beamMatZ = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  const mgMat = new THREE.MeshBasicMaterial({ color: 0xffd070 });
  const bzMat = new THREE.MeshBasicMaterial({ color: 0xff8844 });
  const missileMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  // a literal bomb: cylindrical body + cone nose (+Y) + crossed tail fins (-Y), so it falls nose-first
  const bombBodyGeo = new THREE.CylinderGeometry(0.34, 0.34, 1.7, 8);
  const bombNoseGeo = new THREE.ConeGeometry(0.34, 0.7, 8);
  const bombFinGeo = new THREE.BoxGeometry(0.75, 0.55, 0.08);
  const bombMat = new THREE.MeshStandardMaterial({ color: 0x2a2c26, roughness: 0.7, metalness: 0.3 });
  function makeBomb(){
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bombBodyGeo, bombMat));
    const nose = new THREE.Mesh(bombNoseGeo, bombMat); nose.position.y = 1.2; g.add(nose);
    for (const rot of [0, Math.PI / 2]){ const f = new THREE.Mesh(bombFinGeo, bombMat); f.position.y = -0.85; f.rotation.y = rot; g.add(f); }
    return g;
  }
  // authentic cannon rounds: a machined body + ogive nose + copper driving band + base. AP rounds (direct
  // cannon) wear a hardened windscreen tip; HE rounds (artillery) are fatter. Local +Y is the nose (travel dir).
  const shellBodyMat = new THREE.MeshStandardMaterial({ color: 0x707565, roughness: 0.5, metalness: 0.75 });
  const shellBandMat = new THREE.MeshStandardMaterial({ color: 0xb9832e, roughness: 0.4, metalness: 0.85 }); // copper driving band
  const shellTipMat = new THREE.MeshStandardMaterial({ color: 0x33362f, roughness: 0.55, metalness: 0.6 });
  function makeShell(sc = 1, ap = false){
    const g = new THREE.Group();
    const r = 0.34 * sc, bodyLen = 2.0 * sc, noseLen = (ap ? 1.7 : 1.2) * sc;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, bodyLen, 12), shellBodyMat); g.add(body);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(r * (ap ? 0.1 : 0.3), r, noseLen, 12), ap ? shellTipMat : shellBodyMat);
    nose.position.y = bodyLen / 2 + noseLen / 2; g.add(nose);
    if (ap){ const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.14, 8, 6), shellTipMat); cap.position.y = bodyLen / 2 + noseLen; g.add(cap); }
    else { const fuze = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.3, 0.3 * sc, 10), shellTipMat); fuze.position.y = bodyLen / 2 + noseLen; g.add(fuze); }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.07, r * 1.07, 0.3 * sc, 12), shellBandMat); band.position.y = -bodyLen * 0.28; g.add(band);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.72, 0.4 * sc, 12), shellTipMat); base.position.y = -bodyLen / 2 - 0.16 * sc; g.add(base);
    return g;
  }
  function sendPvpShot(m, projectile, kind){
    if (!PVP || m !== player || !projectile) return;
    if (pvpSend({
      type: 'shot',
      kind,
      weaponIndex: m.wi,
      position: projectile.pos.toArray(),
      velocity: projectile.vel.toArray(),
      life: projectile.life,
    })) pvpShotsSent++;
  }
  const boomGeo = new THREE.SphereGeometry(1, 10, 8);
  const boomMat = new THREE.MeshBasicMaterial({ color: 0xff9a30, transparent: true, opacity: 0.85 });
  const critMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.95 }); // bright weak-point spark
  // Short faceted streaks remain readable against snow/desert without becoming opaque exhaust beams.
  const hoverJetGeo = new THREE.CylinderGeometry(0.07, 0.26, 1.35, 6, 1, true);
  hoverJetGeo.userData.shared = true;
  const hoverJetMatF = new THREE.MeshBasicMaterial({ color: 0x9ae6ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const hoverJetMatZ = new THREE.MeshBasicMaterial({ color: 0xffb45e, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });

  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();

  // ---------- multi-sphere hitboxes for big, non-spherical units (GAW carrier, landships) ----------
  // A unit's `hitSpheres` is an array of LOCAL {x,y,z,r} (x=right, y=up, z=forward/prow). fillWorldSpheres
  // rotates them by the unit's heading and writes world centres into HS_SCRATCH (reused, no per-call alloc).
  const HS_SCRATCH = Array.from({ length: 14 }, () => new THREE.Vector3());
  function fillWorldSpheres(unit, yaw){
    const p = unit.root.position, cy = Math.cos(yaw), sy = Math.sin(yaw), hs = unit.hitSpheres, n = hs.length;
    if (unit.hitSphereBody && unit.parts?.body){
      unit.root.updateMatrixWorld(true); unit.parts.body.updateMatrixWorld(true);
      for (let i = 0; i < n; i++) HS_SCRATCH[i].set(hs[i].x, hs[i].y, hs[i].z).applyMatrix4(unit.parts.body.matrixWorld);
      return n;
    }
    const sc = unit.hitSphereBody ? (unit.suit?.scale || 1) : 1;
    for (let i = 0; i < n; i++){
      const s = hs[i];
      HS_SCRATCH[i].set(p.x + (s.x * cy + s.z * sy) * sc, p.y + s.y * sc, p.z + (-s.x * sy + s.z * cy) * sc);
    }
    return n;
  }
  const hitSphereRadius = (unit, sphere) => sphere.r * (unit.hitSphereBody ? (unit.suit?.scale || 1) : 1);

  // Vertical offset from a unit's root to its CENTRE OF MASS — where every weapon, lock, lead-solve and
  // reticle should aim. Humanoid MS sit ~9·scale up (torso). AIRCRAFT mass-centres sit far lower
  // (~1.3·scale — a Saberfish is barely 3 units tall; the GAW ~9), so the old flat 9·scale put every
  // reticle ABOVE the plane. Props use their hull hitY. Use this instead of a bare `9 * scale` on targets.
  function aimHeight(t){
    if (t.isProp) return t.hitY || 0;
    if (t.suit && Number.isFinite(t.suit.aimHeight)) return t.suit.aimHeight * (t.suit.scale || 1);
    if (t.suit && t.suit.id === 'guntankmk2') return 8.1 * (t.suit.scale || 1);
    if (t.suit && t.suit.id === 'type61') return 4.8 * (t.suit.scale || 1);
    if (t.suit && t.suit.id === 'magella') return 6.1 * (t.suit.scale || 1);
    if (t.suit && t.suit.style === 'zakutank') return 8.2 * (t.suit.scale || 1);
    if (t.suit && t.suit.style === 'guntank') return 7.8 * (t.suit.scale || 1);
    return (t.air ? 1.3 : 9) * (t.suit.scale || 1);
  }
  function weaponHeight(m){
    if (m.suit && Number.isFinite(m.suit.weaponHeight)) return m.suit.weaponHeight * (m.suit.scale || 1);
    if (m.air) return 0;
    if (m.suit.style === 'tank') return 5 * (m.suit.scale || 1);
    if (m.suit.style === 'guntank' || m.suit.style === 'crane') return 11 * (m.suit.scale || 1);
    if (m.suit.style === 'zakutank') return 12 * (m.suit.scale || 1);
    return 13 * (m.suit.scale || 1);
  }
  // WEAK POINTS: each unit may carry `weakPoints` = local {x,y,z,r,mult} (x=right,y=up,z=fwd, same frame as
  // hitSpheres). A hit landing inside one deals mult× damage (engines for aircraft/carriers, cockpit for MS,
  // bridge for ships). Returns the strongest matching multiplier (1 = no weak hit). scale handles mech model scaling.
  function weakMult(hitPoint, root, yaw, scale, wps, unit = null){
    if (!wps) return 1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let mult = 1;
    for (const w of wps){
      let wx, wy, wz;
      if (unit?.hitSphereBody && unit.parts?.body){
        unit.root.updateMatrixWorld(true); unit.parts.body.updateMatrixWorld(true);
        const bp = tmpV3.set(w.x, w.y, w.z).applyMatrix4(unit.parts.body.matrixWorld); wx = bp.x; wy = bp.y; wz = bp.z;
      } else {
        wx = root.x + (w.x * cy + w.z * sy) * scale;
        wy = root.y + w.y * scale;
        wz = root.z + (-w.x * sy + w.z * cy) * scale;
      }
      const r = w.r * scale, dx = hitPoint.x - wx, dy = hitPoint.y - wy, dz = hitPoint.z - wz;
      if (dx * dx + dy * dy + dz * dz < r * r && w.mult > mult) mult = w.mult;
    }
    return mult;
  }

  function resetMuzzleCycle(m, wi = m.wi){
    if (!m.muzzleCursors) m.muzzleCursors = [];
    m.muzzleCursors[wi] = 0;
  }

  // The far-LOD simulation has no detailed nodes, but a held weapon must still
  // originate on the pilot's physical right (-X in every +Z-forward rig).
  const RIGHT_HAND_STYLES = new Set(['gundam', 'gm', 'zaku', 'dom', 'gelgoog']);
  function weaponUsesRightHand(m, w){
    if (m.parts) return !!m.parts.weaponIsHeld;
    return !!w && !w.head && !w.integrated &&
      (RIGHT_HAND_STYLES.has(m.suit.style) || (m.suit.id === 'guncannon' && m.wi === 1));
  }
  function approximateMuzzle(m, w){
    let x = 0, y = 9, z = 4;
    if (w?.head){ y = 16; z = 1.5; }
    else if (weaponUsesRightHand(m, w)){ x = -3.8; y = 13.2; z = 6.2; }
    else if (m.air){ y = 0; z = 6; }
    else if (m.suit.style === 'tank'){ y = 5; z = 11; }
    else if (m.suit.style === 'apc'){ y = 2.46; z = 4.65; }
    else if (m.suit.style === 'guntank'){ y = 11; z = 11; }
    else if (m.suit.style === 'crane'){ y = 12; z = 14; }
    else if (m.suit.style === 'zakutank'){ y = 12; z = 10; }
    const sc = m.suit.scale || 1, c = Math.cos(m.yaw), s = Math.sin(m.yaw);
    return m.root.position.clone().add(new THREE.Vector3(
      (x * c + z * s) * sc,
      y * sc,
      (-x * s + z * c) * sc,
    ));
  }

  function wrapAngle(a){
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }
  function syncTurretYaw(m, worldYaw, k = 1){
    if (!m.parts?.turretYaw || !Number.isFinite(worldYaw)) return;
    const target = wrapAngle(worldYaw - m.yaw);
    const current = m.parts.turretYaw.rotation.y;
    m.parts.turretYaw.rotation.y = current + wrapAngle(target - current) * k;
  }

  // Firing runs from the input/AI update, before the normal animation pass.
  // Synchronize the current root and attack pose here so a first shot after a
  // turn/switch uses the arm and muzzle the player actually sees this frame.
  function syncMuzzlePose(m, dir, aimPoint){
    m.root.rotation.y = m.yaw;
    if (!m.parts) return;
    if (m.air){
      if (m.parts.body){ m.parts.body.rotation.z = m.bank; m.parts.body.rotation.x = -m.pitch; }
    } else {
      let pitch = dir ? Math.asin(clamp(dir.y, -1, 1)) : 0;
      if (aimPoint){
        const dx = aimPoint.x - m.root.position.x, dz = aimPoint.z - m.root.position.z;
        syncTurretYaw(m, Math.atan2(dx, dz));
        pitch = Math.atan2(aimPoint.y - (m.root.position.y + weaponHeight(m)), Math.max(1, Math.hypot(dx, dz)));
      }
      if (m.parts.weaponIsHeld && m.parts.armR) m.parts.armR.rotation.z = 0;
      poseAim(m.parts, pitch, 1);
    }
    m.root.updateMatrixWorld(true);
  }

  // Select the visible muzzle for the active weapon. Explicit per-weapon banks
  // never fall through to another weapon's aggregate bank; held guns always use
  // the anchor parented to their currently visible right-hand mesh.
  function activeMuzzleNode(m, advance = false){
    if (!m.parts) return null;
    const w = m.suit.weapons[m.wi];
    if (m.parts.weaponIsHeld) return m.parts.muzzle;
    const bank = m.parts.weaponMuzzles
      ? m.parts.weaponMuzzles[m.wi]
      : m.parts.muzzles;
    if (bank && bank.length){
      const cursors = m.muzzleCursors || (m.muzzleCursors = []);
      const idx = (cursors[m.wi] || 0) % bank.length;
      if (advance) cursors[m.wi] = (idx + 1) % bank.length;
      return bank[idx];
    }
    if (w?.head) return m.parts.eye || m.parts.head || m.parts.muzzle;
    return m.parts.muzzle;
  }

  function fire(m, dir, aimPoint){
    const w = m.suit.weapons[m.wi];
    if (w.type === 'lockmissile'){
      // homing missile. The player fires these through the lock-on sequence (playerFlightUpdate);
      // here we handle AI pilots, which loose one at their current target.
      if (m.fireT > 0 || m.reloadT > 0) return;
      if (m.clip <= 0){ m.reloadT = w.reload; return; }
      const tgt = (!m.isPlayer && m.ai && m.ai.target && m.ai.target.alive) ? m.ai.target : null;
      if (!tgt) return;
      m.clip--; m.fireT = 1 / w.rof;
      if (m.clip <= 0) m.reloadT = w.reload;
      launchMissile(m, tgt);
      m.shotsFired = (m.shotsFired || 0) + 1;
      return;
    }
    if (w.type === 'bomb'){
      // a stick of bombs released in one pull — they fall under gravity and burst on impact
      if (m.fireT > 0 || m.reloadT > 0) return;
      if (m.clip <= 0){ m.reloadT = w.reload; return; }
      m.clip--; m.fireT = 1 / w.rof;
      if (m.clip <= 0) m.reloadT = w.reload;
      dropBombs(m, w);
      m.shotsFired = (m.shotsFired || 0) + 1;
      return;
    }
    if (w.arc){
      // artillery bombardment: the cannon swings up over the back and LOBS a shell on a high ballistic arc
      if (m.fireT > 0 || m.reloadT > 0) return;
      if (m.clip <= 0){ m.reloadT = w.reload; return; }
      let impact = aimPoint;
      if (!impact && m.ai && m.ai.target && m.ai.target.alive){ impact = m.ai.target.root.position.clone(); impact.y += aimHeight(m.ai.target); }
      if (!impact) return;
      m.clip--; m.fireT = 1 / w.rof;
      if (m.clip <= 0) m.reloadT = w.reload;
      lobShell(m, w, impact);
      m.shotsFired = (m.shotsFired || 0) + 1;
      return;
    }
    if (m.fireT > 0 || m.reloadT > 0) return;
    if (m.clip <= 0){ m.reloadT = w.reload; return; }
    m.clip--; m.fireT = 1 / w.rof;
    if (m.clip <= 0) m.reloadT = w.reload;
    m.shotsFired = (m.shotsFired || 0) + 1;
    // head-mounted weapons (vulcans) fire from the eye sensor; multi-barrel mounts alternate L/R muzzles;
    // others fire from the gun barrel. far-LOD mechs have no detailed parts → approximate barrel offset
    syncMuzzlePose(m, dir, aimPoint);
    const muzzleNode = activeMuzzleNode(m, true);
    const muzzle = muzzleNode
      ? muzzleNode.getWorldPosition(new THREE.Vector3())
      : approximateMuzzle(m, w);
    m.lastMuzzleWorld = muzzle.clone();
    if (m.isPlayer) vgKick = Math.min(0.22, vgKick + (w.type === 'bazooka' ? 0.2 : 0.07));
    // converge on the crosshair point when one is provided (player fire)
    const base = aimPoint ? aimPoint.clone().sub(muzzle).normalize() : dir.clone();
    const geo = w.type === 'beam' ? beamGeo : w.type === 'mg' ? mgGeo : bzGeo;
    const mat = w.type === 'beam' ? (m.suit.faction === 'FED' ? beamMatF : beamMatZ) : w.type === 'mg' ? mgMat : bzMat;
    // w.pellets sub-shots leave in one pull (each with its own spread); w.life shortens range (spray gun)
    for (let s = 0; s < (w.pellets || 1); s++){
      const d = base.clone();
      d.x += (rng.next() - 0.5) * 2 * w.spread;
      d.y += (rng.next() - 0.5) * 2 * w.spread;
      d.z += (rng.next() - 0.5) * 2 * w.spread;
      d.normalize();
      const mesh = w.shell ? makeShell(w.shellScale || 1.05, w.ap) : new THREE.Mesh(geo, mat);
      mesh.position.copy(muzzle);
      if (w.type === 'bazooka' || w.shell) mesh.quaternion.setFromUnitVectors(UP, d); // shell/cone nose forward
      else mesh.quaternion.setFromUnitVectors(FWD, d);
      scene.add(mesh);
      const projectile = { pos: muzzle.clone(), vel: d.multiplyScalar(w.speed), dmg: w.dmg, splash: w.splash || 0, team: m.team, owner: m, weaponName: w.name, life: w.life || 4, mesh };
      projectiles.push(projectile);
      sendPvpShot(m, projectile, 'direct');
    }
    if (w.recoil){ // heavy cannon kick — barrel slides, whole mech shudders
      m.cannonRecoil = w.recoil;
      if (m.isPlayer){ camShake = Math.min(2.2, camShake + w.recoil * 0.6); vgKick = Math.min(0.3, vgKick + 0.28); }
    }
    const vol = m.isPlayer ? 0.22 : clamp(280 / muzzle.distanceTo(player.root.position), 0.02, 0.14);
    sfx(w.type, vol);
  }

  // a guided missile that homes onto a specific mech (Saberfish 5000 lock-on weapon)
  function launchMissile(m, target){
    const w = m.suit.weapons[m.wi];
    const targetPoint = target
      ? target.root.position.clone().setY(target.root.position.y + aimHeight(target))
      : null;
    syncMuzzlePose(m, targetPoint ? null : tmpV2.set(Math.sin(m.yaw), 0, Math.cos(m.yaw)), targetPoint);
    const node = activeMuzzleNode(m, true);
    const muzzle = node
      ? node.getWorldPosition(new THREE.Vector3())
      : approximateMuzzle(m, w);
    m.lastMuzzleWorld = muzzle.clone();
    const aim = targetPoint
      ? tmpV2.copy(targetPoint).sub(muzzle).normalize()
      : tmpV2.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    const mesh = new THREE.Mesh(missileGeo, missileMat);
    mesh.position.copy(muzzle);
    mesh.quaternion.setFromUnitVectors(UP, aim); // cone apex forward
    scene.add(mesh);
    const projectile = { pos: muzzle.clone(), vel: aim.clone().multiplyScalar(w.speed), dmg: w.dmg, splash: w.splash || 14, team: m.team, owner: m, weaponName: w.name, life: 6, mesh, homing: target || null, turn: w.turn || 2.4 };
    projectiles.push(projectile);
    sendPvpShot(m, projectile, 'missile');
    if (m.isPlayer) vgKick = Math.min(0.22, vgKick + 0.12);
    sfx('bazooka', m.isPlayer ? 0.26 : clamp(280 / muzzle.distanceTo(player.root.position), 0.02, 0.14));
  }

  // bombs fall under heavy gravity and burst on impact — released 3 from EACH side of the bay window (G-Fighter)
  function dropBombs(m, w){
    const sc = m.suit.scale || 1;
    const perSide = Math.max(1, Math.round((w.bombs || 6) / 2));  // half the pack down each side of the bay
    const spread = 1.7 * sc;                                      // fore-aft stick spacing scales with the airframe
    const bombScale = clamp(sc * 0.4, 1, 3);                      // bigger carriers drop bigger ordnance
    const base = m.root.position.clone(); base.y -= 1.5 * sc;     // belly bomb-bay window
    const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);            // forward (heading)
    const rx = Math.cos(m.yaw), rz = -Math.sin(m.yaw);          // right (perpendicular = the window's two sides)
    for (const side of [-1, 1])                                  // a stick from each side of the drop window
      for (let i = 0; i < perSide; i++){
        const fwdOff = (i - (perSide - 1) / 2) * spread;
        const pos = base.clone();
        pos.x += rx * side * 1.5 * sc + fx * fwdOff;
        pos.z += rz * side * 1.5 * sc + fz * fwdOff;
        const mesh = makeBomb(); if (bombScale !== 1) mesh.scale.setScalar(bombScale); mesh.position.copy(pos); scene.add(mesh);
        const vel = new THREE.Vector3(fx * w.speed, -8, fz * w.speed); // released forward + a down kick; gravity does the rest
        const projectile = { pos: pos.clone(), vel, dmg: w.dmg, splash: w.splash || 16, team: m.team, owner: m, weaponName: w.name, life: 7, mesh, bomb: true };
        projectiles.push(projectile);
        sendPvpShot(m, projectile, 'bomb');
      }
    if (m.isPlayer) vgKick = Math.min(0.22, vgKick + 0.12);
    sfx('bazooka', m.isPlayer ? 0.24 : clamp(280 / base.distanceTo(player.root.position), 0.02, 0.14));
  }

  function explosion(pos, r, vol = 0.3){
    const mesh = new THREE.Mesh(boomGeo, boomMat.clone());
    mesh.position.copy(pos); scene.add(mesh);
    particles.push({ mesh, life: 0.55, maxLife: 0.55, r });
    sfx('boom', vol);
  }
  // weak-point hit feedback: a quick bright spark at the hit + a brief on-screen CRITICAL marker (player only)
  let critFlash = null;
  function critSpark(pos, isPlayerHit){
    const mesh = new THREE.Mesh(boomGeo, critMat.clone());
    mesh.position.copy(pos); scene.add(mesh);
    particles.push({ mesh, life: 0.3, maxLife: 0.3, r: 4 });
    sfx('hit', clamp(420 / pos.distanceTo(player.root.position), 0.1, 0.4));
    if (isPlayerHit) critFlash = { pos: pos.clone(), t: 0.55 };
  }

  const dustMat = new THREE.MeshBasicMaterial({ color: 0x9a917e, transparent: true, opacity: 0.5 });
  function dust(pos, r){
    const mesh = new THREE.Mesh(boomGeo, dustMat.clone());
    mesh.position.copy(pos); mesh.position.y += 1;
    scene.add(mesh);
    particles.push({ mesh, life: 0.8, maxLife: 0.8, r });
  }

  // E-hover leg exhaust: emit from a sole point attached to each animated leg.
  // Every spark carries velocity and acceleration, so the plume peels backward/downward from the
  // moving foot instead of expanding in place like terrain dust.
  function emitHoverLegAcceleration(m){
    const speed = Math.hypot(m.vel.x, m.vel.z);
    const backX = speed > 0.5 ? -m.vel.x / speed : -Math.sin(m.yaw);
    const backZ = speed > 0.5 ? -m.vel.z / speed : -Math.cos(m.yaw);
    const baseMat = m.suit.faction === 'ZEON' ? hoverJetMatZ : hoverJetMatF;
    m.root.updateMatrixWorld(true);
    for (const [leg, side] of [[m.parts?.legL, -1], [m.parts?.legR, 1]]){
      if (!leg) continue;
      const legLength = Math.max(5, Math.abs(leg.position.y) || 8.5);
      const pos = new THREE.Vector3(0, -legLength + 0.15, 0.5);
      leg.localToWorld(pos);
      const phase = m.groundHoverPhase * 41 + side * 2.7;
      const lateral = Math.sin(phase) * 1.35;
      const vel = new THREE.Vector3(
        backX * (7 + speed * 0.12) + Math.cos(m.yaw) * lateral,
        -7.5 - Math.abs(Math.sin(phase * 0.73)) * 4.5,
        backZ * (7 + speed * 0.12) - Math.sin(m.yaw) * lateral,
      );
      const mesh = new THREE.Mesh(hoverJetGeo, baseMat.clone());
      mesh.position.copy(pos);
      mesh.scale.set(0.82, 1.08, 0.82);
      mesh.quaternion.setFromUnitVectors(UP, vel.clone().normalize());
      scene.add(mesh);
      const accel = new THREE.Vector3(backX * (24 + speed * 0.55), -20, backZ * (24 + speed * 0.55));
      particles.push({ mesh, life: 0.32, maxLife: 0.32, kind: 'hoverJet', origin: pos.clone(), vel, accel });
      m.hoverJetEmitted++;
    }
  }

  function updateHoverLegJets(m, dt){
    if (!m.isPlayer && !m.networkRemote) return;
    if (!m.hovering){ m.hoverJetT = 0; return; }
    m.hoverJetT -= dt;
    if (m.hoverJetT <= 0){
      m.hoverJetT = m.suit.landType ? 0.035 : 0.045;
      emitHoverLegAcceleration(m);
    }
  }

  function splashDamage(pos, r, dmg, attacker, weaponName = null){
    for (const m of mechs){
      if (!m.alive) continue;
      let d;
      if (m.hitSpheres){
        // huge multi-sphere hulls (GAW): a burst on the wing is 50-135m from the root centre, so measure
        // to the NEAREST hull-sphere surface instead — a shell that detonates ON the hull always hurts it.
        // NB the WORLD radius (hitSphereRadius scales by suit.scale for hitSphereBody units), matching the
        // direct-hit test that produced the burst point — the local .r left grazing hits at zero damage.
        const n = fillWorldSpheres(m, m.yaw);
        d = Infinity;
        for (let i = 0; i < n; i++) d = Math.min(d, Math.max(0, HS_SCRATCH[i].distanceTo(pos) - hitSphereRadius(m, m.hitSpheres[i])));
      } else {
        d = m.root.position.distanceTo(pos);
      }
      if (d < r * 2.4) damage(m, dmg * clamp(1 - d / (r * 2.4), 0.15, 1), pos, attacker, false, weaponName);
    }
    for (const p of props){
      if (!p.alive) continue;
      const d = p.root.position.distanceTo(pos);
      if (d < r * 2.4 + p.radius) damageProp(p, dmg * clamp(1 - d / (r * 2.4 + p.radius), 0.15, 1), pos, attacker, weaponName);
    }
    killSoldiersNear(pos, r * 1.8);
  }

  function damage(m, dmg, hitPoint, attacker, melee, weaponName = null){
    if (!m.alive) return;
    // PvP uses shooter-side hit detection but victim-side health. The local rival is
    // therefore a visual/collision proxy: report a bounded raw hit to its owning peer
    // and let that peer run the ordinary armor, guard, weak-point and death logic.
    if (PVP && m.networkRemote && attacker === player){
      const point = hitPoint?.isVector3 ? hitPoint : m.root.position;
      if (pvpSend({
        type: 'hit',
        damage: Number(dmg) || 0,
        hitPoint: point.toArray(),
        melee: !!melee,
        weapon: weaponNoticeName(attacker, melee, weaponName),
      })) pvpHitsSent++;
      return;
    }
    // guard: a frontal MELEE strike into a raised guard is PARRIED (deflected — no damage, attacker knocked back
    // and staggered). A frontal ranged hit on an intact shield is fully absorbed; anything else while guarding is 60% off.
    if (m.blocking){
      const fwd = tmpV.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
      const src = attacker && attacker.root ? attacker.root.position : hitPoint;
      const frontal = tmpV2.subVectors(src, m.root.position).normalize().dot(fwd) > 0.35;
      if (melee && frontal){                                  // clash! deflect the blow
        critSpark(hitPoint, false); m.shieldHitT = 0;
        if (m.isPlayer) camShake = Math.min(0.7, camShake + 0.22);
        if (attacker && attacker.alive){
          attacker.meleeT = Math.max(attacker.meleeT || 0, 0.9); attacker.bladeT = 0;
          attacker.vel.addScaledVector(tmpV2.subVectors(attacker.root.position, m.root.position).setY(0).normalize(), 26);
          if (attacker.ai) attacker.meleeRun = null;          // knock a charging bot out of its lunge
        }
        if (PVP && m === player && attacker === networkRemote)
          pvpSend({ type: 'parry' });
        sfx('saber', m.isPlayer ? 0.22 : clamp(300 / m.root.position.distanceTo(player.root.position), 0.05, 0.18));
        return;
      }
      if (frontal && !m.shieldBroken && m.shieldMax > 0){
        m.shieldHp -= dmg; m.shieldHitT = 0;
        if (m.isPlayer) camShake = Math.min(0.8, camShake + dmg / m.shieldMax * 2);
        if (m.shieldHp <= 0){
          m.shieldHp = 0; m.shieldBroken = true; m.blocking = false;
          explosion(m.root.position.clone().add(tmpV.set(0, 9, 0)), 6, m.isPlayer ? 0.18 : 0.06);
          if (m.isPlayer) setMsg('SHIELD SHATTERED', 2);
        }
        return; // no damage reaches the unit
      }
      dmg *= 0.4; // hits around or through a dropped guard still hurt 60% less
    }
    const ly = (hitPoint.y - m.root.position.y) / m.suit.scale;
    let mult = 1;
    if (ly > 14.5){ mult = 1.6; m.sensorDmg = Math.min(1, m.sensorDmg + 0.25); }
    else if (ly < 8 && !SPACE){ mult = 0.9; m.legDmg = Math.min(1, m.legDmg + dmg / m.maxHp); }
    // weak point (cockpit / engines): hitting it deals bonus damage and sparks a crit
    const wm = weakMult(hitPoint, m.root.position, m.yaw, m.suit.scale || 1, m.weakPoints, m);
    if (wm > 1){ mult = Math.max(mult, wm); critSpark(hitPoint, !!(attacker && attacker.isPlayer)); }
    const final = dmg * mult * (1 - m.suit.armor * 0.013);
    m.hp -= final;
    // getting shot draws attention — retaliate against the actual shooter
    if (m.ai && attacker && attacker.alive && attacker.team !== m.team && rng.chance(0.55))
      m.ai.grudge = attacker;
    if (m.isPlayer || (attacker && attacker.isPlayer)) sfx('hit', m.isPlayer ? 0.2 : 0.12);
    if (m.isPlayer) camShake = Math.min(1.6, camShake + final / m.maxHp * 6);
    if (m.hp <= 0) kill(m, attacker, weaponNoticeName(attacker, melee, weaponName));
  }

  let kills = 0; const destroyedIds = [];
  function kill(m, attacker, weaponName){
    m.alive = false; m.deadT = 1.1; m.deathWeapon = weaponName || null;
    explosion(m.root.position.clone().add(tmpV.set(0, 9, 0)), 16,
      clamp(420 / m.root.position.distanceTo(player.root.position), 0.06, 0.42));
    if (attacker && attacker.isPlayer){ kills++; if (m.core) destroyedIds.push(m.suit.id); }
    if (attacker) addKillNotice(attacker, weaponName, m);
    if (m.isPlayer) setMsg('UNIT DESTROYED — EJECTING', 4);
    else if (m.wingId !== undefined) setMsg(`${m.name} DOWN — PILOT EJECTED`, 2.4);
    else if (m.core || m.ace) setMsg(`${m.name} DESTROYED`, 2);
  }

  function pvpVector(value){
    if (!Array.isArray(value) || value.length !== 3) return null;
    const x = Number(value[0]), y = Number(value[1]), z = Number(value[2]);
    if (![x, y, z].every(Number.isFinite) || Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 100000) return null;
    return new THREE.Vector3(x, y, z);
  }

  function pvpSetRemoteWeapon(m, index){
    if (!m?.suit?.weapons?.length) return false;
    const wi = Math.trunc(Number(index));
    if (!Number.isFinite(wi) || wi < 0 || wi >= m.suit.weapons.length) return false;
    if (m.wi !== wi){
      m.wi = wi;
      resetMuzzleCycle(m, wi);
      m.clip = m.suit.weapons[wi].clip;
      m.reloadT = 0;
      m.parts?.rebuildGun?.(wi);
    }
    return true;
  }

  // Replayed rounds are presentation-only. Hit authority remains with the
  // shooter's simulation and arrives separately as a bounded `hit` message.
  function pvpReplayShot(message){
    const m = networkRemote;
    if (!m || !m.alive) return;
    const position = pvpVector(message.position), velocity = pvpVector(message.velocity);
    if (!position || !velocity || velocity.lengthSq() < 0.001) return;
    if (!pvpSetRemoteWeapon(m, message.weaponIndex)) return;
    const w = m.suit.weapons[m.wi], kind = message.kind;
    if (!['direct', 'missile', 'bomb', 'artillery'].includes(kind)) return;
    if ((kind === 'missile') !== (w.type === 'lockmissile')) return;
    if ((kind === 'bomb') !== (w.type === 'bomb')) return;
    if ((kind === 'artillery') !== !!w.arc) return;
    if (kind === 'direct' && (w.type === 'lockmissile' || w.type === 'bomb' || w.arc)) return;
    const maxSpeed = kind === 'artillery' ? 1800 : Math.max(100, (w.speed || 1000) * 1.3);
    if (velocity.length() > maxSpeed) velocity.setLength(maxSpeed);

    let mesh;
    if (kind === 'bomb'){
      mesh = makeBomb();
      mesh.scale.setScalar(clamp((m.suit.scale || 1) * 0.4, 1, 3));
    } else if (kind === 'artillery'){
      mesh = makeShell(1.6, false);
    } else if (kind === 'missile'){
      mesh = new THREE.Mesh(missileGeo, missileMat);
    } else {
      const geo = w.type === 'beam' ? beamGeo : w.type === 'mg' ? mgGeo : bzGeo;
      const mat = w.type === 'beam' ? (m.suit.faction === 'FED' ? beamMatF : beamMatZ) : w.type === 'mg' ? mgMat : bzMat;
      mesh = w.shell ? makeShell(w.shellScale || 1.05, w.ap) : new THREE.Mesh(geo, mat);
    }
    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors((kind === 'direct' && w.type !== 'bazooka' && !w.shell) ? FWD : UP, velocity.clone().normalize());
    scene.add(mesh);
    const lifeDefault = kind === 'missile' ? 6 : kind === 'bomb' ? 7 : kind === 'artillery' ? (w.life || 9) : (w.life || 4);
    const life = clamp(Number(message.life) || lifeDefault, 0.1, 12);
    projectiles.push({
      pos: position, vel: velocity, dmg: 0, splash: w.splash || (kind === 'missile' ? 14 : kind === 'bomb' ? 16 : 0),
      team: m.team, owner: m, weaponName: w.name, life, mesh,
      homing: kind === 'missile' ? player : null, turn: w.turn || 2.4,
      bomb: kind === 'bomb', arc: kind === 'artillery', networkGhost: true,
    });
    m.lastMuzzleWorld = position.clone();
    m.shotsFired = (m.shotsFired || 0) + 1;
    pvpShotsReceived++;
  }

  function pvpApplyHit(message){
    if (!networkRemote || !player.alive) return;
    const requested = Number(message.damage);
    const hitPoint = pvpVector(message.hitPoint);
    const weaponName = typeof message.weapon === 'string' ? message.weapon.slice(0, 96) : '';
    if (!Number.isFinite(requested) || requested <= 0 || !hitPoint || !weaponName) return;

    let cap = 0;
    if (message.melee){
      const saber = networkRemote.suit.saber;
      if (!saber || saber.dmg <= 0 || weaponName !== saber.name) return;
      cap = saber.dmg * 1.12; // the strongest player slash is the 1.10x overhead cut
    } else if (weaponName === 'GROUND STOMP'){
      cap = 560;
    } else {
      const weapon = networkRemote.suit.weapons.find(candidate => candidate.name === weaponName);
      if (!weapon || !(weapon.dmg > 0)) return;
      cap = weapon.dmg * 1.01;
    }
    const bounded = Math.min(requested, cap);
    if (!(bounded > 0)) return;
    pvpHitsReceived++;
    damage(player, bounded, hitPoint, networkRemote, !!message.melee, weaponName);
  }

  function pvpApplyParry(){
    if (!networkRemote || !networkRemote.alive || !player.alive) return;
    if (player.root.position.distanceTo(networkRemote.root.position) > 120) return;
    player.meleeT = Math.max(player.meleeT || 0, 0.9);
    player.bladeT = 0;
    const away = tmpV2.subVectors(player.root.position, networkRemote.root.position).setY(0);
    if (away.lengthSq() > 0.001) player.vel.addScaledVector(away.normalize(), 26);
    camShake = Math.min(0.7, camShake + 0.22);
  }

  function pvpApplyState(message){
    const m = networkRemote;
    if (!m) return;
    const seq = Math.trunc(Number(message.seq));
    if (!Number.isFinite(seq) || seq <= pvpRemoteSeq) return;
    const position = pvpVector(message.position), velocity = pvpVector(message.velocity);
    if (!position || !velocity) return;
    pvpRemoteSeq = seq;
    pvpLastSnapshotAt = performance.now();
    m.netTargetPosition ||= new THREE.Vector3();
    m.netTargetVelocity ||= new THREE.Vector3();
    m.netExtrapolatedPosition ||= new THREE.Vector3();
    m.netTargetPosition.copy(position);
    m.netTargetVelocity.copy(velocity);
    m.netSnapshotAt = pvpLastSnapshotAt;
    if (!m.netInitialized || m.root.position.distanceToSquared(position) > 500 * 500){
      m.root.position.copy(position);
      m.vel.copy(velocity);
      m.netInitialized = true;
    }
    if (Number.isFinite(Number(message.yaw))) m.netTargetYaw = Number(message.yaw);
    if (Number.isFinite(Number(message.aimYaw))) m.netAimYaw = Number(message.aimYaw);
    if (Number.isFinite(Number(message.aimPitch))) m.netAimPitch = clamp(Number(message.aimPitch), -1.55, 1.55);
    if (Number.isFinite(Number(message.pitch))) m.netTargetPitch = clamp(Number(message.pitch), -1.55, 1.55);
    if (Number.isFinite(Number(message.bank))) m.netTargetBank = clamp(Number(message.bank), -1.6, 1.6);
    pvpSetRemoteWeapon(m, message.weaponIndex);
    m.networkSaberEquipped = !!message.saberEquipped;
    m.blocking = !!message.blocking;
    if (Number.isFinite(Number(message.shieldHp)))
      m.shieldHp = clamp(Number(message.shieldHp), 0, m.shieldMax);
    m.shieldBroken = !!message.shieldBroken;
    m.boosting = !!message.boosting;
    m.thrusting = !!message.thrusting;
    if (Number.isFinite(Number(message.hoverBlend)))
      m.groundHoverBlend = clamp(Number(message.hoverBlend), 0, 1);
    if (Number.isFinite(Number(message.swingT))) m.swingT = clamp(Number(message.swingT), 0, 2);
    if (Number.isFinite(Number(message.swingDuration))) m.swingDuration = clamp(Number(message.swingDuration), 0.1, 2);
    if (['diagonal', 'crosscut', 'overhead', 'thrust'].includes(message.swingKind)) m.swingKind = message.swingKind;
    if (Number.isFinite(Number(message.swingDir))) m.swingDir = Number(message.swingDir) < 0 ? -1 : 1;
    if (Number.isFinite(Number(message.bladeT))) m.bladeT = clamp(Number(message.bladeT), 0, 2);

    const alive = message.alive !== false;
    const hp = Number(message.hp);
    if (m.alive && alive && Number.isFinite(hp)) m.hp = clamp(hp, 1, m.maxHp);
    if (m.alive && !alive){
      m.hp = 0;
      const deathWeapon = typeof message.deathWeapon === 'string' && message.deathWeapon
        ? message.deathWeapon.slice(0, 96) : 'PVP DUEL';
      kill(m, player, deathWeapon);
    }
  }

  function pvpUpdateRemote(m, dt){
    if (!m.netInitialized || !m.netTargetPosition) return;
    const age = clamp((performance.now() - (m.netSnapshotAt || performance.now())) / 1000, 0, 0.12);
    m.netExtrapolatedPosition.copy(m.netTargetPosition).addScaledVector(m.netTargetVelocity, age);
    const posK = 1 - Math.exp(-15 * dt), velK = 1 - Math.exp(-12 * dt);
    m.root.position.lerp(m.netExtrapolatedPosition, posK);
    m.vel.lerp(m.netTargetVelocity, velK);
    if (Number.isFinite(m.netTargetYaw)) m.yaw += wrapAngle(m.netTargetYaw - m.yaw) * (1 - Math.exp(-18 * dt));
    if (Number.isFinite(m.netTargetPitch)) m.pitch = lerp(m.pitch, m.netTargetPitch, 1 - Math.exp(-14 * dt));
    if (Number.isFinite(m.netTargetBank)) m.bank = lerp(m.bank, m.netTargetBank, 1 - Math.exp(-14 * dt));
  }

  function pvpStateUpdate(dt){
    if (!PVP) return;
    pvpStateT -= dt;
    if (pvpStateT > 0) return;
    pvpStateT = 0.05;
    const saberEquipped = hasSaber && player.wi === SABER_SLOT;
    const rangedWeapon = clamp(saberEquipped ? player.suit.weapons.length - 1 : player.wi, 0, player.suit.weapons.length - 1);
    pvpSend({
      type: 'state',
      seq: ++pvpLocalSeq,
      position: player.root.position.toArray(),
      velocity: player.vel.toArray(),
      yaw: player.yaw,
      aimYaw: camYaw,
      aimPitch: camPitch,
      pitch: player.pitch || 0,
      bank: player.bank || 0,
      weaponIndex: rangedWeapon,
      saberEquipped,
      blocking: !!player.blocking,
      shieldHp: player.shieldHp,
      shieldBroken: !!player.shieldBroken,
      boosting: !!player.boosting,
      thrusting: !!player.thrusting,
      hoverBlend: player.groundHoverBlend || 0,
      swingT: player.swingT || 0,
      swingDuration: player.swingDuration || 0.4,
      swingKind: player.swingKind || 'diagonal',
      swingDir: player.swingDir || 1,
      bladeT: player.bladeT || 0,
      hp: Math.max(0, player.hp),
      alive: !!player.alive,
      deathWeapon: player.deathWeapon || null,
    });
  }

  function onPvpMessage(event){
    if (!PVP || !event?.detail || typeof event.detail !== 'object') return;
    pvpLastMessageAt = performance.now();
    if (event.detail.type === 'state') pvpApplyState(event.detail);
    else if (event.detail.type === 'shot') pvpReplayShot(event.detail);
    else if (event.detail.type === 'hit') pvpApplyHit(event.detail);
    else if (event.detail.type === 'parry') pvpApplyParry();
  }

  function onPvpClose(){
    if (!PVP || ended || outcome !== null || !player.alive) return;
    pvpForfeit = true;
    setMsg('OPPONENT DISCONNECTED — FORFEIT VICTORY', 4);
  }

  function onPvpStatus(event){
    const state = event?.detail?.state;
    if (state === 'connected') pvpDisconnectedAt = 0;
    else if (state === 'disconnected' && !pvpDisconnectedAt) pvpDisconnectedAt = performance.now();
    else if (state === 'failed' || state === 'closed') onPvpClose();
  }

  function pvpConnectionWatchdog(){
    if (!PVP || ended || outcome !== null || pvpForfeit || !player.alive) return;
    const now = performance.now();
    const state = pvpLink.connectionState;
    if (state === 'connected') pvpDisconnectedAt = 0;
    else if (state === 'disconnected' && !pvpDisconnectedAt) pvpDisconnectedAt = now;
    if (pvpDisconnectedAt && now - pvpDisconnectedAt >= PVP_DISCONNECT_GRACE_MS){
      pvpForfeit = true;
      setMsg('OPPONENT LINK TIMED OUT — FORFEIT VICTORY', 4);
      return;
    }
    if (pvpLastMessageAt && now - pvpLastMessageAt >= PVP_SILENCE_LIMIT_MS){
      pvpForfeit = true;
      setMsg('OPPONENT STOPPED RESPONDING — FORFEIT VICTORY', 4);
    }
  }

  function attachPvpListeners(){
    if (!PVP || pvpListenersAttached) return;
    pvpLink.addEventListener('message', onPvpMessage);
    pvpLink.addEventListener('close', onPvpClose);
    pvpLink.addEventListener('status', onPvpStatus);
    pvpListenersAttached = true;
    pvpLastMessageAt = performance.now();
  }

  function detachPvpListeners(){
    if (!PVP || !pvpListenersAttached) return;
    pvpLink.removeEventListener('message', onPvpMessage);
    pvpLink.removeEventListener('close', onPvpClose);
    pvpLink.removeEventListener('status', onPvpStatus);
    pvpListenersAttached = false;
  }

  // segment-sphere intersection for fast projectiles
  function segHit(p0, dirN, len, c, r){
    tmpV3.subVectors(c, p0);
    const tca = tmpV3.dot(dirN);
    if (tca < -r || tca > len + r) return false;
    return tmpV3.lengthSq() - tca * tca <= r * r;
  }

  // ---------- input ----------
  const keys = new Set();
  let camYaw = PVP && Number.isFinite(Number(opts.playerYaw)) ? Number(opts.playerYaw) : 0;
  let camPitch = 0.08, mouseDown = false, paused = false, started = false, camShake = 0, assistOn = true;
  let locked = false, firstPerson = false;

  function groundManeuverEligible(m = player){
    return env === 'ground' && !m.air && !m.suit.vehicle && !m.suit.noJump
      && !!m.parts?.legL && !!m.parts?.legR;
  }
  function landTypeMobileSuit(m = player){
    return groundManeuverEligible(m) && !!m.suit.landType;
  }
  const cyclePlayerWeapon = () => switchWeapon((player.wi + 1) % (player.suit.weapons.length + (hasSaber ? 1 : 0)));

  const onMouseMove = e => {
    if (!locked) return;
    camYaw -= e.movementX * 0.0026;
    camPitch = clamp(camPitch - e.movementY * 0.0024, -1.15, 1.15); // mouse up = look up
  };
  const onMouseDown = e => {
    if (!locked){ canvas.requestPointerLock(); return; }
    if (e.button === 0) mouseDown = true;
    if (e.button === 2 && hasSaber) trySaber();
  };
  const onMouseUp = e => { if (e.button === 0) mouseDown = false; };
  const onCtx = e => e.preventDefault();
  const onKeyDown = e => {
    if (PVP && !locked) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'r' && player.wi !== SABER_SLOT && player.clip < player.suit.weapons[player.wi].clip && player.reloadT <= 0)
      player.reloadT = player.suit.weapons[player.wi].reload, player.clip = 0;
    if (k === 'tab'){
      e.preventDefault();
      if (!e.repeat) cyclePlayerWeapon();
    }
    if (k === 'q' && !e.repeat){
      if (groundManeuverEligible()) trySandKick();
      else cyclePlayerWeapon();
    }
    if (k >= '1' && k <= '4'){
      const idx = +k - 1;
      if (player.suit.weapons[idx] || (hasSaber && idx === SABER_SLOT)) switchWeapon(idx);
    }
    if (k === 'v'){ firstPerson = !firstPerson; setMsg(firstPerson ? 'COCKPIT VIEW' : 'PURSUIT CAMERA', 1.2); }
    if (k === 'p'){ assistOn = !assistOn; setMsg(assistOn ? 'AIM SYSTEM ON — prediction + auto-aim on lock' : 'AIM SYSTEM OFF', 1.4); }
    if (k === 'f' && (player.parts.shield || hasSaber)){ // guard raises the shield OR the melee weapon; either parries a frontal melee strike
      player.blocking = !player.blocking;
      setMsg(player.blocking ? (player.wi === SABER_SLOT ? 'BLADE GUARD — PARRY READY' : 'GUARD — RAISED') : 'GUARD DOWN', 1.2);
    }
    if (k === 'j') tryStomp();
    if (k === 'x' && paused && started) finish({ victory: false, retreat: true });
  };
  const onKeyUp = e => keys.delete(e.key.toLowerCase());
  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
    // A local pointer-lock change must never freeze the shared PvP simulation.
    // It only relinquishes this pilot's controls while state, projectiles and the
    // opponent continue ticking.
    paused = PVP ? false : !locked;
    if (locked){ started = true; setMsg('', 0); }
    else {
      keys.clear(); mouseDown = false;
      if (PVP) setMsg('DUEL LIVE — CLICK TO RE-ENGAGE CONTROLS', 9999);
      else if (started) setMsg('PAUSED — CLICK TO RESUME · X TO WITHDRAW', 9999);
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('contextmenu', onCtx);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('pointerlockchange', onLockChange);
  setMsg(PVP ? 'CLICK TO PILOT — DUEL LIVE' : 'CLICK TO ENGAGE', 9999);
  paused = !PVP;

  function switchWeapon(i){
    if (i === player.wi) return;
    player.wi = i;
    resetMuzzleCycle(player, i);
    player.lockT = 0; player.lockTarget = null; // drop any pending missile lock
    player.reloadT = 0; player.fireT = 0; // a ranged reload can never complete against the saber's virtual slot
    if (i !== SABER_SLOT){ player.clip = player.suit.weapons[i].clip; player.parts.rebuildGun?.(i); }
    vgMeleeOverride = i !== SABER_SLOT && player.swingT > 0;
    buildViewGun(vgMeleeOverride);
    const nw = player.suit.weapons[i];
    if (nw && nw.arc) setMsg('ARTILLERY MODE — LOB ONTO FAR TARGETS', 1.8);
    else if (nw && player.parts.turretDock) setMsg('DIRECT FIRE — ANTI-MATERIEL CANNON', 1.4);
    sfx('ui', 0.12);
  }
  buildViewGun();
  buildViewShield();

  // Every player melee command uses the same familiar buttons, but its movement modifier
  // chooses a real attack path. Neutral attacks cycle a diagonal / overhead / thrust combo.
  // The contact fraction delays damage until the blade reaches the target in the animation.
  const PLAYER_SLASHES = Object.freeze({
    diagonal: Object.freeze({ duration: 0.42, recovery: 0.34, blade: 0.50, contact: 0.46, range: 27, minDot: 0.48, propDot: 0.38, impulse: 52, dmg: 1.00 }),
    crosscut: Object.freeze({ duration: 0.46, recovery: 0.38, blade: 0.54, contact: 0.48, range: 29, minDot: 0.24, propDot: 0.18, impulse: 44, dmg: 0.94 }),
    overhead: Object.freeze({ duration: 0.54, recovery: 0.46, blade: 0.62, contact: 0.62, range: 30, minDot: 0.60, propDot: 0.52, impulse: 40, dmg: 1.10 }),
    thrust:   Object.freeze({ duration: 0.38, recovery: 0.32, blade: 0.46, contact: 0.50, range: 39, minDot: 0.82, propDot: 0.76, impulse: 68, dmg: 1.04 }),
  });
  const NEUTRAL_SLASH_COMBO = ['diagonal', 'overhead', 'thrust'];

  function selectPlayerSlash(forced){
    if (forced && PLAYER_SLASHES[forced]) return forced;
    if (keys.has('w') && !keys.has('s')) return 'thrust';
    if (keys.has('s') && !keys.has('w')) return 'overhead';
    if (keys.has('a') !== keys.has('d')) return 'crosscut';
    const kind = NEUTRAL_SLASH_COMBO[player.meleeCombo % NEUTRAL_SLASH_COMBO.length];
    player.meleeCombo = (player.meleeCombo + 1) % NEUTRAL_SLASH_COMBO.length;
    return kind;
  }

  function resolvePlayerSlash(m, attack){
    const aim = m.swingAim || new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    let hits = 0;
    for (const enemy of mechs){
      if (enemy.team === m.team || !enemy.alive) continue;
      tmpV2.subVectors(enemy.root.position, m.root.position);
      const d = tmpV2.length();
      if (d < attack.range && d > 0.001 && tmpV2.multiplyScalar(1 / d).dot(aim) > attack.minDot){
        damage(enemy, m.suit.saber.dmg * attack.dmg,
          enemy.root.position.clone().setY(enemy.root.position.y + 10 * enemy.suit.scale), m, true);
        hits++;
      }
    }
    for (const p of props){
      if (p.team === m.team || !p.alive) continue;
      tmpV2.subVectors(p.root.position, m.root.position);
      const d = tmpV2.length();
      if (d < attack.range + p.radius && d > 0.001 && tmpV2.multiplyScalar(1 / d).dot(aim) > attack.propDot){
        damageProp(p, m.suit.saber.dmg * attack.dmg, p.root.position, m, m.suit.saber.name);
        hits++;
      }
    }
    m.lastSlashHits = hits;
    m.meleeHits = (m.meleeHits || 0) + hits;
  }

  function trySaber(forcedKind){
    if (player.meleeT > 0 || !player.alive || !hasSaber) return false;
    const kind = selectPlayerSlash(forcedKind);
    const attack = PLAYER_SLASHES[kind];
    player.meleeT = attack.recovery;
    player.bladeT = attack.blade;
    player.swingT = attack.duration;
    player.swingDuration = attack.duration;
    player.swingProgress = 0;
    player.swingHitResolved = false;
    player.swingKind = kind;
    player.lastSlashKind = kind;
    player.lastSlashHits = 0;
    player.slashCounts[kind] = (player.slashCounts[kind] || 0) + 1;
    if (kind === 'crosscut' && keys.has('a') !== keys.has('d')) player.swingDir = keys.has('a') ? -1 : 1;
    else player.swingDir = -(player.swingDir || 1);
    vgSwing = attack.duration;
    // RMB is a quick slash from any ranged slot. In the cockpit, temporarily
    // swap the gun viewmodel for the saber so the pilot never swings a rifle.
    vgMeleeOverride = player.wi !== SABER_SLOT;
    if (vgMeleeOverride) buildViewGun(true);
    const cp = Math.cos(camPitch);
    player.swingAim = new THREE.Vector3(
      Math.sin(camYaw) * (SPACE ? cp : 1),
      SPACE ? Math.sin(camPitch) : 0,
      Math.cos(camYaw) * (SPACE ? cp : 1),
    ).normalize();
    player.vel.addScaledVector(player.swingAim, attack.impulse);
    sfx('saber', 0.2);
    return true;
  }

  // AI attacks use the same readable contact delay as the visual slash. This is
  // simulation state (not pose state), so far-LOD pilots still land their blows.
  function queueAIMeleeContact(m, target, dmg, range, commanderComplete = false){
    m.pendingMelee = { target, dmg, range, commanderComplete, t: 0.19 };
  }
  function updatePendingMelee(m, dt){
    const pending = m.pendingMelee;
    if (!pending) return;
    pending.t -= dt;
    if (pending.t > 0) return;
    m.pendingMelee = null;
    const target = pending.target;
    if (!target || !target.alive) return;
    const allowance = pending.range + (target.isProp ? target.radius || 0 : 0);
    if (m.root.position.distanceTo(target.root.position) > allowance) return;
    if (target.isProp) damageProp(target, pending.dmg, target.root.position, m, m.suit.saber?.name || 'MELEE');
    else damage(target, pending.dmg,
      target.root.position.clone().setY(target.root.position.y + 10 * (target.suit?.scale || 1)), m, true);
    m.meleeHits = (m.meleeHits || 0) + 1;
    if (pending.commanderComplete) commanderSpaceMeleeComplete(m);
  }

  // Q on a planetary surface: a short, smooth ground-skimming burst that throws a low
  // dust trail. It is movement-only and deliberately cannot stack with guard, stomp or melee.
  function trySandKick(){
    const m = player, cost = 12;
    if (paused || !groundManeuverEligible(m) || !m.alive || m.sandKickCd > 0 || m.sandKickT > 0
      || m.stomping || m.blocking || m.swingT > 0 || m.fuel < cost) return false;
    const g = groundY(m.root.position.x, m.root.position.z);
    const rest = g + (m.suit.hover ? 3 : 0);
    if (m.root.position.y > rest + 4.5) return false;
    let dx = 0, dz = 0;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = Math.sin(camYaw - Math.PI / 2), rz = Math.cos(camYaw - Math.PI / 2);
    if (keys.has('w')){ dx += fx; dz += fz; }
    if (keys.has('s')){ dx -= fx; dz -= fz; }
    if (keys.has('a')){ dx -= rx; dz -= rz; }
    if (keys.has('d')){ dx += rx; dz += rz; }
    const len = Math.hypot(dx, dz);
    if (len < 0.001){ dx = fx; dz = fz; } else { dx /= len; dz /= len; }
    m.sandKickDir.set(dx, 0, dz);
    m.sandKickSide = Math.sign(dx * Math.cos(camYaw) - dz * Math.sin(camYaw)) || 1;
    m.sandKickDuration = 0.42; m.sandKickT = m.sandKickDuration; m.sandKickCd = 1.35;
    m.sandKickDustT = 0; m.fuel -= cost; m.boosting = true; m.thrusting = true;
    const burst = m.root.position.clone(); burst.y = g; dust(burst, 4.2);
    sfx('boost', 0.18); camShake = Math.min(0.75, camShake + 0.18);
    setMsg('SAND-KICK', 0.55);
    return true;
  }

  // ---------- STOMP (J while airborne): the MS drops like a hammer and shockwaves the ground on impact ----------
  function tryStomp(){
    const m = player;
    if (!m.alive || SPACE || m.stomping || m.suit.noJump) return;
    const g = groundY(m.root.position.x, m.root.position.z), rest = m.suit.hover ? g + 3 : g;
    if (m.root.position.y > rest + 9){                    // must be genuinely airborne
      m.stomping = true;
      m.vel.set(m.vel.x * 0.15, -150, m.vel.z * 0.15);    // slam straight down, kill horizontal drift
      m.meleeT = Math.max(m.meleeT, 0.35); m.bladeT = 0.3;
      sfx('boost', 0.14);
    }
  }
  function stompImpact(pos){
    const R = 52, dmg = 560;
    explosion(pos, 20, 0.42); dust(pos, 9);
    for (const e of mechs){
      if (!e.alive || e.isPlayer || e.team === player.team) continue;
      const d = e.root.position.distanceTo(pos);
      if (d < R) damage(e, dmg * clamp(1 - d / R, 0.28, 1), e.root.position.clone().setY(e.root.position.y + 6), player, false, 'GROUND STOMP');
    }
    for (const p of props){
      if (!p.alive || p.team === player.team) continue;
      const d = p.root.position.distanceTo(pos);
      if (d < R + p.radius) damageProp(p, dmg * clamp(1 - d / (R + p.radius), 0.28, 1), pos, player, 'GROUND STOMP');
    }
    killSoldiersNear(pos, R * 1.3);
    camShake = Math.min(2.2, camShake + 1.3);
    sfx('boom', 0.34); setMsg('GROUND STOMP', 0.8);
  }

  // ---------- AI ----------
  const PREF_RANGE = { beam: 520, mg: 260, bazooka: 390 };

  function setCommanderSpacePhase(s, phase, lo, hi){
    s.phase = phase;
    s.phaseT = 0;
    s.phaseLimit = rng.range(lo, hi);
  }

  // Commander machines get authored SPACE doctrines rather than the generic
  // radial strafe. State and scratch vectors live on the pilot so far-LOD units
  // use the exact same tactics without allocating every frame.
  function commanderSpaceIntent(m, t, d, dt){
    const doctrine = m.suit.spaceDoctrine;
    if (!SPACE || !m.suit.commander || !doctrine) return null;
    let s = m.ai.commanderSpace;
    if (!s || s.doctrine !== doctrine || s.target !== t){
      s = m.ai.commanderSpace = {
        doctrine, target: t,
        phase: '', phaseT: 0, phaseLimit: 0,
        side: rng.chance(0.5) ? 1 : -1,
        up: rng.chance(0.5) ? 1 : -1,
        passes: 0, feints: 0, meleeHits: 0, meleeCd: rng.range(2.5, 5),
        desired: new THREE.Vector3(), radial: new THREE.Vector3(), tangent: new THREE.Vector3(),
        binormal: new THREE.Vector3(), aimDir: new THREE.Vector3(), breakDir: new THREE.Vector3(),
      };
      if (doctrine === 'red_comet') setCommanderSpacePhase(s, 'attack_pass', 4.4, 5.4);
      else setCommanderSpacePhase(s, 'beam_orbit', 2.4, 3.6);
    }

    s.phaseT += dt;
    s.meleeCd = Math.max(0, s.meleeCd - dt);
    s.range = d;

    const radial = s.radial.subVectors(t.root.position, m.root.position);
    if (radial.lengthSq() < 0.0001) radial.set(0, 0, 1); else radial.normalize();
    const tangent = s.tangent.crossVectors(UP, radial);
    if (tangent.lengthSq() < 0.0001) tangent.set(Math.cos(m.yaw), 0, -Math.sin(m.yaw));
    tangent.normalize().multiplyScalar(s.side);
    const binormal = s.binormal.crossVectors(radial, tangent);
    if (binormal.lengthSq() < 0.0001) binormal.set(0, s.up, 0);
    else binormal.normalize().multiplyScalar(s.up);

    const intent = s;
    intent.fireAllowed = false;
    intent.meleeAllowed = false;
    intent.boost = false;
    intent.aimErrorMul = 1;
    intent.fireCone = 0.18;
    intent.turnRate = 2.6;
    intent.meleeRange = 20;
    intent.meleeMult = 0.55;

    if (doctrine === 'red_comet'){
      // The MS-06S uses its de-limited propulsion for one committed pass, then
      // breaks laterally/vertically and recovers before reversing for another.
      if (s.phase === 'attack_pass' && (d < 72 || s.phaseT >= s.phaseLimit || m.fuel < 9)){
        s.breakDir.copy(radial).multiplyScalar(-0.75)
          .addScaledVector(tangent, 0.9).addScaledVector(binormal, 0.55).normalize();
        s.passes++;
        setCommanderSpacePhase(s, 'breakaway', 0.9, 1.15);
      } else if (s.phase === 'breakaway' && s.phaseT >= s.phaseLimit){
        s.side *= -1; s.up *= -1;
        setCommanderSpacePhase(s, 'reengage', 0.75, 1.2);
      } else if (s.phase === 'reengage' &&
          ((s.phaseT >= s.phaseLimit && (d > 330 || m.fuel > 32)) || s.phaseT > s.phaseLimit + 0.8)){
        setCommanderSpacePhase(s, 'attack_pass', 4.4, 5.4);
      }

      if (s.phase === 'attack_pass'){
        const leadT = clamp(d / Math.max(120, m.suit.boost * 1.35), 0.15, 1.35);
        s.aimDir.copy(t.root.position);
        if (t.vel) s.aimDir.addScaledVector(t.vel, leadT);
        s.aimDir.sub(m.root.position).normalize();
        s.desired.copy(s.aimDir).addScaledVector(tangent, 0.16).addScaledVector(binormal, 0.09).normalize();
        intent.boost = m.fuel > 3;
        intent.speed = intent.boost ? m.suit.boost * 1.3 : m.suit.walk * 2.35;
        intent.fireAllowed = s.phaseT > 0.18;
        intent.meleeAllowed = true;
      } else if (s.phase === 'breakaway'){
        s.desired.copy(s.breakDir).normalize();
        intent.boost = m.fuel > 3;
        intent.speed = intent.boost ? m.suit.boost * 1.4 : m.suit.walk * 2.45;
      } else { // reengage: wide hook while the propulsion system recovers
        s.desired.copy(tangent).addScaledVector(radial, -0.18).addScaledVector(binormal, 0.22).normalize();
        intent.speed = m.suit.boost * 0.72;
      }
      intent.turnRate = 5.2;
      intent.fireCone = 0.28;
      intent.aimErrorMul = 0.78;
      intent.meleeRange = 28;
      intent.meleeMult = 0.62;
      m.blocking = false;
    } else { // MS-14S: beam-rifle orbit, high-speed feint, beam-naginata punish
      if (s.phase === 'beam_orbit'){
        if (!t.isProp && d < 210 && s.meleeCd <= 0){
          setCommanderSpacePhase(s, 'naginata_lunge', 1.35, 1.6);
        } else if (s.phaseT >= s.phaseLimit){
          s.breakDir.copy(tangent).multiplyScalar(0.78)
            .addScaledVector(radial, 0.55).addScaledVector(binormal, 0.42).normalize();
          s.feints++;
          setCommanderSpacePhase(s, 'thrust_feint', 0.72, 0.96);
        }
      } else if (s.phase === 'thrust_feint' && s.phaseT >= s.phaseLimit){
        s.side *= -1; s.up *= -1;
        setCommanderSpacePhase(s, 'beam_orbit', 2.3, 3.5);
      } else if (s.phase === 'naginata_lunge' && s.phaseT >= s.phaseLimit){
        s.breakDir.copy(radial).multiplyScalar(-0.85)
          .addScaledVector(tangent, 0.7).addScaledVector(binormal, 0.38).normalize();
        s.meleeCd = rng.range(5, 8);
        s.feints++;
        setCommanderSpacePhase(s, 'thrust_feint', 0.72, 0.96);
      }

      if (s.phase === 'beam_orbit'){
        const rangeCorrection = d > 620 ? 0.62 : d < 430 ? -0.58 : 0.05;
        const corkscrew = Math.sin(s.phaseT * 2.7) * 0.3;
        s.desired.copy(tangent).addScaledVector(radial, rangeCorrection)
          .addScaledVector(binormal, corkscrew).normalize();
        intent.speed = m.suit.boost * 0.92;
        intent.fireAllowed = true;
        // The Gelgoog exposes the rifle only for a shot, then brings its shield
        // back across the approach while the beam weapon cycles.
        m.blocking = m.fireT > 0.28 && !m.shieldBroken && m.shieldHp > 0;
      } else if (s.phase === 'thrust_feint'){
        s.desired.copy(s.breakDir).normalize();
        intent.boost = m.fuel > 3;
        intent.speed = intent.boost ? m.suit.boost * 1.35 : m.suit.walk * 2.4;
        intent.fireAllowed = true;
        m.blocking = false;
      } else { // naginata_lunge
        s.desired.copy(radial).addScaledVector(tangent, 0.08).addScaledVector(binormal, 0.06).normalize();
        intent.boost = m.fuel > 3;
        intent.speed = intent.boost ? m.suit.boost * 1.45 : m.suit.walk * 2.5;
        intent.meleeAllowed = true;
        m.blocking = false;
        m.bladeT = Math.max(m.bladeT, 0.16);
      }
      intent.turnRate = 4.5;
      intent.fireCone = 0.17;
      intent.aimErrorMul = 0.46;
      intent.meleeRange = 30;
      intent.meleeMult = 0.68;
    }

    s.desired.multiplyScalar(intent.speed);
    intent.accel = doctrine === 'red_comet' ? 6.5 : 5.4;
    intent.boostDrain = 18 * (m.suit.spaceBoostDrainMul || 1);
    intent.recharge = doctrine === 'red_comet' ? 16 : 14;
    return intent;
  }

  function commanderSpaceMeleeComplete(m){
    const s = m.ai && m.ai.commanderSpace;
    if (!s) return;
    s.meleeHits++;
    if (s.doctrine === 'red_comet'){
      s.breakDir.copy(s.radial).multiplyScalar(-0.8)
        .addScaledVector(s.tangent, 0.9).addScaledVector(s.binormal, 0.5).normalize();
      s.passes++;
      setCommanderSpacePhase(s, 'breakaway', 0.9, 1.15);
    } else {
      s.breakDir.copy(s.radial).multiplyScalar(-0.9)
        .addScaledVector(s.tangent, 0.75).addScaledVector(s.binormal, 0.42).normalize();
      s.meleeCd = rng.range(5, 8);
      s.feints++;
      setCommanderSpacePhase(s, 'thrust_feint', 0.72, 0.96);
    }
  }

  // ---------- combat doctrine: every suit fights by a ROLE, modulated by the scenario ----------
  // The role is inferred from the suit's stats/loadout (no per-suit hand tags), cached per pilot.
  function combatRole(suit){
    if (suit.aa) return 'aa';
    if (suit.style === 'tank' || suit.vehicle) return 'tank';
    if (suit.weapons.some(w => w.arc)) return 'artillery';
    if (suit.weapons.some(w => (w.pref || PREF_RANGE[w.type]) >= 800 || /SNIPER|SATELLITE/.test(w.name))) return 'sniper';
    if (suit.hover || suit.boost >= 100) return 'skirmisher';
    if (suit.saber && suit.saber.dmg >= 380 && (suit.weapons[0].pref || PREF_RANGE[suit.weapons[0].type]) < 300) return 'brawler'; // true CQB kit only
    if (suit.armor >= 14 || (suit.hp >= 4500 && suit.boost < 80)) return 'heavy';  // slow bruisers, not fast hero frames
    return 'line';
  }
  // per-role doctrine: engagement band (×weapon pref), strafe width, dodge tempo, melee appetite,
  // aim discipline, how hard the suit plants in-band, and the HP fraction where it breaks off to kite
  const ROLE_TUNE = {
    line:       { near: 0.60, far: 1.30, strafe: 0.75, dodge: 1.0, melee: 1.0, aimMul: 1.0, plant: 0.35, retreatHp: 0.25 },
    sniper:     { near: 1.00, far: 1.80, strafe: 0.50, dodge: 1.1, melee: 0.2, aimMul: 0.65, plant: 0.20, retreatHp: 0.50 },
    artillery:  { near: 0.75, far: 1.35, strafe: 0.35, dodge: 0.7, melee: 0.0, aimMul: 0.90, plant: 0.15, retreatHp: 0.60 },
    brawler:    { near: 0.30, far: 0.85, strafe: 1.10, dodge: 1.15, melee: 1.8, aimMul: 1.10, plant: 0.50, retreatHp: 0.12 },
    skirmisher: { near: 0.50, far: 1.20, strafe: 1.50, dodge: 1.5, melee: 1.2, aimMul: 1.05, plant: 1.00, retreatHp: 0.20, passes: true },
    heavy:      { near: 0.80, far: 1.40, strafe: 0.50, dodge: 0.7, melee: 0.6, aimMul: 0.80, plant: 0.20, retreatHp: 0.20 },
    tank:       { near: 0.90, far: 1.60, strafe: 0.60, dodge: 0.9, melee: 0.0, aimMul: 0.90, plant: 0.30, retreatHp: 0.45 },
    aa:         { near: 0.90, far: 1.60, strafe: 0.70, dodge: 0.9, melee: 0.3, aimMul: 0.85, plant: 0.30, retreatHp: 0.35 },
  };
  // scenario anchor: units with an objective stay LEASHED to it instead of chasing across the map.
  // Defenders hold their base, assault garrisons guard their structures, escorts hug the convoy.
  function missionAnchor(m){
    // the player's own hangar wingmen / air wing follow the player, and blip-materialized ambient
    // units must not march back out of the observation bubble — only true garrison units leash
    if (m.wingId !== undefined || m.airId !== undefined || m.fromBlip) return null;
    let list = null, leash = 0;
    if (mission.type === 'defend' && m.team === 'FED') { list = missionProps.filter(p => p.alive); leash = 420; }
    else if (mission.type === 'assault' && m.team === 'ZEON') { list = missionProps.filter(p => p.alive); leash = 500; }
    else if (mission.type === 'escort' && m.team === 'FED') { list = missionProps.filter(p => p.alive); leash = 300; }
    if (!list || !list.length) return null;
    let x = 0, z = 0;
    for (const p of list){ x += p.root.position.x; z += p.root.position.z; }
    return { x: x / list.length, z: z / list.length, leash };
  }

  function aiUpdate(m, dt){
    const ai = m.ai;
    const commanderSpace = SPACE && m.suit.commander && !!m.suit.spaceDoctrine;
    const role = ai.role || (ai.role = combatRole(m.suit));
    const tune = ROLE_TUNE[role];
    ai.tThink -= dt;
    if (ai.tThink <= 0){
      ai.tThink = 1.2;
      const foes = mechs.filter(o => o.alive && o.team !== m.team);
      const hostileProps = props.filter(p => p.alive && p.team !== m.team && !p.scenery);
      if (!foes.length && !hostileProps.length){ ai.target = null; return; }
      // objective pressure: raiders sometimes ignore mechs and press the structures/convoy
      // (relaxed in grand battles so the landships aren't under permanent all-army siege)
      const propBias = mission.type === 'odessa' ? 0.15 : m.team === 'ZEON' ? 0.45 : 0.3;
      if (hostileProps.length && (!foes.length || rng.chance(propBias)) && !(m.suit.aa && foes.some(f => f.air))){
        ai.target = hostileProps[rng.int(0, hostileProps.length - 1)];
      } else if (!foes.length){
        ai.target = null;
      } else {
        // spread fire across the lance: nearest target by default, hold a grudge
        // against whoever shot us last, and never let the whole squad pile on the player
        const nearest = arr => arr.reduce((a, b) =>
          a.root.position.distanceToSquared(m.root.position) < b.root.position.distanceToSquared(m.root.position) ? a : b);
        const airFoes = m.suit.aa ? foes.filter(f => f.air) : null;     // dedicated AA platforms hunt aircraft first
        let pick = (airFoes && airFoes.length) ? nearest(airFoes)
          : (ai.grudge && ai.grudge.alive && ai.grudge.team !== m.team) ? ai.grudge : nearest(foes);
        // hunt escorts SCREEN their vip: intercept whoever is pressing the boss hardest
        if (mission.type === 'hunt' && m.team === 'ZEON' && !m.vip && (!airFoes || !airFoes.length)){
          const vip = mechs.find(v => v.alive && v.vip);
          if (vip) pick = foes.reduce((a, b) =>
            a.root.position.distanceToSquared(vip.root.position) < b.root.position.distanceToSquared(vip.root.position) ? a : b);
        }
        // focus fire: pick up a nearby squadmate's live target ~1/3 of the time — concentrated volleys.
        // Space commanders keep their duel discipline; hunt escorts never abandon the vip screen.
        if (!commanderSpace && !(mission.type === 'hunt' && m.team === 'ZEON')
            && (!airFoes || !airFoes.length) && rng.chance(0.33)){
          const buddy = mechs.find(o => o.alive && o !== m && o.team === m.team && o.ai && o.ai.target
            && o.ai.target.alive && !o.ai.target.isProp && o.ai.target.team !== m.team
            && o.root.position.distanceToSquared(m.root.position) < 320 * 320);
          if (buddy) pick = buddy.ai.target;
        }
        if (m.team === 'ZEON' && pick.isPlayer){
          const others = foes.filter(f => !f.isPlayer);
          const onPlayer = mechs.filter(o => o.alive && o !== m && o.ai && o.ai.target === player).length;
          if (others.length && onPlayer >= 2) pick = nearest(others);
        }
        if (ai.target !== pick) ai.pass = null;   // fresh target → fresh hit-and-run pass, no stale peel-away
        ai.target = pick;
        ai.grudge = null;
      }
      ai.anchor = missionAnchor(m);       // objective leash, refreshed at think cadence
      if (!ai.target) return;
      // pick weapon by range
      const d = m.root.position.distanceTo(ai.target.root.position);
      let best = 0, bestScore = 1e9;
      if (!(commanderSpace && m.suit.spaceDoctrine === 'gelgoog_duelist')){
        m.suit.weapons.forEach((w, i) => {
          const s = Math.abs((w.pref || PREF_RANGE[w.type]) - d);
          if (s < bestScore){ bestScore = s; best = i; }
        });
      }
      if (best !== m.wi){ m.wi = best; resetMuzzleCycle(m, best); m.clip = m.suit.weapons[best].clip; m.reloadT = 0; m.parts?.rebuildGun?.(best); }
    }
    const t = ai.target;
    if (!t || !t.alive){ ai.meleeRun = null; ai.pass = null; m.hopY = 0; return; }

    const toT = tmpV.subVectors(t.root.position, m.root.position);
    const d = toT.length(); toT.normalize();
    const w = m.suit.weapons[m.wi];
    const pref = w.pref || PREF_RANGE[w.type];
    // doctrine state shared by the melee and movement blocks: wounded units break off (vips run
    // early); hold-out attackers are relentless and never disengage
    const retreatAt = m.vip ? Math.max(tune.retreatHp, 0.55) : tune.retreatHp;
    const relentless = mission.type === 'survive' && m.team === 'ZEON';
    const hurt = !relentless && m.hp < m.maxHp * retreatAt;

    // ----- melee charge (ground): lunge in with the blade, swing, then thrust back out -----
    m.meleeT -= dt;
    ai.meleeCd -= dt;
    const canMelee = !SPACE && tune.melee > 0 && !hurt && m.suit.saber && m.suit.saber.dmg > 0
      && !t.isProp && !t.air && !m.dropping; // never blade-charge an aircraft — the swing can't reach the sky
    if (canMelee && !ai.meleeRun && ai.meleeCd <= 0){
      // doctrine-driven blade work: brawlers (heat-hawk Zakus, Goufs) commit from further out and far
      // more often; timid roles (snipers, heavies) barely ever break formation to lunge. The roll is
      // consumed per WINDOW (a failed roll re-arms the cooldown) so tune.melee is a real appetite knob,
      // not a per-frame lottery that every role wins within a second.
      const reach = (tune.melee >= 1.5 || m.suit.style === 'zaku') ? 460 : 340;
      const chance = Math.min(0.65, 0.3 * tune.melee + (m.suit.style === 'zaku' ? 0.2 : 0));
      if (d < reach && d > 26){
        if (rng.chance(chance)){
          ai.meleeRun = { phase: 'charge', swings: 0, t: 0 };
          m.hopT = m.suit.noJump ? 0 : 0.5; // a hop as it springs onto the enemy (tracked chassis can't hop)
        } else ai.meleeCd = rng.range(1.2, 2.4) / Math.max(0.2, tune.melee);
      }
    }
    if (ai.meleeRun){
      m.hopT = (m.hopT || 0) - dt;
      m.hopY = m.hopT > 0 ? Math.sin((1 - m.hopT / 0.5) * Math.PI) * 6 : 0;
      const wy = Math.atan2(toT.x, toT.z);
      let ddy = wy - m.yaw; while (ddy > Math.PI) ddy -= Math.PI * 2; while (ddy < -Math.PI) ddy += Math.PI * 2;
      m.yaw += clamp(ddy, -4.5 * dt, 4.5 * dt);
      const sp = m.suit.boost * (1 - Math.min(0.45, m.legDmg * 0.6));
      m.boosting = m.fuel > 4;
      if (m.fuel > 0) m.fuel = Math.max(0, m.fuel - 16 * dt);
      ai.meleeRun.t += dt;
      if (ai.meleeRun.phase === 'charge'){
        m.vel.lerp(tmpV3.copy(toT).multiplyScalar(sp), clamp(5 * dt, 0, 1)); // drive straight in
        if (d < 22 && m.meleeT <= 0){
          m.meleeT = 0.6; m.bladeT = 0.45; m.swingT = 0.4; m.swingDir = -(m.swingDir || 1);
          sfx('saber', clamp(300 / m.root.position.distanceTo(player.root.position), 0.04, 0.18));
          queueAIMeleeContact(m, t, m.suit.saber.dmg * 0.6, 30);
          if (++ai.meleeRun.swings >= rng.int(2, 4)){ ai.meleeRun.phase = 'back'; ai.meleeRun.t = 0; }
        }
        if (ai.meleeRun.t > 8 || hurt){ ai.meleeRun = null; ai.meleeCd = rng.range(2, 4); m.hopY = 0; } // bail on timeout, or break off wounded
      } else { // thrust back out to firing range
        m.vel.lerp(tmpV3.copy(toT).multiplyScalar(-sp), clamp(5 * dt, 0, 1));
        if (ai.meleeRun.t > 0.9 || d > 110){ ai.meleeRun = null; ai.meleeCd = rng.range(3, 6); m.hopY = 0; }
      }
      return; // a melee run owns this mech's movement and fire for the frame
    }

    // shield guard: shielded units periodically raise their guard at mid-range
    if (!commanderSpace && m.shieldMax > 0 && !m.shieldBroken){
      ai.blockCd = (ai.blockCd ?? rng.range(2, 6)) - dt;
      if (m.blocking){
        ai.blockT -= dt;
        if (ai.blockT <= 0){ m.blocking = false; ai.blockCd = rng.range(3, 7); }
      } else if (ai.blockCd <= 0){
        const facing = toT.x * Math.sin(m.yaw) + toT.z * Math.cos(m.yaw) > 0.4;
        if (facing && d > 120 && d < pref * 1.7 && rng.chance(0.5)){ m.blocking = true; ai.blockT = rng.range(1.0, 2.2); }
        else ai.blockCd = rng.range(1.5, 3);
      }
    } else if (!commanderSpace && m.blocking) m.blocking = false;

    // movement intent — grounded suits hold a firing stance; space/hover stay agile
    const commanderIntent = commanderSpaceIntent(m, t, d, dt);
    let calm = false, tangent = null;
    let boost, speed, accel;
    const desired = tmpV3;
    if (commanderIntent){
      desired.copy(commanderIntent.desired);
      boost = commanderIntent.boost;
      speed = commanderIntent.speed;
      accel = commanderIntent.accel;
    } else {
      calm = !SPACE && !m.suit.hover;
      ai.tStrafe -= dt;
      if (ai.tStrafe <= 0){ ai.strafe *= -1; ai.tStrafe = (calm ? rng.range(3.5, 7) : rng.range(1.5, 4)) / Math.max(0.5, tune.strafe); }
      tangent = tmpV2.crossVectors(UP, toT).multiplyScalar(ai.strafe);
      // engagement band by ROLE (×weapon pref)
      let radial;
      if (hurt) radial = d > pref * 2.0 ? 0.03 : -1;                  // kite to max range, then HOLD and keep firing — never flee the map
      else if (tune.passes){
        // skirmisher hit-and-run: dive in, rake the target, peel out wide, come around again
        ai.pass = ai.pass || { phase: 'in', t: 0 };
        ai.pass.t += dt;
        if (ai.pass.phase === 'in' && (d < pref * 0.5 || ai.pass.t > 6)){ ai.pass.phase = 'out'; ai.pass.t = 0; }
        else if (ai.pass.phase === 'out' && (d > pref * 1.4 || ai.pass.t > 5)){ ai.pass.phase = 'in'; ai.pass.t = 0; }
        radial = ai.pass.phase === 'in' ? 0.9 : -0.9;
      }
      else radial = d > pref * tune.far ? 1 : d < pref * tune.near ? (tune.plant < 0.25 ? -1 : -0.7) : (calm ? 0.03 : 0.12);
      boost = m.fuel > 10 && (hurt || d > pref * 2 || (tune.passes && radial > 0 && d > pref * 0.8));
      speed = (boost ? m.suit.boost : m.suit.walk) * (1 - Math.min(0.45, m.legDmg * 0.6)) * (m.blocking ? 0.5 : 1);
      if (calm && !boost && !hurt && d >= pref * tune.near && d < pref * tune.far) speed *= tune.plant; // in-band: plant by doctrine
      desired.copy(toT).multiplyScalar(radial).addScaledVector(tangent, (calm ? 0.3 : 0.75) * tune.strafe);
      if (SPACE || m.suit.hover) desired.y += clamp((t.root.position.y - m.root.position.y) / Math.max(d, 1), -0.5, 0.5);
      desired.normalize().multiplyScalar(speed);
      accel = m.suit.aiAccel || 3;
      // objective leash: units bound to a base/convoy fall back toward it instead of chasing over the horizon
      if (ai.anchor){
        const ax = ai.anchor.x - m.root.position.x, az = ai.anchor.z - m.root.position.z;
        const adist = Math.hypot(ax, az);
        if (adist > ai.anchor.leash){
          const k = Math.min(1, (adist - ai.anchor.leash) / (ai.anchor.leash * 0.5)), inv = speed / adist;
          desired.x = desired.x * (1 - k) + ax * inv * k;
          desired.z = desired.z * (1 - k) + az * inv * k;
        }
      }
    }
    const aiTurn = commanderIntent ? commanderIntent.turnRate : (m.suit.aiTurn || 2.6);
    if (!commanderIntent && m.suit.vehicle && desired.lengthSq() > 0.001){
      // Wheeled AI follows its travel vector prow-first. Its turret remains free to
      // track the target, eliminating the old sideways APC slide and wheel mismatch.
      const travelYaw = Math.atan2(desired.x, desired.z);
      m.yaw += clamp(wrapAngle(travelYaw - m.yaw), -aiTurn * dt, aiTurn * dt);
      desired.set(Math.sin(m.yaw), 0, Math.cos(m.yaw)).multiplyScalar(speed);
    }
    m.boosting = boost;
    if (boost) m.fuel = Math.max(0, m.fuel - (commanderIntent ? commanderIntent.boostDrain : 18) * dt);
    else m.fuel = Math.min(m.maxFuel, m.fuel + (commanderIntent ? commanderIntent.recharge : 12) * dt);
    m.vel.lerp(desired, clamp(accel * dt, 0, 1));

    // dodge impulse — rare and small on the ground, sharp in space
    if (!commanderIntent) ai.tDodge -= dt;
    if (!commanderIntent && ai.tDodge <= 0){
      ai.tDodge = (calm ? rng.range(3.5, 7) : rng.range(1.4, 3.8)) / ai.skill / (m.suit.agile ? 1.45 : 1) / tune.dodge;
      if (m.suit.vehicle){
        // An agile wheeled vehicle dodges by surging through its steering arc,
        // never by translating sideways like a mobile suit.
        tmpV3.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
        m.vel.addScaledVector(tmpV3, (m.suit.agile ? 20 : 12) * ai.skill);
      } else m.vel.addScaledVector(tangent, (calm ? (m.suit.agile ? 20 : 12) : 34) * ai.skill);
      if (SPACE) m.vel.y += rng.range(-20, 20);
    }

    // face + fire
    const wantYaw = Math.atan2(toT.x, toT.z);
    let dy = wantYaw - m.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    if (!m.suit.vehicle) m.yaw += clamp(dy, -aiTurn * dt, aiTurn * dt);
    // Turreted vehicles may fire off-axis; syncMuzzlePose traverses the live turret
    // onto this lead point before the projectile leaves the animated muzzle.
    const fireCone = commanderIntent ? commanderIntent.fireCone : 0.18;
    const rangedAllowed = !commanderIntent || commanderIntent.fireAllowed;
    if (rangedAllowed && (m.suit.vehicle || Math.abs(dy) < fireCone) && d < pref * 2.4 && !(w.arc && d < 140)){ // artillery holds fire inside its own splash
      // lead the target, with skill-scaled error; aim point scales with target size
      const lead = tmpV2.copy(t.root.position).addScaledVector(t.vel, d / w.speed);
      lead.y += aimHeight(t);
      const dir = lead.clone().sub(m.root.position).normalize();
      const err = (ai.err * (1 + m.sensorDmg * 2)) / ai.skill * (commanderIntent ? commanderIntent.aimErrorMul : tune.aimMul);
      dir.x += rng.range(-err, err); dir.y += rng.range(-err, err); dir.z += rng.range(-err, err);
      dir.normalize();
      fire(m, dir, m.root.position.clone().addScaledVector(dir, Math.max(50, d)));
    }
    // melee when point-blank (fallback for space combat and non-charging contact)
    const meleeAllowed = commanderIntent ? commanderIntent.meleeAllowed : tune.melee > 0;
    const meleeRange = commanderIntent ? commanderIntent.meleeRange : 20;
    if (meleeAllowed && d < meleeRange && m.meleeT <= 0 && !m.dropping && m.suit.saber && m.suit.saber.dmg > 0){
      m.meleeT = commanderIntent ? 1.3 : 2.4; m.bladeT = 0.4;
      m.swingT = 0.4; m.swingDir = -(m.swingDir || 1);
      sfx('saber', clamp(300 / m.root.position.distanceTo(player.root.position), 0.04, 0.18));
      const meleeMult = commanderIntent ? commanderIntent.meleeMult : 0.55;
      queueAIMeleeContact(m, t, m.suit.saber.dmg * meleeMult, meleeRange + 8, !!commanderIntent);
    }
  }

  // ---------- player movement ----------
  // ---------- player flight model (piloting an aircraft) ----------
  // Mouse steers the nose (camYaw/camPitch); the plane banks toward that heading at its
  // turn rate and always thrusts forward. SHIFT boost, S brake, LMB fire forward.
  function playerFlightUpdate(dt){
    const m = player; if (!m.alive) return;
    const w = m.suit, turn = w.turn || 1.6;
    const cp = Math.cos(camPitch);
    const wantYaw = camYaw, wantPitch = clamp(camPitch, -1.2, 1.2);
    let dyaw = wantYaw - m.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const turnStep = clamp(dyaw, -turn * dt, turn * dt);
    m.yaw += turnStep;
    m.pitch += clamp(wantPitch - m.pitch, -turn * dt, turn * dt);
    // throttle: SHIFT boost · S brake · otherwise cruise
    const boosting = keys.has('shift') && m.fuel > 0, braking = keys.has('s');
    m.boosting = boosting;
    if (boosting) m.fuel = Math.max(0, m.fuel - 18 * dt); else m.fuel = Math.min(m.maxFuel, m.fuel + 12 * dt);
    const targetSpd = boosting ? w.boost : braking ? w.boost * 0.5 : w.boost * 0.78;
    const hcp = Math.cos(m.pitch), k = clamp(2.5 * dt, 0, 1);
    m.vel.x = lerp(m.vel.x, Math.sin(m.yaw) * hcp * targetSpd, k);
    m.vel.y = lerp(m.vel.y, Math.sin(m.pitch) * targetSpd, k);
    m.vel.z = lerp(m.vel.z, Math.cos(m.yaw) * hcp * targetSpd, k);
    m.root.position.addScaledVector(m.vel, dt);
    if (!SPACE){ // don't fly into the ground
      const floorY = groundY(m.root.position.x, m.root.position.z) + 20;
      if (m.root.position.y < floorY){ m.root.position.y = floorY; if (m.vel.y < 0) m.vel.y = 0; }
    }
    const rr = Math.hypot(m.root.position.x, m.root.position.z);
    if (rr > 5200) m.root.position.multiplyScalar(5200 / rr);
    m.bank = lerp(m.bank, clamp(-turnStep / dt / turn, -1, 1) * 0.9, 4 * dt);
    // firing — forward, converging on the crosshair
    m.fireT -= dt;
    if (m.reloadT > 0){ m.reloadT -= dt; if (m.reloadT <= 0) m.clip = m.suit.weapons[m.wi].clip; }
    const aw = m.suit.weapons[m.wi];
    if (aw && aw.type === 'lockmissile'){
      updateLockOn(m, dt); // movie-style lock sequence → auto-launches a homing missile at full lock
    } else if (mouseDown && m.reloadT <= 0 && aw){
      fire(m, null, playerAimPoint(aw));
      if (m.fireT >= 1 / aw.rof - 0.001) camShake = Math.min(0.8, camShake + 0.05);
    }
  }

  function playerUpdate(dt){
    const m = player;
    if (!m.alive) return;
    if (m.air) return playerFlightUpdate(dt);
    const w = m.suit;
    // in space, thrust follows the full look direction; on the ground it stays planar
    const fwd = SPACE
      ? tmpV.set(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch))
      : tmpV.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const right = tmpV2.set(Math.sin(camYaw - Math.PI / 2), 0, Math.cos(camYaw - Math.PI / 2));
    const input = tmpV3.set(0, 0, 0);
    if (keys.has('w')) input.add(fwd);
    if (keys.has('s')) input.sub(fwd);
    if (keys.has('a')) input.sub(right);
    if (keys.has('d')) input.add(right);
    const hasInput = input.lengthSq() > 0;
    if (hasInput) input.normalize();

    const gy = SPACE ? -Infinity : groundY(m.root.position.x, m.root.position.z);
    const restY = (!SPACE && w.hover) ? gy + 3 : gy;          // hover suits rest a few metres up
    const grounded = !SPACE && m.root.position.y <= restY + 0.5;
    const legFactor = 1 - Math.min(0.45, m.legDmg * 0.6);
    const wantsHover = groundManeuverEligible(m) && keys.has('e') && m.fuel > 0 && !m.stomping;
    const landHover = landTypeMobileSuit(m);
    const hoverTravelMultiplier = landHover ? 3 : 2;
    const hoverEnergyMultiplier = landHover ? 0.8 : 1;
    const hoverFuelDrain = 8 * hoverEnergyMultiplier;
    const hoverTargetSpeed = w.walk * hoverTravelMultiplier * legFactor * (m.blocking ? 0.5 : 1);
    m.hovering = wantsHover;
    m.hoverTravelMultiplier = hoverTravelMultiplier;
    m.hoverEnergyMultiplier = hoverEnergyMultiplier;
    m.hoverFuelDrain = hoverFuelDrain;
    m.hoverTargetSpeed = hoverTargetSpeed;
    m.groundHoverBlend = lerp(m.groundHoverBlend || 0, wantsHover ? 1 : 0, Math.min(1, (wantsHover ? 8 : 4) * dt));
    m.groundHoverPhase = (m.groundHoverPhase || 0) + dt;
    m.sandKickCd = Math.max(0, (m.sandKickCd || 0) - dt);
    const sandKicking = (m.sandKickT || 0) > 0;
    const shiftBoosting = !wantsHover && keys.has('shift') && m.fuel > 0;
    m.boosting = shiftBoosting || sandKicking || wantsHover;

    if (SPACE){
      // full-vector drift with verniers (suits tuned for ground are sluggish here)
      const acc = (shiftBoosting ? 95 : 42) * (w.spaceThrustMul || 1);
      m.thrusting = hasInput || keys.has(' ') || keys.has('c');
      if (hasInput) m.vel.addScaledVector(input, acc * dt);
      if (keys.has(' ')) m.vel.y += acc * 0.8 * dt;
      if (keys.has('c')) m.vel.y -= acc * 0.8 * dt;
      m.vel.multiplyScalar(1 - 0.5 * dt);
      const cap = (shiftBoosting ? w.boost * 1.6 : w.walk * 2.2) * (w.spaceSpeedMul || 1) * (m.blocking ? 0.5 : 1);
      if (m.vel.length() > cap) m.vel.setLength(cap);
      if (shiftBoosting) m.fuel = Math.max(0, m.fuel - 20 * (w.spaceBoostDrainMul || 1) * dt);
      else m.fuel = Math.min(m.maxFuel, m.fuel + 14 * dt);
    } else {
      const cushionGrounded = grounded || wantsHover || (m.groundHoverBlend > 0.15 && m.root.position.y <= restY + 4.5);
      const acc = cushionGrounded ? (w.groundAccel || 70) : 30;
      if (hasInput && !m.stomping && !sandKicking && !wantsHover){
        if (w.vehicle && cushionGrounded){
          const wantYaw = Math.atan2(input.x, input.z);
          const turn = w.groundTurn || 5;
          m.yaw += clamp(wrapAngle(wantYaw - m.yaw), -turn * dt, turn * dt);
          tmpV2.set(Math.sin(m.yaw), 0, Math.cos(m.yaw));
          m.vel.addScaledVector(tmpV2, (shiftBoosting ? acc * 1.8 : acc) * dt);
        } else m.vel.addScaledVector(input, (shiftBoosting ? acc * 1.8 : acc) * dt);
      }
      if (m.stomping){                                       // ground stomp: drive straight down, no steering / jump
        m.vel.x *= 0.82; m.vel.z *= 0.82; m.vel.y = -150; m.thrusting = false;
      } else if (wantsHover){
        // Ground-effect travel: hold E to ride a damped three-metre cushion that automatically
        // advances along the sightline. Ordinary MS use 2x walk speed; tagged land types use
        // 3x walk speed and only 80% of the normal hover energy.
        const trim = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
        if (!sandKicking && trim) fwd.addScaledVector(right, trim * 0.32).normalize();
        const brake = keys.has('s') && !keys.has('w') ? 0.5 : 1;
        const lookAhead = sandKicking ? 0 : clamp(hoverTargetSpeed * brake * 0.12, 4, 14);
        const aheadGround = lookAhead > 0
          ? groundY(m.root.position.x + fwd.x * lookAhead, m.root.position.z + fwd.z * lookAhead)
          : gy;
        const travelGround = lerp(gy, aheadGround, 0.68);
        const targetY = travelGround + (w.hover ? 3 : 0) + 3 + Math.sin(m.groundHoverPhase * 3.2) * 0.13;
        const targetVy = clamp((targetY - m.root.position.y) * 8.5, -20, 26);
        m.vel.y = lerp(m.vel.y, targetVy, Math.min(1, 9 * dt));
        if (!sandKicking){
          const travelK = 1 - Math.exp(-4.8 * dt);
          m.vel.x = lerp(m.vel.x, fwd.x * hoverTargetSpeed * brake, travelK);
          m.vel.z = lerp(m.vel.z, fwd.z * hoverTargetSpeed * brake, travelK);
        }
        m.fuel = Math.max(0, m.fuel - hoverFuelDrain * dt); m.thrusting = true;
        m.hoverDustT = 0;
      } else {
        // vernier climb / jump
        m.thrusting = !grounded && keys.has(' ') && m.fuel > 0 && !w.noJump;
        if (keys.has(' ') && !w.noJump){
          if (grounded){ m.vel.y = 16 * (w.jumpMul || 1); }   // ground GMs leap 1.5x higher
          else if (m.fuel > 0){ m.vel.y = Math.min(m.vel.y + 44 * dt, 30); m.fuel = Math.max(0, m.fuel - 22 * dt); }
        }
        m.vel.y -= (m.groundHoverBlend > 0.05 ? 20 : 38) * dt;
        if (m.groundHoverBlend > 0.05) m.vel.y = Math.max(m.vel.y, -11); // releasing E settles without a false hard-landing slam
        m.hoverDustT = 0;
      }
      if (sandKicking){
        const duration = Math.max(0.001, m.sandKickDuration || 0.42);
        const p = clamp(1 - m.sandKickT / duration, 0, 1);
        const envelope = Math.pow(Math.sin(p * Math.PI), 0.72);
        const targetSpeed = lerp(w.walk * 1.05, w.boost * 1.25, envelope) * legFactor;
        const k = Math.min(1, 15 * dt);
        m.vel.x = lerp(m.vel.x, m.sandKickDir.x * targetSpeed, k);
        m.vel.z = lerp(m.vel.z, m.sandKickDir.z * targetSpeed, k);
        m.sandKickT = Math.max(0, m.sandKickT - dt);
        m.sandKickDustT -= dt; m.thrusting = true;
        if (m.sandKickDustT <= 0){
          m.sandKickDustT = 0.07;
          const trail = m.root.position.clone(); trail.y = gy; dust(trail, 3.1);
        }
      }
      if (grounded && !hasInput && !sandKicking && !wantsHover){ m.vel.x *= 1 - Math.min(1, 8 * dt); m.vel.z *= 1 - Math.min(1, 8 * dt); }
      const hcap = (sandKicking ? w.boost * 1.28 : wantsHover ? w.walk * hoverTravelMultiplier : (shiftBoosting ? w.boost : w.walk))
        * legFactor * (w.hover && !wantsHover ? 1.15 : 1) * (m.blocking ? 0.5 : 1);
      const hv = Math.hypot(m.vel.x, m.vel.z);
      if (hv > hcap){ m.vel.x *= hcap / hv; m.vel.z *= hcap / hv; }
      if (shiftBoosting && hasInput && !wantsHover) m.fuel = Math.max(0, m.fuel - 24 * dt);
      else if (wantsHover) { /* the cushion already drained fuel above */ }
      else if (grounded) m.fuel = Math.min(m.maxFuel, m.fuel + 18 * dt);
      else m.fuel = Math.min(m.maxFuel, m.fuel + 8 * dt);
    }

    const fallSpeed = -m.vel.y;
    m.root.position.addScaledVector(m.vel, dt);
    if (!SPACE){
      const g = groundY(m.root.position.x, m.root.position.z);
      if (w.vehicle){
        // Wheeled hulls follow the terrain contact plane; ridge transitions must not become lethal MS-style falls.
        m.root.position.y = g; m.vel.y = 0;
      } else if (m.root.position.y < g){
        m.root.position.y = g;
        if (m.vel.y < 0) m.vel.y = 0;
        if (fallSpeed > 14){ // hard landing: dust + thud + shake
          dust(m.root.position, clamp(fallSpeed / 6, 2, 7));
          sfx('boom', clamp(fallSpeed / 120, 0.06, 0.2));
          camShake = Math.min(1.4, camShake + fallSpeed / 60);
        }
      }
      if (w.hover && m.root.position.y < g + 3){ m.root.position.y = g + 3; if (m.vel.y < 0) m.vel.y = 0; } // settle back onto the hover cushion
      if (m.stomping && m.root.position.y <= (w.hover ? g + 3 : g) + 0.5){ stompImpact(m.root.position.clone()); m.stomping = false; } // touchdown shockwave
    }
    // keep inside arena
    const rr = Math.hypot(m.root.position.x, m.root.position.z);
    if (rr > 5200) m.root.position.multiplyScalar(5200 / rr);

    // Mobile suits face the sightline; wheeled vehicles keep the hull on their travel heading and traverse the turret.
    if (!w.vehicle){
      let dy = camYaw - m.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      m.yaw += dy * Math.min(1, 10 * dt);
    }

    // firing
    m.fireT -= dt; m.meleeT -= dt;
    if (m.reloadT > 0){
      m.reloadT -= dt;
      if (m.reloadT <= 0 && m.wi !== SABER_SLOT) m.clip = m.suit.weapons[m.wi].clip;
    }
    if (mouseDown && m.reloadT <= 0){
      if (m.wi === SABER_SLOT) trySaber();
      else if (m.swingT <= 0 && m.meleeT <= 0) {
        fire(m, null, playerAimPoint(m.suit.weapons[m.wi]));
        if (m.fireT >= 1 / m.suit.weapons[m.wi].rof - 0.001) camShake = Math.min(1.2, camShake + 0.08);
      }
    }
  }

  // ---------- artillery ballistics (Zaku Tank mode 2) ----------
  const ART_ANGLE = 0.87;   // ~50° fixed lob elevation — the cannon rides at this angle up over the back
  const ART_G = 260;        // arc shells fall under heavier gravity so the lob stays tight, fast and readable
  // Velocity that throws a shell from `muzzle` to `target` at the FIXED lob angle (an artillery piece adjusts
  // charge, not elevation, in this model). Returns null when the target is out of range. Gravity = ART_G.
  function ballisticVel(muzzle, target){
    const dx = target.x - muzzle.x, dz = target.z - muzzle.z;
    const d = Math.hypot(dx, dz);
    if (d < 1) return null;
    const h = target.y - muzzle.y;
    const c = Math.cos(ART_ANGLE), s = Math.sin(ART_ANGLE), tanA = s / c;
    const denom = 2 * c * c * (d * tanA - h);
    if (denom <= 0.001) return null;                 // target sits above this angle's reachable height
    const v2 = ART_G * d * d / denom;
    if (!(v2 > 0)) return null;
    const v = Math.sqrt(v2);
    if (v > 1500) return null;                       // beyond max range
    const vh = v * c, inv = 1 / d;
    return new THREE.Vector3(dx * inv * vh, v * s, dz * inv * vh);
  }
  // Where an artillery shell should land: the point under the crosshair — an enemy/prop if the ray strikes one,
  // else the ground intersection, else a default range ahead on the ground (when the crosshair is on open sky).
  function artilleryTarget(){
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const dir = new THREE.Vector3(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp);
    const origin = camera.position;
    // Pure manual aim (NO lock-on / NO centre-of-mass snap): the shell lands where the crosshair ray FIRST
    // meets a surface — the actual ray-hit point on an enemy/prop hull, or the ground. You aim; it lands there.
    let best = Infinity;
    for (const m of mechs){
      if (!m.alive || m.isPlayer) continue;
      const c = tmpV.copy(m.root.position); c.y += aimHeight(m);
      const oc = tmpV2.subVectors(c, origin), tca = oc.dot(dir);
      if (tca < 10) continue;
      const r = 8 * m.suit.scale, d2 = oc.lengthSq() - tca * tca;
      if (d2 < r * r){ const hitT = tca - Math.sqrt(r * r - d2); if (hitT < best) best = hitT; } // ray ENTRY point, not centre
    }
    for (const pr of props){
      if (!pr.alive) continue;
      const c = tmpV.copy(pr.root.position); c.y += pr.hitY;
      const oc = tmpV2.subVectors(c, origin), tca = oc.dot(dir);
      if (tca < 10) continue;
      const d2 = oc.lengthSq() - tca * tca;
      if (d2 < pr.radius * pr.radius){ const hitT = tca - Math.sqrt(pr.radius * pr.radius - d2); if (hitT < best) best = hitT; }
    }
    if (hfn){ // the crosshair meets the ground: march the ray, only as far as the nearest hull hit (if any)
      const lim = best === Infinity ? 4000 : best;
      for (let t = 30; t < lim; t += 18){
        const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
        if (y < groundY(x, z)){ best = t; break; }
      }
    }
    if (best === Infinity){ // aiming at open sky with no terrain underneath: drop it on the ground ahead
      const gd = 900, fx = origin.x + Math.sin(camYaw) * gd, fz = origin.z + Math.cos(camYaw) * gd;
      return new THREE.Vector3(fx, hfn ? groundY(fx, fz) : 0, fz);
    }
    return origin.clone().addScaledVector(dir, best);
  }
  function lobShell(m, w, impact){
    syncMuzzlePose(m, null, impact);
    const muzzleNode = activeMuzzleNode(m, true);
    const muzzle = muzzleNode ? muzzleNode.getWorldPosition(new THREE.Vector3())
      : approximateMuzzle(m, w);
    m.lastMuzzleWorld = muzzle.clone();
    let vel = ballisticVel(muzzle, impact);
    if (!vel){ // out of range → fling at the cap toward the target so it still lands (short) rather than nothing
      vel = new THREE.Vector3(impact.x - muzzle.x, 0, impact.z - muzzle.z).normalize().multiplyScalar(1500 * Math.cos(ART_ANGLE));
      vel.y = 1500 * Math.sin(ART_ANGLE);
    }
    const spd = vel.length();
    vel.x += (rng.next() - 0.5) * 2 * w.spread * spd;
    vel.z += (rng.next() - 0.5) * 2 * w.spread * spd;
    const mesh = makeShell(1.6, false);
    mesh.position.copy(muzzle);
    mesh.quaternion.setFromUnitVectors(UP, vel.clone().normalize());
    scene.add(mesh);
    const projectile = { pos: muzzle.clone(), vel, dmg: w.dmg, splash: w.splash || 0, team: m.team, owner: m, weaponName: w.name, life: w.life || 9, mesh, arc: true };
    projectiles.push(projectile);
    sendPvpShot(m, projectile, 'artillery');
    if (m.isPlayer){ camShake = Math.min(2.4, camShake + 0.55); vgKick = Math.min(0.3, vgKick + 0.28); }
    m.cannonRecoil = w.recoil || 1.3;
    sfx('bazooka', m.isPlayer ? 0.3 : clamp(300 / muzzle.distanceTo(player.root.position), 0.03, 0.16));
  }

  // The exact world point under the crosshair: cast the camera's center ray
  // against enemy hit-spheres and the terrain; fall back to a far point.
  function crosshairPoint(){
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const dir = new THREE.Vector3(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp);
    const origin = camera.position;
    let best = 2000;
    for (const m of mechs){
      if (!m.alive || m.isPlayer) continue;
      const c = tmpV.copy(m.root.position); c.y += aimHeight(m);
      const oc = tmpV2.subVectors(c, origin);
      const tca = oc.dot(dir);
      if (tca < 10 || tca > best) continue;
      const d2 = oc.lengthSq() - tca * tca;
      const r = 7.5 * m.suit.scale;
      if (d2 < r * r) best = tca;
    }
    for (const pr of props){
      if (!pr.alive) continue;
      const c = tmpV.copy(pr.root.position); c.y += pr.hitY;
      const oc = tmpV2.subVectors(c, origin);
      const tca = oc.dot(dir);
      if (tca < 10 || tca > best) continue;
      if (oc.lengthSq() - tca * tca < pr.radius * pr.radius) best = tca;
    }
    if (hfn){ // terrain intersection by coarse march
      for (let t = 30; t < best; t += 25){
        const x = origin.x + dir.x * t, y = origin.y + dir.y * t, z = origin.z + dir.z * t;
        if (y < groundY(x, z)){ best = Math.min(best, t); break; }
      }
    }
    return origin.clone().addScaledVector(dir, best);
  }

  // ---------- lock-on missile (Saberfish 5000) ----------
  const LOCK_RANGE = 2200, LOCK_CONE = Math.cos(0.42), LOCK_KEEP = Math.cos(0.62); // narrow (~24°) to acquire, wider (~36°) to hold — hysteresis stops target flicker
  function lockConeDot(m, e, fwd){
    if (!e || !e.alive || e === m || e.team === m.team) return -2;
    const to = tmpV2.copy(e.root.position).sub(m.root.position);
    const d = to.length();
    if (d > LOCK_RANGE || d < 1) return -2;
    return to.multiplyScalar(1 / d).dot(fwd);
  }
  function updateLockOn(m, dt){
    const w = m.suit.weapons[m.wi];
    if (m.lockCd > 0) m.lockCd -= dt;
    if (m.lockedFlash > 0) m.lockedFlash -= dt;
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const fwd = tmpV.set(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp);
    // keep the current target while it stays in the cone, else acquire the most-centred enemy
    let tgt = m.lockTarget;
    if (lockConeDot(m, tgt, fwd) < LOCK_KEEP){      // drop only once it drifts past the wider hold cone
      tgt = null; let bestDot = LOCK_CONE;          // acquire only inside the narrower cone
      for (const e of mechs){ const d = lockConeDot(m, e, fwd); if (d > bestDot){ bestDot = d; tgt = e; } }
      if (tgt !== m.lockTarget) m.lockT = 0; // new target → restart the lock
    }
    m.lockTarget = tgt;
    if (tgt && m.clip > 0 && m.reloadT <= 0 && m.lockCd <= 0){ // automatic: locks whenever a target sits in the cone
      m.lockT = Math.min(w.lockTime, (m.lockT || 0) + dt);
      if (m.lockT >= w.lockTime){ // full lock → loose the missile
        launchMissile(m, tgt);
        m.clip--; m.fireT = 1 / w.rof;
        if (m.clip <= 0) m.reloadT = w.reload;
        m.lockT = 0; m.lockCd = 0.6; m.lockedFlash = 0.6;
        camShake = Math.min(0.8, camShake + 0.12);
        sfx('ui', 0.18);
      }
    } else {
      m.lockT = Math.max(0, (m.lockT || 0) - dt * 2); // decays when you release fire or lose the target
    }
  }
  // draws the converging reticle over the locked target (player flying the lock-on missile)
  // backing store scaled to devicePixelRatio (crisp on Retina); context drawn in CSS pixels
  function sizeLockon(){
    if (!loCanvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    loCanvas.width = innerWidth * dpr; loCanvas.height = innerHeight * dpr;
    loCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- hit-prediction HUD (P) ----------
  // VISUAL GUIDE ONLY — never auto-aims. Draws a lead pipper at where a shot must go to hit the
  // moving target; the player must put the crosshair there. Aircraft "lock" after 0.5s on a target
  // (firms up the line); MS get the live prediction but never lock.
  let predTarget = null, predLockT = 0, predLocked = null;
  function predPickTarget(){
    if (player.lockTarget && player.lockTarget.alive) return player.lockTarget; // follow the missile lock if any
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const fx = Math.sin(camYaw) * cp, fy = sp, fz = Math.cos(camYaw) * cp;
    let best = null, bestDot = 0.55;
    for (const e of mechs){
      if (!e.alive || e.isPlayer || e.team === player.team) continue;
      const dx = e.root.position.x - player.root.position.x, dy = e.root.position.y - player.root.position.y, dz = e.root.position.z - player.root.position.z;
      const d = Math.hypot(dx, dy, dz); if (d > 4000 || d < 1) continue;
      const dot = (dx * fx + dy * fy + dz * fz) / d;
      if (dot > bestDot){ bestDot = dot; best = e; }
    }
    return best;
  }
  // where to aim so a `spd` projectile intercepts the moving target (iterative lead solve)
  function leadPoint(target, spd){
    const predMuzzle = activeMuzzleNode(player);
    const S = predMuzzle ? predMuzzle.getWorldPosition(new THREE.Vector3()) : player.root.position.clone();
    const Tx = target.root.position.x, Ty = target.root.position.y + aimHeight(target), Tz = target.root.position.z;
    const Vt = target.vel || { x: 0, y: 0, z: 0 };
    let t = Math.hypot(Tx - S.x, Ty - S.y, Tz - S.z) / spd;
    for (let k = 0; k < 4; k++) t = Math.hypot(Tx + Vt.x * t - S.x, Ty + Vt.y * t - S.y, Tz + Vt.z * t - S.z) / spd;
    return new THREE.Vector3(Tx + Vt.x * t, Ty + Vt.y * t, Tz + Vt.z * t);
  }
  function updatePrediction(dt){
    if (!player.alive){ predTarget = null; predLockT = 0; predLocked = null; return; } // prediction is always on
    const t = predPickTarget();
    if (!t){ predTarget = null; predLockT = 0; predLocked = null; return; }
    if (t === predTarget) predLockT += dt; else { predTarget = t; predLockT = 0; }
    // only aircraft LOCK (after 0.5s); MS get the live prediction but never lock
    predLocked = (player.air && predLockT >= 0.5) ? t : null;
  }
  // P aim-assist: once the prediction has LOCKED a target, snap the player's shots to its lead so they hit
  function playerAimPoint(w){
    if (w && w.arc) return artilleryTarget();   // artillery lobs to the designated ground/target impact point
    if (assistOn && predLocked && predLocked.alive && w && w.type !== 'lockmissile') return leadPoint(predLocked, w.speed || 1200);
    return crosshairPoint();
  }

  // single overlay pass: clears once, then draws the hit-prediction aid (P) and the missile reticle
  function drawHudOverlay(){
    if (!loCtx) return;
    loCtx.clearRect(0, 0, innerWidth, innerHeight);
    if (!player.alive) return;
    const aw = player.suit.weapons[player.wi];
    if (aw && aw.arc && !player.air) drawArtillery(); // artillery mode owns the aiming overlay (trajectory + impact)
    else if (assistOn) drawPredict();                 // whole aim system (prediction overlay) toggles with P
    drawReticle();
    drawCritFlash();
  }
  // ARTILLERY overlay: the ballistic trajectory line from the muzzle + a pulsing impact ring where it lands.
  function drawArtillery(){
    const muzzleNode = activeMuzzleNode(player);
    const muzzle = muzzleNode ? muzzleNode.getWorldPosition(new THREE.Vector3())
      : player.root.position.clone().add(new THREE.Vector3(0, 16 * (player.suit.scale || 1), 0));
    const target = artilleryTarget();
    const vel = ballisticVel(muzzle, target);
    const col = vel ? '#ff7a2a' : '#ff3b3b';
    loCtx.save();
    if (vel){ // sampled parabola, projected to screen
      loCtx.strokeStyle = 'rgba(255,150,60,.8)'; loCtx.lineWidth = 1.9; loCtx.setLineDash([7, 6]);
      loCtx.beginPath(); let on = false;
      const total = 2 * vel.y / ART_G + 0.6;
      for (let t = 0; t <= total; t += total / 44){
        const x = muzzle.x + vel.x * t, y = muzzle.y + vel.y * t - 0.5 * ART_G * t * t, z = muzzle.z + vel.z * t;
        if (hfn && t > 0.2 && y < groundY(x, z)) break;
        const sp = new THREE.Vector3(x, y, z).project(camera);
        if (sp.z > 1){ on = false; continue; }
        const px = (sp.x * 0.5 + 0.5) * innerWidth, py = (-sp.y * 0.5 + 0.5) * innerHeight;
        if (!on){ loCtx.moveTo(px, py); on = true; } else loCtx.lineTo(px, py);
      }
      loCtx.stroke(); loCtx.setLineDash([]);
    }
    const ip = new THREE.Vector3().copy(target).project(camera);
    if (ip.z <= 1){
      const ix = (ip.x * 0.5 + 0.5) * innerWidth, iy = (-ip.y * 0.5 + 0.5) * innerHeight;
      loCtx.strokeStyle = col; loCtx.fillStyle = col; loCtx.lineWidth = 2.2;
      loCtx.beginPath(); loCtx.arc(ix, iy, 15, 0, 7); loCtx.stroke();
      loCtx.globalAlpha = 0.4; loCtx.beginPath(); loCtx.arc(ix, iy, 26, 0, 7); loCtx.stroke(); loCtx.globalAlpha = 1;
      loCtx.beginPath();
      loCtx.moveTo(ix - 22, iy); loCtx.lineTo(ix + 22, iy);
      loCtx.moveTo(ix, iy - 22); loCtx.lineTo(ix, iy + 22); loCtx.stroke();
      const rng2 = Math.round(Math.hypot(target.x - player.root.position.x, target.z - player.root.position.z));
      loCtx.font = 'bold 12px monospace'; loCtx.textAlign = 'left';
      loCtx.fillText(vel ? `ARTILLERY · IMPACT ${rng2}m` : `OUT OF RANGE ${rng2}m`, ix + 30, iy + 4);
    }
    loCtx.restore();
  }
  function drawCritFlash(){
    if (!critFlash || critFlash.t <= 0) return;
    const wp = tmpV.copy(critFlash.pos).project(camera);
    if (wp.z > 1) return; // behind the camera
    const x = (wp.x * 0.5 + 0.5) * innerWidth, y = (-wp.y * 0.5 + 0.5) * innerHeight;
    const k = critFlash.t / 0.55, a = Math.min(1, k * 1.4);
    loCtx.save();
    loCtx.globalAlpha = a; loCtx.strokeStyle = '#ffe14a'; loCtx.fillStyle = '#ffe14a';
    loCtx.lineWidth = 2.5;
    const rr = 14 + (1 - k) * 26;                                   // ring expands as it fades
    loCtx.beginPath(); loCtx.arc(x, y, rr, 0, 7); loCtx.stroke();
    loCtx.font = 'bold 17px monospace'; loCtx.textAlign = 'center';
    loCtx.fillText('CRITICAL', x, y - rr - 6);
    loCtx.restore();
  }
  function drawReticle(){
    const w = player.suit.weapons[player.wi];
    if (!w || w.type !== 'lockmissile') return;
    const tgt = player.lockTarget;
    if (!tgt || !tgt.alive) return;
    const wp = tmpV.copy(tgt.root.position); wp.y += aimHeight(tgt);
    wp.project(camera);
    if (wp.z > 1) return; // behind the camera
    const x = (wp.x * 0.5 + 0.5) * innerWidth;
    const y = (-wp.y * 0.5 + 0.5) * innerHeight;
    const prog = clamp((player.lockT || 0) / w.lockTime, 0, 1);
    const locked = prog >= 1 || (player.lockedFlash || 0) > 0;
    const col = locked ? '#ff3b3b' : '#ffce3b';
    const s = 80 - 46 * prog;       // corner brackets converge as the lock builds
    const L = 16;
    loCtx.save();
    loCtx.lineWidth = 2.5; loCtx.strokeStyle = col;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]){
      loCtx.beginPath();
      loCtx.moveTo(x + sx * s, y + sy * s - sy * L);
      loCtx.lineTo(x + sx * s, y + sy * s);
      loCtx.lineTo(x + sx * s - sx * L, y + sy * s);
      loCtx.stroke();
    }
    loCtx.globalAlpha = 0.45 + 0.55 * prog;
    loCtx.beginPath(); loCtx.arc(x, y, s * 0.6, 0, 7); loCtx.stroke();
    loCtx.globalAlpha = 1;
    if (locked){ loCtx.beginPath(); loCtx.moveTo(x - 11, y); loCtx.lineTo(x + 11, y); loCtx.moveTo(x, y - 11); loCtx.lineTo(x, y + 11); loCtx.stroke(); }
    loCtx.fillStyle = col; loCtx.font = 'bold 14px monospace'; loCtx.textAlign = 'center';
    loCtx.fillText(locked ? 'LOCK ON — FOX' : `LOCKING ${Math.round(prog * 100)}%`, x, y - s - 12);
    loCtx.restore();
  }
  // P toggle: designates the target ahead and (for aircraft, once locked; for MS, live) draws the
  // lead pipper + line at where a shot must go to hit. Purely a guide — the player aims there manually.
  function drawPredict(){
    const tgt = predTarget;                          // chosen + lock-timed by updatePrediction()
    if (!tgt || !tgt.alive) return;
    const w = player.suit.weapons[player.wi];
    const spd = (w && w.speed) || 1200;
    const Tx = tgt.root.position.x, Ty = tgt.root.position.y + aimHeight(tgt), Tz = tgt.root.position.z;
    const tp = tmpV.set(Tx, Ty, Tz).project(camera);
    if (tp.z > 1) return; // target behind the camera
    const tx = (tp.x * 0.5 + 0.5) * innerWidth, ty = (-tp.y * 0.5 + 0.5) * innerHeight;
    const isAir = player.air;
    const locked = !!predLocked;                     // aircraft only, after 0.5s
    const showLead = isAir ? locked : true;          // air: prediction line appears on lock · MS: always live
    const prog = clamp(predLockT / 0.5, 0, 1);
    const col = locked ? (assistOn ? '#ff5530' : '#ffd23b') : '#39ff88'; // red = auto-aim engaged, amber = locked, green = predict
    loCtx.save();
    loCtx.strokeStyle = col; loCtx.fillStyle = col; loCtx.lineWidth = locked ? 2.3 : 1.6;
    if (locked) loCtx.setLineDash([]); else loCtx.setLineDash([5, 4]);  // designator: dashed → solid on lock
    loCtx.beginPath(); loCtx.arc(tx, ty, 18, 0, 7); loCtx.stroke();
    if (isAir && !locked){ // aircraft acquisition arc — fills as the 0.5s lock builds
      loCtx.setLineDash([]); loCtx.lineWidth = 2.6;
      loCtx.beginPath(); loCtx.arc(tx, ty, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); loCtx.stroke();
      loCtx.lineWidth = 1.6;
    }
    loCtx.setLineDash([]);
    if (showLead){                                   // lead pipper + prediction line — aim here to hit
      const lp = tmpV2.copy(leadPoint(tgt, spd)).project(camera);
      if (lp.z <= 1){
        const lx = (lp.x * 0.5 + 0.5) * innerWidth, ly = (-lp.y * 0.5 + 0.5) * innerHeight;
        loCtx.beginPath(); loCtx.moveTo(tx, ty); loCtx.lineTo(lx, ly); loCtx.stroke();
        loCtx.beginPath(); loCtx.arc(lx, ly, 7, 0, 7); loCtx.stroke();
        loCtx.beginPath();
        loCtx.moveTo(lx - 12, ly); loCtx.lineTo(lx + 12, ly);
        loCtx.moveTo(lx, ly - 12); loCtx.lineTo(lx, ly + 12); loCtx.stroke();
        loCtx.font = 'bold 11px monospace'; loCtx.textAlign = 'left'; loCtx.fillText('AIM', lx + 11, ly - 9);
      }
    }
    const rng = Math.round(Math.hypot(Tx - player.root.position.x, Ty - player.root.position.y, Tz - player.root.position.z));
    loCtx.font = 'bold 12px monospace'; loCtx.textAlign = 'left';
    loCtx.fillText(locked ? `${assistOn ? 'AUTO-AIM' : 'LOCKED'} · ${rng}m` : `${rng}m`, tx + 23, ty + 4);
    loCtx.restore();
  }

  // carrier turrets: each emplacement traverses to the nearest enemy and fires flak on its own cooldown,
  // independent of the carrier's own flight/main-cannon fire. Visual aim is computed in body-local space.
  const TURRET_RANGE = 1500, TURRET_ROF = 0.45;
  function updateTurrets(m, dt){
    const parts = m.parts; if (!parts || !parts.turrets) return;
    m.root.updateMatrixWorld(true); // refresh from this frame's pose so worldToLocal aim + muzzle pos are current
    let best = null, bd = TURRET_RANGE * TURRET_RANGE;
    for (const e of mechs){ if (!e.alive || e.team === m.team) continue; const d2 = e.root.position.distanceToSquared(m.root.position); if (d2 < bd){ bd = d2; best = e; } }
    let local = null, tw = null;
    if (best){
      tw = new THREE.Vector3(best.root.position.x, best.root.position.y + aimHeight(best), best.root.position.z);
      local = parts.body.worldToLocal(tw.clone());
    }
    for (const t of parts.turrets){
      if (!best){ t.gun.rotation.x = lerp(t.gun.rotation.x, -0.12, 2 * dt); continue; } // idle: barrels rest slightly up
      const dx = local.x - t.yaw.position.x, dy = local.y - (t.yaw.position.y + t.gun.position.y), dz = local.z - t.yaw.position.z;
      t.yaw.rotation.y = Math.atan2(dx, dz);                 // traverse
      t.gun.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz)); // elevate
      t.cd = (t.cd == null ? rng.range(0, TURRET_ROF) : t.cd) - dt;
      if (t.cd <= 0){
        t.cd = TURRET_ROF;
        const mw = t.muzzle.getWorldPosition(new THREE.Vector3());
        const dir = tw.clone().addScaledVector(best.vel, mw.distanceTo(tw) / 1400).sub(mw).normalize(); // lead
        const mesh = new THREE.Mesh(mgGeo, mgMat);
        mesh.position.copy(mw); mesh.quaternion.setFromUnitVectors(FWD, dir);
        scene.add(mesh);
        projectiles.push({ pos: mw.clone(), vel: dir.multiplyScalar(1400), dmg: 34, splash: 0, team: m.team, owner: m, weaponName: 'AIRCRAFT TURRET', life: 2.2, mesh });
        sfx('mg', clamp(200 / mw.distanceTo(player.root.position), 0.015, 0.08));
      }
    }
  }

  // ---------- shared mech tick (anim, AI movement integration, death) ----------
  // carrier flight: cruise dead straight, turn PAINFULLY slowly (suit.turn), fire what it passes — no dogfighting
  function carrierFly(m, dt, t){
    const pos = m.root.position, ai = m.ai, turn = m.suit.turn || 0.22;
    // ease toward a heading — the enemy mass, else back over the battlefield centre — at the tiny turn rate
    const wantYaw = t ? Math.atan2(t.root.position.x - pos.x, t.root.position.z - pos.z)
                      : Math.atan2(-pos.x, -pos.z);
    let dyaw = wantYaw - m.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const turnStep = clamp(dyaw, -turn * dt, turn * dt);
    m.yaw += turnStep;
    m.pitch = lerp(m.pitch, 0, 2 * dt); // wings level
    const cp = Math.cos(m.pitch);
    const heading = tmpV.set(Math.sin(m.yaw) * cp, Math.sin(m.pitch), Math.cos(m.yaw) * cp);
    m.vel.lerp(tmpV3.copy(heading).multiplyScalar(m.suit.boost), clamp(1.5 * dt, 0, 1)); // steady straight cruise
    pos.addScaledVector(m.vel, dt);
    if (!SPACE){ // cruise HIGH to stay above ground AA fire
      const floorY = groundY(pos.x, pos.z) + 200;
      if (pos.y < floorY) pos.y = lerp(pos.y, floorY, clamp(1.5 * dt, 0, 1));
    }
    const rr = Math.hypot(pos.x, pos.z);
    if (rr > 5000) pos.multiplyScalar(5000 / rr);
    m.bank = lerp(m.bank, clamp(-turnStep / dt / turn, -1, 1) * 0.35, 1.5 * dt); // gentle list into the turn
    m.boosting = true;
    // defensive gunnery — shoot anything roughly ahead and in range; it never turns to chase
    if (t){
      const dT = pos.distanceTo(t.root.position);
      if (dT < 2400){
        const to = tmpV2.subVectors(t.root.position, pos).normalize();
        if (to.dot(heading) > 0.2){
          const wantWi = dT > 700 ? 0 : 1; // mega cannon at range, flak up close
          if (wantWi !== m.wi && m.suit.weapons[wantWi]){ m.wi = wantWi; resetMuzzleCycle(m, wantWi); m.clip = m.suit.weapons[wantWi].clip; m.reloadT = 0; m.parts?.rebuildGun?.(wantWi); }
          const w = m.suit.weapons[m.wi];
          const aim = tmpV2.copy(t.root.position).addScaledVector(t.vel, dT / w.speed);
          aim.y += aimHeight(t);
          const dir = aim.clone().sub(pos).normalize();
          const err = ai.err / ai.skill;
          dir.x += rng.range(-err, err); dir.y += rng.range(-err, err); dir.z += rng.range(-err, err);
          dir.normalize();
          fire(m, dir, pos.clone().addScaledVector(dir, Math.max(50, dT)));
        }
      }
    }
    // carpet-bombing: if the carrier mounts a bomb bay, dump a full pack when roughly over a target
    const bombW = m.suit.weapons.find(w => w.type === 'bomb');
    if (bombW){
      m.bombCd = (m.bombCd == null ? rng.range(3, 6) : m.bombCd) - dt;
      if (m.bombCd <= 0 && t && pos.distanceTo(t.root.position) < 1500){
        m.bombCd = rng.range(7, 11);
        dropBombs(m, bombW);
      }
    }
  }

  // ---------- aircraft AI: high-speed strafing runs — no hover, no melee ----------
  function aircraftUpdate(m, dt){
    const ai = m.ai, pos = m.root.position;
    ai.tThink -= dt;
    if (ai.tThink <= 0){
      ai.tThink = 0.7;
      // aircraft strafe/bomb ground targets too — include hostile props (landships, ships, bases)
      const foes = mechs.filter(o => o.alive && o.team !== m.team)
        .concat(props.filter(p => p.alive && p.team !== m.team && !p.scenery));
      ai.target = foes.length
        ? foes.reduce((a, b) => a.root.position.distanceToSquared(pos) < b.root.position.distanceToSquared(pos) ? a : b)
        : null;
    }
    const t = ai.target;
    if (m.suit.carrier){ carrierFly(m, dt, t); return; } // carriers cruise straight — never dogfight
    const maxSpeed = m.suit.boost, minSpeed = m.suit.boost * 0.34, turn = m.suit.turn || 1.6;

    // desired heading — PURE pursuit: point straight at the target and bleed speed to tighten
    // the turn so we keep the saddle (leading the heading just makes two planes sidestep & miss)
    const desired = tmpV3;
    let dTgt = 1e9;
    m.airNoFire = (m.airNoFire || 0) + dt; // time spent without a firing solution
    if (t){
      dTgt = pos.distanceTo(t.root.position);
      // stuck circling with no shot for too long → break off, build separation, then re-merge
      // head-on (a head-on pass lines BOTH planes up, so the fight actually resolves)
      if (m.airExtend > 0) m.airExtend -= dt;
      else if (dTgt < 700 && m.airNoFire > 1.8) m.airExtend = 1.1;
      const tp = tmpV2.copy(t.root.position);
      tp.y += aimHeight(t);
      desired.subVectors(tp, pos);
      if (m.airExtend > 0) desired.multiplyScalar(-1); // extend away to open the next merge
      if (!SPACE){ // never dive into the dirt — hold a strafing altitude
        const floorY = groundY(pos.x, pos.z) + 50;
        if (pos.y < floorY) desired.y += (floorY + 40 - pos.y) * 0.5;
      }
    } else desired.set(Math.sin(m.yaw), SPACE ? 0 : 0.02, Math.cos(m.yaw));
    desired.normalize();

    // limited-rate turn toward the heading
    const wantYaw = Math.atan2(desired.x, desired.z);
    let dyaw = wantYaw - m.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const turnStep = clamp(dyaw, -turn * dt, turn * dt);
    m.yaw += turnStep;
    m.pitch += clamp(Math.asin(clamp(desired.y, -1, 1)) - m.pitch, -turn * dt, turn * dt);

    // throttle: ease off when knife-fighting close so the turn circle tightens and we hold the
    // saddle; full burn to close the gap or re-engage after a pass
    const cp = Math.cos(m.pitch);
    const heading = tmpV.set(Math.sin(m.yaw) * cp, Math.sin(m.pitch), Math.cos(m.yaw) * cp);
    const aligned = clamp(1 - Math.abs(dyaw) / 1.0, 0, 1);
    const spd = (t && dTgt < 360) ? lerp(minSpeed, maxSpeed * 0.7, aligned) : lerp(minSpeed * 1.4, maxSpeed, aligned);
    m.vel.lerp(heading.clone().multiplyScalar(spd), clamp(3.5 * dt, 0, 1));
    pos.addScaledVector(m.vel, dt);

    if (!SPACE){
      const floorY = groundY(pos.x, pos.z) + 38;
      if (pos.y < floorY){ pos.y = floorY; if (m.vel.y < 0) m.vel.y = 0; }
    }
    const rr = Math.hypot(pos.x, pos.z);
    if (rr > 5200) pos.multiplyScalar(5200 / rr);

    m.bank = lerp(m.bank, clamp(-turnStep / dt / turn, -1, 1) * 0.9, 4 * dt);
    m.boosting = true;

    // gunnery: wider deflection cone so passing/curving shots land; missiles at range, vulcans close
    if (t && dTgt < 950){
      const to = tmpV2.subVectors(t.root.position, pos).normalize();
      if (to.dot(heading) > 0.7){
        m.airNoFire = 0; m.airExtend = 0; // we have a firing solution — stay on it
        const wantWi = (dTgt > 400 && m.suit.weapons[1]) ? 1 : 0;
        if (wantWi !== m.wi){ m.wi = wantWi; resetMuzzleCycle(m, wantWi); m.clip = m.suit.weapons[wantWi].clip; m.reloadT = 0; m.parts?.rebuildGun?.(wantWi); }
        const w = m.suit.weapons[m.wi];
        const aim = tmpV2.copy(t.root.position).addScaledVector(t.vel, dTgt / w.speed);
        aim.y += aimHeight(t);
        const dir = aim.clone().sub(pos).normalize();
        const err = ai.err / ai.skill;
        dir.x += rng.range(-err, err); dir.y += rng.range(-err, err); dir.z += rng.range(-err, err);
        dir.normalize();
        fire(m, dir, pos.clone().addScaledVector(dir, Math.max(50, dTgt)));
      }
    }
  }

  // Zaku Tank cannon rig: dock the mount (shoulder for direct fire ⇄ swung up over the back for artillery),
  // hold the lob elevation in artillery mode, and play the heavy recoil (barrel slides + muzzle climbs).
  // Runs BEFORE poseAim so userData.artillery is set when poseAim decides whether to elevate the mount.
  function poseCannon(m, dt){
    const mount = m.parts.turret, slide = m.parts.cannonSlide, dock = m.parts.turretDock;
    if (!mount || !dock) return;
    const w = m.suit.weapons[m.wi];
    const art = !!(w && w.arc);
    mount.userData.artillery = art;
    const k = Math.min(1, 6 * dt), d = art ? dock.art : dock.dir;
    mount.position.x = lerp(mount.position.x, d.x, k);
    mount.position.y = lerp(mount.position.y, d.y, k);
    mount.position.z = lerp(mount.position.z, d.z, k);
    if (art) mount.rotation.x = lerp(mount.rotation.x, -ART_ANGLE, k); // swung up over the back to the lob angle
    m.cannonRecoil = Math.max(0, (m.cannonRecoil || 0) - dt * 5);
    if (slide){ slide.position.z = -m.cannonRecoil * 2.2; slide.rotation.x = -m.cannonRecoil * 0.12; }
  }

  // Shared melee presentation runs after the ordinary aim pose. Keeping it in one helper is
  // important: SPACE and airborne mobile suits return before the ground walk block below.
  function updateMeleePose(m, dt){
    const parts = m.parts, arm = parts && parts.armR;
    if (!parts) return;
    if (arm && parts._meleeArm !== arm){
      parts._meleeArm = arm;
      parts._meleeRestArmZ = arm.position.z;
    }
    const wasSwinging = m.swingT > 0;
    if (wasSwinging){
      const duration = Math.max(0.001, m.swingDuration || 0.4);
      m.swingT = Math.max(0, m.swingT - dt);
      const k = clamp(1 - m.swingT / duration, 0, 1);
      const ease = k * k * (3 - 2 * k);
      const arc = Math.sin(k * Math.PI);
      // Fade melee-only lateral rotations back to the ordinary aiming axis during
      // the final recovery frames, so the first post-slash muzzle pose is exact.
      const recover = clamp((1 - k) / 0.15, 0, 1);
      const dir = m.swingDir || 1;
      const kind = m.swingKind || 'diagonal';
      m.swingProgress = k;

      if (m.isPlayer && !m.swingHitResolved){
        const attack = PLAYER_SLASHES[kind] || PLAYER_SLASHES.diagonal;
        if (k >= attack.contact){
          m.swingHitResolved = true;
          resolvePlayerSlash(m, attack);
        }
      }

      if (arm){
        const restZ = parts._meleeRestArmZ;
        if (kind === 'crosscut'){
          // Broad hip-height sweep: the arm travels laterally from one side of the torso to the other.
          arm.rotation.x = -1.42 + arc * 0.18;
          arm.rotation.y = dir * (1.18 - ease * 2.36) * recover;
          arm.rotation.z = dir * (0.52 - ease * 0.92) * recover;
          arm.position.z = restZ + arc * 0.35;
        } else if (kind === 'overhead'){
          // High guard into a vertical cleave; deliberately little lateral motion.
          arm.rotation.x = -3.02 + ease * 3.02;
          arm.rotation.y = dir * arc * 0.10;
          arm.rotation.z = dir * arc * 0.18;
          arm.position.z = restZ + arc * 0.25;
        } else if (kind === 'thrust'){
          // Point-first lunge: keep the blade on-axis and physically drive the arm forward.
          arm.rotation.x = -1.48 + Math.sin(k * Math.PI * 2) * 0.10;
          arm.rotation.y = dir * (1 - arc) * 0.16 * recover;
          arm.rotation.z = dir * arc * 0.10 * recover;
          arm.position.z = restZ + arc * 1.75;
        } else {
          // Fast shoulder-to-hip diagonal; alternating direction makes the neutral chain cross back.
          arm.rotation.x = -2.62 + ease * 2.22;
          arm.rotation.y = dir * arc * 0.16;
          arm.rotation.z = dir * arc * 0.82;
          arm.position.z = restZ + arc * 0.45;
        }
      }
    } else if (arm){
      const settle = Math.min(1, 14 * dt);
      arm.position.z = lerp(arm.position.z, parts._meleeRestArmZ, settle);
      arm.rotation.y = lerp(arm.rotation.y, 0, settle);
      arm.rotation.z = lerp(arm.rotation.z, 0, settle);
    }

    if (parts.gun){
      const selectedGunIsVisible = parts.weaponIsHeld == null || parts.weaponIsHeld;
      parts.gun.visible = selectedGunIsVisible && !wasSwinging
        && !(m.isPlayer && player.wi === SABER_SLOT) && !(m.networkRemote && m.networkSaberEquipped);
    }
    m.bladeT = Math.max(0, m.bladeT - dt);
    if (parts.blade) parts.blade.visible = wasSwinging || m.bladeT > 0
      || (m.isPlayer && player.wi === SABER_SLOT) || (m.networkRemote && m.networkSaberEquipped);
  }

  function mechUpdate(m, dt){
    if (!m.alive){
      if (m.deadT > 0){
        m.deadT -= dt;
        if (m.parts){ // only near (full-detail) wrecks play the sink animation
          m.root.rotation.z = lerp(m.root.rotation.z, 0.9, 2 * dt);
          m.root.position.y -= (SPACE ? 4 : 14) * dt;
        }
        if (m.deadT <= 0) releaseDetail(m);
      }
      return;
    }
    updatePendingMelee(m, dt);
    // GAW carrier: periodically drops a Zaku that descends slowly and can only shoot (no moving)
    if (!m.networkRemote && m.suit.carrier){
      m.dropCd = (m.dropCd == null ? 3 : m.dropCd) - dt;
      if (m.dropCd <= 0){
        m.dropCd = rng.range(5, 8);
        if ((m.dropped || 0) < 6){                           // a GAW carries 6 Zakus TOTAL over its life (no replenish)
          const ang = rng.range(0, 6.28), r = rng.range(0, 12);
          const z = spawnMech({ suitId: 'zaku2' }, m.team,
            new THREE.Vector3(m.root.position.x + Math.cos(ang) * r, 0, m.root.position.z + Math.sin(ang) * r), { core: true });
          z.root.position.y = m.root.position.y - 10;        // override spawnMech's ground-snap: start under the carrier
          z.dropping = true; z.dropSpeed = 26; // a touch faster — it now drops from a higher cruise
          z.dropFloor = SPACE ? z.root.position.y - 90 : 0;  // space: fall a fixed distance, then go active
          m.dropped = (m.dropped || 0) + 1;
        }
      }
    }
    if (m.networkRemote){
      pvpUpdateRemote(m, dt);
    } else if (!m.isPlayer){
      m.fireT -= dt;
      if (m.reloadT > 0){ m.reloadT -= dt; if (m.reloadT <= 0) m.clip = m.suit.weapons[m.wi].clip; }
      if (m.air){ aircraftUpdate(m, dt); }
      else if (m.dropping){ // carrier-dropped: descend slowly, fire at will, but no maneuvering
        aiUpdate(m, dt);
        m.vel.set(0, 0, 0); m.boosting = false;
        m.root.position.y -= m.dropSpeed * dt;
        const land = SPACE ? m.dropFloor : groundY(m.root.position.x, m.root.position.z);
        if (m.root.position.y <= land){ m.root.position.y = land; m.dropping = false; } // touched down → normal combat
      }
      else {
        aiUpdate(m, dt);
        m.root.position.addScaledVector(m.vel, dt);
        if (!SPACE){
          const g = groundY(m.root.position.x, m.root.position.z);
          const target = (m.suit.hover ? g + 3.5 + Math.sin(performance.now() * 0.002 + m.yaw) * 0.8 : g) + (m.hopY || 0);
          m.root.position.y = m.suit.vehicle ? g : lerp(m.root.position.y, target, Math.min(1, (m.hopY ? 13 : 6) * dt));
          if (m.suit.vehicle) m.vel.y = 0;
        }
      }
    }
    m.root.rotation.y = m.yaw;
    if (!m.parts) return; // far-LOD mech: no detailed model to pose/animate this frame
    if (m.parts.turretYaw){
      let turretWorldYaw = m.yaw;
      if (m.isPlayer) turretWorldYaw = camYaw;
      else if (m.networkRemote && Number.isFinite(m.netAimYaw)) turretWorldYaw = m.netAimYaw;
      else if (m.ai?.target?.alive){
        turretWorldYaw = Math.atan2(
          m.ai.target.root.position.x - m.root.position.x,
          m.ai.target.root.position.z - m.root.position.z,
        );
      }
      syncTurretYaw(m, turretWorldYaw, clamp((m.suit.turretTraverse || 8) * dt, 0, 1));
    }
    if (m.air){ // bank and pitch the airframe; engines stay lit
      if (m.parts.body){ m.parts.body.rotation.z = m.bank; m.parts.body.rotation.x = -m.pitch; }
      if (m.parts.turrets) updateTurrets(m, dt); // any aircraft with turrets (GAW + G-Fighter); after the body pose is set → aim current
      for (const fl of m.parts.flames) fl.scale.y = lerp(fl.scale.y, 1, 8 * dt);
      if (m.sensorDmg > 0) m.parts.eyeMat.emissiveIntensity = 2.4 * (1 - m.sensorDmg * 0.5);
      return;
    }
    if (m.parts.turretDock) poseCannon(m, dt); // Zaku Tank: dock/elevate/recoil the cannon before poseAim reads the mode
    else if (m.parts.cannonSlide){ // fixed artillery mounts (RTX-440-B): recoil without the Zaku Tank's docking rig
      m.cannonRecoil = Math.max(0, (m.cannonRecoil || 0) - dt * 5);
      m.parts.cannonSlide.position.z = -m.cannonRecoil * 1.45;
    }
    // MS-specific poses: airborne (boost/jump/melee-hop, or any MS in space) and carrier-dropping units
    // get a distinct stance instead of the ground walk cycle — return before the walk/braced code so it can't fight.
    {
      const gy = groundY(m.root.position.x, m.root.position.z);
      const airborne = SPACE || (!m.suit.hover && m.root.position.y > gy + 4);
      if (m.dropping || airborne){
        const k = Math.min(1, 9 * dt);
        if (m.dropping){
          // bracing for touchdown: knees bent and spread, free arm out, slight back lean
          if (m.parts.legL){
            m.parts.legL.rotation.x = lerp(m.parts.legL.rotation.x, -0.4, k);
            m.parts.legR.rotation.x = lerp(m.parts.legR.rotation.x, -0.4, k);
            m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, -0.22, k);
            m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, 0.22, k);
          }
          if (m.parts.armL) m.parts.armL.rotation.x = lerp(m.parts.armL.rotation.x, -0.75, k);
          m.root.rotation.x = lerp(m.root.rotation.x, -0.12, 4 * dt);
          m.root.rotation.z = lerp(m.root.rotation.z, 0, 4 * dt);
        } else {
          // boost/flight: legs straight, swept back and together, free arm tucked, leaning into the thrust
          if (m.parts.legL){
            m.parts.legL.rotation.x = lerp(m.parts.legL.rotation.x, 0.34, k);
            m.parts.legR.rotation.x = lerp(m.parts.legR.rotation.x, 0.34, k);
            m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, 0.04, k);
            m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, -0.04, k);
          }
          if (m.parts.armL) m.parts.armL.rotation.x = lerp(m.parts.armL.rotation.x, -0.32, k);
          m.root.rotation.x = lerp(m.root.rotation.x, 0.3, 4 * dt);
          m.root.rotation.z = lerp(m.root.rotation.z, 0, 4 * dt);
        }
        // the weapon arm still tracks the aim so the suit can keep firing while airborne / dropping
        if (m.isPlayer) poseAim(m.parts, camPitch, k);
        else if (m.networkRemote && Number.isFinite(m.netAimPitch)) poseAim(m.parts, m.netAimPitch, k);
        else if (m.ai && m.ai.target && m.ai.target.alive){
          const tp = m.ai.target.root.position;
          const dh = Math.max(1, Math.hypot(tp.x - m.root.position.x, tp.z - m.root.position.z));
          poseAim(m.parts, Math.atan2((tp.y + aimHeight(m.ai.target)) - (m.root.position.y + weaponHeight(m)), dh), k);
        } else poseAim(m.parts, -0.4, k);
        updateMeleePose(m, dt);
        updateHoverLegJets(m, dt); // pose first so each plume starts at the current animated sole
        for (const fl of m.parts.flames) fl.scale.y = lerp(fl.scale.y, 1, 8 * dt); // thrusters lit
        if (m.sensorDmg > 0 && m.parts.eyeMat) m.parts.eyeMat.emissiveIntensity = 2.4 * (1 - m.sensorDmg * 0.5);
        return;
      }
    }
    // walk anim — the leg cadence is capped so the stride never spins into a flail at boost speed,
    // and the head stays still (no bob): a steady, natural gait
    const hSpeed = Math.hypot(m.vel.x, m.vel.z);
    m.walkPhase += Math.min(hSpeed, 18) * dt * 0.34;   // cap the step frequency ~1 cycle/s even when gliding fast
    if (m.parts.wheels?.length){
      const forwardSpeed = m.vel.x * Math.sin(m.yaw) + m.vel.z * Math.cos(m.yaw);
      const roll = forwardSpeed * dt / (m.parts.wheelRadius || 0.75);
      for (const wheel of m.parts.wheels) wheel.rotation.x += roll;
    }
    const specialGroundPose = !SPACE && ((m.groundHoverBlend || 0) > 0.04 || (m.sandKickT || 0) > 0);
    if (!specialGroundPose){
      const wAmp = SPACE || m.suit.hover ? 0.12 : clamp(hSpeed / 13, 0, 1);
      poseWalk(m.parts, m.walkPhase, wAmp);
    }
    // braced combat stance when planted: stagger the legs and sink the hips a touch
    if (!SPACE && !specialGroundPose && hSpeed < 4 && m.parts.legL && m.parts.legR){
      const kk = Math.min(1, 5 * dt);
      m.parts.legL.rotation.x = lerp(m.parts.legL.rotation.x, -0.3, kk);   // lead leg forward
      m.parts.legR.rotation.x = lerp(m.parts.legR.rotation.x, 0.24, kk);   // trailing leg back
      m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, -0.1, kk);
      m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, 0.1, kk); // feet planted wide
    } else if (!specialGroundPose && m.parts.legL){
      m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, 0, Math.min(1, 8 * dt));
      m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, 0, Math.min(1, 8 * dt));
    }
    if (specialGroundPose && m.parts.legL && m.parts.legR){
      const k = Math.min(1, 12 * dt), hover = clamp(m.groundHoverBlend || 0, 0, 1);
      // E hover now shares the airborne flight silhouette: straight legs swept back and held
      // close together. The accelerated sole/calf particles are what distinguish ground effect.
      m.parts.legL.rotation.x = lerp(m.parts.legL.rotation.x, 0.34, k * hover);
      m.parts.legR.rotation.x = lerp(m.parts.legR.rotation.x, 0.34, k * hover);
      m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, 0.04, k * hover);
      m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, -0.04, k * hover);
      if (m.parts.armL && !m.blocking)
        m.parts.armL.rotation.x = lerp(m.parts.armL.rotation.x, -0.32, k * hover);
      if (m.sandKickT > 0){
        const p = clamp(1 - m.sandKickT / Math.max(0.001, m.sandKickDuration || 0.42), 0, 1);
        const sweep = Math.sin(p * Math.PI), side = m.sandKickSide || 1;
        // Q sand-kick: one leg plants while the opposite foot scrapes back through the dust trail.
        m.parts.legL.rotation.x = lerp(m.parts.legL.rotation.x, side > 0 ? -0.62 : 0.55, k * sweep);
        m.parts.legR.rotation.x = lerp(m.parts.legR.rotation.x, side > 0 ? 0.55 : -0.62, k * sweep);
        m.parts.legL.rotation.z = lerp(m.parts.legL.rotation.z || 0, -0.2 * side, k * sweep);
        m.parts.legR.rotation.z = lerp(m.parts.legR.rotation.z || 0, 0.2 * side, k * sweep);
      }
    }
    // combat stance: weapon arm raised, tracking the aim line
    if (m.isPlayer) poseAim(m.parts, camPitch, Math.min(1, 12 * dt));
    else if (m.networkRemote && Number.isFinite(m.netAimPitch))
      poseAim(m.parts, m.netAimPitch, Math.min(1, 12 * dt));
    else if (m.ai && m.ai.target && m.ai.target.alive){
      const tp = m.ai.target.root.position;
      const dh = Math.max(1, Math.hypot(tp.x - m.root.position.x, tp.z - m.root.position.z));
      poseAim(m.parts, Math.atan2((tp.y + aimHeight(m.ai.target)) - (m.root.position.y + weaponHeight(m)), dh), Math.min(1, 8 * dt));
    } else poseAim(m.parts, -0.85, Math.min(1, 3 * dt)); // at ease
    // shield guard: raise the left arm and bring the shield across the front
    m.blockPose = lerp(m.blockPose || 0, m.blocking ? 1 : 0, Math.min(1, 10 * dt));
    const guardArm = m.parts.guardArm || m.parts.armL;
    if (guardArm && m.blockPose > 0.01){
      guardArm.rotation.x = lerp(guardArm.rotation.x, -1.5, m.blockPose);
      guardArm.rotation.z = lerp(guardArm.rotation.z, 0.5, m.blockPose);
    }
    // shield durability self-restores a few seconds after the last hit (no repair needed)
    if (m.shieldMax > 0){
      m.shieldHitT += dt;
      if (m.shieldHitT > 2.5 && m.shieldHp < m.shieldMax){
        m.shieldHp = Math.min(m.shieldMax, m.shieldHp + m.shieldMax * 0.18 * dt);
        if (m.shieldBroken && m.shieldHp > m.shieldMax * 0.35) m.shieldBroken = false;
      }
      if (m.parts.shield)
        m.parts.shield.visible = m.parts.shieldKind === 'block' ? (m.blockPose > 0.05 && !m.shieldBroken) : !m.shieldBroken;
    }
    // lean into motion: pitch with forward speed, bank with lateral speed
    const fSpd = m.vel.x * Math.sin(m.yaw) + m.vel.z * Math.cos(m.yaw);
    const lSpd = -m.vel.x * Math.cos(m.yaw) + m.vel.z * Math.sin(m.yaw);
    if (m.sandKickT > 0){
      const p = clamp(1 - m.sandKickT / Math.max(0.001, m.sandKickDuration || 0.42), 0, 1);
      const sweep = Math.sin(p * Math.PI);
      m.root.rotation.x = lerp(m.root.rotation.x, 0.3 * sweep, 8 * dt);
      m.root.rotation.z = lerp(m.root.rotation.z, -0.19 * (m.sandKickSide || 1) * sweep, 8 * dt);
    } else {
      const hover = clamp(m.groundHoverBlend || 0, 0, 1);
      const travelLean = clamp(fSpd / m.suit.boost, -1, 1) * 0.2;
      m.root.rotation.x = lerp(m.root.rotation.x, lerp(travelLean, 0.3, hover), 4 * dt);
      m.root.rotation.z = lerp(m.root.rotation.z, clamp(-lSpd / m.suit.boost, -1, 1) * 0.16, 4 * dt);
    }
    updateHoverLegJets(m, dt); // after the flight-style hover pose and root lean are final
    // thruster flames: light on boost or vernier input
    const flame = m.boosting || m.thrusting || (SPACE && !m.isPlayer && m.vel.lengthSq() > 900) ? 1 : 0.01;
    for (const fl of m.parts.flames) fl.scale.y = lerp(fl.scale.y, flame, 8 * dt);
    updateMeleePose(m, dt);
    // mono-eye scans the field / tracks the target — the lens slides side-to-side along its slit (Zeon heads)
    if (m.parts.monoeye){
      let ex;
      if (m.networkRemote && Number.isFinite(m.netAimYaw)){
        ex = clamp(wrapAngle(m.netAimYaw - m.yaw) * 0.9, -0.42, 0.42);
      } else if (m.ai && m.ai.target && m.ai.target.alive){
        let a = Math.atan2(m.ai.target.root.position.x - m.root.position.x, m.ai.target.root.position.z - m.root.position.z) - m.yaw;
        while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
        ex = clamp(Math.sin(a) * 0.5, -0.42, 0.42);
      } else if (m.isPlayer){
        let a = camYaw - m.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
        ex = clamp(a * 0.9, -0.42, 0.42);
      } else ex = Math.sin(performance.now() * 0.0009 + m.walkPhase * 0.4) * 0.34; // idle scan
      m.parts.monoeye.position.x = lerp(m.parts.monoeye.position.x, ex, 0.12);
    }
    // sensor flicker
    if (m.sensorDmg > 0) m.parts.eyeMat.emissiveIntensity = 2.4 * (1 - m.sensorDmg * (0.5 + 0.5 * Math.sin(performance.now() * 0.02)));
  }

  // ---------- projectiles tick ----------
  function projectilesUpdate(dt){
    for (let i = projectiles.length - 1; i >= 0; i--){
      const p = projectiles[i];
      p.life -= dt;
      if (p.homing){
        if (!p.homing.alive) p.homing = null;            // target gone → fly straight on
        else {
          const desired = tmpV2.copy(p.homing.root.position);
          desired.y += aimHeight(p.homing);
          desired.sub(p.pos).normalize();
          const cur = tmpV3.copy(p.vel); const spd = cur.length() || 1; cur.multiplyScalar(1 / spd);
          const ang = Math.acos(clamp(cur.dot(desired), -1, 1));
          if (ang > 1e-3){ cur.lerp(desired, Math.min(1, (p.turn * dt) / ang)).normalize(); }
          p.vel.copy(cur).multiplyScalar(spd);
        }
      }
      const stepLen = p.vel.length() * dt;
      const dirN = tmpV.copy(p.vel).normalize();
      let hit = false;
      for (const m of mechs){
        if (!m.alive || m === p.owner || m.team === p.team) continue;
        let c = null;
        if (m.hitSpheres){ // big airframes (GAW): test the spread of spheres covering wings/length
          const n = fillWorldSpheres(m, m.yaw);
          for (let i = 0; i < n; i++) if (segHit(p.pos, dirN, stepLen, HS_SCRATCH[i], hitSphereRadius(m, m.hitSpheres[i]))){ c = HS_SCRATCH[i]; break; }
        } else {
          const cc = tmpV2.copy(m.root.position); cc.y += aimHeight(m); // centre the hitbox on the COM the aim targets
          if (segHit(p.pos, dirN, stepLen, cc, m.air ? (6 + 6 * m.suit.scale) : 7.5 * m.suit.scale)) c = cc; // fighters are wide
        }
        if (c){
          const hp = p.pos.clone().addScaledVector(dirN, Math.min(stepLen, p.pos.distanceTo(c)));
          if (p.splash){
            explosion(hp, p.splash, clamp(380 / hp.distanceTo(player.root.position), 0.05, 0.3));
            if (!p.networkGhost) splashDamage(hp, p.splash, p.dmg, p.owner, p.weaponName);
          } else if (!p.networkGhost) damage(m, p.dmg, hp, p.owner, false, p.weaponName);
          hit = true; break;
        }
      }
      if (!hit) for (const pr of props){
        if (!pr.alive || pr.team === p.team) continue;
        let c = null;
        if (pr.hitSpheres){ // landships: spheres strung along the hull instead of one fat ball
          const n = fillWorldSpheres(pr, pr.root.rotation.y);
          for (let i = 0; i < n; i++) if (segHit(p.pos, dirN, stepLen, HS_SCRATCH[i], pr.hitSpheres[i].r)){ c = HS_SCRATCH[i]; break; }
        } else {
          const cc = tmpV2.copy(pr.root.position); cc.y += pr.hitY;
          if (segHit(p.pos, dirN, stepLen, cc, pr.radius)) c = cc;
        }
        if (c){
          const hp = p.pos.clone().addScaledVector(dirN, Math.min(stepLen, p.pos.distanceTo(c)));
          if (p.splash){
            explosion(hp, p.splash, clamp(380 / hp.distanceTo(player.root.position), 0.05, 0.3));
            if (!p.networkGhost) splashDamage(hp, p.splash, p.dmg, p.owner, p.weaponName);
          } else if (!p.networkGhost) damageProp(pr, p.dmg, hp, p.owner, p.weaponName);
          hit = true; break;
        }
      }
      if (!SPACE && p.splash) p.vel.y -= (p.arc ? ART_G : p.bomb ? 30 : 9) * dt; // artillery lobs hard; bombs drop; shells barely arc
      // terrain is solid: march the travel segment so fast rounds can't tunnel through ridges
      if (!hit && hfn){
        const steps = Math.max(1, Math.ceil(stepLen / 8));
        for (let s = 1; s <= steps; s++){
          tmpV2.copy(p.pos).addScaledVector(p.vel, dt * s / steps);
          if (tmpV2.y < groundY(tmpV2.x, tmpV2.z)){
            p.pos.copy(tmpV2);
            if (p.splash){
              explosion(p.pos, p.splash, clamp(380 / p.pos.distanceTo(player.root.position), 0.04, 0.25));
              if (!p.networkGhost) splashDamage(p.pos, p.splash, p.dmg, p.owner, p.weaponName);
            }
            if (!p.networkGhost) killSoldiersNear(p.pos, p.splash ? p.splash * 1.6 : 3);
            hit = true; break;
          }
        }
      }
      if (!hit) p.pos.addScaledVector(p.vel, dt);
      if (hit || p.life <= 0){
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      } else {
        p.mesh.position.copy(p.pos);
        if ((p.splash && !SPACE) || p.homing) p.mesh.quaternion.setFromUnitVectors(UP, tmpV.copy(p.vel).normalize()); // shells/missiles nose over toward travel
      }
    }
  }

  // ---------- particles ----------
  function particlesUpdate(dt){
    if (critFlash){ critFlash.t -= dt; if (critFlash.t <= 0) critFlash = null; }
    for (let i = particles.length - 1; i >= 0; i--){
      const pt = particles[i];
      pt.life -= dt;
      const k = 1 - pt.life / pt.maxLife;
      if (pt.kind === 'hoverJet'){
        pt.vel.addScaledVector(pt.accel, dt);
        pt.mesh.position.addScaledVector(pt.vel, dt);
        const width = 0.82 + k * 0.72;
        pt.mesh.scale.set(width, 1.08 + k * 0.9, width);
        pt.mesh.quaternion.setFromUnitVectors(UP, tmpV.copy(pt.vel).normalize());
        pt.mesh.material.opacity = 0.9 * (1 - k);
      } else {
        pt.mesh.scale.setScalar(1 + k * pt.r);
        pt.mesh.material.opacity = 0.85 * (1 - k);
      }
      if (pt.life <= 0){ scene.remove(pt.mesh); pt.mesh.material.dispose(); particles.splice(i, 1); }
    }
  }

  // ---------- blips: the abstract battlefield ----------
  function blipsUpdate(dt){
    if (!blips.length) return;
    for (let i = blips.length - 1; i >= 0; i--){
      const b = blips[i];
      // drift toward nearest hostile blip
      let nearest = null, nd = 1e12;
      for (const o of blips){
        if (o.team === b.team) continue;
        const d2 = o.pos.distanceToSquared(b.pos);
        if (d2 < nd){ nd = d2; nearest = o; }
      }
      if (nearest){
        tmpV.subVectors(nearest.pos, b.pos).normalize();
        tmpV2.crossVectors(UP, tmpV);
        b.pos.addScaledVector(tmpV, 40 * dt).addScaledVector(tmpV2, 55 * dt);
      }
      if (hfn) b.pos.y = groundY(b.pos.x, b.pos.z) + 6;
      // statistical skirmish resolution
      b.tSkirmish -= dt;
      if (b.tSkirmish <= 0){
        b.tSkirmish = rng.range(5, 11);
        const sideBias = b.team === 'FED' ? (opts.sim.fed - opts.sim.zeon) : (opts.sim.zeon - opts.sim.fed);
        if (rng.chance(clamp(0.16 - sideBias * 0.001, 0.05, 0.3))){
          // this unit is lost — a distant flash on the horizon
          explosion(b.pos, 10, clamp(500 / b.pos.distanceTo(player.root.position), 0.015, 0.1));
          blips.splice(i, 1);
          continue;
        }
      }
      // materialize when the observer approaches
      const dP = b.pos.distanceTo(player.root.position);
      if (dP < OBS_RADIUS && mechs.filter(m => m.alive && m.fromBlip).length < 6){
        const pool = b.team === 'FED' ? FED_POOL : zeonPool;
        spawnMech({ suitId: pool[rng.int(0, pool.length - 1)] }, b.team, b.pos.clone(), { core: false, fromBlip: true });
        blips.splice(i, 1);
      }
    }
    // collapse distant real units back into statistics
    for (const m of mechs){
      if (!m.alive || !m.fromBlip) continue;
      if (m.root.position.distanceTo(player.root.position) > DROP_RADIUS){
        m.alive = false; m.deadT = 0; releaseDetail(m);
        blips.push({ team: m.team, hp: 1, tSkirmish: rng.range(4, 9), pos: m.root.position.clone() });
      }
    }
  }

  // ---------- mission tick: waves, convoys, hold-out timer, ship batteries ----------
  function shipFire(p){
    const foes = mechs.filter(m => m.alive && m.team !== p.team);
    // capital ships DUEL: enemy hulls in extended gun reach are priority targets — the fleets
    // actually fight each other instead of leaving every ship kill to the player
    const foeShips = props.filter(q => q.alive && q.isShip && q.team !== p.team
      && q.root.position.distanceTo(p.root.position) < p.gunRange * 1.6);
    if (!foes.length && !foeShips.length) return;
    let fired = false;
    for (let s = 0; s < (p.gunShots || 1); s++){           // heavy ships loose multi-shot volleys
      const shipShot = foeShips.length > 0 && (!foes.length || rng.chance(0.65));
      const t = shipShot ? foeShips[rng.int(0, foeShips.length - 1)] : foes[rng.int(0, foes.length - 1)];
      const muzzle = p.root.position.clone(); muzzle.y += p.hitY + 8;
      const d = t.root.position.clone().setY(t.root.position.y + aimHeight(t)).sub(muzzle);
      if (d.length() > p.gunRange * (shipShot ? 1.6 : 1)) continue; // hulls trade fire at longer range
      d.normalize();
      d.x += rng.range(-0.03, 0.03); d.y += rng.range(-0.03, 0.03); d.z += rng.range(-0.03, 0.03);
      const mesh = new THREE.Mesh(bzGeo, p.team === 'FED' ? beamMatF : bzMat);
      mesh.position.copy(muzzle);
      mesh.quaternion.setFromUnitVectors(UP, d);
      scene.add(mesh);
      // capital-grade shells hit other capitals much harder than MS-scale rounds
      projectiles.push({ pos: muzzle.clone(), vel: d.normalize().multiplyScalar(420), dmg: p.gunDmg * (shipShot ? 2.2 : 1), splash: p.gunSplash, team: p.team, owner: p, weaponName: 'MAIN BATTERY', life: 5.5, mesh });
      fired = true;
    }
    if (fired) sfx('bazooka', clamp(380 / p.root.position.distanceTo(player.root.position), 0.03, 0.2));
  }

  // landship turrets traverse, elevate and fire on their OWN — each picks the nearest enemy to itself,
  // tracks it at a limited slew rate, and looses from its muzzle when lined up (replaces hull-centre fire).
  const stv1 = new THREE.Vector3(), stv2 = new THREE.Vector3(), stv3 = new THREE.Vector3();
  function updateShipTurrets(p, dt){
    p.root.updateMatrixWorld(true);
    const rangeSq = p.gunRange * p.gunRange;
    for (const t of p.turrets){
      const tw = t.yaw.getWorldPosition(stv1);
      let best = null, bd = rangeSq;
      for (const e of mechs){ if (!e.alive || e.team === p.team) continue; const d2 = e.root.position.distanceToSquared(tw); if (d2 < bd){ bd = d2; best = e; } }
      for (const q of props){
        if (!q.alive || q === p || q.team === p.team || !q.isShip) continue;
        const d2 = q.root.position.distanceToSquared(tw); if (d2 < bd){ bd = d2; best = q; }
      }
      if (!best){ // nothing in range: rest the barrels and slowly return to dead-ahead
        t.gun.rotation.x = lerp(t.gun.rotation.x, -0.04, 2 * dt);
        let d = (t.restYaw || 0) - t.yaw.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        t.yaw.rotation.y += clamp(d, -0.7 * dt, 0.7 * dt);
        continue;
      }
      const aim = stv2.set(best.root.position.x, best.root.position.y + aimHeight(best), best.root.position.z);
      const local = p.root.worldToLocal(stv3.copy(aim)); // props carry no scale → clean hull-local coords
      const dx = local.x - t.yaw.position.x, dz = local.z - t.yaw.position.z, dy = local.y - (t.yaw.position.y + t.gun.position.y);
      const wantYaw = Math.atan2(dx, dz);
      let dyaw = wantYaw - t.yaw.rotation.y; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      t.yaw.rotation.y += clamp(dyaw, -1.4 * dt, 1.4 * dt);                     // traverse at a limited slew
      t.gun.rotation.x = lerp(t.gun.rotation.x, clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.55), 3 * dt); // elevate
      t.cd -= dt;
      if (t.cd <= 0 && Math.abs(dyaw) < 0.16){                                  // fire only once roughly lined up
        t.cd = rng.range(p.gunRof[0], p.gunRof[1]);
        t.yaw.updateMatrixWorld(true);                                          // refresh so the muzzle reflects this frame's aim
        const mw = t.muzzle.getWorldPosition(stv1);
        const dir = stv3.copy(aim).addScaledVector(best.vel, mw.distanceTo(aim) / 420).sub(mw).normalize(); // lead
        const mesh = new THREE.Mesh(bzGeo, p.team === 'FED' ? beamMatF : bzMat);
        mesh.position.copy(mw); mesh.quaternion.setFromUnitVectors(UP, dir); scene.add(mesh);
        projectiles.push({ pos: mw.clone(), vel: dir.clone().multiplyScalar(420), dmg: p.gunDmg, splash: p.gunSplash, team: p.team, owner: p, weaponName: 'TURRET BATTERY', life: 5.5, mesh });
        sfx('bazooka', clamp(380 / mw.distanceTo(player.root.position), 0.03, 0.18));
      }
    }
  }

  function missionUpdate(dt){
    // delayed attack waves (defend)
    for (let i = waves.length - 1; i >= 0; i--){
      waves[i].t -= dt;
      if (waves[i].t <= 0){
        const ang = rng.range(-180, 180);
        waves[i].specs.forEach((spec, j) =>
          spawnMech(spec, 'ZEON', ringPos(ang + j * 16, rng.range(800, 1100), 220), { core: true }));
        setMsg(waves[i].msg, 2.8);
        waves.splice(i, 1);
      }
    }
    // staged waves: commit the next one once the current attack thins out
    waveCd -= dt;
    if (waveQueue.length && waveCd <= 0 && outcome === null){
      const aliveCore = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length;
      if (aliveCore <= 2){
        const wv = waveQueue.shift();
        const ang = rng.range(-180, 180);
        wv.specs.forEach((spec, j) =>
          spawnMech(spec, 'ZEON', ringPos(ang + j * 12, rng.range(850, 1150), 220), { core: true }));
        setMsg(wv.msg, 3);
        waveCd = 10;
      }
    }
    // fleet battle: capital ships are not statues — each line steams toward the other until it holds
    // a broadside standoff, so the Salamis wall actually closes and fights (the fortress never moves)
    if (mission.type === 'fleet'){
      for (const p of props){
        if (!p.alive || !p.isShip || p.kind === 'solfortress') continue;
        let best = null, bd = Infinity;
        for (const q of props){
          if (!q.alive || !q.isShip || q.team === p.team) continue;
          const d2 = q.root.position.distanceToSquared(p.root.position);
          if (d2 < bd){ bd = d2; best = q; }
        }
        if (!best) continue;
        const standoff = p.kind === 'columbus' ? 950 : 620;    // carriers hang back behind the gun line
        if (bd > standoff * standoff){                         // close to gun range, then hold the line
          if (p.cruise == null) p.cruise = rng.range(9, 14);   // per-hull speed so the wall staggers naturally
          tmpV.subVectors(best.root.position, p.root.position).normalize();
          p.root.position.addScaledVector(tmpV, p.cruise * dt);
          const want = Math.atan2(tmpV.x, tmpV.z);
          let dy = want - p.root.rotation.y;
          while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
          p.root.rotation.y += clamp(dy, -0.12 * dt, 0.12 * dt); // ponderous prow-first turn
        }
      }
    }
    // capital-ship & landship batteries — turreted hulls aim+fire per-turret; the rest volley from the hull
    for (const p of props){
      if (!p.alive || !p.isShip) continue;
      if (p.turrets){ updateShipTurrets(p, dt); continue; }
      p.gunT -= dt;
      if (p.gunT <= 0){
        p.gunT = rng.range(p.gunRof[0], p.gunRof[1]);
        shipFire(p);
      }
    }
    // Odessa: reserves feed the line as armor is lost, and the infantry war grinds on
    if ((mission.type === 'odessa' || mission.type === 'fleet') && outcome === null){
      const fleet = mission.type === 'fleet';
      mission._reinT = (mission._reinT ?? 4) - dt;
      if (mission._reinT <= 0){
        mission._reinT = fleet ? 2.4 : 3.2;
        const liveZ = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length;
        if (zeonReserve.length && liveZ < (fleet ? 40 : 90))
          spawnMech(zeonReserve.pop(), 'ZEON',
            fleet ? ringPos(rng.range(-45, 45), rng.range(900, 1300), 220) : ringPos(rng.range(-35, 35), rng.range(950, 1250)), { core: true });
        const liveF = mechs.filter(m => m.alive && m.team === 'FED' && !m.isPlayer && m.wingId === undefined && m.airId === undefined && !m.fromBlip).length;
        if (fedReserve.length && liveF < (fleet ? 30 : 60))
          spawnMech(fedReserve.pop(), 'FED',
            fleet ? ringPos(rng.range(150, 210), rng.range(250, 520), 200) : ringPos(rng.range(140, 220), rng.range(350, 560)), { core: false });
      }
    }
    infantryUpdate(dt);
    // hold-out: enemies keep coming until the clock runs out
    if (mission.type === 'survive' && outcome === null){
      missionT -= dt;
      nextWaveT -= dt;
      const aliveZ = mechs.filter(m => m.alive && m.team === 'ZEON').length;
      if (nextWaveT <= 0 && missionT > 12 && aliveZ < 9){
        nextWaveT = rng.range(18, 26);
        const ang = rng.range(0, 360);
        for (let i = 0, n = rng.int(2, 3); i < n; i++)
          spawnMech({ suitId: zeonPool[rng.int(0, zeonPool.length - 1)] }, 'ZEON',
            ringPos(ang + i * 14, rng.range(750, 950), 220), { core: false });
        setMsg('HOSTILE REINFORCEMENTS INBOUND', 2.2);
      }
    }
    // convoys roll toward their goal
    for (const p of props){
      if (!p.alive || !p.goal) continue;
      tmpV.subVectors(p.goal, p.root.position); tmpV.y = 0;
      if (tmpV.length() < 40){
        if (p.team === 'FED'){ p.arrived = true; setMsg('CONVOY UNIT CLEAR', 1.6); }
        else { p.escaped = true; setMsg('TRANSPORT ESCAPED', 2.6); }
        p.alive = false;
        scene.remove(p.root);
        continue;
      }
      tmpV.normalize();
      p.root.position.addScaledVector(tmpV, p.speed * dt);
      p.root.rotation.y = Math.atan2(tmpV.x, tmpV.z);
      if (hfn && !SPACE) p.root.position.y = groundY(p.root.position.x, p.root.position.z);
    }
  }

  // ---------- ship fire support ----------
  let supportT = opts.shipSupport ? 16 : Infinity;
  let supportStrike = null;
  function supportUpdate(dt){
    if (!opts.shipSupport) return;
    supportT -= dt;
    if (supportT <= 0){
      supportT = 30 - opts.shipSupport * 5;
      const targets = mechs.filter(m => m.alive && m.team === 'ZEON');
      if (targets.length){
        supportStrike = { pos: targets[rng.int(0, targets.length - 1)].root.position.clone(), t: 1.5 };
        setMsg(`${opts.shipName || 'CARRIER'} — FIRE SUPPORT INBOUND`, 1.6);
      }
    }
    if (supportStrike){
      supportStrike.t -= dt;
      if (supportStrike.t <= 0){
        for (let i = 0; i < 3; i++){
          const p = supportStrike.pos.clone().add(tmpV.set(rng.range(-25, 25), 6, rng.range(-25, 25)));
          explosion(p, 14, 0.25);
          splashDamage(p, 14, 300, player, 'SHIP FIRE SUPPORT');
        }
        supportStrike = null;
      }
    }
  }

  // ---------- HUD ----------
  function objectiveText(){
    const base = opts.objective || 'DESTROY ALL HOSTILES';
    const left = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length
      + waves.reduce((a, w) => a + w.specs.length, 0);
    const total = (opts.enemies || []).length;
    switch (mission.type){
      case 'defend':
        return `${base} · STRUCTURES ${missionProps.filter(p => p.alive).length}/${missionProps.length} · HOSTILES ${total - left}/${total}`;
      case 'assault':
        return `${base} · TARGETS ${missionProps.filter(p => !p.alive).length}/${missionProps.length} · GARRISON ${total - left}/${total}`;
      case 'escort': {
        const moving = missionProps.filter(p => p.alive);
        const arrived = missionProps.filter(p => p.arrived).length;
        return `${base} · CONVOY ${arrived + moving.length}/${missionProps.length}`
          + (moving.length ? ` · ${Math.round(moving[0].root.position.distanceTo(mission.goal))} m TO GO` : '');
      }
      case 'ambush':
        return `${base} · TRANSPORTS ${missionProps.filter(p => !p.alive && !p.escaped).length}/${missionProps.length} DESTROYED`;
      case 'hunt': {
        const vip = mechs.find(m => m.vip);
        return `${base} · TARGET ${vip && vip.alive ? 'ACTIVE' : 'DOWN'} · ESCORTS ${total - 1 - Math.max(0, left - (vip && vip.alive ? 1 : 0))}/${total - 1}`;
      }
      case 'survive':
        return `${base} · ${Math.max(0, Math.ceil(missionT))}s UNTIL RELIEF`;
      case 'odessa': {
        const liveZ = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length + zeonReserve.length;
        const shipName = (landZ[0]?.kind || 'landship').toUpperCase();
        return `${base} · ENEMY ARMOR ${total - liveZ}/${total} · ${shipName} ${landZ.filter(p => p.alive).length}/2`
          + ` · TROOPS ${infantry.aliveF} vs ${infantry.aliveZ}`;
      }
      case 'fleet': {
        const liveZ = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length + zeonReserve.length;
        return `${base} · ENEMY FLEET ${fleetZ.filter(p => !p.alive).length}/${fleetZ.length} SUNK · OUR FLEET ${fleetF.filter(p => p.alive).length}/${fleetF.length} · HOSTILE MS ${liveZ}`;
      }
      case 'shipkill':
        return `${base} · ENEMY HULL ${Math.max(0, Math.round(missionProps[0].hp))} / ${missionProps[0].maxHp}`
          + (allyShipProp ? ` · ${allyShipProp.kind.toUpperCase()} ${Math.max(0, Math.round(allyShipProp.hp))}` : '');
      case 'shipdefend': {
        const aliveZ = mechs.filter(m => m.alive && m.core && m.team === 'ZEON').length;
        const ships = missionProps.filter(p => p.isShip);
        const hp = ships.reduce((a, p) => a + Math.max(0, p.hp), 0);
        const maxHp = ships.reduce((a, p) => a + p.maxHp, 0);
        return `${base} · SALAMIS ${ships.filter(p => p.alive).length}/${ships.length} · HULL ${Math.round(hp)}/${maxHp}`
          + ` · WAVE ${totalWaves - waveQueue.length}/${totalWaves} · HOSTILES ${aliveZ}`;
      }
      default: {
        const zShips = missionProps.filter(p => p.isShip && p.team === 'ZEON');
        return `${base} · ${total - left}/${total}`
          + (zShips.length ? ` · LANDSHIPS ${zShips.filter(p => !p.alive).length}/${zShips.length}` : '');
      }
    }
  }

  let radarT = 0;
  function hudUpdate(dt){
    const w = player.suit.weapons[player.wi];
    const frac = clamp(player.hp / player.maxHp, 0, 1);
    hpBar.style.width = frac * 100 + '%';
    hpBar.classList.toggle('low', frac < 0.3);
    hpNum.textContent = ` ${Math.max(0, Math.round(player.hp))} / ${player.maxHp}`;
    boostBar.style.width = clamp(player.fuel / player.maxFuel, 0, 1) * 100 + '%';
    let wHtml;
    if (player.wi === SABER_SLOT){
      wHtml = `${player.suit.saber.name} <span class="ammo">MELEE</span>`;
    } else if (player.reloadT > 0){
      wHtml = `${w.name} <span class="ammo">RELOADING ${player.reloadT.toFixed(1)}s</span>`;
    } else if (w.type === 'lockmissile'){
      const st = (player.lockedFlash || 0) > 0 ? 'LOCK ✓ — FOX'
        : player.lockTarget ? `LOCKING ${Math.round(clamp((player.lockT || 0) / w.lockTime, 0, 1) * 100)}%`
        : `${player.clip} / ${w.clip} · AUTO-LOCK`;
      wHtml = `${w.name} <span class="ammo">${st}</span>`;
    } else {
      wHtml = `${w.name} <span class="ammo">${player.clip} / ${w.clip}</span>`;
    }
    if (player.shieldMax > 0){
      const sf = Math.round(clamp(player.shieldHp / player.shieldMax, 0, 1) * 100);
      wHtml += player.shieldBroken
        ? `<br><span class="ammo" style="color:var(--zeon)">SHIELD BROKEN</span>`
        : `<br>SHIELD GUARD <span class="ammo" style="color:${player.blocking ? 'var(--ok)' : 'var(--dim)'}">${player.blocking ? 'UP' : 'DOWN'} · ${sf}%</span>`;
    }
    if (groundManeuverEligible(player)){
      const kick = player.sandKickCd > 0 ? `${player.sandKickCd.toFixed(1)}s` : 'READY';
      const travel = landTypeMobileSuit(player) ? '3× AUTO · 80% ENERGY' : '2× AUTO · 100% ENERGY';
      wHtml += `<br>GROUND EFFECT <span class="ammo" style="color:${player.hovering ? 'var(--ok)' : 'var(--dim)'}">E ${player.hovering ? 'HOVER ACTIVE' : 'HOVER READY'} · ${travel} · Q KICK ${kick}</span>`;
    }
    wEl.innerHTML = wHtml;
    objEl.textContent = objectiveText();
    const real = mechs.filter(m => m.alive && !m.isPlayer).length;
    simEl.textContent = opts.sim
      ? `FULL-SIM ${real} UNITS · ABSTRACT ${blips.length} · OBSERVATION BUBBLE 1.6 KM`
      : `${env.toUpperCase()} OPERATION`;
    msgT -= dt;
    if (msgT <= 0 && msgEl.textContent && !paused) msgEl.textContent = '';

    radarT -= dt;
    if (radarT <= 0){
      radarT = 0.08;
      drawRadar();
    }
  }

  function drawRadar(){
    const R = 90, range = 3500;
    rctx.clearRect(0, 0, 180, 180);
    rctx.strokeStyle = 'rgba(60,110,160,.5)';
    rctx.beginPath(); rctx.arc(R, R, 88, 0, 7); rctx.stroke();
    rctx.beginPath(); rctx.arc(R, R, 44, 0, 7); rctx.stroke();
    const put = (pos, color, size) => {
      tmpV.subVectors(pos, player.root.position);
      const rx = tmpV.x * Math.cos(-camYaw) - tmpV.z * Math.sin(-camYaw);
      const rz = tmpV.x * Math.sin(-camYaw) + tmpV.z * Math.cos(-camYaw);
      const d = Math.hypot(rx, rz);
      if (d > range) return;
      rctx.fillStyle = color;
      rctx.fillRect(R + rx / range * 86 - size / 2, R - rz / range * 86 - size / 2, size, size);
    };
    for (const m of mechs){
      if (!m.alive || m.isPlayer) continue;
      put(m.root.position, m.team === 'ZEON' ? '#ff5d5d' : '#4aa3ff', m.core ? 5 : 4);
    }
    for (const b of blips) put(b.pos, b.team === 'ZEON' ? 'rgba(255,93,93,.35)' : 'rgba(74,163,255,.35)', 3);
    for (const p of props){
      if (!p.alive) continue;
      if (p.scenery){ if (!p.indestructible) put(p.root.position, '#8a8f96', 3); continue; } // map structures: faint grey, landmarks hidden
      put(p.root.position, p.team === 'ZEON' ? '#ffb14a' : '#4affc8', p.kind === 'truck' ? 4 : p.isShip ? 9 : 6);
    }
    if (mission.goal) put(mission.goal, '#ffffff', 3);
    rctx.fillStyle = '#fff';
    rctx.beginPath();
    rctx.moveTo(R, R - 6); rctx.lineTo(R - 4, R + 5); rctx.lineTo(R + 4, R + 5);
    rctx.fill();
  }

  // ---------- camera ----------
  function cameraUpdate(dt){
    const p = player.root.position;
    const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
    const fwd = tmpV.set(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp);
    let lookOverride = null; // branches that don't look straight along the aim set this

    const cockpitVisible = firstPerson && player.alive && !player.air && !player.suit.vehicle;
    hud.classList.toggle('cockpit-view', cockpitVisible);
    cockpitEl.classList.toggle('hidden', !cockpitVisible);
    cockpitInterior.visible = cockpitVisible;
    if (cockpitVisible){
      // The cockpit is registered to a fixed 68-degree reference view. Compensate only its screen
      // axes when boost widens the world FOV or the window aspect changes, keeping WebGL frames
      // aligned with the percentage-based instrument overlay.
      const fovFit = Math.tan(camera.fov * Math.PI / 360) / Math.tan(68 * Math.PI / 360);
      const aspectFit = clamp(camera.aspect / (16 / 9), .76, 1.4);
      cockpitInterior.scale.set(fovFit * aspectFit, fovFit, 1);
      const gaugeValues = [
        clamp(player.hp / player.maxHp, 0, 1),
        clamp(Math.hypot(player.vel.x, player.vel.z) / Math.max(1, player.suit.boost), 0, 1),
        clamp(player.fuel / player.maxFuel, 0, 1),
      ];
      for (let i = 0; i < cockpitGaugeNeedles.length; i++){
        const needle = cockpitGaugeNeedles[i], pivot = needle.userData.gaugePivot;
        const target = -1.08 + gaugeValues[i] * 2.16;
        const angle = lerp(needle.rotation.z, target, Math.min(1, 8 * dt));
        needle.rotation.z = angle;
        needle.position.x = pivot.x - Math.sin(angle) * pivot.r * .22;
        needle.position.y = pivot.y + Math.cos(angle) * pivot.r * .22;
      }
    }
    if (firstPerson && !player.air){
      // cockpit: camera rides in the head, own mech hidden
      player.root.visible = false;
      const head = player.parts.head.getWorldPosition(tmpV3);
      head.addScaledVector(fwd, 1.5);
      camera.position.lerp(head, started ? Math.min(1, 22 * dt) : 1);
    } else if (player.air && firstPerson){
      // aircraft BOMBING TOP-VIEW: ride high above the plane looking down, so you can see the ground
      // and where bombs will fall. Anchored to the HEADING (player.yaw), not the banking body, so the
      // view stays stable through rolls and the nose always reads "forward/up" on screen. Airframe visible.
      player.root.visible = player.alive || player.deadT > 0;
      const sc = player.suit.scale || 1;
      const cy = Math.cos(player.yaw), syaw = Math.sin(player.yaw);
      const height = 60 * sc, back = 26 * sc; // sit high and a little behind so forward ground is in shot
      const desired = tmpV3.set(p.x - back * syaw, p.y + height, p.z - back * cy);
      if (hfn) desired.y = Math.max(desired.y, groundY(desired.x, desired.z) + 20);
      camera.position.lerp(desired, started ? Math.min(1, 10 * dt) : 1);
      // look down at a point ahead of the plane on the ground — leads the view forward over the target
      const ahead = 42 * sc;
      lookOverride = tmpV2.set(p.x + ahead * syaw, p.y - height * 0.45, p.z + ahead * cy);
    } else if (player.air){
      // aircraft chase cam: behind and above, looking along the aim — pulled back proportionally to the
      // airframe so huge carriers are framed (camera not stuck inside the hull) and the crosshair stays centred
      player.root.visible = player.alive || player.deadT > 0;
      const acs = Math.max(1, (player.suit.scale || 1) * 0.7);
      const desired = tmpV3.copy(p).addScaledVector(fwd, -38 * acs);
      desired.y += 13 * acs;
      if (hfn) desired.y = Math.max(desired.y, groundY(desired.x, desired.z) + 6);
      camera.position.lerp(desired, started ? Math.min(1, 7 * dt) : 1);
    } else if (player.suit.vehicle){
      // Low vehicle chase camera: frame the 2.7m APC instead of hovering at mobile-suit head height.
      player.root.visible = player.alive || player.deadT > 0;
      const desired = tmpV3.copy(p).addScaledVector(fwd, -14);
      desired.y += 7 - sp * 2;
      if (hfn) desired.y = Math.max(desired.y, groundY(desired.x, desired.z) + 2.5);
      camera.position.lerp(desired, started ? Math.min(1, 12 * dt) : 1);
    } else {
      player.root.visible = player.alive || player.deadT > 0;
      // pursuit cam: centred directly behind the mech so it lines up with the
      // cockpit sightline, lifted above the head so the body never blocks the crosshair
      const desired = tmpV3.copy(p)
        .addScaledVector(fwd, -23);
      desired.y += 21 - sp * 5;
      if (hfn) desired.y = Math.max(desired.y, groundY(desired.x, desired.z) + 2.5);
      camera.position.lerp(desired, started ? Math.min(1, 11 * dt) : 1);
    }

    // cockpit weapon: sway with motion, kick on fire (mobile suits only — not when flying a plane)
    // Mirror simulation time instead of advancing a second cockpit-only clock.
    // This keeps the saber viewmodel frozen in sync whenever the game is paused.
    vgSwing = Math.max(0, player.swingT || 0);
    if (vgSwing <= 0 && vgMeleeOverride){
      vgMeleeOverride = false;
      buildViewGun();
    }
    viewGun.visible = firstPerson && player.alive && !player.air && !player.blocking;
    if (viewGun.visible){
      vgKick = Math.max(0, vgKick - vgKick * Math.min(1, 9 * dt));
      const tNow = performance.now() * 0.001;
      const sway = 0.3 + clamp(Math.hypot(player.vel.x, player.vel.z) / 50, 0, 1);
      // At this deeper camera-local depth the cockpit tub, controls and window frames
      // naturally mask the weapon through the depth buffer. X/Y preserve its familiar
      // low-right screen position while the reduced apparent size keeps the sightline clear.
      viewGun.scale.setScalar(player.wi === SABER_SLOT || vgMeleeOverride ? 1.2 : 1);
      viewGun.position.set(
        3.3 + Math.sin(tNow * 1.7) * 0.024 * sway,
        -2.3 + Math.sin(tNow * 3.4) * 0.036 * sway,
        -5 + vgKick);
      if (vgSwing > 0){
        const duration = Math.max(0.001, player.swingDuration || 0.4);
        const k = clamp(1 - vgSwing / duration, 0, 1);
        const ease = k * k * (3 - 2 * k);
        const arc = Math.sin(k * Math.PI);
        const dir = player.swingDir || 1;
        if (player.swingKind === 'crosscut'){
          viewGun.rotation.set(-0.18, dir * (1.1 - ease * 2.2), dir * 0.28);
          viewGun.position.x += dir * (0.72 - ease * 1.44);
        } else if (player.swingKind === 'overhead'){
          viewGun.rotation.set(-2.15 + ease * 2.75, 0, dir * arc * 0.16);
          viewGun.position.y += 0.48 - ease * 0.96;
        } else if (player.swingKind === 'thrust'){
          viewGun.rotation.set(-0.82, dir * (1 - arc) * 0.12, dir * arc * 0.10);
          viewGun.position.y += arc * 0.22;
          viewGun.position.z -= arc * 1.35;
        } else {
          viewGun.rotation.set(vgKick * 0.6 - arc * 0.9, 0, dir * arc * 1.25);
          viewGun.position.x -= dir * arc * 0.9;
        }
      } else {
        viewGun.rotation.set(vgKick * 0.6, 0, 0);
      }
    }

    // Cockpit shield: the same family silhouette as the exterior plate, held low on its canonical
    // side so the protected pilot retains a usable central monitor sightline.
    if (firstPerson && player.blocking && player.alive && !player.shieldBroken
      && player.shieldMax > 0 && player.parts?.shield && player.wi !== SABER_SLOT){
      viewShield.visible = true;
      const t = clamp(player.blockPose || 0, 0, 1);
      const tNow = performance.now() * 0.001;
      const shieldSide = viewShield.userData.screenSide === 'right' ? 1 : -1;
      // Keep the shield upright and low on its canonical side (Zaku shoulder plate right, carried
      // shields left). It protects the pilot without erasing the panoramic centre/crosshair.
      viewShield.position.set(shieldSide * 1.48, -1.38 + t * 0.14 + Math.sin(tNow * 1.5) * 0.015, -2.75);
      viewShield.rotation.set(-0.08, -shieldSide * 0.22, shieldSide * 0.08);
    } else viewShield.visible = false;

    if (camShake > 0){
      camera.position.x += (rng.next() - 0.5) * camShake;
      camera.position.y += (rng.next() - 0.5) * camShake;
      camShake = Math.max(0, camShake - 4 * dt);
    }
    if (lookOverride){
      camera.lookAt(lookOverride);
    } else {
      const look = tmpV.set(Math.sin(camYaw) * cp, sp, Math.cos(camYaw) * cp)
        .multiplyScalar(firstPerson ? 120 : 90).add(camera.position);
      camera.lookAt(look);
    }
    camera.fov = lerp(camera.fov, (player.boosting ? 8 : 0) + (firstPerson ? 68 : 62), 4 * dt);
    camera.updateProjectionMatrix();
  }

  // ---------- end conditions ----------
  let endT = -1, ended = false, outcome = null;
  function checkEnd(dt){
    if (ended) return;
    if (outcome === null){
      if (!player.alive){ outcome = { victory: false }; endT = 3; setMsg('SORTIE FAILED', 4); return; }
      if (PVP && pvpForfeit){
        outcome = { victory: true, forfeit: true };
        endT = 2.4;
        setMsg('OPPONENT DISCONNECTED — FORFEIT VICTORY', 4);
        return;
      }
      const zCore = mechs.some(m => m.alive && m.core && m.team === 'ZEON') || waves.length > 0 || waveQueue.length > 0 || zeonReserve.length > 0;
      let win = false, winMsg = 'ENEMY FORCE ELIMINATED', lose = null;
      if (allyShipProp && !allyShipProp.alive)
        lose = `THE ${allyShipProp.kind.toUpperCase()} IS LOST — OPERATION FAILED`;
      switch (mission.type){
        case 'defend':
          if (!missionProps.some(p => p.alive)) lose = 'THE BASE HAS FALLEN — DEFENSE FAILED';
          win = !zCore; winMsg = 'RAID REPELLED — BASE SECURE';
          break;
        case 'assault':
          win = !zCore && !missionProps.some(p => p.alive);
          winMsg = 'FORWARD BASE LEVELED — LINE BROKEN';
          break;
        case 'escort': {
          const moving = missionProps.filter(p => p.alive).length;
          const arrived = missionProps.filter(p => p.arrived).length;
          if (!moving && !arrived) lose = 'CONVOY LOST — ESCORT FAILED';
          win = (arrived && !moving) || (!zCore && arrived + moving > 0);
          winMsg = 'CONVOY SAFE — ESCORT COMPLETE';
          break;
        }
        case 'ambush':
          if (missionProps.some(p => p.escaped)) lose = 'TRANSPORTS ESCAPED — AMBUSH FAILED';
          win = missionProps.every(p => !p.alive && !p.escaped);
          winMsg = 'SUPPLY COLUMN ANNIHILATED';
          break;
        case 'hunt': {
          const vip = mechs.find(m => m.vip);
          win = vip ? !vip.alive : !zCore;
          winMsg = 'TARGET ELIMINATED — DISENGAGE';
          break;
        }
        case 'survive':
          win = missionT <= 0;
          winMsg = 'RELIEF FORCE ON STATION — LINE HELD';
          break;
        case 'shipkill':
          win = !missionProps[0].alive;
          winMsg = 'ENEMY CRUISER DESTROYED — ZEON LINE BROKEN';
          break;
        case 'shipdefend':
          if (!missionProps.some(p => p.isShip && p.alive)) lose = 'BOTH CRUISERS LOST — FLEET DEFENSE FAILED';
          win = !zCore;
          winMsg = 'ALL WAVES REPELLED — THE SALAMIS HOLDS';
          break;
        case 'odessa':
          if (!landF.some(p => p.alive)) lose = 'FEDERATION LANDSHIPS DESTROYED — THE OFFENSIVE COLLAPSES';
          win = !zCore && !landZ.some(p => p.alive);
          winMsg = mission.winMsg || 'ODESSA HAS FALLEN — ZEON RETREATS FROM EARTH';
          break;
        case 'fleet': {
          // a BROKEN fleet fails the assault — not just a fully-annihilated one. mission.fleetLoseFrac
          // is the survival fraction at/below which the line has collapsed (default 0 = only when all gone)
          const aliveF = fleetF.filter(p => p.alive).length, loseFrac = mission.fleetLoseFrac || 0;
          if (fleetF.length && aliveF <= fleetF.length * loseFrac){
            lose = 'THE FLEET IS BROKEN — THE ASSAULT COLLAPSES';
          } else if (fleetF.length && loseFrac > 0 && aliveF <= fleetF.length * 0.5 && !mission._fleetWarned){
            mission._fleetWarned = true; setMsg('THE FLEET IS BREAKING — PROTECT THE SHIPS', 3.5);
          }
          // win only when every enemy is destroyed — the whole mobile-suit force AND every capital ship
          win = !zCore && !fleetZ.some(p => p.alive);
          winMsg = mission.winMsg || 'THE ZEON FLEET IS SHATTERED — PRESS ON TO SOLOMON';
          break;
        }
        default:
          // custom sortie: clear every enemy mech AND every fielded enemy landship
          win = !zCore && !missionProps.some(p => p.isShip && p.team === 'ZEON' && p.alive);
      }
      if (lose){ outcome = { victory: false }; endT = 3; setMsg(lose, 4); }
      else if (win){
        outcome = { victory: true }; endT = 2.4;
        setMsg(opts.finale ? 'A BAOA QU HAS FALLEN — THE WAR IS OVER' : winMsg, 4);
      }
    } else {
      endT -= dt;
      if (endT <= 0) finish(outcome);
    }
  }

  function finish(res){
    if (ended) return;
    ended = true;
    document.exitPointerLock?.();
    removeListeners();
    detachPvpListeners();
    cockpitEl.classList.add('hidden');
    killFeedEl.replaceChildren();
    hud.classList.add('hidden');
    onEnd({
      victory: !!res.victory, retreat: !!res.retreat,
      forfeit: !!res.forfeit, disconnected: !!res.forfeit, kills,
      destroyedIds, hpFrac: clamp(player.hp / player.maxHp, 0, 1),
      wing: mechs.filter(m => m.wingId !== undefined).map(m => ({
        wingId: m.wingId, alive: m.alive, hpFrac: clamp(m.hp / m.maxHp, 0, 1),
      })),
      // air wing survivors, written back to the player's S.air roster
      aircraft: mechs.filter(m => m.airId !== undefined).map(m => ({
        airId: m.airId, alive: m.alive, hpFrac: clamp(m.hp / m.maxHp, 0, 1),
      })),
      // contract allies (not wingmen, not blip-spawned) — multi-phase ops carry survivors over;
      // reserves that never got the call to deploy survive by definition
      allies: mechs.filter(m => m.team === 'FED' && !m.isPlayer && m.wingId === undefined && m.airId === undefined && !m.fromBlip)
        .map(m => ({ suitId: m.suit.id, alive: m.alive, hpFrac: clamp(m.hp / m.maxHp, 0, 1) }))
        .concat(fedReserve.map(spec => ({ suitId: spec.suitId, alive: true, hpFrac: spec.hpFrac ?? 1 }))),
      // surviving allied capital ships by kind — multi-phase fleet ops sail them into the next battle
      allyFleet: fleetF.filter(p => p.alive).reduce((m, p) => { m[p.kind] = (m[p.kind] || 0) + 1; return m; }, {}),
    });
  }

  function removeListeners(){
    document.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('contextmenu', onCtx);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('pointerlockchange', onLockChange);
  }
  attachPvpListeners();

  // ---------- LOD pass: choose the near (full-detail) set, instance the rest ----------
  const lodMat = new THREE.Matrix4(), lodQ = new THREE.Quaternion(), lodS = new THREE.Vector3(), lodC = new THREE.Color();
  let lodTimer = 0;
  function lodRepartition(){
    const cam = camera.position;
    const live = [];
    for (const m of mechs){
      if (!m.alive) continue;
      if (m.alwaysFull){ ensureDetail(m); m.lodNear = true; continue; }
      m._d2 = m.root.position.distanceToSquared(cam);
      live.push(m);
    }
    live.sort((a, b) => a._d2 - b._d2);
    const nearN = Math.min(NEAR_CAP - 1, live.length); // -1 leaves headroom for the always-full player
    for (let i = 0; i < live.length; i++){
      const m = live[i];
      if (i < nearN){ m.lodNear = true; ensureDetail(m); }
      else { m.lodNear = false; releaseDetail(m); }
    }
  }
  function lodWriteInstances(){
    const counts = new Map(Array.from(farMeshes.keys(), key => [key, 0]));
    for (const m of mechs){
      if (!m.alive || m.lodNear || m.alwaysFull) continue;
      const key = liteKind(m.suit), farMesh = farMeshes.get(key), fi = counts.get(key);
      if (fi >= MAX_FAR) continue;
      lodQ.setFromAxisAngle(UP, m.yaw);
      lodS.setScalar(m.suit.scale || 1);
      lodMat.compose(m.root.position, lodQ, lodS);
      farMesh.setMatrixAt(fi, lodMat);
      lodC.set(m.suit.colors ? m.suit.colors.main : 0xcccccc);
      farMesh.setColorAt(fi, lodC);
      counts.set(key, fi + 1);
    }
    for (const [key, farMesh] of farMeshes){
      farMesh.count = counts.get(key);
      farMesh.instanceMatrix.needsUpdate = true;
      if (farMesh.instanceColor) farMesh.instanceColor.needsUpdate = true;
    }
  }

  // ---------- body collision (solid hitboxes) ----------
  // Every live unit is a sphere; overlapping pairs get pushed apart and their
  // closing velocity is cancelled, so nothing walks through anything. Broad-phase
  // is a uniform (x,z) grid so this stays ~O(n) even with 300+ mechs. The overlap
  // test is 3D (a jet 30m overhead won't shove a mech below it), but on the ground
  // the push is horizontal so units stay on the deck instead of being launched/buried.
  const CELL = 16;
  function bodyRadius(m){
    const s = m.suit.scale || 1, st = m.suit.style;
    if (Number.isFinite(m.suit.collisionRadius)) return m.suit.collisionRadius * s;
    if (m.suit.id === 'gfighter') return 12 * s;
    if (m.air) return 6 * s;
    if (st === 'tank') return 10 * s;          // built at MS scale, shrunk to ~1/3
    if (st === 'crane') return 8 * s;          // wide crane carrier
    if (st === 'guntank') return 5.2 * s;
    if (st === 'acguy' || st === 'dom') return 4.6 * s;
    return 4.0 * s;                            // humanoid MS / gundam / gm / zaku / etc.
  }
  function resolveCollisions(dt){
    collisionGrid.clear();
    const live = [];
    for (const m of mechs){
      if (!m.alive) continue;
      m._ci = live.length; m._r = bodyRadius(m); live.push(m);
      const key = Math.floor(m.root.position.x / CELL) + ',' + Math.floor(m.root.position.z / CELL);
      let cell = collisionGrid.get(key);
      if (!cell){ cell = []; collisionGrid.set(key, cell); }
      cell.push(m);
    }
    const MAXPUSH = 80 * dt; // cap per-pair displacement so dense crowds settle instead of snapping
    // --- mech vs mech ---
    for (const a of live){
      const pa = a.root.position, va = a.vel, ra = a._r;
      const cx = Math.floor(pa.x / CELL), cz = Math.floor(pa.z / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gz = cz - 1; gz <= cz + 1; gz++){
          const cell = collisionGrid.get(gx + ',' + gz);
          if (!cell) continue;
          for (const b of cell){
            if (b._ci <= a._ci) continue;                // resolve each pair once
            const pb = b.root.position, vb = b.vel;
            const minD = ra + b._r;
            let dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z;
            if (dx * dx + dy * dy + dz * dz >= minD * minD) continue;
            // the player carries more "mass" so grunts give way without shoving the player around
            let wa = 0.5, wb = 0.5;
            if (a.isPlayer){ wa = 0.25; wb = 0.75; } else if (b.isPlayer){ wa = 0.75; wb = 0.25; }
            let nx, ny = 0, nz, overlap;
            if (SPACE){
              const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
              nx = dx / d; ny = dy / d; nz = dz / d; overlap = minD - d;
            } else {
              let dh = Math.hypot(dx, dz);
              if (dh < 0.001){ const an = a._ci * 1.7; dx = Math.cos(an); dz = Math.sin(an); dh = 1; }
              nx = dx / dh; nz = dz / dh; overlap = minD - dh;
              if (overlap <= 0) continue;                // only overlapping vertically — let it pass over
            }
            const push = Math.min(overlap, MAXPUSH);
            pa.x -= nx * push * wa; pa.z -= nz * push * wa; if (ny) pa.y -= ny * push * wa;
            pb.x += nx * push * wb; pb.z += nz * push * wb; if (ny) pb.y += ny * push * wb;
            // cancel only the closing velocity so they stop ramming but can still slide apart
            const avn = va.x * nx + va.z * nz + (ny ? va.y * ny : 0);
            if (avn > 0){ va.x -= nx * avn; va.z -= nz * avn; if (ny) va.y -= ny * avn; }
            const bvn = vb.x * nx + vb.z * nz + (ny ? vb.y * ny : 0);
            if (bvn < 0){ vb.x -= nx * bvn; vb.z -= nz * bvn; if (ny) vb.y -= ny * bvn; }
          }
        }
    }
    // --- mech vs solid props (bases, depots, capital ships): push the mech out, prop holds ---
    const cap = MAXPUSH * 2;
    const pushOut = (m, cx, cy, cz, sr) => {       // shove mech m out of a solid sphere centred at (cx,cy,cz)
      const pm = m.root.position, vm = m.vel, minD = sr + m._r;
      const dx = pm.x - cx, dy = pm.y - cy, dz = pm.z - cz;
      if (dx * dx + dy * dy + dz * dz >= minD * minD) return;
      if (SPACE){
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        const push = Math.min(minD - d, cap), nx = dx / d, ny = dy / d, nz = dz / d;
        pm.x += nx * push; pm.y += ny * push; pm.z += nz * push;
        const vn = vm.x * nx + vm.y * ny + vm.z * nz;
        if (vn < 0){ vm.x -= nx * vn; vm.y -= ny * vn; vm.z -= nz * vn; }
      } else {
        let dh = Math.hypot(dx, dz), ex = dx, ez = dz;
        if (dh < 0.001){ ex = 1; ez = 0; dh = 1; }
        const overlap = minD - dh;
        if (overlap <= 0) return;
        const push = Math.min(overlap, cap), nx = ex / dh, nz = ez / dh;
        pm.x += nx * push; pm.z += nz * push;
        const vn = vm.x * nx + vm.z * nz;
        if (vn < 0){ vm.x -= nx * vn; vm.z -= nz * vn; }
      }
    };
    for (const p of props){
      if (!p.alive) continue;
      if (p.hitSpheres){                            // landships: a chain of solid spheres along the hull
        const n = fillWorldSpheres(p, p.root.rotation.y);
        for (const m of live) for (let i = 0; i < n; i++){ const s = HS_SCRATCH[i]; pushOut(m, s.x, s.y, s.z, p.hitSpheres[i].r); }
      } else if (p.radius){
        const pp = p.root.position;
        for (const m of live) pushOut(m, pp.x, pp.y, pp.z, p.radius);
      }
    }
  }

  // ---------- main tick ----------
  return {
    // test hooks: run the sim without pointer lock, drive aim/fire, read state
    _debugUnpause(){ paused = false; started = true; setMsg('', 0); },
    _debugPause(value = true){ paused = !!value; },
    _debugInput(o){
      if ('yaw' in o) camYaw = o.yaw;
      if ('bodyYaw' in o) player.yaw = o.bodyYaw;
      if ('pitch' in o) camPitch = o.pitch;
      if (o.position) player.root.position.set(o.position[0], o.position[1], o.position[2]);
      if (o.velocity) player.vel.set(o.velocity[0], o.velocity[1], o.velocity[2]);
      if ('fire' in o) mouseDown = o.fire;
      if ('fp' in o) firstPerson = o.fp;
      if ('view' in o){ firstPerson = !!o.view; buildViewGun(vgMeleeOverride); }
      if ('keys' in o){ keys.clear(); for (const k of o.keys) keys.add(k); }
      if ('hover' in o){ if (o.hover) keys.add('e'); else keys.delete('e'); }
      if ('blocking' in o) player.blocking = !!o.blocking;
      if ('weapon' in o){
        let wi = null;
        if (o.weapon === 'saber') wi = hasSaber ? SABER_SLOT : null;
        else {
          const requested = Math.trunc(o.weapon);
          if (Number.isFinite(requested)) wi = clamp(requested, 0, player.suit.weapons.length - 1);
        }
        if (wi !== null){
          if (wi !== player.wi) switchWeapon(wi);
          else if (wi !== SABER_SLOT) player.parts?.rebuildGun?.(wi);
          player.fireT = 0; player.reloadT = 0;
          if (wi !== SABER_SLOT){
            resetMuzzleCycle(player, wi);
            player.clip = player.suit.weapons[wi].clip;
          }
        }
      }
      if (o.reload && player.wi !== SABER_SLOT){
        player.reloadT = player.suit.weapons[player.wi].reload;
        player.clip = 0;
      }
      if (o.ready){
        player.fireT = 0; player.reloadT = 0; player.meleeT = 0;
        if (player.wi !== SABER_SLOT) player.clip = player.suit.weapons[player.wi].clip;
      }
      if (o.sandKick) trySandKick();
      if ('slash' in o) trySaber(typeof o.slash === 'string' ? o.slash : undefined);
    },
    _debugEnemy(index, o = {}){
      const enemy = mechs.filter(m => m.alive && !m.isPlayer && m.team === 'ZEON')[index];
      if (!enemy) return false;
      if (o.position) enemy.root.position.set(o.position[0], o.position[1], o.position[2]);
      if (o.velocity) enemy.vel.set(o.velocity[0], o.velocity[1], o.velocity[2]);
      if ('yaw' in o) enemy.yaw = o.yaw;
      if ('hp' in o) enemy.hp = clamp(o.hp, 1, enemy.maxHp);
      if ('blocking' in o) enemy.blocking = !!o.blocking;
      if ('fuel' in o) enemy.fuel = clamp(o.fuel, 0, enemy.maxFuel);
      if ('freezeAi' in o && enemy.ai){
        enemy.ai.target = null;
        enemy.ai.tThink = o.freezeAi ? 9999 : 0;
        if (o.freezeAi) enemy.vel.set(0, 0, 0);
      }
      if ('targetPlayer' in o && enemy.ai){
        enemy.ai.target = o.targetPlayer ? player : null;
        enemy.ai.tThink = o.targetPlayer ? 9999 : 0;
      }
      if (o.meleePlayer && enemy.suit.saber?.dmg > 0){
        enemy.meleeT = 0.6; enemy.bladeT = 0.45; enemy.swingT = 0.4;
        enemy.swingDuration = 0.4; enemy.swingKind = 'diagonal';
        enemy.swingDir = -(enemy.swingDir || 1);
        queueAIMeleeContact(enemy, player, enemy.suit.saber.dmg * 0.55, 32);
      }
      if ('weapon' in o){
        const wi = clamp(Math.trunc(o.weapon), 0, enemy.suit.weapons.length - 1);
        enemy.wi = wi; enemy.clip = enemy.suit.weapons[wi].clip; enemy.reloadT = 0;
        resetMuzzleCycle(enemy, wi); enemy.parts?.rebuildGun?.(wi);
      }
      if (o.ready){ enemy.fireT = 0; enemy.reloadT = 0; enemy.meleeT = 0; enemy.clip = enemy.suit.weapons[enemy.wi].clip; }
      if (SPACE && enemy.ai && enemy.suit.commander && enemy.suit.spaceDoctrine){
        const target = enemy.ai.target || player;
        const range = enemy.root.position.distanceTo(target.root.position);
        commanderSpaceIntent(enemy, target, range, 0);
        const s = enemy.ai.commanderSpace;
        if (o.phase){
          s.phase = o.phase; s.phaseT = o.phaseT || 0; s.phaseLimit = o.phaseLimit || 999;
          if (o.phase === 'breakaway') s.breakDir.copy(s.radial).multiplyScalar(-0.75)
            .addScaledVector(s.tangent, 0.9).addScaledVector(s.binormal, 0.55).normalize();
          if (o.phase === 'thrust_feint') s.breakDir.copy(s.tangent).multiplyScalar(0.78)
            .addScaledVector(s.radial, 0.55).addScaledVector(s.binormal, 0.42).normalize();
        }
        if ('meleeCd' in o) s.meleeCd = o.meleeCd;
      }
      return true;
    },
    // static framed orbit view of the player suit for screenshots — runs no sim
    _debugView(theta = 0, dist = 26, h = 14){
      const p = player.root.position;
      player.root.visible = true;
      camera.position.set(p.x + Math.sin(theta) * dist, p.y + h, p.z + Math.cos(theta) * dist);
      camera.lookAt(p.x, p.y + 9, p.z);
      camera.fov = 40; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
    _debugState(){
      const selectedWeapon = player.suit.weapons[player.wi];
      const activeMuzzle = selectedWeapon ? activeMuzzleNode(player) : null;
      const muzzleWorld = activeMuzzle ? activeMuzzle.getWorldPosition(new THREE.Vector3())
        : selectedWeapon ? approximateMuzzle(player, selectedWeapon)
        : player.parts?.blade ? player.parts.blade.getWorldPosition(new THREE.Vector3()) : player.root.position.clone();
      let lastPlayerProjectile = null;
      for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].owner === player){ lastPlayerProjectile = projectiles[i]; break; }
      const hoverJetSample = particles.find(pt => pt.kind === 'hoverJet') || null;
      const hoverJetOrigins = particles
        .filter(pt => pt.kind === 'hoverJet' && pt.origin)
        .slice(0, 2)
        .map(pt => pt.origin.toArray());
      const cockpitRoleCounts = {};
      cockpitInterior.traverse(o => {
        const role = o.userData?.cockpitPart;
        if (role) cockpitRoleCounts[role] = (cockpitRoleCounts[role] || 0) + 1;
      });
      const terrainY = SPACE ? null : groundY(player.root.position.x, player.root.position.z);
      return {
        kills, playerHp: player.hp, cam: camera.position.toArray(), env, space: SPACE, paused,
        pvp: {
          enabled: PVP,
          role: multiplayer?.role || null,
          connected: !!pvpLink?.connected,
          readyState: pvpLink?.readyState || null,
          connectionState: pvpLink?.connectionState || null,
          localSeq: pvpLocalSeq,
          remoteSeq: pvpRemoteSeq,
          lastSnapshotAge: pvpLastSnapshotAt ? (performance.now() - pvpLastSnapshotAt) / 1000 : null,
          lastMessageAge: pvpLastMessageAt ? (performance.now() - pvpLastMessageAt) / 1000 : null,
          shotsSent: pvpShotsSent,
          shotsReceived: pvpShotsReceived,
          hitsSent: pvpHitsSent,
          hitsReceived: pvpHitsReceived,
          forfeit: pvpForfeit,
          listenersAttached: pvpListenersAttached,
          disconnectedAge: pvpDisconnectedAt ? (performance.now() - pvpDisconnectedAt) / 1000 : null,
        },
        pvpRemote: networkRemote ? {
          id: networkRemote.suit.id,
          name: networkRemote.name,
          alive: networkRemote.alive,
          hp: networkRemote.hp,
          maxHp: networkRemote.maxHp,
          position: networkRemote.root.position.toArray(),
          targetPosition: networkRemote.netTargetPosition?.toArray() || null,
          velocity: networkRemote.vel.toArray(),
          yaw: networkRemote.yaw,
          aimYaw: networkRemote.netAimYaw ?? null,
          aimPitch: networkRemote.netAimPitch ?? null,
          weaponIndex: networkRemote.wi,
          saberEquipped: !!networkRemote.networkSaberEquipped,
          blocking: !!networkRemote.blocking,
        } : null,
        playerSuitId: player.suit.id, playerStyle: player.suit.style,
        firstPerson, viewGunChildren: viewGun.children.length, playerRootVisible: player.root.visible,
        viewMeleeOverride: vgMeleeOverride, viewShowsSaber: player.wi === SABER_SLOT || vgMeleeOverride,
        pYaw: +player.yaw.toFixed(3), camYawDbg: +camYaw.toFixed(3), pRotY: +player.root.rotation.y.toFixed(3),
        weaponIndex: player.wi, weaponName: selectedWeapon?.name || (player.wi === SABER_SLOT ? player.suit.saber.name : null),
        weaponIsHeld: !!player.parts?.weaponIsHeld,
        bladeVisible: !!player.parts?.blade?.visible, gunVisible: !!player.parts?.gun?.visible,
        pMeleeT: player.meleeT, pBladeT: player.bladeT, pReloadT: player.reloadT,
        pSwingT: player.swingT, pSwingDuration: player.swingDuration,
        pSwingProgress: player.swingProgress || 0, pSwingKind: player.swingKind,
        pSwingDir: player.swingDir, pSwingHitResolved: !!player.swingHitResolved,
        pLastSlashKind: player.lastSlashKind || null, pLastSlashHits: player.lastSlashHits || 0,
        pMeleeHits: player.meleeHits || 0, pSlashCounts: { ...player.slashCounts },
        armRRotation: player.parts?.armR
          ? [player.parts.armR.rotation.x, player.parts.armR.rotation.y, player.parts.armR.rotation.z].map(v => +v.toFixed(4))
          : null,
        armRWorld: player.parts?.armR ? player.parts.armR.getWorldPosition(new THREE.Vector3()).toArray() : null,
        gunWorld: player.parts?.gun ? player.parts.gun.getWorldPosition(new THREE.Vector3()).toArray() : null,
        muzzleWorld: muzzleWorld.toArray(),
        lastShotMuzzle: player.lastMuzzleWorld?.toArray() || null,
        lastPlayerProjectile: lastPlayerProjectile ? lastPlayerProjectile.pos.toArray() : null,
        projectileMuzzleDelta: lastPlayerProjectile && player.lastMuzzleWorld ? lastPlayerProjectile.pos.distanceTo(player.lastMuzzleWorld) : null,
        turretYaw: player.parts?.turretYaw ? +player.parts.turretYaw.rotation.y.toFixed(4) : null,
        turretPitch: player.parts?.turret ? +player.parts.turret.rotation.x.toFixed(4) : null,
        wheelRotations: (player.parts?.wheels || []).map(w => +w.rotation.x.toFixed(4)),
        eyeWorld: player.parts && player.parts.eye ? player.parts.eye.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)) : null,
        pFuel: player.fuel, pMaxFuel: player.maxFuel, pY: player.root.position.y,
        pPosition: player.root.position.toArray(), pVel: player.vel.toArray(),
        pShieldHp: player.shieldHp, pShieldMax: player.shieldMax, pShieldBroken: player.shieldBroken, pBlocking: player.blocking,
        pBlockPose: player.blockPose || 0,
        groundManeuverEligible: groundManeuverEligible(player),
        landTypeMobileSuit: landTypeMobileSuit(player),
        groundClearance: terrainY === null ? null : player.root.position.y - terrainY,
        pHovering: !!player.hovering, pGroundHoverBlend: player.groundHoverBlend || 0,
        pHoverTravelMultiplier: player.hoverTravelMultiplier || (landTypeMobileSuit(player) ? 3 : 2),
        pHoverEnergyMultiplier: player.hoverEnergyMultiplier || (landTypeMobileSuit(player) ? 0.8 : 1),
        pHoverFuelDrain: player.hoverFuelDrain || (landTypeMobileSuit(player) ? 6.4 : 8),
        pHoverTargetSpeed: player.hoverTargetSpeed || 0,
        pHorizontalSpeed: Math.hypot(player.vel.x, player.vel.z),
        pHoverJetParticles: particles.filter(pt => pt.kind === 'hoverJet').length,
        pHoverJetEmitted: player.hoverJetEmitted || 0,
        pHoverJetOrigins: hoverJetOrigins,
        pHoverJetSample: hoverJetSample ? {
          origin: hoverJetSample.origin?.toArray() || null,
          position: hoverJetSample.mesh.position.toArray(),
          velocity: hoverJetSample.vel.toArray(),
          acceleration: hoverJetSample.accel.toArray(),
          life: hoverJetSample.life,
        } : null,
        pLegLRotation: player.parts?.legL
          ? [player.parts.legL.rotation.x, player.parts.legL.rotation.y, player.parts.legL.rotation.z].map(v => +v.toFixed(4))
          : null,
        pLegRRotation: player.parts?.legR
          ? [player.parts.legR.rotation.x, player.parts.legR.rotation.y, player.parts.legR.rotation.z].map(v => +v.toFixed(4))
          : null,
        pRootPitch: +player.root.rotation.x.toFixed(4),
        pSandKickT: player.sandKickT || 0, pSandKickCd: player.sandKickCd || 0,
        pSandKickDir: player.sandKickDir?.toArray() || null,
        cockpitVisible: !cockpitEl.classList.contains('hidden'),
        cockpitMeshVisible: cockpitInterior.visible, cockpitMeshChildren: cockpitInterior.children.length,
        cockpitRoleCounts, cockpitScale: cockpitInterior.scale.toArray(),
        cameraFov: camera.fov, cameraAspect: camera.aspect,
        viewShieldVisible: viewShield.visible,
        viewShieldSide: viewShield.userData.screenSide || 'left',
        viewShieldPosition: viewShield.position.toArray(),
        viewShieldRotation: viewShield.rotation.toArray().slice(0, 3),
        killFeed: Array.from(killFeedEl.children, row => row.textContent),
        particleCount: particles.length,
        player: player.root.position.toArray(),
        enemies: mechs.filter(m => m.alive && !m.isPlayer && m.team === 'ZEON')
          .map((m, index) => {
            const s = m.ai?.commanderSpace;
            const target = m.ai?.target;
            let targetRange = null, radialSpeed = null;
            if (target?.alive){
              const radial = target.root.position.clone().sub(m.root.position);
              targetRange = radial.length();
              radialSpeed = targetRange > 0 ? m.vel.dot(radial.multiplyScalar(1 / targetRange)) : 0;
            }
            return {
              index, id: m.suit.id, specAce: !!m.ace, commander: !!m.suit.commander,
              networkRemote: !!m.networkRemote,
              doctrine: m.suit.spaceDoctrine || null,
              p: m.root.position.toArray(), v: m.vel.toArray(), yaw: m.yaw,
              hp: m.hp, vip: m.vip, fuel: m.fuel, boosting: m.boosting,
              weaponIndex: m.wi, weaponName: m.suit.weapons[m.wi]?.name, clip: m.clip,
              phase: s?.phase || null, phaseT: s?.phaseT || 0, phaseLimit: s?.phaseLimit || 0,
              phaseSide: s?.side || null, phaseUp: s?.up || null,
              passes: s?.passes || 0, feints: s?.feints || 0,
              shotsFired: m.shotsFired || 0, meleeHits: m.meleeHits || 0,
              tacticMeleeHits: s?.meleeHits || 0,
              meleeT: m.meleeT, bladeT: m.bladeT, swingT: m.swingT,
              pendingMeleeT: m.pendingMelee?.t ?? null,
              targetRange, radialSpeed, targetingPlayer: target === player,
            };
          }),
        wing: mechs.filter(m => m.wingId !== undefined)
          .map(m => ({ wingId: m.wingId, alive: m.alive, hp: m.hp })),
        props: props.map(p => ({ kind: p.kind, team: p.team, p: p.root.position.toArray(),
          rotY: +p.root.rotation.y.toFixed(3), isShip: p.isShip,
          hp: p.hp, alive: p.alive, arrived: p.arrived, escaped: p.escaped })),
        missionType: mission.type, missionT, outcome, ended, wavesQueued: waveQueue.length,
        nFed: mechs.filter(m => m.alive && m.team === 'FED' && !m.isPlayer).length,
        nFedTanks: mechs.filter(m => m.alive && m.team === 'FED' && (m.suit.style === 'tank' || m.suit.style === 'apc')).length,
        nZeonTanks: mechs.filter(m => m.alive && m.team === 'ZEON' && (m.suit.style === 'tank' || m.suit.style === 'apc')).length,
        reserves: { fed: fedReserve.length, zeon: zeonReserve.length },
        troops: { fed: infantry.aliveF, zeon: infantry.aliveZ },
        projCount: projectiles.length,
        fedAir: mechs.filter(m => m.alive && m.air && m.team === 'FED').length,
        zeonAir: mechs.filter(m => m.alive && m.air && m.team === 'ZEON').length,
        fedAirHp: mechs.filter(m => m.alive && m.air && m.team === 'FED').reduce((a, m) => a + m.hp, 0),
        zeonAirHp: mechs.filter(m => m.alive && m.air && m.team === 'ZEON').reduce((a, m) => a + m.hp, 0),
        meleeRuns: mechs.filter(m => m.alive && m.ai && m.ai.meleeRun).length,
        charging: mechs.filter(m => m.alive && m.ai && m.ai.meleeRun && m.ai.meleeRun.phase === 'charge').length,
        targetingPlayer: mechs.filter(m => m.alive && m.team === 'ZEON' && m.ai && m.ai.target === player).length,
      };
    },
    update(dt){
      dt = Math.min(dt, 0.05);
      if (!paused && !ended){
        updatePrediction(dt); // P aim-assist: maintain the 0.5s lock before the player fires
        playerUpdate(dt);
        lodTimer -= dt;
        if (lodTimer <= 0){ lodRepartition(); lodTimer = 0.2; } // re-pick the near set ~5x/sec
        for (let i = 0, n = mechs.length; i < n; i++) mechUpdate(mechs[i], dt); // cached length: carrier-dropped mechs join next frame, not mid-loop
        resolveCollisions(dt); // solid bodies: nothing walks through anything
        projectilesUpdate(dt);
        particlesUpdate(dt);
        blipsUpdate(dt);
        missionUpdate(dt);
        supportUpdate(dt);
        pvpConnectionWatchdog();
        pvpStateUpdate(dt);
        checkEnd(dt);
        lodWriteInstances(); // refresh far-mech instance transforms every frame
      }
      if (ended) return; // scene may already be disposed by onEnd
      for (const a of spinners) a.rotation.y += a.userData.spin * dt;
      hudUpdate(dt);
      cameraUpdate(paused ? 0.016 : dt);
      renderer.render(scene, camera);
      drawHudOverlay(); // lock reticle + hit-prediction overlay on top of the rendered frame
    },
    resize(w, h){
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      sizeLockon();
    },
    dispose(){
      detachPvpListeners();
      if (!ended){ removeListeners(); hud.classList.add('hidden'); ended = true; }
      for (const pool of detailPool.values()) for (const d of pool) disposeDetailRoot(d.root);
      detailPool.clear();
      scene.traverse(o => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); // never free the shared lite-mech geo
        if (o.material){
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      hoverJetGeo.dispose(); hoverJetMatF.dispose(); hoverJetMatZ.dispose();
    },
  };
}
