// Canon-locked Federation ground units.  These builders deliberately own the
// silhouettes and armour layouts; mecha.js only supplies shared equipment and
// animation after a humanoid body is returned.
import {
  THREE, box, cyl, sph, chamferBox, profile, tube, ribbedCable,
  materialSet, compactGroup, addThruster, instancedTrack,
} from './model-kit.js';

const PI = Math.PI;

const PALETTES = {
  rx78:       { main: 0xf1f0e9, chest: 0x17458c, accent: 0xbd2730, trim: 0xe9bd2f },
  fa78:       { main: 0xe8e9e4, chest: 0x172950, accent: 0xb62b31, trim: 0xe3b83a },
  rx79g:      { main: 0xd8dad3, chest: 0x234c75, accent: 0xa92d2b, trim: 0xd6b73b },
  ez8:        { main: 0xd9d0b8, chest: 0x394654, accent: 0xa94635, trim: 0xc29f42 },
  nt1:        { main: 0xe6e8e6, chest: 0x1e4c9b, accent: 0xb92932, trim: 0xe2bd38 },
  gp01:       { main: 0xeeeeda, chest: 0x204fa1, accent: 0xbc2730, trim: 0xe3ba32 },
  mk2:        { main: 0xe7e7df, chest: 0x18243d, accent: 0xb32a31, trim: 0xd6b63c },
  gundamx:    { main: 0xe9e9df, chest: 0x183f7f, accent: 0xae2930, trim: 0xd7a92e },
  gm:         { main: 0xdce5d6, chest: 0xbd3131, accent: 0x9e272b, trim: 0xd8ac2f },
  groundgm:   { main: 0xd6c9aa, chest: 0xb94b30, accent: 0x343b42, trim: 0xc5a54b },
  sniper:     { main: 0x72afc1, chest: 0x173b5b, accent: 0xa92c32, trim: 0xc4d0d3 },
  spartan:    { main: 0x536148, chest: 0x2f3c32, accent: 0x242b27, trim: 0x8a4a39 },
  guncannon:  { main: 0xb62a2b, chest: 0x343b45, accent: 0xd9d8ce, trim: 0xd7aa35 },
  guntank:    { main: 0xe2dfd4, chest: 0xb3292e, accent: 0x243e68, trim: 0xd4ae38 },
  guntankaa:  { main: 0xb5b6a4, chest: 0x4a593f, accent: 0x303a42, trim: 0xc7ab52 },
  earlytank:  { main: 0xaeb3ba, chest: 0x7b838d, accent: 0x424950, trim: 0xc4d3d9 },
  type61:     { main: 0x5c654d, chest: 0x46503d, accent: 0x2e3630, trim: 0x8a7954 },
};

function palette(key, M){
  const P = materialSet(PALETTES[key]);
  // Sensors, effects and melee materials are shared with the game so damage
  // flicker and boost/melee animation continue to work exactly as before.
  if (M){
    P.eye = M.eye || P.eye;
    P.flame = M.flame || P.flame;
    P.blade = M.blade || P.blade;
    P.heat = M.heat || P.heat;
    P.gold = M.gold || P.gold;
    P.scope = M.scope || P.eye;
  } else P.scope = P.eye;
  return P;
}

const BIPED = {
  standard: { hipY: 8.75, hipX: 1.45, shoulderY: 13.9, shoulderX: 3.35, leg: 1, arm: 1, chest: 1 },
  heavy:    { hipY: 8.7,  hipX: 1.62, shoulderY: 13.9, shoulderX: 3.65, leg: 1.13, arm: 1.1, chest: 1.12 },
  ground:   { hipY: 8.55, hipX: 1.55, shoulderY: 13.75, shoulderX: 3.48, leg: 1.08, arm: 1.04, chest: 1.08 },
  alex:     { hipY: 8.8,  hipX: 1.5, shoulderY: 14.0, shoulderX: 3.45, leg: 1.04, arm: 1.02, chest: 1.02 },
  gp01:     { hipY: 8.85, hipX: 1.58, shoulderY: 14.05, shoulderX: 3.62, leg: 1.1, arm: 1.08, chest: 1.08 },
  mk2:      { hipY: 9.0,  hipX: 1.5, shoulderY: 14.15, shoulderX: 3.5, leg: 1.02, arm: 1.02, chest: 1.04 },
  x:        { hipY: 8.9,  hipX: 1.42, shoulderY: 14.0, shoulderX: 3.3, leg: 0.96, arm: 0.96, chest: 0.96 },
  gm:       { hipY: 8.6,  hipX: 1.4, shoulderY: 13.75, shoulderX: 3.15, leg: 0.98, arm: 0.96, chest: 0.95 },
  lategm:   { hipY: 8.8,  hipX: 1.5, shoulderY: 13.95, shoulderX: 3.42, leg: 1.03, arm: 1.0, chest: 1.02 },
  cannon:   { hipY: 8.45, hipX: 1.65, shoulderY: 13.65, shoulderX: 3.7, leg: 1.2, arm: 1.12, chest: 1.16 },
};

// Create a fully articulated EFSF humanoid rig.  Static armour is compacted
// inside each limb, while the shoulder and hip groups remain untouched pivots.
function makeBiped(P, style, options = {}){
  const C = BIPED[style];
  const root = new THREE.Group();
  const parts = { flames: [] };
  const torso = new THREE.Group();
  const waist = new THREE.Group();
  const backpack = new THREE.Group();
  const backpackBody = new THREE.Group();
  backpack.add(backpackBody);
  root.add(torso, waist, backpack);

  const footMat = options.footMat || P.accent;
  const kneeMat = options.kneeMat || P.main;
  const shoulderMat = options.shoulderMat || P.main;
  const chestMat = options.chestMat || P.chest;
  const legArmour = options.legMat || P.main;
  const armArmour = options.armMat || P.main;

  // Pelvis and torso use absolute coordinates so backpack equipment can line
  // up across family variants without inheriting a hidden scaling transform.
  waist.add(chamferBox(3.2 * C.chest, 1.2, 2.45, P.frame, 0, C.hipY + 0.35, 0, 0.16));
  waist.add(chamferBox(1.7, 1.2, 2.6, P.accent, 0, C.hipY + 0.55, 0.25, 0.14));
  for (const sx of [-1, 1]){
    const front = chamferBox(1.45 * C.chest, 2.35, 0.6, P.main, sx * 0.82 * C.chest, C.hipY - 0.15, 1.35, 0.12);
    front.rotation.z = -sx * 0.07; waist.add(front);
    waist.add(chamferBox(1.3 * C.chest, 2.05, 0.55, P.main, sx * 1.72 * C.chest, C.hipY + 0.15, 0, 0.12));
    waist.add(chamferBox(1.35 * C.chest, 1.9, 0.5, P.main, sx * 0.78 * C.chest, C.hipY + 0.05, -1.25, 0.1));
  }

  torso.add(chamferBox(3.3 * C.chest, 1.6, 2.3, P.frame, 0, C.hipY + 2.0, 0, 0.2));
  torso.add(chamferBox(4.65 * C.chest, 3.15, 2.65, chestMat, 0, C.hipY + 4.15, 0, 0.3));
  torso.add(chamferBox(5.35 * C.chest, 1.15, 2.5, chestMat, 0, C.hipY + 5.55, -0.05, 0.2));
  torso.add(chamferBox(1.2, 2.15, 0.65, P.accent, 0, C.hipY + 3.35, 1.55, 0.1));
  torso.add(chamferBox(2.1, 0.7, 2.35, P.main, 0, C.hipY + 5.85, 0, 0.12));

  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = new THREE.Group();
    leg.position.set(sx * C.hipX, C.hipY, 0);
    const armour = new THREE.Group();
    armour.add(sph(0.8 * C.leg, P.joint, 0, 0, 0, 14, 9));
    armour.add(chamferBox(1.85 * C.leg, 2.8, 2.05, legArmour, 0, -1.72, 0, 0.2));
    armour.add(chamferBox(1.7 * C.leg, 0.9, 1.9, P.joint, 0, -3.42, 0.05, 0.12));
    armour.add(chamferBox(1.75 * C.leg, 1.45, 0.75, kneeMat, 0, -3.45, 1.18, 0.14));
    armour.add(chamferBox(2.05 * C.leg, 3.25, 2.25, legArmour, 0, -5.4, 0.05, 0.22));
    armour.add(chamferBox(1.7 * C.leg, 1.8, 0.75, legArmour, 0, -5.25, -1.38, 0.14));
    armour.add(cyl(0.55, 0.55, 0.75, P.joint, 0, -C.hipY + 1.35, 0, 12));
    // ExtrudeGeometry's bevel extends beyond the nominal rectangle.  The
    // centres account for that expansion so the rendered sole—not merely the
    // primitive's un-bevelled bounds—rests exactly on y=0.
    armour.add(chamferBox(2.25 * C.leg, 1.05, 3.2, footMat, 0, -C.hipY + 0.685, 0.55, 0.16));
    armour.add(chamferBox(2.05 * C.leg, 0.72, 1.5, footMat, 0, -C.hipY + 0.71, 2.2, 0.13));

    if (style === 'ground'){
      armour.add(chamferBox(2.0 * C.leg, 1.85, 0.55, legArmour, 0, -3.55, 1.45, 0.12));
      armour.add(box(0.42, 2.25, 0.65, P.dark, sx * 1.12, -5.35, -0.9));
    } else if (style === 'alex'){
      armour.add(chamferBox(0.72, 2.15, 1.0, P.chest, sx * 1.08, -5.55, -0.75, 0.12));
      armour.add(cyl(0.35, 0.45, 0.55, P.dark, sx * 1.2, -5.5, -1.35, 12).rotateX(PI / 2));
    } else if (style === 'gp01'){
      armour.add(chamferBox(0.8, 2.7, 1.2, P.main, sx * 1.18, -5.4, -0.65, 0.14));
      armour.add(chamferBox(1.7, 1.45, 0.7, P.accent, 0, -3.6, 1.35, 0.12));
      armour.add(cyl(0.38, 0.5, 0.58, P.dark, sx * 1.2, -6.1, -1.35, 12).rotateX(PI / 2));
    } else if (style === 'mk2'){
      armour.add(chamferBox(0.55, 3.1, 0.8, P.chest, sx * 1.05, -5.35, -0.65, 0.11));
      armour.add(box(1.3, 0.22, 0.18, P.dark, 0, -4.55, 1.25));
      armour.add(box(1.3, 0.22, 0.18, P.dark, 0, -4.9, 1.28));
    } else if (style === 'x'){
      armour.add(chamferBox(0.35, 2.6, 0.52, P.chest, sx * 0.98, -5.4, 1.05, 0.09));
      armour.add(chamferBox(1.5, 0.65, 0.55, P.accent, 0, -6.7, 1.12, 0.1));
    } else if (style === 'lategm'){
      armour.add(chamferBox(0.62, 2.4, 1.05, P.main, sx * 1.08, -5.45, -0.55, 0.12));
      armour.add(cyl(0.34, 0.46, 0.5, P.dark, sx * 1.2, -5.8, -1.4, 12).rotateX(PI / 2));
    } else if (style === 'cannon'){
      armour.add(chamferBox(0.8, 2.4, 1.15, P.main, sx * 1.22, -5.3, -0.6, 0.12));
      armour.add(chamferBox(2.05, 1.55, 0.8, P.main, 0, -3.5, 1.3, 0.12));
    }
    compactGroup(armour);
    leg.add(armour); root.add(leg); parts[key] = leg;
  }

  // All authored meshes face +Z.  In that basis the pilot's anatomical right is -X
  // (the pursuit camera is looking over the suit's back), matching the Zeon and
  // legacy rig contracts.  Keep the semantic arm names physical: guns/right hand
  // at -X, shields/left hand at +X.
  for (const [key, sx] of [['armL', 1], ['armR', -1]]){
    const arm = new THREE.Group();
    arm.position.set(sx * C.shoulderX, C.shoulderY, 0);
    const armour = new THREE.Group();
    armour.add(sph(0.72 * C.arm, P.joint, 0, -0.05, 0, 14, 9));
    armour.add(chamferBox(2.45 * C.arm, 1.85, 2.5, shoulderMat, 0, 0.05, 0, 0.18));
    armour.add(chamferBox(1.5 * C.arm, 2.55, 1.65, armArmour, 0, -1.75, 0, 0.16));
    armour.add(cyl(0.65, 0.65, 0.62, P.joint, 0, -3.25, 0, 12));
    armour.add(chamferBox(1.85 * C.arm, 2.75, 2.0, armArmour, 0, -4.75, 0.18, 0.18));
    armour.add(chamferBox(1.25, 0.9, 1.45, P.frame, 0, -6.18, 0.35, 0.12));

    if (style === 'ground'){
      armour.add(chamferBox(2.7, 0.55, 2.72, P.dark, 0, 0.83, -0.05, 0.1));
      armour.add(box(0.22, 1.6, 1.6, P.accent, sx * 1.2, 0.05, 0));
    } else if (style === 'alex'){
      armour.add(chamferBox(2.55, 0.55, 2.8, P.chest, 0, 0.8, -0.05, 0.1));
      armour.add(chamferBox(2.0, 2.7, 0.65, P.chest, 0, -4.7, 1.3, 0.1));
    } else if (style === 'gp01'){
      const flare = profile([[-1.8, -0.8], [-1.25, 1.2], [0.9, 1.0], [1.45, -1.05]], [], 2.7, P.main, 0, 0.1, 0);
      flare.scale.set(1, 1, 1); armour.add(flare);
      armour.add(chamferBox(2.45, 0.35, 2.8, P.accent, 0, 0.95, -0.05, 0.08));
    } else if (style === 'mk2'){
      armour.add(chamferBox(2.8, 0.55, 2.95, P.chest, 0, 0.85, -0.05, 0.09));
      for (const oz of [-0.72, 0, 0.72]) armour.add(box(1.5, 0.13, 0.34, P.dark, 0, 1.15, oz));
    } else if (style === 'x'){
      armour.add(chamferBox(2.4, 0.42, 2.7, P.chest, 0, 0.75, 0, 0.09));
      armour.add(chamferBox(0.45, 2.25, 0.52, P.trim, sx * 1.15, -0.1, 1.18, 0.08));
    } else if (style === 'lategm'){
      armour.add(chamferBox(2.62, 0.5, 2.85, P.dark, 0, 0.82, -0.05, 0.1));
      armour.add(chamferBox(0.45, 2.0, 0.5, P.main, sx * 1.2, -0.05, 1.15, 0.08));
    } else if (style === 'cannon'){
      armour.add(chamferBox(3.05, 1.0, 2.9, P.main, 0, 0.55, 0, 0.15));
      armour.add(chamferBox(2.0, 2.6, 0.55, P.chest, 0, -4.7, 1.25, 0.09));
    }
    compactGroup(armour);
    arm.add(armour); root.add(arm); parts[key] = arm;
  }

  return { root, parts, torso, waist, backpack, backpackBody, C };
}

function finishHumanoid(suit, rig, options = {}){
  compactGroup(rig.torso);
  compactGroup(rig.waist);
  compactGroup(rig.backpackBody);
  rig.root.name = `canonical-${suit.id}`;
  return {
    root: rig.root,
    parts: rig.parts,
    kind: 'humanoid',
    allowDefaultShield: options.allowDefaultShield,
    weaponMount: options.weaponMount,
    meleeMount: options.meleeMount,
    fixedMuzzle: options.fixedMuzzle,
  };
}

function addChestVents(rig, P, y, z = 1.48, width = 0.9){
  for (const sx of [-1, 1]){
    const vent = chamferBox(width, 0.72, 0.25, P.trim, sx * 1.18, y, z, 0.08);
    vent.rotation.z = -sx * 0.14; rig.torso.add(vent);
    for (let i = -1; i <= 1; i++) rig.torso.add(box(width * 0.82, 0.055, 0.08, P.dark, sx * 1.18, y + i * 0.18, z + 0.15));
  }
}

function addGundamHead(rig, P, options = {}){
  const head = new THREE.Group();
  head.position.set(0, options.y || rig.C.shoulderY + 2.25, 0);
  const geom = new THREE.Group();
  geom.add(chamferBox(2.2, 1.55, 2.0, P.main, 0, 0.15, 0, 0.2));
  geom.add(chamferBox(1.8, 0.85, 1.95, options.crownMat || P.main, 0, 0.92, -0.08, 0.14));
  geom.add(box(1.62, 0.42, 0.34, P.dark, 0, 0.16, 1.07));
  geom.add(chamferBox(0.36, 0.3, 0.2, P.eye, -0.43, 0.18, 1.29, 0.04));
  geom.add(chamferBox(0.36, 0.3, 0.2, P.eye, 0.43, 0.18, 1.29, 0.04));
  geom.add(chamferBox(0.38, 0.82, 0.45, P.main, 0, -0.12, 1.22, 0.08));
  geom.add(chamferBox(0.72, 0.5, 0.72, options.chinMat || P.accent, 0, -0.72, 0.92, 0.1));
  for (const sx of [-1, 1]){
    geom.add(chamferBox(0.52, 0.72, 0.58, P.main, sx * 0.8, -0.45, 0.82, 0.09));
    geom.add(box(0.32, 0.08, 0.18, P.dark, sx * 0.8, -0.35, 1.14));
    geom.add(box(0.32, 0.08, 0.18, P.dark, sx * 0.8, -0.55, 1.1));
  }
  geom.add(chamferBox(0.46, 0.78, 0.32, options.crestMat || P.accent, 0, 1.22, 0.87, 0.08));

  if (options.ez8){
    geom.add(chamferBox(2.35, 0.42, 0.52, P.chest, 0, 0.62, 0.95, 0.08));
    geom.add(chamferBox(0.5, 1.25, 0.6, P.main, -1.0, -0.12, 0.35, 0.09));
    geom.add(chamferBox(0.5, 1.25, 0.6, P.main, 1.0, -0.12, 0.35, 0.09));
    const ant = box(0.15, 2.25, 0.16, P.dark, 0.92, 1.55, -0.05);
    ant.rotation.z = -0.2; geom.add(ant);
  } else {
    const finScale = options.smallFin ? 0.78 : 1;
    for (const sx of [-1, 1]){
      const fin = chamferBox(0.22, 2.65 * finScale, 0.2, P.trim, sx * 0.82 * finScale, 1.65, 0.35, 0.04);
      fin.rotation.z = -sx * 0.68; geom.add(fin);
      const inner = box(0.16, 1.15 * finScale, 0.18, P.trim, sx * 0.37, 1.4, 0.37);
      inner.rotation.z = -sx * 0.23; geom.add(inner);
    }
  }

  if (options.vulcanPod){
    geom.add(chamferBox(2.7, 0.5, 1.25, P.dark, 0, 0.82, 0.05, 0.09));
    geom.add(cyl(0.28, 0.28, 0.78, P.frame, -1.32, 0.78, 0.5, 10).rotateX(PI / 2));
    geom.add(cyl(0.14, 0.14, 0.32, P.dark, -1.32, 0.78, 1.02, 10).rotateX(PI / 2));
  }

  compactGroup(geom); head.add(geom);
  const eye = new THREE.Object3D(); eye.position.set(0, 0.18, 1.58); head.add(eye);
  rig.root.add(head); rig.parts.head = head; rig.parts.eye = eye; rig.parts.eyeMat = P.eye;
  return head;
}

// A thin polygon extruded toward the camera.  GM faces are defined by their
// sensor-window outlines, so a front plate reads much closer to the animation
// model sheets than another stack of rectangular boxes.
function frontPlate(points, depth, material, x = 0, y = 0, z = 0){
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); return mesh;
}

function gmVisorMaterial(P, color = 0x58cbb0, emissive = 0x35d6ad){
  const material = P.eye.clone();
  material.color.setHex(color); material.emissive.setHex(emissive);
  material.emissiveIntensity = 2.0; material.roughness = 0.22; material.metalness = 0.34;
  return material;
}

function finishGMHead(rig, P, head, geom, eyePosition, eyeMaterial){
  compactGroup(geom); head.add(geom);
  const eye = new THREE.Object3D(); eye.position.copy(eyePosition); head.add(eye);
  rig.root.add(head); rig.parts.head = head; rig.parts.eye = eye; rig.parts.eyeMat = eyeMaterial || P.eye;
  return head;
}

// RGM-79: rounded mint shell, inset wraparound visor, broad central face guard,
// circular ear covers and the raised green main camera from the 1979 model sheet.
function addClassicGMHead(rig, P){
  const head = new THREE.Group(); head.position.set(0, rig.C.shoulderY + 2.15, 0);
  const geom = new THREE.Group(), visor = gmVisorMaterial(P);
  const dome = sph(1.08, P.main, 0, 0.23, -0.08, 24, 16); dome.scale.set(1.06, 1.03, 0.98); geom.add(dome);
  geom.add(chamferBox(1.92, 0.92, 1.55, P.main, 0, -0.42, -0.08, 0.15));
  geom.add(frontPlate([[-0.9, 0.28], [-0.68, 0.58], [0.68, 0.58], [0.9, 0.28], [0.78, -0.27], [0.38, -0.42], [-0.38, -0.42], [-0.78, -0.27]], 0.24, P.dark, 0, 0.07, 0.96));
  geom.add(frontPlate([[-0.76, 0.25], [-0.59, 0.47], [0.59, 0.47], [0.76, 0.25], [0.67, -0.17], [0.34, -0.29], [-0.34, -0.29], [-0.67, -0.17]], 0.13, visor, 0, 0.1, 1.13));
  geom.add(chamferBox(0.64, 0.98, 0.62, P.main, 0, -0.45, 1.08, 0.1));
  for (const sx of [-1, 1]){
    const cheek = chamferBox(0.5, 0.68, 0.58, P.main, sx * 0.65, -0.48, 0.82, 0.09);
    cheek.rotation.z = -sx * 0.08; geom.add(cheek);
    geom.add(cyl(0.43, 0.43, 0.22, P.main, sx * 1.06, 0.0, -0.08, 16).rotateZ(PI / 2));
    geom.add(cyl(0.29, 0.29, 0.25, P.frame, sx * 1.07, 0.0, -0.08, 14).rotateZ(PI / 2));
  }
  // The original sheet is deliberately asymmetric here: a diagonal service
  // slot on the left temple and a round 60 mm port on the right.
  const templeSlot = box(0.29, 0.1, 0.12, P.dark, -0.62, 0.72, 0.69);
  templeSlot.rotation.z = 0.35; geom.add(templeSlot);
  geom.add(cyl(0.12, 0.12, 0.12, P.dark, 0.62, 0.72, 0.69, 10).rotateX(PI / 2));
  geom.add(chamferBox(0.62, 0.58, 0.7, P.main, 0, 1.08, -0.05, 0.11));
  geom.add(chamferBox(0.37, 0.28, 0.14, visor, 0, 1.13, 0.39, 0.04));
  return finishGMHead(rig, P, head, geom, new THREE.Vector3(0, 0.12, 1.42), visor);
}

// RGM-79[G]: the Requiem/08th MS Team ground head is much more angular.  Its
// tall camera mohawk and central mask visibly split the green panoramic visor.
function addGroundGMHead(rig, P){
  const head = new THREE.Group(); head.position.set(0, rig.C.shoulderY + 2.12, 0);
  const geom = new THREE.Group(), visor = gmVisorMaterial(P, 0x5ec7a3, 0x30d395);
  geom.add(chamferBox(2.15, 1.58, 1.82, P.main, 0, 0.0, -0.08, 0.2));
  geom.add(chamferBox(1.72, 0.72, 1.6, P.main, 0, 0.83, -0.17, 0.13));
  geom.add(frontPlate([[-0.9, 0.3], [-0.67, 0.58], [0.67, 0.58], [0.9, 0.3], [0.74, -0.25], [0.38, -0.38], [-0.38, -0.38], [-0.74, -0.25]], 0.23, P.dark, 0, 0.08, 0.96));
  geom.add(frontPlate([[-0.75, 0.2], [-0.57, 0.36], [0.57, 0.36], [0.75, 0.2], [0.63, -0.1], [0.31, -0.18], [-0.31, -0.18], [-0.63, -0.1]], 0.13, visor, 0, 0.1, 1.13));
  geom.add(chamferBox(0.5, 0.82, 0.58, P.main, 0, -0.4, 1.09, 0.09));
  for (const sx of [-1, 1]){
    const cheek = chamferBox(0.52, 0.72, 0.6, P.dark, sx * 0.68, -0.5, 0.78, 0.09);
    cheek.rotation.z = -sx * 0.09; geom.add(cheek);
    geom.add(cyl(0.44, 0.44, 0.24, P.main, sx * 1.08, -0.05, -0.05, 16).rotateZ(PI / 2));
    geom.add(cyl(0.28, 0.28, 0.27, P.dark, sx * 1.09, -0.05, -0.05, 14).rotateZ(PI / 2));
  }
  geom.add(chamferBox(0.62, 0.88, 0.68, P.dark, 0, 1.17, -0.08, 0.11));
  geom.add(chamferBox(0.36, 0.28, 0.14, visor, 0, 1.26, 0.36, 0.05));
  geom.add(chamferBox(1.05, 0.22, 0.24, P.dark, 0, -0.91, 0.48, 0.05));
  return finishGMHead(rig, P, head, geom, new THREE.Vector3(0, 0.12, 1.43), visor);
}

// RGM-79SP: a dedicated movable optical hood replaces the ordinary GM visor.
// The small green rangefinder sits to port, with a second visor below the hood.
function addSniperIIHead(rig, P){
  const head = new THREE.Group(); head.position.set(0, rig.C.shoulderY + 2.15, 0);
  const geom = new THREE.Group(), visor = gmVisorMaterial(P, 0x55d3a8, 0x32db9c);
  geom.add(chamferBox(1.92, 1.46, 1.7, P.main, 0, -0.02, -0.12, 0.18));
  geom.add(chamferBox(2.24, 0.93, 1.55, P.chest, 0, 0.5, 0.38, 0.16));
  geom.add(chamferBox(1.82, 0.38, 1.35, P.chest, 0, 1.08, 0.12, 0.09));
  geom.add(frontPlate([[-0.88, 0.36], [0.88, 0.36], [0.82, -0.36], [-0.82, -0.36]], 0.12, P.dark, 0, 0.5, 1.2));
  geom.add(chamferBox(0.42, 0.5, 0.14, P.frame, -0.64, 0.5, 1.28, 0.05));
  geom.add(chamferBox(0.26, 0.32, 0.12, visor, -0.64, 0.5, 1.37, 0.04));
  geom.add(frontPlate([[-0.57, 0.18], [0.57, 0.18], [0.43, -0.28], [-0.43, -0.28]], 0.13, visor, 0, -0.18, 1.1));
  geom.add(chamferBox(0.74, 0.72, 0.6, P.trim, 0, -0.61, 0.95, 0.1));
  geom.add(chamferBox(0.42, 0.25, 0.2, P.accent, 0.47, -0.44, 1.29, 0.04));
  for (const sx of [-1, 1]){
    geom.add(cyl(0.46, 0.46, 0.25, P.main, sx * 1.0, -0.02, -0.17, 16).rotateZ(PI / 2));
    geom.add(cyl(0.31, 0.31, 0.28, P.chest, sx * 1.02, -0.02, -0.17, 14).rotateZ(PI / 2));
    for (let i = 0; i < 2; i++) geom.add(chamferBox(0.28, 0.1, 0.13, P.accent, sx * 0.89, 0.52 - i * 0.22, 1.18, 0.025));
  }
  const antenna = cyl(0.045, 0.065, 2.55, P.frame, 0.72, 1.74, -0.28, 8);
  antenna.rotation.z = -0.055; geom.add(antenna);
  geom.add(cyl(0.11, 0.16, 0.28, P.main, 0.72, 0.48, -0.28, 10));
  return finishGMHead(rig, P, head, geom, new THREE.Vector3(0, 0.0, 1.42), visor);
}

// RGM-79S: armored jungle sensor head.  Only a narrow blue camera slit is
// exposed; the triple smoke discharger points forward from the left temple.
function addSpartanHead(rig, P){
  const head = new THREE.Group(); head.position.set(0, rig.C.shoulderY + 2.08, 0);
  const geom = new THREE.Group(), visor = gmVisorMaterial(P, 0x36b8ca, 0x22cbe4);
  geom.add(chamferBox(2.1, 1.42, 1.82, P.chest, 0, -0.04, -0.12, 0.18));
  geom.add(frontPlate([[-1.0, 0.06], [-0.65, 0.88], [0.64, 0.88], [1.0, 0.18], [0.82, -0.2], [-0.82, -0.2]], 1.58, P.main, 0, 0.28, -0.08));
  geom.add(frontPlate([[-0.8, 0.19], [0.8, 0.19], [0.68, -0.2], [-0.68, -0.2]], 0.2, P.dark, 0, -0.11, 0.96));
  geom.add(chamferBox(1.18, 0.18, 0.12, visor, 0, -0.12, 1.12, 0.035));
  geom.add(frontPlate([[-0.68, 0.12], [0.68, 0.12], [0.54, -0.62], [-0.46, -0.72], [-0.7, -0.38]], 0.58, P.chest, 0, -0.39, 0.82));
  for (const sx of [-1, 1]){
    geom.add(cyl(0.49, 0.49, 0.25, P.dark, sx * 1.06, 0.02, -0.18, 16).rotateZ(PI / 2));
    geom.add(cyl(0.34, 0.34, 0.28, P.chest, sx * 1.08, 0.02, -0.18, 14).rotateZ(PI / 2));
  }
  geom.add(chamferBox(0.16, 0.5, 0.72, P.accent, -1.08, 0.32, -0.43, 0.04));
  const antenna = cyl(0.045, 0.065, 2.65, P.frame, 0.48, 1.78, -0.42, 8);
  antenna.rotation.z = -0.035; geom.add(antenna);
  geom.add(cyl(0.13, 0.17, 0.32, P.dark, 0.48, 0.49, -0.42, 10));
  for (let i = 0; i < 3; i++){
    const x = -0.92 + i * 0.24, y = 0.65 + i * 0.11;
    geom.add(cyl(0.14, 0.18, 0.88, P.dark, x, y, 0.6, 10).rotateX(PI / 2));
    geom.add(cyl(0.08, 0.08, 0.09, P.frame, x, y, 1.06, 9).rotateX(PI / 2));
  }
  return finishGMHead(rig, P, head, geom, new THREE.Vector3(0, -0.1, 1.32), visor);
}

function addGuncannonHead(rig, P){
  const head = new THREE.Group(); head.position.set(0, rig.C.shoulderY + 2.05, 0);
  const geom = new THREE.Group();
  geom.add(chamferBox(2.2, 1.65, 2.0, P.accent, 0, 0, 0, 0.22));
  geom.add(chamferBox(1.85, 0.68, 0.35, P.eye, 0, 0.18, 1.12, 0.08));
  geom.add(chamferBox(2.1, 0.3, 0.4, P.dark, 0, 0.65, 1.05, 0.06));
  geom.add(chamferBox(1.2, 0.5, 0.68, P.accent, 0, -0.62, 0.83, 0.1));
  for (const sx of [-1, 1]) geom.add(cyl(0.4, 0.4, 0.45, P.dark, sx * 1.08, -0.05, 0, 12).rotateZ(PI / 2));
  compactGroup(geom); head.add(geom);
  const eye = new THREE.Object3D(); eye.position.set(0, 0.2, 1.55); head.add(eye);
  rig.root.add(head); rig.parts.head = head; rig.parts.eye = eye; rig.parts.eyeMat = P.eye;
}

// Shield-local frame is the left forearm: y follows the arm and +z is forward.
function makeArmShield(P, kind = 'gundam', short = false){
  const g = new THREE.Group();
  const h = short ? 4.25 : 6.0;
  const w = short ? 2.75 : 3.45;
  const rim = kind === 'gm' ? P.main : P.main;
  const face = kind === 'ground' ? P.chest : kind === 'alex' ? P.chest : kind === 'sniper' ? P.main : P.accent;
  const outline = [[-w * 0.42, h * 0.5], [w * 0.42, h * 0.5], [w * 0.5, h * 0.27], [w * 0.34, -h * 0.43], [0, -h * 0.55], [-w * 0.34, -h * 0.43], [-w * 0.5, h * 0.27]];
  g.add(profile(outline, [], 0.48, rim));
  const inner = outline.map(([z, y]) => [z * 0.82, y * 0.86]);
  const faceMesh = profile(inner, [], 0.54, face, -0.1, 0, 0); g.add(faceMesh);
  g.add(box(0.28, h * 0.63, 0.36, P.dark, 0.36, 0.05, 0));
  g.add(box(0.38, 0.65, 1.4, P.dark, 0.42, 1.0, 0));
  g.add(box(0.38, 0.65, 1.4, P.dark, 0.42, -1.0, 0));
  if (kind === 'gundam' || kind === 'gm'){
    g.add(box(0.18, h * 0.46, 0.42, P.trim, -0.31, 0.65, 0));
    g.add(box(0.18, 0.48, w * 0.55, P.trim, -0.32, 1.4, 0));
  } else if (kind === 'ground'){
    g.add(box(0.2, 0.38, w * 0.58, P.trim, -0.31, 0.55, 0));
    g.add(box(0.2, 1.35, 0.28, P.trim, -0.31, 0.55, 0));
  }
  return g;
}

function mountShield(rig, shield, x = 1.32, y = -3.45, z = 0.2){
  shield.position.set(x, y, z); shield.rotation.y = 0.06;
  rig.parts.armL.add(shield); rig.parts.shield = shield; rig.parts.shieldKind = 'native';
}

function addStandardBackpack(rig, P, options = {}){
  const y = options.y || 13.1;
  rig.backpackBody.add(chamferBox(options.width || 3.45, options.height || 3.6, options.depth || 1.45, options.material || P.chest, 0, y, -1.8, 0.18));
  rig.backpackBody.add(chamferBox(2.2, 1.0, 0.65, P.dark, 0, y + 0.25, -2.72, 0.1));
  if (options.sabers !== false){
    for (const sx of [-1, 1]){
      const hilt = cyl(0.19, 0.23, 2.45, P.frame, sx * 1.22, y + 2.45, -1.95, 10);
      hilt.rotation.z = sx * 0.09; rig.backpackBody.add(hilt);
      rig.backpackBody.add(cyl(0.27, 0.27, 0.25, P.trim, sx * 1.22, y + 3.65, -1.95, 10));
    }
  }
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -0.86, y - 0.95, -2.75, options.thruster || 0.46, 2.2, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 0.86, y - 0.95, -2.75, options.thruster || 0.46, 2.2, 'rear');
}

function buildRX78(suit, M){
  const P = palette('rx78', M);
  const rig = makeBiped(P, 'standard');
  addGundamHead(rig, P);
  addChestVents(rig, P, 12.55);
  rig.torso.add(chamferBox(1.0, 1.25, 0.45, P.accent, 0, 12.05, 1.56, 0.09));
  rig.torso.add(chamferBox(2.35, 0.48, 0.55, P.trim, 0, 14.18, 1.25, 0.08));
  for (const sx of [-1, 1]){
    rig.torso.add(chamferBox(0.85, 0.42, 0.3, P.main, sx * 2.25, 13.48, 1.35, 0.06));
    rig.waist.add(box(0.32, 1.35, 0.18, P.dark, sx * 0.82, 8.3, 1.68));
  }
  addStandardBackpack(rig, P);
  mountShield(rig, makeArmShield(P, 'gundam'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function makeThunderboltShield(P){
  const g = new THREE.Group();
  const outline = [[-1.5, 2.85], [1.5, 2.85], [1.75, 1.95], [1.35, -2.25], [0, -3.05], [-1.35, -2.25], [-1.75, 1.95]];
  // Rotate the normal from x to z: backpack shields face fore/aft rather than
  // being welded edge-on like an ordinary forearm shield.
  const rim = profile(outline, [], 0.42, P.main); rim.rotation.y = PI / 2; g.add(rim);
  const inner = profile(outline.map(([z, y]) => [z * 0.82, y * 0.87]), [], 0.47, P.accent, 0, 0, 0);
  inner.rotation.y = PI / 2; inner.position.z = 0.02; g.add(inner);
  g.add(box(0.38, 3.8, 0.52, P.chest, 0, 0.15, 0.28));
  g.add(box(1.85, 0.42, 0.54, P.chest, 0, 1.25, 0.29));
  g.add(chamferBox(0.8, 0.65, 0.18, P.trim, 0, 2.18, 0.5, 0.05));
  return g;
}

function buildFA78(suit, M){
  const P = palette('fa78', M);
  const rig = makeBiped(P, 'heavy', { shoulderMat: P.chest, kneeMat: P.chest });
  addGundamHead(rig, P, { crownMat: P.chest });
  addChestVents(rig, P, 12.5, 1.52, 0.88);
  rig.torso.add(chamferBox(1.15, 1.5, 0.58, P.accent, 0, 11.95, 1.62, 0.1));
  rig.torso.add(chamferBox(5.6, 0.55, 2.8, P.main, 0, 14.35, 0, 0.1));
  rig.waist.add(chamferBox(3.3, 0.7, 2.75, P.chest, 0, 10.0, 0, 0.12));

  // Flexible debris seals at every exposed Thunderbolt joint.
  for (const limb of [rig.parts.armL, rig.parts.armR]){
    limb.add(ribbedCable([[0, -2.78, 0], [0, -3.65, 0]], 0.48, P.joint, P.dark, 8));
    limb.add(ribbedCable([[0, -5.85, 0.15], [0, -6.35, 0.3]], 0.42, P.joint, P.dark, 5));
  }
  for (const limb of [rig.parts.legL, rig.parts.legR]){
    limb.add(ribbedCable([[0, -3.0, 0], [0, -3.9, 0]], 0.5, P.joint, P.dark, 8));
    limb.add(ribbedCable([[0, -7.05, 0], [0, -7.6, 0]], 0.44, P.joint, P.dark, 5));
  }

  // Satchel unit: two huge rear boosters, beam cannon, missile pod and four
  // articulated shield sub-arms are all mandatory silhouette elements.
  rig.backpackBody.add(chamferBox(5.4, 4.8, 2.4, P.chest, 0, 12.7, -2.7, 0.28));
  rig.backpackBody.add(chamferBox(4.3, 1.25, 1.2, P.dark, 0, 14.65, -4.15, 0.14));
  for (const sx of [-1, 1]){
    const booster = new THREE.Group();
    booster.position.set(sx * 2.4, 11.8, -4.35); booster.rotation.z = -sx * 0.09;
    booster.add(cyl(0.9, 1.12, 6.8, P.chest, 0, 0, -2.75, 16).rotateX(PI / 2));
    booster.add(cyl(1.18, 1.18, 0.65, P.dark, 0, 0, -6.05, 16).rotateX(PI / 2));
    booster.add(chamferBox(0.55, 2.8, 1.2, P.main, sx * 0.75, 0.2, -2.7, 0.1));
    rig.backpack.add(booster);
    addThruster(rig.backpack, rig.parts, P.dark, P.flame, sx * 2.4, 11.8, -10.55, 0.92, 3.4, 'rear');
  }
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -0.9, 11.55, -4.2, 0.52, 2.4, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 0.9, 11.55, -4.2, 0.52, 2.4, 'rear');

  const beamCannon = new THREE.Group(); beamCannon.position.set(2.85, 14.4, -2.4); beamCannon.rotation.z = -0.1;
  beamCannon.add(chamferBox(1.15, 1.4, 3.5, P.dark, 0, 0, 0.4, 0.14));
  beamCannon.add(cyl(0.34, 0.42, 7.4, P.frame, 0, 0.2, 5.7, 14).rotateX(PI / 2));
  beamCannon.add(cyl(0.52, 0.52, 0.7, P.chest, 0, 0.2, 9.42, 14).rotateX(PI / 2));
  rig.backpack.add(beamCannon);
  const missiles = new THREE.Group(); missiles.position.set(-2.9, 14.25, -2.2);
  missiles.add(chamferBox(1.85, 2.8, 2.8, P.chest, 0, 0, 0, 0.18));
  const missileMuzzles = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++){
    missiles.add(cyl(0.28, 0.28, 0.36, P.dark, (col - 0.5) * 0.72, (row - 1) * 0.72, 1.55, 12).rotateX(PI / 2));
    const muzzle = new THREE.Object3D(); muzzle.position.set((col - 0.5) * 0.72, (row - 1) * 0.72, 1.82); missiles.add(muzzle); missileMuzzles.push(muzzle);
  }
  rig.backpack.add(missiles);
  rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[2] = missileMuzzles;

  const shieldBank = new THREE.Group();
  for (const [sx, y, z, rz] of [[-1, 14.3, -0.8, 0.08], [1, 14.3, -0.8, -0.08], [-1, 9.7, -1.35, -0.08], [1, 9.7, -1.35, 0.08]]){
    const elbow = new THREE.Vector3(sx * 3.3, y + (y > 12 ? -0.5 : 0.5), -2.5);
    shieldBank.add(tube([[sx * 1.8, 12.9, -3.1], [sx * 2.5, 12.3, -2.8], elbow], 0.2, P.frame, 12, 7));
    shieldBank.add(sph(0.38, P.dark, elbow.x, elbow.y, elbow.z, 12, 8));
    const shield = makeThunderboltShield(P); shield.position.set(sx * 4.25, y, z); shield.rotation.z = rz; shieldBank.add(shield);
  }
  rig.root.add(shieldBank); rig.parts.shield = shieldBank; rig.parts.shieldKind = 'native';
  return finishHumanoid(suit, rig, { allowDefaultShield: false, weaponMount: [0, -6.35, 1.0] });
}

function addGroundBackpack(rig, P){
  rig.backpackBody.add(chamferBox(4.5, 4.15, 1.65, P.dark, 0, 12.45, -1.95, 0.2));
  rig.backpackBody.add(chamferBox(3.75, 2.65, 1.25, P.chest, 0, 12.55, -2.95, 0.16));
  for (const sx of [-1, 1]){
    rig.backpackBody.add(chamferBox(0.75, 4.65, 0.8, P.frame, sx * 2.15, 12.6, -2.1, 0.1));
    rig.backpackBody.add(box(0.55, 0.55, 1.8, P.dark, sx * 2.15, 14.65, -2.4));
    rig.backpackBody.add(box(0.55, 0.55, 1.8, P.dark, sx * 2.15, 10.55, -2.4));
  }
  rig.backpackBody.add(box(4.5, 0.45, 0.6, P.frame, 0, 14.65, -3.0));
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -0.95, 10.7, -3.2, 0.43, 2.0, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 0.95, 10.7, -3.2, 0.43, 2.0, 'rear');
}

function buildGroundGundam(suit, M){
  const P = palette('rx79g', M);
  const rig = makeBiped(P, 'ground', { footMat: P.chest });
  addGundamHead(rig, P, { smallFin: true });
  addChestVents(rig, P, 12.35, 1.52, 0.82);
  rig.torso.add(chamferBox(1.0, 1.35, 0.5, P.accent, 0, 11.75, 1.6, 0.09));
  rig.torso.add(chamferBox(5.5, 0.55, 2.75, P.main, 0, 14.05, 0, 0.1));
  for (const sx of [-1, 1]){
    rig.torso.add(box(0.24, 1.65, 0.25, P.dark, sx * 2.35, 12.9, 1.4));
  }
  rig.parts.legL.add(cyl(0.22, 0.22, 2.1, P.frame, -0.4, -5.5, -1.38, 10));
  rig.parts.legR.add(cyl(0.22, 0.22, 2.1, P.frame, 0.4, -5.5, -1.38, 10));
  addGroundBackpack(rig, P);
  mountShield(rig, makeArmShield(P, 'ground', true), 1.28, -3.5, 0.18);
  const chestMuzzles = [-1.65, 1.65].map(x => { const a = new THREE.Object3D(); a.position.set(x, 12.9, 1.95); rig.torso.add(a); return a; });
  rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[2] = chestMuzzles;
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildEz8(suit, M){
  const P = palette('ez8', M);
  const rig = makeBiped(P, 'ground', { footMat: P.chest, kneeMat: P.main });
  addGundamHead(rig, P, { ez8: true, crestMat: P.main });
  // Field-rebuild chest: three heavy horizontal slabs, left anti-personnel
  // weapon and right sensor recess distinguish it from the Ground Gundam.
  rig.torso.add(chamferBox(5.4, 0.58, 2.95, P.main, 0, 14.1, 0, 0.1));
  for (const y of [13.45, 12.8, 12.15]) rig.torso.add(chamferBox(4.45, 0.42, 0.4, P.main, 0, y, 1.5, 0.07));
  rig.torso.add(chamferBox(1.0, 1.25, 0.45, P.accent, 0, 11.6, 1.62, 0.09));
  rig.torso.add(cyl(0.22, 0.26, 0.75, P.dark, 1.85, 12.8, 1.72, 10).rotateX(PI / 2));
  rig.torso.add(chamferBox(0.75, 0.62, 0.25, P.eye, -1.8, 12.82, 1.7, 0.06));
  addGroundBackpack(rig, P);
  mountShield(rig, makeArmShield(P, 'ground', true), 1.28, -3.5, 0.18);
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildNT1(suit, M){
  const P = palette('nt1', M);
  const rig = makeBiped(P, 'alex', { footMat: P.chest });
  addGundamHead(rig, P, { crownMat: P.chest, smallFin: true });
  addChestVents(rig, P, 12.65, 1.5, 0.78);
  rig.torso.add(chamferBox(1.05, 1.15, 0.48, P.accent, 0, 12.0, 1.58, 0.09));
  rig.torso.add(chamferBox(5.2, 0.5, 2.75, P.main, 0, 14.25, 0, 0.1));
  // Opening forearm housings with the Alex's integrated 90 mm rotary guns.
  const gatlingMuzzles = [];
  for (const arm of [rig.parts.armL, rig.parts.armR]){
    arm.add(chamferBox(1.82, 2.5, 0.42, P.chest, 0, -4.75, 1.35, 0.08));
    arm.add(chamferBox(1.55, 1.9, 0.34, P.main, 0, -4.75, 1.67, 0.06));
    for (const bx of [-0.42, 0, 0.42]) arm.add(cyl(0.12, 0.12, 1.25, P.dark, bx, -4.72, 2.48, 8).rotateX(PI / 2));
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, -4.72, 3.15); arm.add(muzzle); gatlingMuzzles.push(muzzle);
  }
  rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[1] = gatlingMuzzles;
  rig.parts.integratedAimArms = []; rig.parts.integratedAimArms[1] = [rig.parts.armL, rig.parts.armR];
  addStandardBackpack(rig, P, { width: 3.8, height: 3.85, material: P.chest, thruster: 0.52 });
  rig.backpackBody.add(chamferBox(0.75, 2.6, 0.85, P.main, -1.85, 13.2, -2.0, 0.1));
  rig.backpackBody.add(chamferBox(0.75, 2.6, 0.85, P.main, 1.85, 13.2, -2.0, 0.1));
  mountShield(rig, makeArmShield(P, 'alex'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildGP01(suit, M){
  const P = palette('gp01', M);
  const rig = makeBiped(P, 'gp01', { footMat: P.accent });
  addGundamHead(rig, P, { crownMat: P.chest });
  addChestVents(rig, P, 12.7, 1.52, 0.82);
  rig.torso.add(chamferBox(1.15, 1.55, 0.58, P.accent, 0, 11.8, 1.62, 0.1));
  rig.torso.add(chamferBox(5.85, 0.65, 3.0, P.main, 0, 14.35, -0.05, 0.12));
  for (const sx of [-1, 1]){
    const collar = chamferBox(1.35, 1.25, 2.65, P.chest, sx * 2.1, 13.75, 0, 0.14);
    collar.rotation.z = -sx * 0.18; rig.torso.add(collar);
  }
  // Core Fighter II tail and large GP01 vernier backpack.
  rig.backpackBody.add(chamferBox(4.3, 3.8, 1.8, P.chest, 0, 12.85, -2.0, 0.2));
  rig.backpackBody.add(chamferBox(1.0, 3.7, 2.1, P.main, -1.75, 13.7, -2.25, 0.15));
  rig.backpackBody.add(chamferBox(1.0, 3.7, 2.1, P.main, 1.75, 13.7, -2.25, 0.15));
  const tail = chamferBox(1.15, 3.3, 0.52, P.accent, 0, 13.2, -3.15, 0.09); tail.rotation.x = -0.16; rig.backpackBody.add(tail);
  for (const sx of [-1, 1]){
    rig.backpackBody.add(cyl(0.22, 0.25, 2.5, P.frame, sx * 1.32, 16.1, -2.1, 10));
    addThruster(rig.backpack, rig.parts, P.dark, P.flame, sx * 1.65, 12.0, -3.0, 0.62, 2.6, 'rear');
  }
  mountShield(rig, makeArmShield(P, 'gundam'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildMk2(suit, M){
  const P = palette('mk2', M);
  const rig = makeBiped(P, 'mk2', { footMat: P.chest, kneeMat: P.main });
  addGundamHead(rig, P, { crownMat: P.chest, vulcanPod: true });
  addChestVents(rig, P, 12.75, 1.5, 0.78);
  rig.torso.add(chamferBox(1.0, 1.45, 0.48, P.accent, 0, 11.85, 1.58, 0.09));
  rig.torso.add(chamferBox(5.55, 0.48, 2.8, P.main, 0, 14.45, 0, 0.1));
  for (const sx of [-1, 1]){
    rig.torso.add(chamferBox(0.58, 1.3, 0.34, P.trim, sx * 1.65, 12.85, 1.5, 0.07));
    rig.waist.add(chamferBox(0.48, 1.4, 0.3, P.accent, sx * 1.8, 8.8, 1.35, 0.06));
  }
  rig.backpackBody.add(chamferBox(3.7, 3.45, 1.6, P.chest, 0, 13.0, -1.95, 0.18));
  for (const sx of [-1, 1]){
    const pod = new THREE.Group(); pod.position.set(sx * 1.8, 13.25, -2.05); pod.rotation.z = -sx * 0.12;
    pod.add(chamferBox(0.9, 4.15, 1.4, P.chest, 0, 0, 0, 0.13));
    pod.add(cyl(0.42, 0.55, 0.7, P.dark, 0, -1.95, -0.65, 12).rotateX(PI / 2));
    rig.backpack.add(pod);
    rig.backpackBody.add(cyl(0.2, 0.24, 2.35, P.frame, sx * 1.05, 16.05, -1.95, 10));
    addThruster(rig.backpack, rig.parts, P.dark, P.flame, sx * 1.8, 11.25, -3.0, 0.5, 2.2, 'rear');
  }
  mountShield(rig, makeArmShield(P, 'gundam'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildGundamX(suit, M){
  const P = palette('gundamx', M);
  const rig = makeBiped(P, 'x', { footMat: P.accent, kneeMat: P.main });
  addGundamHead(rig, P, { crownMat: P.chest });
  addChestVents(rig, P, 12.62, 1.48, 0.72);
  rig.torso.add(chamferBox(0.9, 1.35, 0.48, P.accent, 0, 11.8, 1.56, 0.09));
  rig.torso.add(chamferBox(5.0, 0.45, 2.65, P.main, 0, 14.22, 0, 0.09));
  rig.backpackBody.add(chamferBox(3.2, 3.3, 1.5, P.chest, 0, 12.95, -2.0, 0.17));

  // Four microwave reflector vanes form the unmistakable X behind the unit.
  const reflectors = new THREE.Group(); reflectors.position.z = -2.75;
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]){
    const vane = new THREE.Group();
    vane.position.set(sx * 2.05, 12.95 + sy * 2.2, 0);
    vane.rotation.z = -sx * sy * 0.68;
    vane.add(chamferBox(1.15, 5.4, 0.42, P.main, 0, 0, 0, 0.12));
    vane.add(chamferBox(0.72, 4.45, 0.18, P.trim, 0, 0, 0.31, 0.07));
    for (const yy of [-1.4, 0, 1.4]) vane.add(box(0.72, 0.12, 0.2, P.chest, 0, yy, 0.43));
    reflectors.add(vane);
  }
  rig.root.add(reflectors);

  // Folded satellite cannon rides the right side of the backpack.  The shared
  // equipment layer supplies the deployed weapon state when it is selected.
  const cannon = new THREE.Group(); cannon.position.set(-2.65, 12.8, -2.1); cannon.rotation.z = 0.08;
  cannon.add(chamferBox(1.1, 6.7, 1.25, P.dark, 0, -1.0, 0, 0.14));
  cannon.add(chamferBox(0.72, 5.8, 0.75, P.main, 0, -1.0, 0.9, 0.1));
  cannon.add(cyl(0.48, 0.55, 0.75, P.chest, 0, -4.3, 0.55, 12).rotateX(PI / 2));
  cannon.add(chamferBox(1.7, 1.3, 1.6, P.chest, 0, 2.55, 0, 0.14));
  const satelliteMuzzle = new THREE.Object3D(); satelliteMuzzle.position.set(0, -4.75, 0.55); cannon.add(satelliteMuzzle);
  rig.root.add(cannon);
  const breastMuzzles = [-1.45, 1.45].map(x => { const a = new THREE.Object3D(); a.position.set(x, 12.65, 1.82); rig.torso.add(a); return a; });
  rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[0] = [satelliteMuzzle]; rig.parts.weaponMuzzles[2] = breastMuzzles;
  rig.parts.deployWeapon = wi => { cannon.rotation.x = wi === 0 ? -PI / 2 : 0; };
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -0.82, 11.85, -3.0, 0.44, 2.1, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 0.82, 11.85, -3.0, 0.44, 2.1, 'rear');
  return finishHumanoid(suit, rig, { allowDefaultShield: false, weaponMount: [0, -6.35, 1.0], meleeMount: [0, -6.4, 0.9] });
}

function buildGM(suit, M){
  const P = palette('gm', M);
  const rig = makeBiped(P, 'gm', { footMat: P.chest, chestMat: P.chest, shoulderMat: P.main });
  addClassicGMHead(rig, P);
  addChestVents(rig, P, 12.35, 1.46, 0.72);
  rig.torso.add(chamferBox(1.0, 1.2, 0.44, P.main, 0, 11.65, 1.54, 0.08));
  rig.torso.add(chamferBox(4.8, 0.42, 2.55, P.main, 0, 13.95, 0, 0.09));
  rig.backpackBody.add(chamferBox(3.05, 3.25, 1.35, P.dark, 0, 12.65, -1.8, 0.16));
  rig.backpackBody.add(chamferBox(1.9, 0.8, 0.62, P.frame, 0, 12.7, -2.62, 0.09));
  rig.backpackBody.add(cyl(0.2, 0.24, 2.35, P.frame, -0.85, 15.35, -1.85, 10));
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -0.68, 11.6, -2.65, 0.4, 1.9, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 0.68, 11.6, -2.65, 0.4, 1.9, 'rear');
  mountShield(rig, makeArmShield(P, 'gm'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildGroundGM(suit, M){
  const P = palette('groundgm', M);
  const rig = makeBiped(P, 'ground', { footMat: P.chest, chestMat: P.chest, shoulderMat: P.main });
  addGroundGMHead(rig, P);
  addChestVents(rig, P, 12.25, 1.48, 0.76);
  rig.torso.add(chamferBox(1.05, 1.25, 0.48, P.main, 0, 11.55, 1.58, 0.09));
  rig.torso.add(chamferBox(5.25, 0.5, 2.7, P.main, 0, 13.98, 0, 0.09));
  addGroundBackpack(rig, P);
  mountShield(rig, makeArmShield(P, 'ground', true), 1.28, -3.5, 0.18);
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function buildSniperII(suit, M){
  const P = palette('sniper', M);
  const rig = makeBiped(P, 'lategm', { footMat: P.accent, chestMat: P.chest, kneeMat: P.main });
  addSniperIIHead(rig, P);
  rig.torso.add(chamferBox(4.95, 0.48, 2.7, P.main, 0, 14.18, 0, 0.09));
  rig.torso.add(chamferBox(1.0, 1.35, 0.48, P.accent, 0, 11.85, 1.57, 0.09));
  for (const sx of [-1, 1]){
    rig.torso.add(chamferBox(0.75, 1.2, 0.34, P.main, sx * 1.6, 12.72, 1.52, 0.07));
    rig.waist.add(chamferBox(0.48, 1.3, 0.26, P.accent, sx * 1.72, 8.7, 1.3, 0.06));
  }
  // Late-production high-output backpack and lower-leg verniers.
  rig.backpackBody.add(chamferBox(4.15, 3.9, 1.75, P.dark, 0, 12.8, -2.05, 0.19));
  rig.backpackBody.add(chamferBox(2.6, 1.2, 0.75, P.main, 0, 14.1, -3.0, 0.11));
  for (const sx of [-1, 1]){
    rig.backpackBody.add(chamferBox(0.72, 3.35, 1.05, P.main, sx * 1.75, 12.9, -2.2, 0.12));
    addThruster(rig.backpack, rig.parts, P.dark, P.flame, sx * 1.45, 11.5, -3.05, 0.5, 2.2, 'rear');
  }
  mountShield(rig, makeArmShield(P, 'sniper'));
  return finishHumanoid(suit, rig, { allowDefaultShield: false, weaponMount: [0, -6.35, 0.95] });
}

function buildSpartan(suit, M){
  const P = palette('spartan', M);
  const rig = makeBiped(P, 'lategm', { footMat: P.chest, chestMat: P.chest, kneeMat: P.main, shoulderMat: P.main });
  addSpartanHead(rig, P);
  rig.torso.add(chamferBox(5.2, 0.65, 2.9, P.main, 0, 14.22, -0.05, 0.11));
  rig.torso.add(chamferBox(1.1, 1.45, 0.52, P.trim, 0, 11.78, 1.58, 0.09));
  rig.torso.add(chamferBox(3.8, 0.45, 0.34, P.dark, 0, 12.95, 1.62, 0.07));
  for (const sx of [-1, 1]) rig.torso.add(chamferBox(0.7, 1.35, 0.35, P.main, sx * 1.7, 12.65, 1.55, 0.07));

  // Twin WAMM launch tubes live on the right shoulder.
  const wam = new THREE.Group(); wam.position.set(-0.55, 0.95, -0.1);
  wam.add(chamferBox(1.85, 0.75, 2.0, P.dark, 0, 0, 0, 0.1));
  for (const bx of [-0.43, 0.43]){
    wam.add(cyl(0.3, 0.3, 2.15, P.main, bx, 0, 0.55, 12).rotateX(PI / 2));
    wam.add(cyl(0.21, 0.21, 0.2, P.trim, bx, 0, 1.67, 10).rotateX(PI / 2));
  }
  rig.parts.armR.add(wam);

  // Central Minovsky-particle dispersal pod, compact vernier units and heat-
  // knife sheath give the Spartan its crowded jungle-assault backpack.
  rig.backpackBody.add(chamferBox(4.1, 3.65, 1.7, P.chest, 0, 12.85, -2.0, 0.18));
  rig.backpackBody.add(cyl(0.78, 0.95, 2.4, P.main, 0, 14.55, -2.2, 14));
  rig.backpackBody.add(cyl(0.56, 0.56, 0.5, P.dark, 0, 15.82, -2.2, 14));
  for (const sx of [-1, 1]){
    rig.backpackBody.add(chamferBox(0.75, 3.0, 1.1, P.main, sx * 1.72, 12.8, -2.25, 0.12));
    addThruster(rig.backpack, rig.parts, P.dark, P.flame, sx * 1.4, 11.5, -3.0, 0.46, 2.0, 'rear');
  }
  const sheath = chamferBox(0.55, 3.2, 0.75, P.dark, -1.9, 10.4, -1.9, 0.1); sheath.rotation.z = -0.18; rig.backpackBody.add(sheath);
  rig.backpackBody.add(chamferBox(0.25, 2.65, 0.38, P.gold, -1.9, 10.45, -1.45, 0.06));
  for (let i = 0; i < 3; i++) rig.waist.add(cyl(0.23, 0.28, 0.75, P.dark, 2.1, 8.55 + i * 0.42, -0.55, 9).rotateZ(PI / 2));
  return finishHumanoid(suit, rig, { allowDefaultShield: false, weaponMount: [0, -6.35, 1.0], meleeMount: [0, -6.3, 0.8] });
}

function makeBullpup(P){
  const gun = new THREE.Group();
  gun.add(chamferBox(1.0, 1.35, 3.2, P.dark, 0, 0, 0.5, 0.12));
  gun.add(chamferBox(0.75, 0.72, 2.2, P.main, 0, 0.65, 0.5, 0.09));
  gun.add(chamferBox(0.7, 1.05, 1.35, P.dark, 0, -0.05, -1.75, 0.09));
  gun.add(chamferBox(0.48, 1.1, 0.65, P.dark, 0, -1.1, 0.15, 0.08));
  gun.add(cyl(0.18, 0.2, 4.4, P.frame, 0, 0.2, 4.25, 12).rotateX(PI / 2));
  gun.add(cyl(0.3, 0.3, 0.55, P.dark, 0, 0.2, 6.5, 12).rotateX(PI / 2));
  gun.add(chamferBox(0.32, 0.45, 1.5, P.dark, 0, 1.05, 0.2, 0.06));
  return gun;
}

function buildGuncannon(suit, M){
  const P = palette('guncannon', M);
  const rig = makeBiped(P, 'cannon', { footMat: P.chest, chestMat: P.chest, shoulderMat: P.main, kneeMat: P.main });
  addGuncannonHead(rig, P);
  rig.torso.add(chamferBox(5.95, 0.72, 3.0, P.main, 0, 14.05, -0.05, 0.12));
  rig.torso.add(chamferBox(1.2, 1.5, 0.55, P.main, 0, 11.45, 1.6, 0.1));
  for (const sx of [-1, 1]){
    rig.torso.add(chamferBox(0.9, 1.2, 0.38, P.trim, sx * 1.72, 12.4, 1.53, 0.07));
    rig.waist.add(chamferBox(0.5, 1.45, 0.3, P.main, sx * 1.92, 8.45, 1.3, 0.06));
  }
  rig.backpackBody.add(chamferBox(4.3, 3.9, 1.8, P.chest, 0, 12.5, -2.0, 0.2));
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, -1.2, 10.9, -3.0, 0.52, 2.2, 'rear');
  addThruster(rig.backpack, rig.parts, P.dark, P.flame, 1.2, 10.9, -3.0, 0.52, 2.2, 'rear');

  // Both 240 mm cannons share an elevation pivot.  Their long recoil jackets,
  // collars and open bores read correctly from front and rear.
  const bank = new THREE.Group(); bank.position.set(0, 14.25, -1.35); rig.root.add(bank); rig.parts.turret = bank;
  const cannonMuzzles = [];
  for (const sx of [-1, 1]){
    const cannon = new THREE.Group(); cannon.position.set(sx * 2.15, 0, 0); cannon.rotation.z = -sx * 0.045;
    cannon.add(chamferBox(1.2, 1.35, 3.0, P.dark, 0, 0, 0.8, 0.13));
    cannon.add(cyl(0.42, 0.52, 7.8, P.frame, 0, 0.15, 5.8, 14).rotateX(PI / 2));
    cannon.add(cyl(0.62, 0.62, 0.85, P.main, 0, 0.15, 9.75, 14).rotateX(PI / 2));
    cannon.add(cyl(0.36, 0.36, 0.18, P.dark, 0, 0.15, 10.22, 14).rotateX(PI / 2));
    const cannonMuzzle = new THREE.Object3D(); cannonMuzzle.position.set(0, 0.15, 10.45);
    cannon.add(cannonMuzzle); cannonMuzzles.push(cannonMuzzle); bank.add(cannon);
  }
  // Shoulder cannons keep their own two anchors.  The shared single muzzle is
  // reserved for the optional handheld bullpup so switching cannot reparent a
  // cannon anchor into a hidden gun.
  const muzzle = new THREE.Object3D(); rig.parts.muzzle = muzzle;
  rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[0] = cannonMuzzles;

  const gun = makeBullpup(P); gun.position.set(0, -6.35, 0.9); gun.visible = false; rig.parts.armR.add(gun);
  rig.parts.gun = gun; rig.parts.fixedWeapon = true; rig.parts.weaponIsHeld = false;
  rig.parts.rebuildGun = wi => {
    gun.visible = wi !== 0;
    if (wi === 0){
      rig.parts.weaponIsHeld = false;
      rig.parts.aimIntegrated = false; rig.parts.aimArms = []; rig.parts.aimArm = null; rig.parts.aimGun = null;
      rig.parts.turret = bank;
    } else {
      // poseAim sees no turret in bullpup mode and therefore raises the right
      // shoulder pivot as a normal handheld-weapon unit.
      rig.parts.weaponIsHeld = true;
      rig.parts.aimIntegrated = false; rig.parts.aimArms = [rig.parts.armR];
      rig.parts.aimArm = rig.parts.armR; rig.parts.aimGun = gun;
      rig.parts.turret = null;
      gun.add(muzzle); muzzle.position.set(0, 0.2, 6.85);
    }
  };
  const strike = new THREE.Group(); strike.visible = false; strike.position.set(0, -6.3, 0.7); rig.parts.armR.add(strike); rig.parts.blade = strike;
  return finishHumanoid(suit, rig, { allowDefaultShield: false });
}

function finishVehicle(suit, root, parts, P){
  parts.flames ||= [];
  parts.legL = null; parts.legR = null; parts.armL = null; parts.armR = null;
  parts.gun = null;
  if (!parts.head){ parts.head = new THREE.Object3D(); root.add(parts.head); }
  if (!parts.eye){ parts.eye = new THREE.Object3D(); parts.head.add(parts.eye); }
  if (!parts.muzzle){ parts.muzzle = new THREE.Object3D(); root.add(parts.muzzle); }
  if (!parts.blade){
    parts.blade = new THREE.Object3D(); parts.blade.visible = false; root.add(parts.blade);
  }
  parts.eyeMat ||= P.eye;
  parts.rebuildGun = () => {};
  root.name = `canonical-${suit.id}`;
  return { root, parts, kind: 'complete' };
}

function addTrackAssembly(root, P, config){
  const {
    x = 2.55, width = 2.35, front = 5.0, rear = -5.0,
    bottom = 0.3, top = 3.2, pitch = 0.5, wheel = 1.12,
    wheelZ = [-3.55, -1.2, 1.2, 3.55], fenderY = 3.45,
  } = config;
  const path = [
    [rear + 0.65, bottom], [front - 0.7, bottom], [front, bottom + 1.0],
    [front - 0.45, top], [rear + 0.45, top], [rear - 0.1, bottom + 1.05],
  ];
  root.add(instancedTrack(path, [-x, x], width, pitch, P.dark, true));
  const staticBits = new THREE.Group();
  for (const sx of [-1, 1]){
    for (const z of wheelZ){
      staticBits.add(cyl(wheel, wheel, width * 0.92, P.frame, sx * x, bottom + wheel * 0.92, z, 16).rotateZ(PI / 2));
      staticBits.add(cyl(wheel * 0.52, wheel * 0.52, width * 0.97, P.accent, sx * x, bottom + wheel * 0.92, z, 14).rotateZ(PI / 2));
    }
    staticBits.add(cyl(wheel * 1.22, wheel * 1.22, width * 0.94, P.frame, sx * x, bottom + 1.38, front - 0.35, 18).rotateZ(PI / 2));
    staticBits.add(cyl(wheel * 1.12, wheel * 1.12, width * 0.94, P.frame, sx * x, bottom + 1.25, rear + 0.35, 18).rotateZ(PI / 2));
    staticBits.add(chamferBox(width + 0.38, 0.48, front - rear + 0.2, P.main, sx * x, fenderY, (front + rear) / 2, 0.1));
    staticBits.add(chamferBox(width + 0.56, 0.65, 2.4, P.main, sx * x, fenderY + 0.25, front - 1.1, 0.12));
  }
  compactGroup(staticBits); root.add(staticBits);
  return { path, x, width };
}

function buildGuntankChassis(P){
  const root = new THREE.Group();
  const parts = { flames: [] };
  addTrackAssembly(root, P, {
    x: 2.55, width: 2.45, front: 5.25, rear: -5.1, bottom: 0.21,
    top: 3.25, pitch: 0.5, wheel: 1.05, wheelZ: [-3.55, -1.2, 1.2, 3.65], fenderY: 3.5,
  });
  const hull = new THREE.Group();
  hull.add(chamferBox(5.2, 1.35, 8.0, P.main, 0, 3.75, 0, 0.2));
  hull.add(chamferBox(4.45, 1.25, 5.9, P.accent, 0, 4.75, 0.15, 0.18));
  hull.add(chamferBox(3.8, 0.72, 4.55, P.dark, 0, 5.55, -0.15, 0.13));
  hull.add(chamferBox(3.5, 0.85, 2.3, P.main, 0, 5.25, 2.75, 0.13));
  for (const sx of [-1, 1]){
    hull.add(chamferBox(0.62, 0.72, 2.0, P.dark, sx * 2.55, 4.25, -3.15, 0.1));
    hull.add(chamferBox(0.75, 0.58, 1.5, P.trim, sx * 1.6, 5.75, 2.0, 0.09));
  }
  compactGroup(hull); root.add(hull);

  const torso = new THREE.Group();
  torso.add(cyl(2.2, 2.55, 1.0, P.dark, 0, 6.15, 0, 18));
  torso.add(chamferBox(4.8, 3.45, 3.65, P.chest, 0, 7.65, 0.1, 0.3));
  torso.add(chamferBox(5.2, 1.05, 3.8, P.main, 0, 9.25, 0, 0.16));
  torso.add(chamferBox(1.0, 1.45, 0.46, P.trim, 0, 7.65, 2.02, 0.09));
  for (const sx of [-1, 1]){
    torso.add(chamferBox(0.9, 1.4, 0.35, P.trim, sx * 1.35, 7.9, 2.0, 0.07));
    torso.add(sph(1.0, P.main, sx * 2.6, 8.7, 0, 16, 10));
  }
  compactGroup(torso); root.add(torso);

  const head = new THREE.Group(); head.position.set(0, 10.65, 0.2);
  const headGeom = new THREE.Group();
  headGeom.add(chamferBox(2.65, 1.65, 2.75, P.main, 0, 0, 0.2, 0.22));
  headGeom.add(chamferBox(2.35, 0.85, 0.42, P.glass, 0, 0.2, 1.62, 0.08));
  headGeom.add(chamferBox(0.9, 0.18, 0.12, P.eye, 0, 0.2, 1.88, 0.035));
  headGeom.add(chamferBox(2.6, 0.25, 0.35, P.dark, 0, 0.78, 1.55, 0.05));
  headGeom.add(chamferBox(1.3, 0.48, 0.48, P.main, 0, -0.64, 1.34, 0.08));
  for (const sx of [-1, 1]) headGeom.add(cyl(0.34, 0.4, 0.38, P.dark, sx * 1.34, 0, 0, 12).rotateZ(PI / 2));
  compactGroup(headGeom); head.add(headGeom);
  const eye = new THREE.Object3D(); eye.position.set(0, 0.2, 1.92); head.add(eye);
  root.add(head); parts.head = head; parts.eye = eye; parts.eyeMat = P.eye;

  addThruster(root, parts, P.dark, P.flame, -1.3, 4.55, -5.05, 0.42, 1.8, 'rear');
  addThruster(root, parts, P.dark, P.flame, 1.3, 4.55, -5.05, 0.42, 1.8, 'rear');
  return { root, parts };
}

function addBopArms(root, P, aa = false){
  const arms = new THREE.Group(), muzzles = [];
  for (const sx of [-1, 1]){
    const arm = new THREE.Group(); arm.position.set(sx * 2.65, 8.55, 0.35); arm.rotation.z = sx * 0.08;
    arm.add(cyl(0.72, 0.78, 1.75, P.main, sx * 0.6, -0.75, 0, 14).rotateZ(PI / 2));
    arm.add(chamferBox(1.9, 1.9, aa ? 3.0 : 2.5, P.accent, sx * 1.35, -1.4, 0.65, 0.18));
    arm.add(chamferBox(1.45, 1.25, aa ? 2.5 : 2.1, P.dark, sx * 1.35, -1.35, 1.45, 0.12));
    for (const bx of [-0.42, 0.42]) for (const by of [-0.38, 0.38]){
      const barrel = cyl(aa ? 0.11 : 0.19, aa ? 0.11 : 0.2, aa ? 3.2 : 1.35, P.frame,
        sx * 1.35 + bx, -1.35 + by, aa ? 3.55 : 2.75, aa ? 9 : 11);
      barrel.rotateX(PI / 2); arm.add(barrel);
      arm.add(cyl(aa ? 0.17 : 0.24, aa ? 0.17 : 0.24, 0.25, P.dark,
        sx * 1.35 + bx, -1.35 + by, aa ? 5.18 : 3.45, 10).rotateX(PI / 2));
      const muzzle = new THREE.Object3D();
      muzzle.position.set(sx * 1.35 + bx, -1.35 + by, aa ? 5.36 : 3.62); arm.add(muzzle); muzzles.push(muzzle);
    }
    arms.add(arm);
  }
  root.add(arms);
  return { arms, muzzles };
}

function buildGuntank(suit, M, aa = false){
  const P = palette(aa ? 'guntankaa' : 'guntank', M);
  const { root, parts } = buildGuntankChassis(P);
  const bop = addBopArms(root, P, aa);

  const bank = new THREE.Group(); bank.position.set(0, aa ? 10.0 : 9.55, -0.65); root.add(bank); parts.turret = bank;
  const cannonMuzzles = [];
  for (const sx of [-1, 1]){
    const gun = new THREE.Group(); gun.position.set(sx * (aa ? 1.0 : 1.55), 0, 0);
    gun.rotation.x = aa ? -0.08 : -0.12;
    gun.add(chamferBox(aa ? 0.78 : 1.0, aa ? 1.0 : 1.35, aa ? 2.8 : 3.1, P.dark, 0, 0, 0.75, 0.12));
    gun.add(cyl(aa ? 0.2 : 0.35, aa ? 0.24 : 0.42, aa ? 7.8 : 9.0, P.frame, 0, 0.15, aa ? 5.9 : 6.6, aa ? 12 : 14).rotateX(PI / 2));
    for (const z of aa ? [7.7, 8.45, 9.2] : [8.6])
      gun.add(cyl(aa ? 0.3 : 0.48, aa ? 0.3 : 0.48, aa ? 0.18 : 0.5, P.dark, 0, 0.15, z, 12).rotateX(PI / 2));
    if (aa){
      gun.add(cyl(0.34, 0.34, 0.65, P.dark, 0, 0.15, 10.05, 12).rotateX(PI / 2));
      for (const ox of [-0.18, 0.18]) gun.add(box(0.12, 0.28, 0.22, P.frame, ox, 0.15, 10.08));
    } else gun.add(cyl(0.28, 0.28, 0.18, P.dark, 0, 0.15, 11.35, 12).rotateX(PI / 2));
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.15, aa ? 10.45 : 11.55); gun.add(muzzle); cannonMuzzles.push(muzzle);
    bank.add(gun);
  }
  parts.weaponMuzzles = [cannonMuzzles, bop.muzzles]; parts.muzzle = cannonMuzzles[0];

  if (aa){
    // Explicit game-original AA conversion: radar and optical director replace
    // no chassis components, while the arm pods become long 35 mm batteries.
    const radar = new THREE.Group(); radar.position.set(-2.2, 11.8, -0.8);
    radar.add(cyl(0.22, 0.28, 1.8, P.frame, 0, 0, 0, 10));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 8, 0, PI * 2, 0, PI / 2), P.main);
    dish.scale.set(1, 0.28, 1); dish.position.y = 1.0; radar.add(dish);
    radar.add(cyl(0.18, 0.18, 0.8, P.eye, 0, 1.15, 0, 10)); root.add(radar);
    root.add(chamferBox(1.4, 1.15, 1.25, P.dark, 2.25, 11.3, -0.55, 0.12));
    root.add(chamferBox(0.8, 0.55, 0.22, P.eye, 2.25, 11.45, 0.12, 0.06));
  }
  return finishVehicle(suit, root, parts, P);
}

function buildEarlyGuntank(suit, M){
  const P = palette('earlytank', M);
  const root = new THREE.Group(); const parts = { flames: [] };
  addTrackAssembly(root, P, {
    x: 3.45, width: 2.9, front: 6.1, rear: -5.75, bottom: 0.23,
    top: 3.65, pitch: 0.54, wheel: 1.18, wheelZ: [-4.05, -1.45, 1.25, 3.85], fenderY: 3.9,
  });
  const hull = new THREE.Group();
  hull.add(chamferBox(7.1, 1.45, 9.4, P.main, 0, 4.0, 0, 0.22));
  hull.add(chamferBox(6.2, 1.25, 6.8, P.chest, 0, 5.15, -0.25, 0.18));
  hull.add(chamferBox(5.2, 0.72, 4.8, P.dark, 0, 6.05, -0.55, 0.12));
  hull.add(chamferBox(5.8, 0.75, 2.45, P.main, 0, 5.35, 3.65, 0.12));
  const armMuzzles = [];
  for (const sx of [-1, 1]){
    hull.add(chamferBox(0.65, 0.8, 2.2, P.dark, sx * 3.3, 4.65, -3.3, 0.1));
    for (let i = 0; i < 3; i++) hull.add(cyl(0.16, 0.18, 0.55, P.frame, sx * (0.65 + i * 0.42), 5.55, 4.8, 9).rotateX(PI / 2));
  }
  compactGroup(hull); root.add(hull);

  const torso = new THREE.Group();
  torso.add(cyl(3.0, 3.45, 1.25, P.dark, 0, 6.6, -0.15, 20));
  torso.add(chamferBox(6.2, 3.8, 4.3, P.main, 0, 8.45, 0, 0.35));
  torso.add(chamferBox(6.75, 1.1, 4.4, P.chest, 0, 10.1, -0.05, 0.18));
  torso.add(chamferBox(1.4, 1.15, 0.45, P.trim, 0, 8.35, 2.28, 0.08));
  for (const sx of [-1, 1]){
    torso.add(sph(1.35, P.main, sx * 3.35, 9.25, 0, 18, 11));
    for (let i = 0; i < 3; i++) torso.add(cyl(0.2, 0.24, 0.65, P.dark, sx * (2.2 + i * 0.35), 8.55, 2.3, 9).rotateX(PI / 2));
  }
  compactGroup(torso); root.add(torso);

  // Short manipulator stubs terminate in quad autocannon blocks.
  for (const sx of [-1, 1]){
    const arm = new THREE.Group(); arm.position.set(sx * 3.2, 8.75, 0.25); arm.rotation.z = sx * 0.12;
    arm.add(cyl(0.8, 0.9, 2.15, P.main, sx * 0.75, -0.45, 0, 14).rotateZ(PI / 2));
    arm.add(chamferBox(2.1, 1.85, 2.8, P.chest, sx * 1.7, -0.85, 0.6, 0.18));
    for (const bx of [-0.45, 0.45]) for (const by of [-0.38, 0.38]){
      arm.add(cyl(0.12, 0.12, 3.25, P.frame, sx * 1.7 + bx, -0.85 + by, 3.25, 9).rotateX(PI / 2));
      const muzzle = new THREE.Object3D(); muzzle.position.set(sx * 1.7 + bx, -0.85 + by, 4.92); arm.add(muzzle); armMuzzles.push(muzzle);
    }
    root.add(arm);
  }

  const head = new THREE.Group(); head.position.set(0, 11.15, 0.15);
  const hg = new THREE.Group();
  hg.add(chamferBox(2.95, 1.25, 2.6, P.main, 0, 0, 0.15, 0.2));
  hg.add(chamferBox(2.45, 0.48, 0.35, P.eye, 0, 0.05, 1.5, 0.07));
  hg.add(chamferBox(2.7, 0.23, 0.32, P.dark, 0, 0.55, 1.45, 0.05));
  const antenna = box(0.14, 2.15, 0.14, P.dark, 0.95, 1.4, -0.15); antenna.rotation.z = -0.18; hg.add(antenna);
  compactGroup(hg); head.add(hg);
  const eye = new THREE.Object3D(); eye.position.set(0, 0.05, 1.82); head.add(eye); root.add(head);
  parts.head = head; parts.eye = eye; parts.eyeMat = P.eye;

  const bank = new THREE.Group(); bank.position.set(0, 10.2, -1.25); root.add(bank); parts.turret = bank;
  const cannonMuzzles = [];
  for (const sx of [-1, 1]){
    const cannon = new THREE.Group(); cannon.position.set(sx * 2.2, 0, 0); cannon.rotation.z = -sx * 0.1;
    cannon.rotation.x = -0.1;
    cannon.add(chamferBox(1.15, 1.35, 3.0, P.dark, 0, 0, 0.6, 0.13));
    cannon.add(cyl(0.32, 0.4, 9.4, P.frame, 0, 0.2, 6.5, 14).rotateX(PI / 2));
    cannon.add(cyl(0.5, 0.5, 0.65, P.chest, 0, 0.2, 11.2, 14).rotateX(PI / 2));
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.2, 11.6); cannon.add(muzzle); cannonMuzzles.push(muzzle);
    bank.add(cannon);
  }
  parts.weaponMuzzles = [armMuzzles, cannonMuzzles]; parts.muzzle = armMuzzles[0];
  addThruster(root, parts, P.dark, P.flame, -1.65, 4.8, -5.7, 0.48, 2.0, 'rear');
  addThruster(root, parts, P.dark, P.flame, 1.65, 4.8, -5.7, 0.48, 2.0, 'rear');
  return finishVehicle(suit, root, parts, P);
}

function buildType61(suit, M){
  const P = palette('type61', M);
  const root = new THREE.Group(); const parts = { flames: [] };
  addTrackAssembly(root, P, {
    x: 2.65, width: 1.6, front: 6.7, rear: -6.15, bottom: 0.18,
    top: 2.25, pitch: 0.42, wheel: 0.72, wheelZ: [-4.6, -3.0, -1.4, 0.2, 1.8, 3.4, 5.0], fenderY: 2.5,
  });
  const hull = new THREE.Group();
  hull.add(chamferBox(5.65, 1.45, 10.7, P.main, 0, 2.15, -0.1, 0.2));
  const glacis = chamferBox(5.25, 1.15, 3.25, P.main, 0, 2.75, 4.75, 0.16); glacis.rotation.x = -0.16; hull.add(glacis);
  hull.add(chamferBox(5.1, 0.8, 4.3, P.chest, 0, 2.9, -3.55, 0.15));
  hull.add(chamferBox(4.4, 0.45, 2.4, P.dark, 0, 3.45, -4.25, 0.09));
  for (const sx of [-1, 1]){
    hull.add(chamferBox(0.75, 0.65, 2.0, P.chest, sx * 2.75, 3.05, -3.1, 0.1));
    hull.add(chamferBox(0.55, 0.45, 1.2, P.trim, sx * 1.95, 2.95, 5.55, 0.08));
    hull.add(cyl(0.12, 0.12, 4.8, P.dark, sx * 2.65, 3.1, -0.45, 8).rotateX(PI / 2));
  }
  for (let z = -4.1; z <= -1.8; z += 0.55) hull.add(box(3.8, 0.08, 0.22, P.dark, 0, 3.88, z));
  compactGroup(hull); root.add(hull);

  // Low angular turret with bustle, cupola, stowage rails and twin 155 mm guns.
  const turret = new THREE.Group();
  turret.add(profile([[-2.5, -0.8], [2.2, -0.8], [2.65, -0.2], [1.55, 1.1], [-1.5, 1.25], [-2.6, 0.45]], [], 4.65, P.main, 0, 4.15, 0));
  turret.add(chamferBox(4.3, 0.7, 2.15, P.chest, 0, 5.15, -2.0, 0.12));
  turret.add(chamferBox(3.55, 0.45, 1.65, P.dark, 0, 5.45, -2.65, 0.08));
  turret.add(cyl(0.75, 0.8, 0.48, P.dark, -1.2, 5.55, -0.3, 16));
  turret.add(cyl(0.58, 0.58, 0.35, P.main, -1.2, 5.92, -0.3, 16));
  turret.add(chamferBox(0.72, 0.42, 0.65, P.eye, 1.15, 5.45, 1.05, 0.08));
  for (const sx of [-1, 1]){
    turret.add(box(0.16, 1.3, 0.16, P.dark, sx * 1.8, 6.0, -2.1));
    turret.add(box(0.16, 0.16, 2.7, P.dark, sx * 1.8, 6.6, -1.0));
  }
  // Pintle weapon and radio antennas.
  turret.add(cyl(0.11, 0.11, 2.0, P.frame, -1.2, 7.0, -0.2, 8));
  turret.add(chamferBox(0.45, 0.45, 1.45, P.dark, -1.2, 7.75, 0.55, 0.07));
  turret.add(cyl(0.08, 0.08, 2.15, P.frame, -1.2, 7.75, 2.2, 8).rotateX(PI / 2));
  for (const sx of [-1, 1]){
    const ant = cyl(0.035, 0.045, 3.25, P.dark, sx * 1.65, 7.25, -2.25, 6); ant.rotation.z = sx * 0.1; turret.add(ant);
  }
  compactGroup(turret); root.add(turret);
  const headAnchor = new THREE.Object3D(); headAnchor.position.set(0, 5.3, 0); root.add(headAnchor); parts.head = headAnchor;

  const bank = new THREE.Group(); bank.position.set(0, 4.85, 1.1); root.add(bank); parts.turret = bank;
  const cannonMuzzles = [];
  for (const sx of [-1, 1]){
    const gun = new THREE.Group(); gun.position.set(sx * 0.72, 0, 0);
    gun.add(chamferBox(0.82, 0.92, 2.4, P.dark, 0, 0, 0.4, 0.1));
    gun.add(cyl(0.18, 0.23, 9.0, P.frame, 0, 0.12, 5.9, 12).rotateX(PI / 2));
    gun.add(cyl(0.3, 0.3, 0.65, P.dark, 0, 0.12, 10.45, 12).rotateX(PI / 2));
    gun.add(cyl(0.14, 0.14, 0.18, P.dark, 0, 0.12, 10.82, 10).rotateX(PI / 2));
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.12, 11.0);
    gun.add(muzzle); cannonMuzzles.push(muzzle); bank.add(gun);
  }
  parts.muzzle = cannonMuzzles[0]; parts.weaponMuzzles = [cannonMuzzles];
  const eye = new THREE.Object3D(); eye.position.set(1.15, 0.15, 1.48); headAnchor.add(eye); parts.eye = eye; parts.eyeMat = P.eye;
  addThruster(root, parts, P.dark, P.flame, -1.3, 2.7, -6.1, 0.3, 1.4, 'rear');
  addThruster(root, parts, P.dark, P.flame, 1.3, 2.7, -6.1, 0.3, 1.4, 'rear');
  return finishVehicle(suit, root, parts, P);
}

/**
 * Build one unscaled, +Z-forward Federation ground unit.
 * Humanoids are intentionally returned before shared weapon/melee equipment;
 * complete vehicles already satisfy the complete engine-parts contract.
 */
export function buildFederationCanonical(suit, M){
  if (!suit || !suit.id) return null;
  switch (suit.id){
    case 'rx78': return buildRX78(suit, M);
    case 'fa78': return buildFA78(suit, M);
    case 'rx79g': return buildGroundGundam(suit, M);
    case 'ez8': return buildEz8(suit, M);
    case 'nt1': return buildNT1(suit, M);
    case 'gp01': return buildGP01(suit, M);
    case 'mk2': return buildMk2(suit, M);
    case 'gundamx': return buildGundamX(suit, M);
    case 'gm':
    case 'gmbazooka': return buildGM(suit, M);
    case 'gmg_a':
    case 'gmg_b': return buildGroundGM(suit, M);
    case 'rgm79sp': return buildSniperII(suit, M);
    case 'gmspartan': return buildSpartan(suit, M);
    case 'guncannon': return buildGuncannon(suit, M);
    case 'guntank': return buildGuntank(suit, M, false);
    case 'guntankaa': return buildGuntank(suit, M, true);
    case 'guntankmk1': return buildEarlyGuntank(suit, M);
    case 'type61': return buildType61(suit, M);
    default: return null;
  }
}
