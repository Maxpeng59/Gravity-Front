// Canonical One Year War Zeon ground-unit meshes.
//
// Contract:
//   * unscaled geometry (the caller applies suit.scale)
//   * +Z is forward and the lowest contact point is y=0
//   * humanoid limbs remain separate shoulder/hip pivots for battle animation
//   * only static detail subgroups are compacted
import {
  THREE, box, cyl, cone, sph, chamferBox, profile, ribbedCable,
  materialSet, boltRing, addThruster, instancedTrack, compactGroup,
} from './model-kit.js';

const PI = Math.PI;
const V3 = THREE.Vector3;

const supported = new Set([
  'zaku2', 'zaku2b', 'zaku2g', 'zaku2s', 'zakutank',
  'gouf', 'goufnh', 'dom', 'gelgoog', 'gelgoogs', 'magella', 'weasel', 'acguy',
]);

// Paint follows the cited animation/model sheets, not the older gameplay placeholder palette.
// The J-type is the normal ground-use Zaku II, so it remains Zeon green; a tan Desert Type would
// require the MS-06D designation. Command variants use the distinctive Char palettes without gold.
const PALETTES = {
  zaku:         { main: 0x9aaa8f, chest: 0x3b3e46, accent: 0x66715e, trim: 0xaeb9a5 },
  charZaku:     { main: 0xd75d68, chest: 0x67262b, accent: 0xa72d31, trim: 0x393c42 },
  zakuTank:     { main: 0x4f5948, chest: 0x28302d, accent: 0x68715d, trim: 0x8b9185 },
  gouf:         { main: 0x2869a9, chest: 0x182b45, accent: 0x245181, trim: 0xd88a2d },
  goufCustom:   { main: 0x465666, chest: 0x1c2730, accent: 0x293b4c, trim: 0x8a9296 },
  dom:          { main: 0x756594, chest: 0x202129, accent: 0x34313f, trim: 0xa5a7ad },
  gelgoog:      { main: 0x66745f, chest: 0x404b41, accent: 0x555c64, trim: 0x70787a },
  charGelgoog:  { main: 0xd25a64, chest: 0x65131c, accent: 0xad2733, trim: 0xe07c84 },
  magella:      { main: 0x64764a, chest: 0x435139, accent: 0x7c8b5c, trim: 0x9b9d8c },
  weasel:       { main: 0x4d5d40, chest: 0x2c382c, accent: 0x6b5139, trim: 0xa5a795 },
  acguy:        { main: 0x8a705e, chest: 0x4b111b, accent: 0x6d5248, trim: 0x999ba5 },
};

function palette(key, supplied){
  const P = materialSet(PALETTES[key], true);
  if (supplied){
    P.eye = supplied.eye || P.eye;
    P.flame = supplied.flame || P.flame;
    P.blade = supplied.blade || P.blade;
    P.heat = supplied.heat || P.heat;
    P.gold = supplied.gold || P.gold;
  }
  return P;
}

function mats(M){
  return {
    ...M,
    frame: M.frame || M.dark,
    joint: M.joint || M.dark,
    glass: M.glass || M.dark,
    heat: M.heat || M.gold || M.trim,
    blade: M.blade || M.trim,
    flame: M.flame || M.heat || M.trim,
  };
}

function fwdCyl(rt, rb, len, material, x = 0, y = 0, z = 0, seg = 14){
  const mesh = cyl(rt, rb, len, material, x, y, z, seg);
  mesh.rotation.x = PI / 2; return mesh;
}

function sideCyl(rt, rb, len, material, x = 0, y = 0, z = 0, seg = 14){
  const mesh = cyl(rt, rb, len, material, x, y, z, seg);
  mesh.rotation.z = PI / 2; return mesh;
}

function between(a, b, radius, material, seg = 10){
  const av = a.isVector3 ? a : new V3(...a), bv = b.isVector3 ? b : new V3(...b);
  const d = new V3().subVectors(bv, av), mesh = cyl(radius, radius, d.length(), material, 0, 0, 0, seg);
  mesh.position.copy(av).add(bv).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return mesh;
}

function hiddenAnchor(){
  const anchor = new THREE.Object3D(); anchor.visible = false; return anchor;
}

function groundChildren(root){
  root.updateMatrixWorld(true);
  const minY = new THREE.Box3().setFromObject(root).min.y;
  if (Number.isFinite(minY) && Math.abs(minY) > 1e-5)
    for (const child of root.children) child.position.y -= minY;
  return Number.isFinite(minY) ? minY : 0;
}

function completeParts(M){
  return {
    flames: [], legL: null, legR: null, armL: null, armR: null, gun: null,
    eyeMat: M.eye, rebuildGun: () => {},
  };
}

function addPanelBolts(parent, material, x, y, z, dx, dy, countX = 2, countY = 2){
  for (let ix = 0; ix < countX; ix++) for (let iy = 0; iy < countY; iy++){
    const px = x + (ix / Math.max(1, countX - 1) - 0.5) * dx;
    const py = y + (iy / Math.max(1, countY - 1) - 0.5) * dy;
    parent.add(fwdCyl(0.07, 0.07, 0.12, material, px, py, z, 7));
  }
}

function zeonArm(M, sx, options = {}){
  const arm = new THREE.Group();
  const stat = new THREE.Group();
  const armor = options.armor || M.main;

  stat.add(sph(0.88, M.joint, 0, 0.05, 0, 14, 9));
  stat.add(cyl(0.83, 0.98, 2.65, armor, 0, -1.65, 0, 12));
  stat.add(sideCyl(0.62, 0.62, 1.75, M.joint, 0, -3.25, 0, 12));
  stat.add(chamferBox(1.82, 2.55, 1.9, armor, 0, -4.72, 0, 0.16));
  stat.add(chamferBox(1.18, 1.05, 1.35, M.joint, 0, -6.15, 0.05, 0.12));
  stat.add(chamferBox(1.25, 0.72, 1.42, M.dark, 0, -6.55, 0.2, 0.1));
  for (let i = -1; i <= 1; i++) stat.add(box(0.25, 0.17, 0.72, M.frame, i * 0.33, -6.72, 0.52));
  if (options.forearmPlate){
    const plate = chamferBox(1.35, 1.75, 0.3, options.forearmPlate, 0, -4.65, 1.08, 0.08);
    stat.add(plate);
  }
  arm.add(compactGroup(stat));
  return arm;
}

function zeonLeg(M, sx, options = {}){
  const leg = new THREE.Group(), stat = new THREE.Group();
  const thigh = options.thigh || M.main, shin = options.shin || M.main;
  const wide = options.wide || 1;
  stat.add(sph(0.92 * wide, M.joint, 0, 0, 0, 14, 10));
  stat.add(cyl(1.0 * wide, 1.2 * wide, 3.15, thigh, 0, -1.82, 0, 12));
  stat.add(sideCyl(0.67, 0.67, 1.95 * wide, M.joint, 0, -3.68, 0, 12));
  stat.add(chamferBox(1.55 * wide, 1.0, 0.45, options.knee || M.accent, 0, -3.62, 1.18, 0.1));
  stat.add(cyl(1.16 * wide, 1.52 * wide, 3.45, shin, 0, -5.62, -0.02, 13));
  stat.add(chamferBox(1.58 * wide, 2.35, 0.38, options.calf || M.main, 0, -5.75, 1.43 * wide, 0.09));
  stat.add(chamferBox(1.45 * wide, 1.05, 1.75, M.joint, 0, -7.58, 0.08, 0.12));
  stat.add(profile([
    [-1.6, -9.25], [2.55, -9.25], [2.82, -8.48], [2.2, -7.78],
    [-1.45, -7.68], [-1.82, -8.32],
  ], [], 2.55 * wide, M.dark));
  stat.add(profile([
    [0.0, -8.95], [2.72, -8.95], [2.55, -8.22], [1.86, -7.83], [0.05, -7.86],
  ], [], 2.3 * wide, options.toe || M.main, 0, 0.12, 0));

  // The Zaku/Gouf family carries a conspicuous external hydraulic line down each outer calf.
  if (options.cable !== false){
    const ox = sx * 1.12 * wide;
    stat.add(ribbedCable([
      [sx * 0.78, -3.65, -0.15], [ox, -4.55, -0.62],
      [ox, -6.15, -0.35], [sx * 0.75, -7.25, 0.25],
    ], 0.19, M.frame, M.dark, 12));
  }
  leg.add(compactGroup(stat));
  return leg;
}

function monoHead(M, options = {}){
  const head = new THREE.Group(), stat = new THREE.Group();
  const gelgoog = !!options.gelgoog;
  if (gelgoog){
    const dome = sph(1.35, M.main, 0, 0.25, -0.1, 20, 12); dome.scale.set(1.0, 1.08, 1.1); stat.add(dome);
    stat.add(chamferBox(1.72, 0.78, 1.45, M.main, 0, -0.7, 0.72, 0.13));
    stat.add(chamferBox(1.28, 0.52, 1.14, M.dark, 0, -0.78, 1.36, 0.1));
    stat.add(box(2.05, 0.42, 0.48, M.dark, 0, 0.06, 1.12));
    const fin = profile([[-0.45, 0.75], [0.45, 2.25], [0.72, 0.72]], [], 0.18, M.accent, 0, 0, -0.12);
    stat.add(fin);
    if (options.commander){
      const horn = profile([[-0.05, 0.78], [0.18, 2.15], [0.38, 0.75]], [], 0.13, M.main, 0.15, 0, 0.72);
      horn.rotation.y = -0.22; stat.add(horn);
    }
  } else {
    const dome = sph(1.35, M.main, 0, 0.3, -0.08, 20, 12); dome.scale.set(1.1, 0.95, 1.08); stat.add(dome);
    stat.add(cyl(1.23, 1.08, 1.12, M.main, 0, -0.35, 0, 16));
    stat.add(box(2.18, 0.48, 0.46, M.dark, 0, 0.04, 1.08));
    const brow = chamferBox(2.05, 0.38, 0.68, M.main, 0, 0.42, 1.05, 0.1); brow.rotation.x = 0.2; stat.add(brow);
    stat.add(chamferBox(1.48, 0.72, 0.95, M.main, 0, -0.72, 1.0, 0.12));
    stat.add(box(1.3, 0.5, 0.22, M.dark, 0, -0.77, 1.53));
    for (const yy of [-0.62, -0.79, -0.96]) stat.add(box(1.0, 0.055, 0.12, M.frame, 0, yy, 1.67));
    for (const sx of [-1, 1]){
      stat.add(sideCyl(0.38, 0.38, 0.34, M.dark, sx * 1.25, -0.14, 0.28, 12));
      stat.add(ribbedCable([
        [sx * 1.2, -0.08, 0.35], [sx * 1.38, -0.38, 0.78],
        [sx * 1.13, -0.86, 1.16], [sx * 0.7, -0.93, 1.42],
      ], 0.2, M.main, M.dark, 9));
    }
    if (options.commander || options.gouf){
      const horn = profile([[-0.18, 0.82], [0.02, 2.3], [0.35, 0.86]], [], 0.14, M.main, 0, 0, 0.08);
      horn.rotation.x = options.gouf ? -0.12 : 0.04; stat.add(horn);
    }
  }
  head.add(compactGroup(stat));
  const lens = fwdCyl(0.29, 0.29, 0.2, M.eye, 0, 0.04, 1.32, 14);
  head.add(lens);
  const eye = new THREE.Object3D(); eye.position.set(0, 0.04, 1.75); head.add(eye);
  return { head, eye, monoeye: lens };
}

function addBackThrusters(root, parts, M, y, z, xs = [-0.9, 0.9], radius = 0.48){
  for (const x of xs) addThruster(root, parts, M.frame, M.flame, x, y, z, radius, 2.25, 'rear');
}

function makeZakuShoulderShield(M){
  const shield = new THREE.Group(), stat = new THREE.Group();
  stat.add(chamferBox(0.72, 4.25, 3.45, M.main, 0, 0, 0, 0.18));
  stat.add(chamferBox(0.28, 3.5, 2.8, M.accent, 0.47, 0, 0, 0.1));
  stat.add(box(0.22, 3.55, 0.18, M.dark, 0.66, 0, 0));
  addPanelBolts(stat, M.frame, 0.7, 0, 1.18, 0, 2.5, 1, 3);
  shield.add(compactGroup(stat)); return shield;
}

function makeGoufShield(M, custom = false){
  const shield = new THREE.Group(), stat = new THREE.Group();
  const points = custom
    ? [[-1.9, -3.4], [1.65, -3.0], [2.0, 2.6], [1.25, 3.4], [-1.35, 3.15], [-2.05, 2.25]]
    : [[-1.55, -3.05], [1.6, -2.55], [1.9, 2.1], [0.95, 3.0], [-1.0, 2.75], [-1.75, 1.7]];
  stat.add(profile(points, [], custom ? 0.72 : 0.62, custom ? M.chest : M.main));
  stat.add(profile(points.map(([z, y]) => [z * 0.82, y * 0.84]), [], 0.18, M.accent, 0.38, 0, 0));
  stat.add(sideCyl(0.28, 0.28, 1.05, M.frame, -0.42, 0.5, 0, 10));
  addPanelBolts(stat, M.frame, 0.48, 0.3, 1.0, 0, 3.5, 1, 4);
  shield.add(compactGroup(stat)); return shield;
}

function makeGelgoogShield(M){
  const shield = new THREE.Group(), stat = new THREE.Group();
  const rim = sph(3.05, M.dark, 0, 0, 0, 24, 16); rim.scale.set(0.22, 1.0, 0.68); stat.add(rim);
  const face = sph(2.82, M.accent, 0.32, 0.05, 0, 24, 16); face.scale.set(0.18, 1.0, 0.66); stat.add(face);
  stat.add(sideCyl(0.45, 0.45, 0.55, M.frame, 0.55, 0.15, 0, 12));
  stat.add(box(0.18, 4.35, 0.26, M.main, 0.87, 0, 0));
  for (const yy of [-1.85, 1.85]) stat.add(fwdCyl(0.09, 0.09, 0.16, M.frame, 0.75, yy, 0, 7));
  shield.add(compactGroup(stat)); return shield;
}

function makeBeamNaginata(M){
  const blade = new THREE.Group();
  blade.add(fwdCyl(0.19, 0.19, 2.3, M.frame, 0, 0, 0, 10));
  blade.add(fwdCyl(0.29, 0.24, 0.35, M.trim, 0, 0, 1.25, 10));
  blade.add(fwdCyl(0.29, 0.24, 0.35, M.trim, 0, 0, -1.25, 10));
  blade.add(fwdCyl(0.3, 0.08, 5.8, M.blade, 0, 0, 4.25, 12));
  blade.add(fwdCyl(0.08, 0.3, 5.8, M.blade, 0, 0, -4.25, 12));
  blade.visible = false; return blade;
}

function buildZaku(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = { flames: [] };
  const ground = suit.id === 'zaku2g', commander = suit.id === 'zaku2s';
  const stat = new THREE.Group();

  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = zeonLeg(M, sx, {
      thigh: M.main, shin: M.main, knee: M.accent, calf: ground ? M.chest : M.main,
    });
    leg.position.set(sx * 1.75, 9.25, 0); root.add(leg); parts[key] = leg;
    // J-type replaces the F-type's rear calf apogee hardware with simple armor plates.
    if (!ground){
      const pod = new THREE.Group(); pod.position.set(sx * 1.75, 3.55, -1.25);
      pod.add(fwdCyl(0.23, 0.34, 0.55, M.frame, 0, 0, 0, 9)); root.add(pod);
    }
  }

  stat.add(cyl(2.55, 2.95, 1.65, M.chest, 0, 10.15, 0, 14));
  stat.add(chamferBox(4.35, 1.65, 2.7, M.chest, 0, 10.55, 0.15, 0.18));
  stat.add(profile([[-1.25, 9.2], [1.45, 9.2], [1.65, 11.0], [-1.4, 11.0]], [], 1.6, M.main, -2.45));
  stat.add(profile([[-1.25, 9.2], [1.45, 9.2], [1.65, 11.0], [-1.4, 11.0]], [], 1.6, M.main, 2.45));
  stat.add(chamferBox(2.65, 1.65, 0.46, M.main, 0, 10.2, 1.72, 0.1));
  stat.add(chamferBox(2.55, 1.35, 0.38, M.main, 0, 10.25, -1.55, 0.08));

  stat.add(chamferBox(5.25, 3.45, 3.1, M.chest, 0, 13.05, 0, 0.3));
  for (const sx of [-1, 1]) stat.add(chamferBox(1.35, 2.9, 2.7, M.main, sx * 2.35, 13.15, 0.12, 0.22));
  const chest = chamferBox(3.95, 1.55, 0.72, M.main, 0, 13.65, 1.66, 0.16); chest.rotation.x = -0.14; stat.add(chest);
  stat.add(chamferBox(1.48, 1.3, 0.34, M.accent, 0, 12.25, 1.72, 0.1));
  stat.add(box(3.25, 0.58, 2.25, M.main, 0, 15.0, 0));
  for (const sx of [-1, 1]) for (const yy of [13.25, 13.75])
    stat.add(box(0.72, 0.16, 0.22, M.dark, sx * 1.52, yy, 1.81));

  // Waist and torso power transmission pipes are one of the frame's defining shapes.
  stat.add(ribbedCable([
    [-2.65, 10.75, 0.85], [-3.0, 10.72, 0], [-2.5, 10.72, -1.05],
    [0, 10.72, -1.45], [2.5, 10.72, -1.05], [3.0, 10.72, 0], [2.65, 10.75, 0.85],
  ], 0.25, M.frame, M.dark, 22));
  stat.add(ribbedCable([
    [-1.85, 14.15, 1.3], [-2.15, 14.7, 0.7], [-1.55, 15.1, 0.1],
    [1.55, 15.1, 0.1], [2.15, 14.7, 0.7], [1.85, 14.15, 1.3],
  ], 0.22, M.frame, M.dark, 16));
  stat.add(chamferBox(3.25, 2.65, 1.45, M.dark, 0, 13.45, -2.05, 0.18));
  stat.add(box(2.45, 0.34, 0.18, M.frame, 0, 13.55, -2.85));
  root.add(compactGroup(stat));

  addBackThrusters(root, parts, M, 12.75, -2.9, [-0.86, 0.86], 0.43);

  const mh = monoHead(M, { commander }); mh.head.position.set(0, 16.15, 0);
  root.add(mh.head); parts.head = mh.head; parts.eye = mh.eye; parts.monoeye = mh.monoeye; parts.eyeMat = M.eye;

  const armL = zeonArm(M, 1), armR = zeonArm(M, -1);
  armL.position.set(3.6, 14.45, 0); armR.position.set(-3.6, 14.45, 0);
  // Canonical asymmetry: the slab shield and weapon hand are both on the machine's right (-X);
  // the three-spike pauldron is on its left (+X).
  const shoulderShield = makeZakuShoulderShield(M); shoulderShield.position.set(-1.1, 0.55, 0); shoulderShield.rotation.z = 0.1;
  armR.add(shoulderShield); parts.shield = shoulderShield; parts.shieldKind = 'native'; parts.guardArm = armR;
  const pauldron = new THREE.Group(), ps = new THREE.Group();
  const shell = sph(1.75, M.accent, 0.2, 0.65, 0, 18, 12); shell.scale.set(1.0, 0.92, 1.02); ps.add(shell);
  const top = cone(0.31, 1.25, M.accent, 0.25, 2.2, 0, 10); ps.add(top);
  const side = cone(0.34, 1.35, M.accent, 1.75, 0.9, 0, 10); side.rotation.z = -PI / 2; ps.add(side);
  for (const zz of [-0.92, 0.92]){ const spike = cone(0.27, 1.0, M.accent, 0.35, 1.25, zz, 10); spike.rotation.x = zz > 0 ? -1.05 : 1.05; ps.add(spike); }
  pauldron.add(compactGroup(ps)); armL.add(pauldron);
  root.add(armL, armR); parts.armL = armL; parts.armR = armR;

  return {
    root, parts, kind: 'humanoid', allowDefaultShield: false,
    weaponMount: [0, -6.42, 0.72], meleeMount: [0, -6.42, 0.62],
  };
}

function buildGouf(suit, rawM, custom){
  const M = mats(rawM), root = new THREE.Group(), parts = { flames: [], fixedWeapon: true, weaponIsHeld: false };
  const stat = new THREE.Group();
  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = zeonLeg(M, sx, { thigh: M.main, shin: custom ? M.main : M.chest, knee: M.accent, wide: 1.03 });
    leg.position.set(sx * 1.82, 9.25, 0); root.add(leg); parts[key] = leg;
  }

  stat.add(cyl(2.65, 3.15, 2.0, M.chest, 0, 10.25, 0, 15));
  stat.add(chamferBox(5.65, 3.5, 3.25, M.chest, 0, 13.0, 0, custom ? 0.18 : 0.28));
  for (const sx of [-1, 1]) stat.add(chamferBox(1.45, 3.0, 2.75, M.main, sx * 2.52, 13.1, 0.05, 0.2));
  const chest = chamferBox(4.35, 1.55, 0.75, custom ? M.chest : M.dark, 0, 13.65, 1.7, 0.14); chest.rotation.x = -0.15; stat.add(chest);
  for (const sx of [-1, 1]){
    const vent = profile([[-0.55, -0.52], [0.58, -0.35], [0.48, 0.48], [-0.38, 0.58]], [], 0.18, custom ? M.heat : M.gold,
      sx * 0.92, 12.05, 1.84);
    vent.rotation.z = sx * -0.15; stat.add(vent);
  }
  stat.add(chamferBox(1.45, 1.15, 0.35, M.main, 0, 12.15, 1.85, 0.08));
  stat.add(box(3.45, 0.62, 2.4, M.main, 0, 15.05, 0));
  stat.add(ribbedCable([
    [-2.8, 10.75, 0.75], [-3.2, 10.7, -0.2], [-2.35, 10.65, -1.15],
    [0, 10.62, -1.45], [2.35, 10.65, -1.15], [3.2, 10.7, -0.2], [2.8, 10.75, 0.75],
  ], 0.27, M.frame, M.dark, 24));
  stat.add(chamferBox(3.45, 2.8, 1.5, M.dark, 0, 13.35, -2.1, 0.18));
  if (custom){
    for (const sx of [-1, 1]) for (const yy of [12.2, 12.7, 13.2, 13.7, 14.2])
      stat.add(fwdCyl(0.06, 0.06, 0.15, M.frame, sx * 2.35, yy, 1.72, 7));
    stat.add(box(2.1, 0.2, 0.16, M.frame, 0, 14.45, 1.86));
  }
  root.add(compactGroup(stat));
  addBackThrusters(root, parts, M, 12.7, -3.0, [-0.9, 0.9], 0.46);

  const mh = monoHead(M, { gouf: true, commander: true }); mh.head.position.set(0, 16.15, 0);
  root.add(mh.head); parts.head = mh.head; parts.eye = mh.eye; parts.monoeye = mh.monoeye; parts.eyeMat = M.eye;

  const armL = zeonArm(M, 1, { armor: M.main, forearmPlate: custom ? M.chest : null });
  const armR = zeonArm(M, -1, { armor: M.main, forearmPlate: custom ? M.chest : null });
  armL.position.set(3.8, 14.45, 0); armR.position.set(-3.8, 14.45, 0);
  for (const [arm, sx] of [[armL, 1], [armR, -1]]){
    const pauldron = new THREE.Group(), ps = new THREE.Group();
    const shell = sph(custom ? 1.9 : 1.82, M.accent, 0, 0.65, 0, 20, 12); shell.scale.set(1.05, 0.78, 1.05); ps.add(shell);
    const spike = cone(custom ? 0.42 : 0.36, custom ? 1.85 : 1.55, M.accent, sx * 0.22, 2.2, 0, 12);
    spike.rotation.z = sx * -0.16; ps.add(spike);
    if (custom) boltRing(ps, M.frame, 'x', [sx * 1.33, 0.72, 0], 0.48, 0.06, 8);
    pauldron.add(compactGroup(ps)); arm.add(pauldron);
  }

  const muzzle = new THREE.Object3D(); parts.muzzle = muzzle;
  if (!custom){
    // MS-07B: five left-hand gun barrels and the right-arm heat-rod projector.
    const hand = new THREE.Group(), hs = new THREE.Group(); hand.position.set(0, -6.55, 0.35);
    hs.add(chamferBox(1.35, 0.85, 1.4, M.main, 0, 0, 0, 0.1));
    const fingerXY = [[-0.45, -0.33], [-0.23, -0.43], [0, -0.48], [0.23, -0.43], [0.45, -0.33]];
    for (const [x, y] of fingerXY){
      hs.add(fwdCyl(0.11, 0.13, 1.45, M.frame, x, y, 0.7, 8));
      hs.add(fwdCyl(0.16, 0.16, 0.25, M.dark, x, y, 1.47, 8));
    }
    hand.add(compactGroup(hs)); armL.add(hand);
    const rodPort = new THREE.Group(); rodPort.position.set(0, -5.15, 1.28);
    rodPort.add(fwdCyl(0.42, 0.5, 0.75, M.frame, 0, 0, 0, 12)); armR.add(rodPort);
    hand.add(muzzle); muzzle.position.set(0, -0.4, 1.7);
    parts.aimArm = armL; parts.aimGun = hand;
    parts.rebuildGun = wi => {
      parts.weaponIsHeld = false; parts.aimIntegrated = false;
      (wi === 1 ? rodPort : hand).add(muzzle);
      parts.aimArm = wi === 1 ? armR : armL;
      parts.aimArms = [parts.aimArm];
      parts.aimGun = wi === 1 ? rodPort : hand;
      muzzle.position.set(0, wi === 1 ? 0 : -0.4, wi === 1 ? 0.57 : 1.7);
    };
    const shield = makeGoufShield(M, false); shield.position.set(1.55, -3.45, 0.2); shield.rotation.z = -0.08;
    armL.add(shield); parts.shield = shield; parts.shieldKind = 'native';
  } else {
    // MS-07B-3 Gouf Custom (RfV): three-barrel forearm gun under the full Gatling Shield.
    const shield = makeGoufShield(M, true); shield.position.set(1.65, -3.15, 0.15); shield.rotation.z = -0.06;
    const gatling = new THREE.Group(), gs = new THREE.Group(); gatling.position.set(0.25, -5.45, 0.65);
    gs.add(chamferBox(1.8, 1.35, 2.35, M.dark, 0, 0, 0.2, 0.14));
    const ring = [[0.48, 0], [0.24, 0.42], [-0.24, 0.42], [-0.48, 0], [-0.24, -0.42], [0.24, -0.42]];
    for (const [x, y] of ring){
      gs.add(fwdCyl(0.1, 0.1, 4.8, M.frame, x, y, 3.0, 8));
      gs.add(fwdCyl(0.16, 0.16, 0.35, M.dark, x, y, 5.42, 8));
    }
    gs.add(fwdCyl(0.46, 0.46, 0.42, M.frame, 0, 0, 5.3, 14));
    gatling.add(compactGroup(gs)); gatling.add(muzzle); muzzle.position.set(0, 0, 5.65);
    shield.add(gatling); armL.add(shield); parts.shield = shield; parts.shieldKind = 'native';

    const tri = new THREE.Group(), ts = new THREE.Group(); tri.position.set(0, -5.15, 0.68);
    for (const x of [-0.34, 0, 0.34]) ts.add(fwdCyl(0.1, 0.12, 2.35, M.frame, x, 0, 1.17, 8));
    tri.add(compactGroup(ts)); armL.add(tri);
    armR.add(fwdCyl(0.36, 0.46, 0.8, M.frame, 0, -5.05, 1.28, 12));
    parts.aimArm = armL; parts.aimGun = gatling;
    parts.rebuildGun = wi => {
      parts.weaponIsHeld = false; parts.aimIntegrated = false;
      (wi === 1 ? tri : gatling).add(muzzle);
      parts.aimArm = armL; parts.aimArms = [armL];
      parts.aimGun = wi === 1 ? tri : gatling;
      muzzle.position.set(0, 0, wi === 1 ? 2.4 : 5.65);
    };
  }
  root.add(armL, armR); parts.armL = armL; parts.armR = armR;

  return {
    root, parts, kind: 'humanoid', allowDefaultShield: false,
    meleeMount: [0, -6.42, 0.72],
  };
}

function buildDom(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = { flames: [] }, stat = new THREE.Group();
  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = new THREE.Group(), ls = new THREE.Group();
    ls.add(sph(1.02, M.joint, 0, 0, 0, 14, 10));
    ls.add(cyl(1.08, 1.3, 3.2, M.main, 0, -1.85, 0, 13));
    ls.add(sideCyl(0.72, 0.72, 2.2, M.joint, 0, -3.72, 0, 12));
    ls.add(chamferBox(1.7, 1.05, 0.45, M.dark, 0, -3.68, 1.28, 0.1));
    ls.add(cyl(1.45, 2.25, 3.75, M.accent, 0, -5.85, -0.08, 14));
    ls.add(profile([[-1.75, -9.4], [2.9, -9.4], [3.1, -8.65], [2.15, -7.75], [-1.7, -7.65], [-2.2, -8.35]], [], 3.15, M.dark));
    ls.add(profile([[0, -9.05], [3.05, -9.05], [2.75, -8.2], [1.72, -7.8], [0, -7.85]], [], 2.88, M.main, 0, 0.12, 0));
    leg.add(compactGroup(ls)); leg.position.set(sx * 1.95, 9.4, 0); root.add(leg); parts[key] = leg;
  }

  stat.add(cyl(3.0, 4.65, 3.45, M.accent, 0, 9.45, 0, 16));
  stat.add(cyl(2.65, 3.18, 1.3, M.dark, 0, 11.2, 0, 16));
  stat.add(chamferBox(5.75, 3.45, 3.55, M.dark, 0, 13.2, 0, 0.34));
  const chest = chamferBox(4.45, 1.55, 0.78, M.accent, 0, 13.8, 1.9, 0.16); chest.rotation.x = -0.12; stat.add(chest);
  stat.add(fwdCyl(0.48, 0.48, 0.28, M.gold, 0, 13.2, 2.08, 16));
  boltRing(stat, M.frame, 'z', [0, 13.2, 2.25], 0.72, 0.06, 10);
  stat.add(box(3.5, 0.55, 2.5, M.main, 0, 15.2, 0));
  stat.add(chamferBox(4.2, 2.45, 1.35, M.accent, 0, 13.45, -2.25, 0.2));
  root.add(compactGroup(stat));
  for (const x of [-2.4, 0, 2.4]) addThruster(root, parts, M.frame, M.flame, x, 8.15, -1.75, 0.45, 2.2, 'rear');

  const head = new THREE.Group(), hs = new THREE.Group(); head.position.set(0, 15.65, 0.25);
  const dome = sph(1.5, M.main, 0, -0.15, -0.08, 20, 12); dome.scale.set(1.35, 0.58, 1.12); hs.add(dome);
  hs.add(box(2.62, 0.42, 0.45, M.dark, 0, -0.08, 1.12));
  hs.add(box(0.34, 1.5, 0.38, M.main, 0, 0.08, 1.24));
  hs.add(box(2.28, 0.3, 0.4, M.main, 0, 0.43, 1.2));
  head.add(compactGroup(hs));
  const mono = fwdCyl(0.28, 0.28, 0.18, M.eye, 0, -0.08, 1.4, 14); head.add(mono); parts.monoeye = mono;
  const eye = new THREE.Object3D(); eye.position.set(0, -0.08, 1.78); head.add(eye);
  root.add(head); parts.head = head; parts.eye = eye; parts.eyeMat = M.eye;

  const armL = zeonArm(M, 1, { armor: M.main }), armR = zeonArm(M, -1, { armor: M.main });
  armL.position.set(4.0, 14.45, 0); armR.position.set(-4.0, 14.45, 0);
  for (const [arm, sx] of [[armL, 1], [armR, -1]]){
    const pg = new THREE.Group(), ps = new THREE.Group();
    const shell = sph(2.15, M.accent, sx * 0.35, 0.7, 0, 20, 12); shell.scale.set(1.12, 0.58, 1.05); ps.add(shell);
    const flare = profile([[-1.7, -0.25], [0, 2.4], [1.65, -0.05], [1.15, -0.8], [-1.15, -0.8]], [], 0.5, M.dark, sx * 0.65, 0.6, 0);
    flare.rotation.z = sx * -0.1; ps.add(flare);
    pg.add(compactGroup(ps)); arm.add(pg);
  }
  root.add(armL, armR); parts.armL = armL; parts.armR = armR;

  return {
    root, parts, kind: 'humanoid', allowDefaultShield: false,
    weaponMount: [0, -6.4, 0.7], meleeMount: [0, -6.4, 0.65],
  };
}

function buildGelgoog(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = { flames: [] }, stat = new THREE.Group();
  const commander = suit.id === 'gelgoogs', limbMat = commander ? M.main : M.trim;
  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = new THREE.Group(), ls = new THREE.Group();
    ls.add(sph(0.98, M.joint, 0, 0, 0, 14, 10));
    ls.add(chamferBox(2.15, 3.3, 2.3, limbMat, 0, -1.9, 0, 0.24));
    ls.add(sideCyl(0.7, 0.7, 2.15, M.joint, 0, -3.72, 0, 12));
    ls.add(chamferBox(1.62, 1.15, 0.42, M.dark, 0, -3.7, 1.26, 0.1));
    ls.add(profile([[-1.25, -7.75], [1.0, -7.62], [1.6, -6.5], [1.35, -4.15], [-1.15, -4.2], [-1.65, -6.4]], [], 2.5, limbMat));
    ls.add(profile([[-1.6, -9.3], [2.65, -9.3], [2.92, -8.5], [2.0, -7.7], [-1.4, -7.65], [-1.9, -8.35]], [], 2.7, M.dark));
    ls.add(profile([[0.1, -8.95], [2.83, -8.95], [2.5, -8.12], [1.75, -7.72], [0.08, -7.78]], [], 2.42, limbMat, 0, 0.12, 0));
    leg.add(compactGroup(ls)); leg.position.set(sx * 1.9, 9.3, 0); root.add(leg); parts[key] = leg;
  }

  stat.add(cyl(2.95, 4.15, 3.85, M.main, 0, 9.75, 0, 16));
  stat.add(chamferBox(5.75, 3.3, 3.5, M.chest, 0, 13.1, 0, 0.28));
  const chest = cyl(2.85, 3.25, 1.35, M.main, 0, 14.05, 0.3, 16); chest.rotation.x = PI / 2; chest.scale.z = 0.55; stat.add(chest);
  for (const x of [-1.7, -0.85, 0, 0.85, 1.7]) stat.add(box(0.55, 0.25, 0.22, M.dark, x, 13.75, 1.87));
  stat.add(chamferBox(3.75, 3.0, 1.55, M.dark, 0, 13.3, -2.3, 0.2));
  root.add(compactGroup(stat));
  addBackThrusters(root, parts, M, 12.55, -3.2, [-1.12, 0, 1.12], 0.43);

  const mh = monoHead(M, { gelgoog: true, commander }); mh.head.position.set(0, 16.15, 0);
  root.add(mh.head); parts.head = mh.head; parts.eye = mh.eye; parts.monoeye = mh.monoeye; parts.eyeMat = M.eye;

  const armL = zeonArm(M, 1, { armor: limbMat }), armR = zeonArm(M, -1, { armor: limbMat });
  armL.position.set(4.0, 14.55, 0); armR.position.set(-4.0, 14.55, 0);
  for (const [arm, sx] of [[armL, 1], [armR, -1]]){
    const pg = new THREE.Group(), ps = new THREE.Group();
    ps.add(profile([[-1.8, -0.35], [-1.3, 1.8], [-0.2, 2.65], [1.55, 1.25], [1.82, -0.5], [0.65, -1.05], [-0.95, -0.95]], [], 2.75, limbMat, sx * 0.15, 0.55, 0));
    ps.add(profile([[-1.42, 0], [-1.05, 1.55], [-0.2, 2.15], [1.15, 1.05], [1.4, -0.18]], [], 2.4, M.accent, sx * 0.35, 0.85, 0));
    pg.add(compactGroup(ps)); arm.add(pg);
  }
  const shield = makeGelgoogShield(M); shield.position.set(1.75, -3.1, 0.15); shield.rotation.z = -0.08;
  armL.add(shield); parts.shield = shield; parts.shieldKind = 'native';
  const blade = makeBeamNaginata(M); blade.position.set(0, -6.42, 0.75); armR.add(blade); parts.blade = blade;
  root.add(armL, armR); parts.armL = armL; parts.armR = armR;

  return {
    root, parts, kind: 'humanoid', allowDefaultShield: false,
    weaponMount: [0, -6.42, 0.72], meleeMount: [0, -6.42, 0.72],
  };
}

function buildAcguy(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = { flames: [], fixedWeapon: true, weaponIsHeld: false }, stat = new THREE.Group();
  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = new THREE.Group(), ls = new THREE.Group();
    ls.add(sph(1.05, M.joint, 0, 0, 0, 14, 10));
    ls.add(cyl(1.35, 1.55, 2.8, M.chest, 0, -1.65, 0, 14));
    ls.add(sideCyl(0.75, 0.75, 2.45, M.joint, 0, -3.25, 0, 12));
    ls.add(cyl(1.48, 1.82, 2.75, M.chest, 0, -4.95, -0.05, 14));
    ls.add(profile([[-1.3, -7.4], [2.4, -7.4], [2.55, -6.55], [1.65, -5.9], [-1.3, -5.88], [-1.65, -6.5]], [], 3.2, M.main));
    leg.add(compactGroup(ls)); leg.position.set(sx * 1.75, 7.4, 0); root.add(leg); parts[key] = leg;
  }

  const belly = cyl(3.05, 3.45, 5.3, M.chest, 0, 10.2, 0, 18); belly.scale.z = 0.9; stat.add(belly);
  stat.add(chamferBox(4.25, 3.85, 0.72, M.main, 0, 10.35, 2.65, 0.25));
  stat.add(chamferBox(2.75, 2.8, 0.34, M.accent, 0, 9.8, 3.08, 0.12));
  for (const yy of [8.75, 9.2, 9.65]) stat.add(box(1.7, 0.11, 0.16, M.dark, 0, yy, 3.3));
  stat.add(chamferBox(3.15, 2.25, 1.45, M.dark, 0, 10.85, -2.65, 0.2));
  root.add(compactGroup(stat));
  addBackThrusters(root, parts, M, 10.1, -3.5, [-0.9, 0.9], 0.48);

  const head = new THREE.Group(), hs = new THREE.Group(); head.position.set(0, 14.0, 0.15);
  const dome = sph(2.75, M.chest, 0, 0.2, -0.1, 28, 18); dome.scale.set(1.05, 0.66, 0.92); hs.add(dome);
  hs.add(cyl(2.45, 2.25, 1.25, M.chest, 0, -0.9, 0, 22));
  hs.add(box(4.2, 0.42, 0.54, M.dark, 0, -0.48, 2.0));
  hs.add(box(0.4, 1.72, 0.48, M.dark, 0, 0.05, 2.02));
  hs.add(chamferBox(1.15, 0.62, 0.38, M.dark, 0, -1.35, 2.08, 0.1));
  for (const sx of [-1, 1]) for (const z of [-0.85, 0.85]) hs.add(fwdCyl(0.09, 0.09, 0.15, M.frame, sx * 1.55, 0.55, z, 7));
  head.add(compactGroup(hs));
  const mono = fwdCyl(0.3, 0.3, 0.2, M.eye, 0, -0.48, 2.25, 14); head.add(mono); parts.monoeye = mono;
  const eye = new THREE.Object3D(); eye.position.set(0, -0.48, 2.65); head.add(eye);
  root.add(head); parts.head = head; parts.eye = eye; parts.eyeMat = M.eye;

  const arms = {};
  for (const [key, sx] of [['armL', 1], ['armR', -1]]){
    const arm = new THREE.Group(), as = new THREE.Group(); arm.position.set(sx * 3.65, 12.45, 0);
    as.add(sph(1.55, M.main, 0, 0.25, 0, 18, 12));
    as.add(cyl(1.18, 1.32, 2.1, M.chest, 0, -1.45, 0, 14));
    as.add(cyl(1.08, 1.18, 1.55, M.accent, 0, -3.25, 0, 14));
    as.add(cyl(1.22, 1.35, 2.05, M.chest, 0, -4.95, 0, 14));
    as.add(fwdCyl(1.18, 1.18, 0.45, M.frame, 0, -6.25, 0.7, 18));
    arm.add(compactGroup(as));
    const plate = fwdCyl(1.02, 1.02, 0.28, M.trim, 0, -6.25, 1.02, 18); arm.add(plate);
    root.add(arm); parts[key] = arm; arms[key] = arm;
  }
  const armR = arms.armR, armL = arms.armL;
  for (let i = 0; i < 3; i++){
    const a = i / 3 * PI * 2;
    const nail = cone(0.22, 1.35, M.frame, Math.cos(a) * 0.67, -6.25 + Math.sin(a) * 0.67, 1.75, 9);
    nail.rotation.x = PI / 2; armR.add(nail);
  }
  for (let i = 0; i < 6; i++){
    const a = i / 6 * PI * 2;
    armL.add(fwdCyl(0.13, 0.13, 0.22, M.dark, Math.cos(a) * 0.58, -6.25 + Math.sin(a) * 0.58, 1.22, 8));
  }
  const muzzle = new THREE.Object3D(); armR.add(muzzle); muzzle.position.set(0, -6.25, 2.05); parts.muzzle = muzzle;
  parts.aimArm = armR;
  parts.rebuildGun = wi => {
    parts.weaponIsHeld = false; parts.aimIntegrated = false;
    (wi === 1 ? armL : armR).add(muzzle); parts.aimArm = wi === 1 ? armL : armR; parts.aimArms = [parts.aimArm];
    muzzle.position.set(0, -6.25, wi === 1 ? 1.65 : 2.05);
  };
  const blade = new THREE.Group();
  for (let i = 0; i < 3; i++){
    const a = i / 3 * PI * 2;
    const nail = cone(0.28, 2.6, M.heat, Math.cos(a) * 0.72, Math.sin(a) * 0.72, 1.75, 10); nail.rotation.x = PI / 2; blade.add(nail);
  }
  blade.position.set(0, -6.25, 0.2); blade.visible = false; armR.add(blade); parts.blade = blade;

  return { root, parts, kind: 'humanoid', allowDefaultShield: false };
}

function addTrackWheels(parent, M, x, zs, y, largeEnds = false){
  for (let i = 0; i < zs.length; i++){
    const end = i === 0 || i === zs.length - 1, r = end && largeEnds ? 1.22 : 0.92;
    parent.add(sideCyl(r, r, 2.52, M.frame, x, y, zs[i], 16));
    parent.add(sideCyl(r * 0.58, r * 0.58, 2.65, M.dark, x, y, zs[i], 12));
  }
}

function zakuTankUpper(root, parts, M){
  const stat = new THREE.Group();
  stat.add(cyl(2.65, 2.9, 1.15, M.dark, 0, 6.45, 0, 16));
  stat.add(chamferBox(5.1, 3.35, 3.15, M.chest, 0, 8.55, 0, 0.25));
  for (const sx of [-1, 1]) stat.add(chamferBox(1.35, 2.85, 2.65, M.main, sx * 2.35, 8.65, 0.05, 0.18));
  stat.add(chamferBox(3.95, 1.45, 0.72, M.main, 0, 9.2, 1.65, 0.14));
  stat.add(chamferBox(1.35, 1.1, 0.35, M.accent, 0, 7.75, 1.72, 0.08));
  stat.add(chamferBox(3.4, 2.65, 1.45, M.dark, 0, 8.7, -2.05, 0.16));
  stat.add(ribbedCable([[-2.7, 6.95, 0.8], [-3.0, 6.9, -0.2], [-2.2, 6.85, -1.2], [0, 6.8, -1.45], [2.2, 6.85, -1.2], [3.0, 6.9, -0.2], [2.7, 6.95, 0.8]], 0.25, M.frame, M.dark, 20));
  root.add(compactGroup(stat));

  // RfV field conversion: two slab shoulder shields and compact claw manipulators.
  for (const sx of [-1, 1]){
    const arm = new THREE.Group(), as = new THREE.Group();
    arm.position.set(sx * 3.45, 10.0, 0);
    as.add(sph(0.82, M.joint, 0, 0, 0, 12, 8));
    as.add(cyl(0.85, 1.0, 2.2, M.main, 0, -1.25, 0, 12));
    as.add(sideCyl(0.58, 0.58, 1.7, M.joint, 0, -2.65, 0, 10));
    as.add(cyl(0.9, 1.1, 2.2, M.main, 0, -3.95, 0, 12));
    as.add(chamferBox(0.75, 3.8, 3.55, M.main, sx * 1.0, 0.35, 0, 0.16));
    as.add(chamferBox(0.25, 3.15, 2.85, M.accent, sx * 1.42, 0.35, 0, 0.08));
    for (let i = 0; i < 3; i++){
      const a = i / 3 * PI * 2;
      const claw = cone(0.18, 0.95, M.frame, Math.cos(a) * 0.48, -5.25, Math.sin(a) * 0.48 + 0.25, 8);
      claw.rotation.x = PI; as.add(claw);
    }
    arm.add(compactGroup(as)); root.add(arm);
  }

  const mh = monoHead(M, { commander: false }); mh.head.position.set(0, 11.6, 0);
  root.add(mh.head); parts.head = mh.head; parts.eye = mh.eye; parts.monoeye = mh.monoeye;
}

function buildZakuTank(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = completeParts(M), stat = new THREE.Group();
  const path = [[-6.15, 0.5], [5.35, 0.5], [6.25, 1.35], [5.55, 3.35], [-4.85, 3.35], [-6.45, 2.25]];
  root.add(instancedTrack(path, [-3.65, 3.65], 2.65, 0.72, M.dark, true));
  for (const x of [-3.65, 3.65]) addTrackWheels(stat, M, x, [-4.65, -2.7, -0.8, 1.1, 3.1, 5.05], 1.55, true);
  stat.add(profile([[-5.65, 2.45], [5.9, 2.55], [5.2, 4.35], [-4.65, 4.45]], [], 3.0, M.main, -3.65));
  stat.add(profile([[-5.65, 2.45], [5.9, 2.55], [5.2, 4.35], [-4.65, 4.45]], [], 3.0, M.main, 3.65));
  stat.add(profile([[-5.2, 3.15], [5.5, 3.15], [4.25, 5.55], [-4.4, 5.4]], [], 6.1, M.main));
  stat.add(chamferBox(5.4, 1.35, 4.0, M.accent, 0, 5.35, -0.4, 0.18));
  stat.add(chamferBox(2.4, 0.8, 1.45, M.dark, 0, 4.7, 4.65, 0.1));
  for (const x of [-0.75, 0, 0.75]) stat.add(fwdCyl(0.13, 0.13, 1.1, M.frame, x, 4.65, 5.45, 8));
  // Rear engineering blade seen on the official RfV conversion.
  const bladePlate = chamferBox(8.2, 2.25, 0.5, M.frame, 0, 2.4, -6.75, 0.16); bladePlate.rotation.x = -0.18; stat.add(bladePlate);
  for (const x of [-2.8, 2.8]) stat.add(between([x, 3.0, -5.2], [x, 2.65, -6.55], 0.18, M.dark, 9));
  for (const x of [-4.5, 4.5]) stat.add(chamferBox(1.1, 1.0, 2.35, M.accent, x, 4.25, -3.75, 0.12));
  root.add(compactGroup(stat));

  zakuTankUpper(root, parts, M); parts.eyeMat = M.eye;
  const mount = new THREE.Group(); mount.position.set(-2.65, 11.15, -0.5);
  const ms = new THREE.Group();
  ms.add(chamferBox(1.65, 1.4, 2.2, M.dark, 0, -0.45, 0, 0.15));
  ms.add(sideCyl(0.38, 0.38, 2.0, M.frame, 0, -0.25, 0, 10));
  mount.add(compactGroup(ms));
  const slide = new THREE.Group(), cs = new THREE.Group();
  cs.add(chamferBox(1.15, 1.25, 3.0, M.frame, 0, 0, 0.8, 0.14));
  cs.add(chamferBox(0.82, 0.85, 2.0, M.dark, 0, 0.25, -1.6, 0.1));
  cs.add(fwdCyl(0.28, 0.34, 7.0, M.frame, 0, 0.05, 5.5, 12));
  cs.add(fwdCyl(0.48, 0.48, 0.8, M.dark, 0, 0.05, 9.2, 12));
  for (const x of [-0.34, 0.34]) cs.add(box(0.16, 0.72, 1.05, M.frame, x, 0.05, 9.2));
  slide.add(compactGroup(cs));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.05, 9.75); slide.add(muzzle);
  mount.add(slide); root.add(mount);
  parts.turret = mount; parts.cannonSlide = slide; parts.muzzle = muzzle;
  parts.turretDock = {
    dir: { x: -2.65, y: 11.15, z: -0.5 },
    art: { x: -2.35, y: 12.0, z: -1.15 },
  };
  parts.blade = hiddenAnchor(); root.add(parts.blade);
  for (const x of [-2.2, 2.2]) addThruster(root, parts, M.frame, M.flame, x, 3.25, -6.0, 0.34, 1.7, 'rear');
  const groundShift = groundChildren(root);
  parts.turretDock.dir.y -= groundShift; parts.turretDock.art.y -= groundShift;
  return { root, parts, kind: 'complete' };
}

// PVN.44/1 Weasel — the low, wide six-wheel Zeon reconnaissance/APC seen in RfV.
// Canon mounts a 37mm machine cannon; this game entry is the requested 30mm field refit.
// Geometry stays in real vehicle metres (6.9m hull x 3.8m wheel width x ~2.7m to antenna).
function buildWeasel(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = completeParts(M);
  const stat = new THREE.Group();
  const lamp = new THREE.MeshStandardMaterial({
    color: 0xe8d9a0, emissive: 0xffd878, emissiveIntensity: 1.7, roughness: 0.24, metalness: 0.35,
  });
  const tailLamp = new THREE.MeshStandardMaterial({
    color: 0x401315, emissive: 0xff3b32, emissiveIntensity: 1.25, roughness: 0.35, metalness: 0.25,
  });

  root.name = 'PVN.44-1 Weasel 30mm APC';
  root.userData.canonicalDimensions = { length: 6.9, width: 3.8, height: 2.7 };

  // Watertight boat-like lower hull and sharply sloped prow.
  stat.add(profile([
    [-3.35, 0.52], [-3.02, 0.28], [2.7, 0.28], [3.45, 0.72],
    [2.92, 1.28], [-2.82, 1.24],
  ], [], 3.18, M.chest));
  stat.add(profile([
    [-2.92, 1.02], [-2.48, 1.92], [-1.85, 2.08], [1.45, 2.08],
    [2.72, 1.48], [2.98, 1.05],
  ], [], 2.96, M.main));
  stat.add(chamferBox(2.8, 0.18, 4.35, M.accent, 0, 2.04, -0.28, 0.05));
  stat.add(chamferBox(3.05, 0.22, 1.45, M.main, 0, 1.42, 2.2, 0.06));

  // Side applique plates, fenders, seams and suspension arms.
  for (const sx of [-1, 1]){
    stat.add(profile([
      [-3.05, 0.86], [-2.68, 1.45], [2.4, 1.5], [3.05, 1.12], [2.72, 0.84],
    ], [], 0.14, M.main, sx * 1.56));
    stat.add(chamferBox(0.16, 0.2, 5.72, M.accent, sx * 1.63, 1.44, -0.08, 0.04));
    for (const z of [-2.18, 0, 2.18]){
      stat.add(between([sx * 1.42, 0.95, z - 0.22], [sx * 1.7, 0.72, z], 0.085, M.frame, 8));
      stat.add(sideCyl(0.11, 0.11, 0.22, M.frame, sx * 1.53, 0.9, z, 8));
    }
    for (let z = -2.6; z <= 2.61; z += 0.65)
      stat.add(sideCyl(0.035, 0.035, 0.18, M.trim, sx * 1.61, 1.34, z, 6));
  }

  // Six huge knobby wheels, each kept on a live pivot for rolling animation.
  const makeWheel = () => {
    const pivot = new THREE.Group(), detail = new THREE.Group();
    detail.add(sideCyl(0.76, 0.76, 0.58, M.dark, 0, 0, 0, 20));
    detail.add(sideCyl(0.43, 0.43, 0.605, M.frame, 0, 0, 0, 16));
    detail.add(sideCyl(0.2, 0.22, 0.64, M.accent, 0, 0, 0, 12));
    for (let i = 0; i < 12; i++){
      const a = i / 12 * PI * 2;
      const lug = box(0.62, 0.16, 0.3, M.chest, 0, Math.cos(a) * 0.74, Math.sin(a) * 0.74);
      lug.rotation.x = a; detail.add(lug);
    }
    boltRing(detail, M.trim, 'x', [0, 0, 0], 0.31, 0.04, 8);
    pivot.add(compactGroup(detail));
    return pivot;
  };
  parts.wheels = [];
  for (const sx of [-1, 1]) for (const z of [-2.18, 0, 2.18]){
    const wheel = makeWheel(); wheel.position.set(sx * 1.61, 0.9, z);
    wheel.userData.wheelSide = sx; wheel.userData.wheelRadius = 0.76;
    root.add(wheel); parts.wheels.push(wheel);
  }
  parts.wheelRadius = 0.76;

  // Driver glazing, periscopes, headlights and the canonical fixed front-left MG74/S.
  stat.add(chamferBox(0.82, 0.32, 0.09, M.glass, -0.68, 1.67, 2.57, 0.04));
  stat.add(chamferBox(0.82, 0.32, 0.09, M.glass, 0.38, 1.67, 2.57, 0.04));
  for (const x of [-1.08, 1.08]){
    stat.add(fwdCyl(0.17, 0.17, 0.12, M.frame, x, 0.92, 3.29, 10));
    stat.add(fwdCyl(0.12, 0.12, 0.14, lamp, x, 0.92, 3.37, 10));
  }
  stat.add(chamferBox(0.28, 0.3, 0.42, M.frame, 0.82, 1.42, 2.78, 0.04));
  stat.add(fwdCyl(0.055, 0.065, 1.15, M.frame, 0.82, 1.43, 3.48, 9));
  stat.add(fwdCyl(0.105, 0.105, 0.18, M.dark, 0.82, 1.43, 4.08, 9));
  for (const x of [-0.82, 0, 0.82]) stat.add(chamferBox(0.32, 0.16, 0.42, M.glass, x, 2.18, 1.03, 0.04));

  // Rear troop doors, hinges, step and external stowage make the APC role readable.
  for (const x of [-0.72, 0.72]){
    stat.add(chamferBox(1.28, 1.25, 0.1, M.main, x, 1.28, -2.92, 0.04));
    for (const y of [0.9, 1.65]) stat.add(fwdCyl(0.055, 0.055, 0.16, M.frame, x + (x < 0 ? -0.48 : 0.48), y, -3.02, 7));
    stat.add(box(0.3, 0.055, 0.09, M.trim, x + (x < 0 ? 0.24 : -0.24), 1.34, -3.02));
  }
  stat.add(chamferBox(1.65, 0.16, 0.54, M.frame, 0, 0.45, -3.22, 0.04));
  for (const x of [-1.05, 1.05]) stat.add(fwdCyl(0.11, 0.11, 0.12, tailLamp, x, 1.1, -3.0, 8));
  stat.add(chamferBox(0.48, 0.72, 0.26, M.accent, -1.26, 1.52, -1.75, 0.05));
  stat.add(chamferBox(0.48, 0.72, 0.26, M.accent, -1.26, 1.52, -1.18, 0.05));
  for (const z of [-1.75, -1.18]){
    stat.add(box(0.12, 0.46, 0.05, M.trim, -1.52, 1.52, z));
    stat.add(box(0.12, 0.08, 0.2, M.trim, -1.52, 1.82, z));
  }

  // Roof hatches, engine grilles, exhaust, tie-downs and tow eyes.
  stat.add(chamferBox(1.05, 0.12, 0.82, M.accent, 0.66, 2.18, -1.45, 0.04));
  stat.add(chamferBox(0.9, 0.12, 0.72, M.accent, -0.68, 2.18, -1.42, 0.04));
  for (let i = -3; i <= 3; i++) stat.add(box(0.12, 0.08, 0.98, M.dark, i * 0.22, 2.18, -2.05));
  stat.add(fwdCyl(0.11, 0.14, 0.75, M.frame, 1.25, 1.98, -2.25, 9));
  stat.add(fwdCyl(0.16, 0.16, 0.18, M.dark, 1.25, 1.98, -2.67, 9));
  for (const x of [-1.05, 1.05]){
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 10), M.frame);
    eye.position.set(x, 0.58, 3.38); stat.add(eye);
  }

  // Amphibious drive: deployable rear propeller and protective ring under the stern.
  const prop = new THREE.Group(); prop.position.set(0, 0.5, -3.48);
  prop.add(fwdCyl(0.12, 0.15, 0.38, M.frame, 0, 0, 0, 10));
  const cage = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 6, 16), M.frame); cage.position.z = -0.22; prop.add(cage);
  for (let i = 0; i < 3; i++){
    const blade = chamferBox(0.12, 0.56, 0.06, M.accent, 0, 0.25, -0.23, 0.03);
    blade.rotation.z = i * PI * 2 / 3; prop.add(blade);
  }
  stat.add(prop);

  // Paired triple smoke-discharge banks, angled out from both shoulders.
  for (const sx of [-1, 1]) for (let i = -1; i <= 1; i++){
    const z = 0.16 + i * 0.23;
    stat.add(between([sx * 1.32, 1.76, z], [sx * 1.58, 2.12, z + 0.12], 0.07, M.frame, 8));
    stat.add(between([sx * 1.56, 2.1, z + 0.11], [sx * 1.68, 2.27, z + 0.18], 0.1, M.dark, 8));
  }

  // Pale field markings: side chevrons and compact '44' stencil bars.
  for (const sx of [-1, 1]){
    for (const [y, z, rx] of [[1.63, -0.35, 0.72], [1.63, -0.35, -0.72], [1.48, -0.35, 0]]){
      const mark = box(0.035, 0.065, 0.34, M.trim, sx * 1.635, y, z); mark.rotation.x = rx; stat.add(mark);
    }
    for (const dz of [0, 0.42]){
      stat.add(box(0.035, 0.46, 0.055, M.trim, sx * 1.64, 1.63, -1.0 + dz));
      stat.add(box(0.035, 0.055, 0.32, M.trim, sx * 1.64, 1.63, -1.0 + dz));
      stat.add(box(0.035, 0.25, 0.055, M.trim, sx * 1.64, 1.48, -1.13 + dz));
    }
  }
  root.add(compactGroup(stat));

  // Open low-profile turret: the housing traverses, while only the gun cradle elevates.
  const turretYaw = new THREE.Group(); turretYaw.position.set(0, 2.02, 0.72); turretYaw.name = 'weasel-turret-yaw';
  const turretStatic = new THREE.Group();
  turretStatic.add(cyl(0.72, 0.78, 0.16, M.dark, 0, 0, 0, 16));
  turretStatic.add(cyl(0.61, 0.66, 0.2, M.main, 0, 0.13, 0, 14));
  turretStatic.add(chamferBox(0.18, 0.58, 0.82, M.main, -0.58, 0.35, -0.02, 0.04));
  turretStatic.add(chamferBox(0.18, 0.58, 0.82, M.main, 0.58, 0.35, -0.02, 0.04));
  turretStatic.add(chamferBox(1.0, 0.52, 0.15, M.main, 0, 0.37, -0.43, 0.04));
  turretStatic.add(chamferBox(0.42, 0.1, 0.34, M.glass, -0.28, 0.64, -0.28, 0.03));
  turretYaw.add(compactGroup(turretStatic));

  const gunPitch = new THREE.Group(); gunPitch.position.set(0, 0.42, 0.08); gunPitch.name = 'weasel-30mm-elevation';
  const gunStatic = new THREE.Group();
  gunStatic.add(chamferBox(0.58, 0.46, 0.78, M.frame, 0, 0, 0.18, 0.06));
  gunStatic.add(chamferBox(0.78, 0.56, 0.16, M.main, 0, 0, 0.55, 0.04));
  gunStatic.add(fwdCyl(0.095, 0.125, 3.15, M.frame, 0, 0.02, 2.05, 12));
  gunStatic.add(fwdCyl(0.165, 0.165, 0.3, M.dark, 0, 0.02, 3.76, 12));
  gunStatic.add(box(0.36, 0.08, 0.24, M.frame, 0, 0.02, 3.76));
  gunStatic.add(chamferBox(0.3, 0.22, 0.38, M.accent, -0.34, -0.17, 0.05, 0.04));
  gunPitch.add(compactGroup(gunStatic));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.02, 3.93); muzzle.name = 'weasel-30mm-muzzle'; gunPitch.add(muzzle);
  turretYaw.add(gunPitch); root.add(turretYaw);

  // RfV command/spotter antenna cluster; tallest whip establishes the 2.7m overall height.
  const antBase = new THREE.Group(); antBase.position.set(0, 0, 0);
  antBase.add(between([0.82, 2.05, -1.5], [0.88, 2.59, -1.6], 0.018, M.frame, 7));
  antBase.add(between([1.05, 1.98, -1.7], [1.17, 2.49, -1.83], 0.016, M.frame, 7));
  antBase.add(fwdCyl(0.07, 0.09, 0.14, M.dark, 0.82, 2.07, -1.5, 8));
  root.add(compactGroup(antBase));

  const eye = new THREE.Object3D(); eye.position.set(-0.18, 1.7, 2.5); root.add(eye);
  const head = new THREE.Object3D(); head.position.set(-0.18, 1.7, 2.5); root.add(head);
  parts.eye = eye; parts.head = head; parts.eyeMat = M.eye;
  parts.turretYaw = turretYaw; parts.turret = gunPitch; parts.turretPitchScale = 1;
  parts.muzzle = muzzle; parts.weaponMuzzles = [[muzzle]]; parts.weaponIsHeld = false;
  parts.blade = hiddenAnchor(); root.add(parts.blade);

  groundChildren(root);
  return { root, parts, kind: 'complete' };
}

function buildMagella(suit, rawM){
  const M = mats(rawM), root = new THREE.Group(), parts = completeParts(M), stat = new THREE.Group();
  const path = [[-5.05, 0.42], [4.65, 0.42], [5.45, 1.3], [4.85, 3.2], [-4.4, 3.2], [-5.35, 2.1]];
  root.add(instancedTrack(path, [-3.15, 3.15], 2.35, 0.64, M.dark, true));
  for (const x of [-3.15, 3.15]) addTrackWheels(stat, M, x, [-4.15, -2.45, -0.75, 0.95, 2.75, 4.3], 1.45, true);
  stat.add(profile([[-4.7, 2.3], [4.9, 2.25], [4.15, 4.2], [-3.85, 4.15]], [], 2.65, M.main, -3.15));
  stat.add(profile([[-4.7, 2.3], [4.9, 2.25], [4.15, 4.2], [-3.85, 4.15]], [], 2.65, M.main, 3.15));
  stat.add(profile([[-4.2, 3.0], [4.65, 3.0], [3.65, 5.0], [-3.5, 4.8]], [], 5.25, M.main));
  stat.add(chamferBox(2.35, 0.85, 1.5, M.dark, 0, 4.4, 4.15, 0.1));
  for (const x of [-0.66, 0, 0.66]){
    stat.add(fwdCyl(0.11, 0.11, 1.65, M.frame, x, 4.35, 5.25, 8));
    stat.add(fwdCyl(0.16, 0.16, 0.24, M.dark, x, 4.35, 6.1, 8));
  }
  for (const x of [-4.1, 4.1]) stat.add(chamferBox(1.0, 0.75, 1.6, M.accent, x, 4.0, 2.85, 0.1));
  root.add(compactGroup(stat));

  const turret = new THREE.Group(); turret.position.set(0, 6.45, 0);
  const ts = new THREE.Group();
  ts.add(profile([[-3.65, -0.9], [3.55, -0.72], [4.2, 0.25], [2.55, 1.15], [-2.55, 1.25], [-4.15, 0.15]], [], 3.95, M.main));
  ts.add(chamferBox(2.45, 0.95, 2.0, M.glass, 0, 1.18, 1.25, 0.16));
  ts.add(profile([[-2.1, -0.25], [0.65, 0.1], [-0.25, 0.62], [-2.45, 0.45]], [], 3.0, M.accent, -3.0, 0, -0.25));
  ts.add(profile([[-2.1, -0.25], [0.65, 0.1], [-0.25, 0.62], [-2.45, 0.45]], [], 3.0, M.accent, 3.0, 0, -0.25));
  for (const x of [-1.6, 1.6]){
    const fin = profile([[-3.1, 0], [-1.05, 2.25], [0.45, 0.05]], [], 0.2, M.main, x, 0.35, 0);
    ts.add(fin);
  }
  ts.add(fwdCyl(0.28, 0.38, 8.9, M.frame, 0, 0.35, 7.1, 12));
  ts.add(fwdCyl(0.42, 0.42, 0.8, M.dark, 0, 0.35, 11.75, 12));
  for (let i = 0; i < 6; i++){
    const a = i / 6 * PI * 2;
    ts.add(fwdCyl(0.16, 0.2, 0.75, M.frame, Math.cos(a) * 0.5, Math.sin(a) * 0.5, -4.25, 9));
  }
  turret.add(compactGroup(ts));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.35, 12.2); turret.add(muzzle);
  const eye = new THREE.Object3D(); eye.position.set(0, 1.35, 2.1); turret.add(eye);
  root.add(turret); parts.turret = turret; parts.muzzle = muzzle; parts.eye = eye;
  const head = new THREE.Object3D(); head.position.set(0, 7.8, 1.25); root.add(head); parts.head = head;
  parts.blade = hiddenAnchor(); root.add(parts.blade);
  for (const x of [-2.2, 2.2]) addThruster(root, parts, M.frame, M.flame, x, 3.0, -5.45, 0.32, 1.65, 'rear');
  groundChildren(root);
  return { root, parts, kind: 'complete' };
}

export function buildZeonCanonical(suit, M){
  if (!suit || !supported.has(suit.id)) return null;
  switch (suit.id){
    case 'zaku2': case 'zaku2b': case 'zaku2g': return buildZaku(suit, palette('zaku', M));
    case 'zaku2s': return buildZaku(suit, palette('charZaku', M));
    case 'zakutank': return buildZakuTank(suit, palette('zakuTank', M));
    case 'gouf': return buildGouf(suit, palette('gouf', M), false);
    case 'goufnh': return buildGouf(suit, palette('goufCustom', M), true);
    case 'dom': return buildDom(suit, palette('dom', M));
    case 'gelgoog': return buildGelgoog(suit, palette('gelgoog', M));
    case 'gelgoogs': return buildGelgoog(suit, palette('charGelgoog', M));
    case 'magella': return buildMagella(suit, palette('magella', M));
    case 'weasel': return buildWeasel(suit, palette('weasel', M));
    case 'acguy': return buildAcguy(suit, palette('acguy', M));
    default: return null;
  }
}
