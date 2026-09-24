// ---------- Gravity Front original mobile suits ----------
// Four machines designed for this game, sharing the engine's humanoid rig contract (hip/knee/shoulder
// pivots, head + eye anchors, flame list, weapon muzzles) so they walk, kneel, aim, block and fight
// exactly like every other suit. Each has its own silhouette language:
//   GFR-24 Harrow   Federation trench fighter — sloped glacis, collar-guarded tri-lens head, rocket rack
//   GFR-31 Kestrel  Federation marksman — long legs, swept wing binders, asymmetric periscope head
//   GFZ-17 Varg     Zeon breacher — hunched, forward pauldrons, drum head with a triangular lens cluster
//   GFZ-22 Lamia    Zeon raider — forward-canted, vertical slit sensor, tail stabiliser boom
import {
  THREE, box, cyl, sph, chamferBox, profile, materialSet, compactGroup, addThruster,
} from './model-kit.js';

const PI = Math.PI;

export const ORIGINAL_SUIT_IDS = new Set(['harrow', 'kestrel', 'varg', 'lamia']);
export const isOriginalSuit = suit => !!suit && ORIGINAL_SUIT_IDS.has(suit.id);

function palette(suit, M){
  const P = materialSet(suit.colors, suit.faction === 'ZEON');
  if (M){
    P.eye = M.eye || P.eye;
    P.flame = M.flame || P.flame;
    P.blade = M.blade || P.blade;
    P.heat = M.heat || P.heat;
    P.gold = M.gold || P.gold;
  }
  return P;
}

// ---------- shared rig ----------
function makeRig(F){
  const root = new THREE.Group();
  const parts = { flames: [] };
  const torso = new THREE.Group(), waist = new THREE.Group(), backpack = new THREE.Group(), jets = new THREE.Group();
  root.add(torso, waist, backpack, jets);
  return { root, parts, torso, waist, backpack, jets, F };
}

// A leg hangs from the hip pivot; the shin hangs from a knee pivot so the kneel pose can fold it.
// `upper(g, sx)` dresses the thigh in hip space; `lower(g, sx, len)` dresses the shin in knee space,
// where the sole must end exactly at y = -len.
function addLegs(rig, upper, lower){
  const { F } = rig;
  const len = F.hipY + F.kneeY;
  for (const [key, sx] of [['legL', -1], ['legR', 1]]){
    const leg = new THREE.Group(); leg.position.set(sx * F.hipX, F.hipY, 0);
    const thigh = new THREE.Group(), shin = new THREE.Group(), knee = new THREE.Group();
    knee.position.y = F.kneeY;
    upper(thigh, sx); lower(shin, sx, len);
    compactGroup(thigh); compactGroup(shin);
    knee.add(shin); leg.add(thigh, knee); leg.kneePivot = knee;
    rig.root.add(leg); rig.parts[key] = leg;
  }
}

// Arms hang from the shoulder pivot. The pilot's right (gun) arm is at -X, as for every suit.
function addArms(rig, dress){
  const { F } = rig;
  for (const [key, sx] of [['armL', 1], ['armR', -1]]){
    const arm = new THREE.Group(); arm.position.set(sx * F.shoulderX, F.shoulderY, 0);
    const armour = new THREE.Group(); dress(armour, sx, key);
    compactGroup(armour); arm.add(armour);
    rig.root.add(arm); rig.parts[key] = arm;
  }
}

function addHead(rig, y, dress, eyeAt){
  const head = new THREE.Group(); head.position.set(0, y, 0);
  const geom = new THREE.Group(); dress(geom);
  compactGroup(geom); head.add(geom);
  const eye = new THREE.Object3D(); eye.position.set(...eyeAt); head.add(eye);
  rig.root.add(head); rig.parts.head = head; rig.parts.eye = eye;
  return head;
}

function finish(rig, suit, P, options = {}){
  compactGroup(rig.torso); compactGroup(rig.waist); compactGroup(rig.backpack);
  rig.parts.eyeMat = P.eye;
  rig.root.name = `original-${suit.id}`;
  return {
    root: rig.root, parts: rig.parts, kind: 'humanoid',
    allowDefaultShield: options.allowDefaultShield,
    weaponMount: options.weaponMount, meleeMount: options.meleeMount,
  };
}

const weaponIndex = (suit, pattern) => suit.weapons.findIndex(w => pattern.test(w.name || ''));

// A row of panel seams: thin dark strips that read as armour breaks under the ink lines.
function seams(g, mat, x, y, z, w, count, gap, vertical = false){
  for (let i = 0; i < count; i++){
    const o = (i - (count - 1) / 2) * gap;
    g.add(vertical ? box(0.07, w, 0.06, mat, x + o, y, z) : box(w, 0.07, 0.06, mat, x, y + o, z));
  }
}

// ---------- GFR-24 Harrow ----------
function buildHarrow(suit, M){
  const P = palette(suit, M);
  const F = { hipY: 8.6, kneeY: -3.55, hipX: 1.72, shoulderX: 3.95, shoulderY: 13.65 };
  const rig = makeRig(F);
  const { torso, waist, backpack, jets } = rig;

  // pelvis + heavy skirts
  waist.add(chamferBox(3.5, 1.3, 2.5, P.frame, 0, F.hipY + 0.35, 0, 0.16));
  waist.add(chamferBox(1.5, 1.1, 2.7, P.chest, 0, F.hipY + 0.45, 0.15, 0.14));
  for (const sx of [-1, 1]){
    const front = chamferBox(1.55, 2.2, 0.55, P.main, sx * 0.9, F.hipY - 0.2, 1.38, 0.12);
    front.rotation.x = -0.16; front.rotation.z = -sx * 0.05; waist.add(front);
    waist.add(chamferBox(0.6, 2.3, 2.2, P.chest, sx * 2.05, F.hipY + 0.05, 0.05, 0.12));
    waist.add(box(0.08, 1.6, 0.4, P.trim, sx * 2.37, F.hipY + 0.25, 0.9));
  }
  waist.add(chamferBox(2.9, 1.8, 0.5, P.main, 0, F.hipY + 0.05, -1.35, 0.1));

  // torso: armoured core under a sloped glacis, collar guards flanking the head
  torso.add(chamferBox(3.3, 1.6, 2.3, P.frame, 0, F.hipY + 1.95, 0, 0.18));
  torso.add(chamferBox(5.3, 2.9, 2.8, P.chest, 0, F.hipY + 4.0, -0.05, 0.28));
  const glacis = chamferBox(4.7, 2.5, 0.55, P.main, 0, F.hipY + 4.25, 1.45, 0.14);
  glacis.rotation.x = -0.42; torso.add(glacis);
  torso.add(chamferBox(4.2, 0.9, 0.6, P.main, 0, F.hipY + 2.75, 1.35, 0.12));          // belly plate
  seams(torso, P.dark, 0, F.hipY + 4.35, 2.0, 3.6, 2, 0.62);
  for (const sx of [-1, 1]){
    torso.add(box(0.5, 0.18, 0.08, P.trim, sx * 1.75, F.hipY + 5.05, 1.62));           // hazard ticks
    torso.add(box(0.5, 0.18, 0.08, P.trim, sx * 1.75, F.hipY + 4.75, 1.72));
    const collar = chamferBox(0.6, 2.1, 2.5, P.main, sx * 1.6, F.hipY + 6.15, 0.05, 0.12);
    collar.rotation.z = sx * 0.12; torso.add(collar);
    torso.add(box(0.12, 1.2, 1.4, P.accent, sx * 1.93, F.hipY + 6.25, 0.2));
  }
  torso.add(chamferBox(2.9, 0.75, 1.0, P.main, 0, F.hipY + 5.85, -0.95, 0.1));          // rear collar

  // backpack: box between twin vertical thruster canisters
  backpack.add(chamferBox(3.1, 2.6, 1.4, P.chest, 0, F.hipY + 4.35, -1.95, 0.16));
  seams(backpack, P.dark, 0, F.hipY + 4.35, -2.68, 2.4, 3, 0.55);
  for (const sx of [-1, 1]){
    backpack.add(cyl(0.58, 0.58, 3.1, P.dark, sx * 1.1, F.hipY + 4.1, -2.75, 14));
    backpack.add(cyl(0.64, 0.64, 0.3, P.accent, sx * 1.1, F.hipY + 5.55, -2.75, 14));
    addThruster(jets, rig.parts, P.frame, P.flame, sx * 1.1, F.hipY + 2.35, -2.75, 0.55, 2.4);
  }

  // head: low turret with a three-lens slot under a heavy brow, whip antenna on the right side
  addHead(rig, F.shoulderY + 1.95, g => {
    g.add(chamferBox(2.3, 1.0, 1.95, P.main, 0, 0, 0, 0.16));
    g.add(chamferBox(2.55, 0.34, 0.7, P.chest, 0, 0.52, 0.72, 0.08));                  // brow
    g.add(box(1.9, 0.38, 0.22, P.dark, 0, 0.05, 1.0));                                   // sensor slot
    for (const x of [-0.55, 0, 0.55]) g.add(cyl(0.14, 0.14, 0.14, P.eye, x, 0.05, 1.1, 12).rotateX(PI / 2));
    g.add(chamferBox(1.2, 0.55, 0.6, P.chest, 0, -0.55, 0.7, 0.08));                   // chin guard
    g.add(box(0.3, 0.3, 1.2, P.frame, 0, 0.6, -0.4));
    const whip = cyl(0.045, 0.06, 3.2, P.dark, -0.95, 1.9, -0.55, 6); whip.rotation.x = -0.32; g.add(whip);
    g.add(cyl(0.16, 0.16, 0.3, P.frame, -0.95, 0.4, -0.2, 8));
  }, [0, 0.05, 1.25]);

  // arms: blocky pads, the left one carries the rocket rack; thick armoured forearms
  const rackMuzzles = [];
  addArms(rig, (g, sx) => {
    g.add(sph(0.72, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(2.9, 2.2, 2.8, P.main, sx * 0.2, 0.2, 0, 0.2));
    g.add(box(0.1, 1.5, 2.0, P.trim, sx * 1.66, 0.1, 0));
    g.add(chamferBox(1.6, 2.5, 1.7, P.frame, 0, -1.75, 0, 0.14));
    g.add(cyl(0.62, 0.62, 0.7, P.joint, 0, -3.2, 0, 12).rotateZ(PI / 2));
    g.add(chamferBox(2.15, 2.9, 2.35, P.main, 0, -4.75, 0.12, 0.18));
    g.add(box(2.18, 0.22, 0.4, P.trim, 0, -4.1, 1.32));
    g.add(chamferBox(1.35, 0.95, 1.5, P.frame, 0, -6.35, 0.3, 0.12));
  });
  const rack = new THREE.Group(); rack.position.set(0.25, 1.75, 0.1);
  rack.add(chamferBox(1.7, 1.25, 2.3, P.chest, 0, 0, 0, 0.1));
  rack.add(box(1.72, 0.12, 2.32, P.trim, 0, 0.64, 0));
  for (let i = 0; i < 6; i++){
    const x = -0.45 + (i % 3) * 0.45, y = i < 3 ? 0.25 : -0.25;
    rack.add(cyl(0.17, 0.17, 0.2, P.dark, x, y, 1.12, 10).rotateX(PI / 2));
    const m = new THREE.Object3D(); m.position.set(x, y, 1.3); rack.add(m); rackMuzzles.push(m);
  }
  rig.parts.armL.add(rack);

  addLegs(rig, (g, sx) => {
    g.add(sph(0.82, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(2.05, 3.0, 2.2, P.main, 0, -1.75, 0, 0.2));
    g.add(box(0.1, 2.0, 1.2, P.trim, sx * 1.08, -1.75, 0.3));
    g.add(chamferBox(1.8, 0.9, 1.9, P.joint, 0, -3.45, 0, 0.12));
  }, (g, sx, len) => {
    g.add(chamferBox(1.95, 0.9, 0.7, P.accent, 0, 0.05, 1.12, 0.12));                   // knee plate
    g.add(chamferBox(2.35, 3.35, 2.45, P.main, 0, -1.95, 0.05, 0.22));
    g.add(chamferBox(1.9, 2.1, 0.8, P.chest, 0, -1.8, -1.35, 0.14));                    // calf bulge
    seams(g, P.dark, 0, -2.3, 1.3, 1.5, 3, 0.4);
    g.add(box(0.1, 1.6, 0.6, P.trim, sx * 1.2, -2.6, 0.7));
    g.add(chamferBox(2.1, 0.8, 2.4, P.chest, 0, -len + 1.35, 0.1, 0.12));               // ankle skirt
    g.add(chamferBox(2.45, 0.75, 3.3, P.chest, 0, -len + 0.72, 0.5, 0.12));
    g.add(chamferBox(2.2, 0.6, 1.0, P.dark, 0, -len + 0.6, 2.25, 0.1));                 // toe cap
    g.add(box(2.55, 0.3, 3.9, P.frame, 0, -len + 0.15, 0.55));                          // sole plate
  });

  const rackIndex = weaponIndex(suit, /ROCKET RACK/);
  if (rackIndex >= 0){ rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[rackIndex] = rackMuzzles; }
  return finish(rig, suit, P, { weaponMount: [0, -6.55, 0.8], meleeMount: [0, -6.55, 0.8] });
}

// ---------- GFR-31 Kestrel ----------
function buildKestrel(suit, M){
  const P = palette(suit, M);
  const F = { hipY: 9.05, kneeY: -3.75, hipX: 1.32, shoulderX: 3.15, shoulderY: 14.05 };
  const rig = makeRig(F);
  const { torso, waist, backpack, jets } = rig;

  waist.add(chamferBox(2.8, 1.2, 2.1, P.frame, 0, F.hipY + 0.35, 0, 0.14));
  for (const sx of [-1, 1]){
    const front = chamferBox(1.2, 2.6, 0.4, P.main, sx * 0.72, F.hipY - 0.45, 1.18, 0.1);
    front.rotation.x = -0.1; front.rotation.z = -sx * 0.1; waist.add(front);
    waist.add(chamferBox(0.4, 2.1, 1.7, P.main, sx * 1.7, F.hipY - 0.05, 0, 0.1));
    waist.add(box(0.42, 0.3, 1.72, P.accent, sx * 1.7, F.hipY + 0.95, 0));
  }
  waist.add(chamferBox(2.2, 1.9, 0.4, P.main, 0, F.hipY - 0.15, -1.15, 0.1));

  // tapered chest over a segmented abdomen
  for (let i = 0; i < 3; i++) torso.add(chamferBox(2.6 - i * 0.1, 0.42, 1.9, P.frame, 0, F.hipY + 1.45 + i * 0.48, 0, 0.08));
  torso.add(chamferBox(4.1, 2.6, 2.3, P.chest, 0, F.hipY + 4.15, 0, 0.26));
  torso.add(chamferBox(4.6, 0.85, 2.25, P.main, 0, F.hipY + 5.55, -0.05, 0.16));
  const plate = profile([[-1.2, -1.2], [1.2, -1.2], [1.2, 0.9], [0, 1.25], [-1.2, 0.9]], [], 3.2, P.main, 0, F.hipY + 4.05, 1.2);
  plate.rotation.y = PI / 2; plate.scale.set(1, 1, 0.22); torso.add(plate);
  torso.add(box(0.2, 1.6, 0.1, P.accent, 0, F.hipY + 4.1, 1.52));
  for (const sx of [-1, 1]) torso.add(box(0.7, 0.14, 0.1, P.accent, sx * 1.0, F.hipY + 4.85, 1.5));

  // swept wing binders on the shoulder blades, each with a root thruster
  backpack.add(chamferBox(2.4, 2.2, 1.1, P.chest, 0, F.hipY + 4.5, -1.65, 0.14));
  for (const sx of [-1, 1]){
    const wing = profile([[0, 0], [2.9, 0.6], [4.4, -0.2], [2.6, -0.95], [0, -0.6]], [], 0.26, P.main);
    wing.rotation.set(0.3, sx * 2.1, 0);                                                    // swept back and out, tips raised
    wing.scale.setScalar(1.35);
    wing.position.set(sx * 0.95, F.hipY + 5.4, -1.95);
    backpack.add(wing);
    backpack.add(box(0.14, 0.2, 1.4, P.accent, sx * 1.3, F.hipY + 5.75, -2.5));
    addThruster(jets, rig.parts, P.frame, P.flame, sx * 0.9, F.hipY + 3.25, -2.2, 0.48, 2.3);
  }

  // asymmetric head: wedge helm, periscope mast and stacked twin lenses on the right cheek
  addHead(rig, F.shoulderY + 2.05, g => {
    const helm = profile([[-1.0, -0.75], [0.95, -0.65], [1.05, 0.05], [0.4, 0.75], [-0.9, 0.7]], [], 1.35, P.main);
    helm.rotation.y = 0; g.add(helm);
    g.add(chamferBox(1.45, 0.3, 1.4, P.chest, 0, 0.72, -0.2, 0.08));
    g.add(box(1.1, 0.7, 0.18, P.dark, 0.05, -0.05, 1.0));                                 // face plate recess
    g.add(cyl(0.17, 0.17, 0.16, P.eye, -0.34, 0.14, 1.1, 12).rotateX(PI / 2));
    g.add(cyl(0.12, 0.12, 0.16, P.eye, -0.34, -0.24, 1.1, 12).rotateX(PI / 2));
    g.add(chamferBox(0.36, 0.8, 0.9, P.main, 0.72, -0.05, 0.55, 0.06));                   // left cheek plate
    g.add(box(0.22, 1.5, 0.28, P.frame, -0.62, 1.2, -0.15));                              // periscope mast
    g.add(box(0.3, 0.26, 0.5, P.dark, -0.62, 1.95, -0.02));
    g.add(box(0.2, 0.16, 0.08, P.eye, -0.62, 1.95, 0.25));
    g.add(box(0.12, 0.12, 1.1, P.accent, 0.45, 0.62, 0.35));
  }, [-0.34, 0.14, 1.25]);

  addArms(rig, (g, sx, key) => {
    g.add(sph(0.62, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(2.25, 1.55, 2.3, P.main, sx * 0.15, 0.25, 0, 0.3));
    g.add(box(2.28, 0.16, 0.5, P.accent, sx * 0.15, 0.75, 0.9));
    g.add(chamferBox(1.3, 2.6, 1.4, P.frame, 0, -1.7, 0, 0.12));
    g.add(cyl(0.55, 0.55, 0.6, P.joint, 0, -3.15, 0, 12).rotateZ(PI / 2));
    g.add(chamferBox(1.6, 2.7, 1.75, P.main, 0, -4.65, 0.1, 0.16));
    if (key === 'armL') g.add(chamferBox(0.8, 1.6, 1.4, P.chest, 0.85, -4.6, 0.25, 0.1)); // wrist autocannon housing
    g.add(chamferBox(1.15, 0.85, 1.3, P.frame, 0, -6.1, 0.25, 0.1));
  });
  const wristMuzzles = [];
  for (const oy of [-4.2, -4.9]){
    const barrel = cyl(0.1, 0.1, 0.8, P.dark, 0.85, oy, 1.2, 8).rotateX(PI / 2);
    rig.parts.armL.add(barrel);
    const m = new THREE.Object3D(); m.position.set(0.85, oy, 1.65); rig.parts.armL.add(m); wristMuzzles.push(m);
  }

  addLegs(rig, (g, sx) => {
    g.add(sph(0.7, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(1.7, 3.2, 1.9, P.main, 0, -1.85, 0, 0.18));
    g.add(chamferBox(1.5, 0.8, 1.7, P.joint, 0, -3.65, 0, 0.1));
  }, (g, sx, len) => {
    g.add(chamferBox(1.55, 1.1, 0.55, P.main, 0, 0.1, 1.0, 0.1));
    g.add(chamferBox(1.9, 3.7, 2.1, P.main, 0, -2.2, 0, 0.2));
    seams(g, P.dark, 0.35, -2.4, 1.12, 1.8, 3, 0.25, true);
    g.add(chamferBox(1.45, 2.4, 0.7, P.chest, 0, -2.0, -1.15, 0.12));
    g.add(box(0.1, 2.6, 0.3, P.accent, sx * 0.98, -2.1, 0.6));
    g.add(chamferBox(1.85, 0.6, 3.1, P.chest, 0, -len + 0.62, 0.55, 0.1));
    g.add(chamferBox(1.4, 0.45, 0.9, P.accent, 0, -len + 0.55, 2.15, 0.08));
    g.add(chamferBox(0.6, 0.5, 1.1, P.dark, 0, -len + 0.5, -1.25, 0.08));               // heel spur
    g.add(box(1.95, 0.28, 3.7, P.frame, 0, -len + 0.14, 0.5));
  });

  const wristIndex = weaponIndex(suit, /WRIST/);
  if (wristIndex >= 0){ rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[wristIndex] = wristMuzzles; }
  return finish(rig, suit, P, { weaponMount: [0, -6.3, 0.8], meleeMount: [0, -6.3, 0.8] });
}

// ---------- GFZ-17 Varg ----------
function buildVarg(suit, M){
  const P = palette(suit, M);
  const F = { hipY: 8.45, kneeY: -3.45, hipX: 1.78, shoulderX: 4.15, shoulderY: 13.35 };
  const rig = makeRig(F);
  const { torso, waist, backpack, jets } = rig;

  waist.add(chamferBox(3.7, 1.4, 2.7, P.frame, 0, F.hipY + 0.35, 0, 0.18));
  for (const sx of [-1, 1]){
    const front = chamferBox(1.7, 2.1, 0.6, P.main, sx * 0.95, F.hipY - 0.15, 1.48, 0.14);
    front.rotation.x = -0.2; waist.add(front);
    waist.add(chamferBox(0.7, 2.2, 2.4, P.chest, sx * 2.2, F.hipY, 0, 0.14));
    for (const oy of [0.5, -0.3]) waist.add(cyl(0.1, 0.1, 0.12, P.gold, sx * 2.58, F.hipY + oy, 0.7, 8).rotateZ(PI / 2));
  }
  waist.add(chamferBox(3.2, 1.9, 0.6, P.main, 0, F.hipY - 0.05, -1.45, 0.12));

  // hunched barrel chest: the mass sits forward of the hips, the hump rides high behind the head
  torso.add(chamferBox(3.6, 1.7, 2.6, P.frame, 0, F.hipY + 1.95, 0, 0.2));
  torso.add(chamferBox(5.6, 3.1, 3.2, P.main, 0, F.hipY + 3.95, 0.35, 0.36));
  torso.add(chamferBox(4.4, 1.6, 0.7, P.chest, 0, F.hipY + 3.4, 1.72, 0.16));
  torso.add(box(4.46, 0.24, 0.72, P.accent, 0, F.hipY + 4.28, 1.74));
  torso.add(chamferBox(4.8, 1.2, 2.6, P.chest, 0, F.hipY + 5.55, 0.2, 0.2));             // hump behind the head
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++)
    torso.add(cyl(0.11, 0.11, 0.12, P.gold, sx * (0.9 + i * 0.55), F.hipY + 2.75, 1.63, 8).rotateX(PI / 2));

  // single heavy thruster bell plus two trim jets, and the shoulder mortar on the right
  backpack.add(chamferBox(3.4, 2.8, 1.6, P.chest, 0, F.hipY + 4.1, -2.05, 0.2));
  backpack.add(box(3.46, 0.25, 1.62, P.accent, 0, F.hipY + 5.0, -2.05));
  addThruster(jets, rig.parts, P.frame, P.flame, 0, F.hipY + 2.3, -2.3, 0.85, 3.0);
  for (const sx of [-1, 1]) addThruster(jets, rig.parts, P.frame, P.flame, sx * 1.35, F.hipY + 2.7, -2.4, 0.42, 1.8);
  const mortar = new THREE.Group(); mortar.position.set(-1.35, F.hipY + 5.6, -2.2); mortar.rotation.x = -0.55;
  mortar.add(cyl(0.52, 0.58, 3.4, P.dark, 0, 1.2, 0, 14));
  mortar.add(cyl(0.64, 0.64, 0.4, P.accent, 0, 2.75, 0, 14));
  mortar.add(chamferBox(1.2, 1.1, 1.4, P.main, 0, -0.3, 0, 0.12));
  const mortarMuzzle = new THREE.Object3D(); mortarMuzzle.position.set(0, 3.05, 0); mortar.add(mortarMuzzle);
  compactGroup(mortar); rig.root.add(mortar);

  // drum head sunk between the pauldrons: recessed cowl, triangular lens cluster, mandible guards
  addHead(rig, F.shoulderY + 1.75, g => {
    g.add(cyl(1.15, 1.2, 1.15, P.main, 0, 0, 0, 20));
    g.add(cyl(1.18, 1.18, 0.18, P.accent, 0, 0.5, 0, 20));
    g.add(box(1.5, 0.9, 0.5, P.dark, 0, 0, 1.0));
    for (const [x, y, r] of [[-0.3, -0.12, 0.14], [0.3, -0.12, 0.14], [0, 0.22, 0.17]])
      g.add(cyl(r, r, 0.16, P.eye, x, y, 1.26, 12).rotateX(PI / 2));
    for (const sx of [-1, 1]){
      const jaw = chamferBox(0.55, 0.6, 0.9, P.chest, sx * 0.62, -0.62, 0.85, 0.08); jaw.rotation.y = sx * 0.25; g.add(jaw);
    }
    g.add(box(0.2, 0.55, 0.9, P.frame, 0, 0.8, -0.3));
  }, [0, 0.05, 1.35]);

  addArms(rig, (g, sx) => {
    g.add(sph(0.8, P.joint, 0, 0, 0, 14, 9));
    const pad = chamferBox(3.25, 2.55, 3.6, P.main, sx * 0.35, 0.45, 0.45, 0.42); g.add(pad);
    const lip = chamferBox(3.35, 0.45, 1.3, P.chest, sx * 0.35, 1.55, 2.05, 0.1); lip.rotation.x = -0.55; g.add(lip);
    g.add(chamferBox(0.5, 1.9, 2.8, P.chest, sx * 2.05, 0.3, 0.4, 0.1));                  // outer plate
    g.add(box(3.3, 0.24, 0.3, P.accent, sx * 0.35, 1.25, 2.2));
    for (let i = 0; i < 4; i++) g.add(cyl(0.1, 0.1, 0.14, P.gold, sx * (-0.7 + i * 0.5) * 1 + sx * 0.35, 1.55, 1.1, 8));
    g.add(chamferBox(1.8, 2.5, 1.9, P.frame, 0, -1.85, 0, 0.14));
    g.add(cyl(0.7, 0.7, 0.75, P.joint, 0, -3.3, 0, 12).rotateZ(PI / 2));
    g.add(chamferBox(2.3, 3.0, 2.4, P.main, 0, -4.85, 0.15, 0.22));
    for (const oy of [-4.1, -4.55]) g.add(box(2.34, 0.14, 2.44, P.gold, 0, oy, 0.15));
    g.add(chamferBox(1.45, 1.0, 1.6, P.frame, 0, -6.5, 0.3, 0.12));
  });

  addLegs(rig, (g, sx) => {
    g.add(sph(0.9, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(2.3, 2.9, 2.4, P.main, 0, -1.7, 0, 0.24));
    g.add(chamferBox(2.0, 0.9, 2.0, P.joint, 0, -3.35, 0, 0.12));
  }, (g, sx, len) => {
    g.add(chamferBox(2.0, 1.0, 0.7, P.chest, 0, 0.05, 1.18, 0.12));
    g.add(cyl(1.15, 1.55, 3.5, P.main, 0, -2.05, 0, 16));                               // flared calf
    g.add(cyl(1.58, 1.58, 0.22, P.accent, 0, -3.55, 0, 16));
    g.add(chamferBox(2.4, 0.9, 2.6, P.chest, 0, -len + 1.25, 0.1, 0.14));               // ankle guard
    g.add(chamferBox(2.7, 0.8, 3.5, P.chest, 0, -len + 0.72, 0.45, 0.14));
    g.add(chamferBox(2.3, 0.55, 0.9, P.dark, 0, -len + 0.55, 2.3, 0.08));
    g.add(box(2.8, 0.3, 4.0, P.frame, 0, -len + 0.15, 0.45));
  });

  const mortarIndex = weaponIndex(suit, /MORTAR/);
  if (mortarIndex >= 0){ rig.parts.weaponMuzzles = []; rig.parts.weaponMuzzles[mortarIndex] = [mortarMuzzle]; }
  return finish(rig, suit, P, { weaponMount: [0, -6.7, 0.85], meleeMount: [0, -6.7, 0.85] });
}

// ---------- GFZ-22 Lamia ----------
function buildLamia(suit, M){
  const P = palette(suit, M);
  const F = { hipY: 9.1, kneeY: -3.8, hipX: 1.28, shoulderX: 3.0, shoulderY: 13.95 };
  const rig = makeRig(F);
  const { torso, waist, backpack, jets } = rig;

  waist.add(chamferBox(2.6, 1.15, 2.0, P.frame, 0, F.hipY + 0.35, 0, 0.14));
  for (const sx of [-1, 1]){
    const front = chamferBox(1.05, 2.3, 0.35, P.main, sx * 0.62, F.hipY - 0.3, 1.1, 0.08);
    front.rotation.x = -0.14; front.rotation.z = -sx * 0.16; waist.add(front);
    const side = chamferBox(0.35, 1.9, 1.6, P.chest, sx * 1.55, F.hipY - 0.05, -0.1, 0.08); side.rotation.z = sx * 0.12; waist.add(side);
  }

  // forward-canted wasp torso: chest carried ahead of the hips
  for (let i = 0; i < 2; i++) torso.add(chamferBox(2.3, 0.5, 1.7, P.frame, 0, F.hipY + 1.5 + i * 0.55, 0, 0.08));
  torso.add(chamferBox(3.7, 2.5, 2.1, P.main, 0, F.hipY + 4.0, 0.3, 0.26));
  const keel = profile([[-1.1, -1.25], [1.1, -1.25], [0.75, 0.85], [0, 1.3], [-0.75, 0.85]], [], 2.6, P.chest, 0, F.hipY + 4.05, 1.4);
  keel.rotation.y = PI / 2; keel.scale.set(1, 1, 0.24); torso.add(keel);
  for (const sx of [-1, 1]){
    const line = box(0.08, 1.9, 0.08, P.accent, sx * 0.62, F.hipY + 4.1, 1.73); line.rotation.z = sx * 0.3; torso.add(line);
  }
  torso.add(chamferBox(4.1, 0.7, 2.0, P.chest, 0, F.hipY + 5.4, -0.1, 0.14));

  // compact backpack and a tapered tail stabiliser boom with its own thruster
  backpack.add(chamferBox(2.3, 2.1, 1.2, P.chest, 0, F.hipY + 4.4, -1.6, 0.14));
  for (const sx of [-1, 1]) addThruster(jets, rig.parts, P.frame, P.flame, sx * 0.72, F.hipY + 3.1, -1.9, 0.42, 2.0);
  const tail = new THREE.Group(); tail.position.set(0, F.hipY + 0.2, -1.05); tail.rotation.x = 0.95;
  tail.add(cyl(0.22, 0.42, 4.6, P.main, 0, -2.3, 0, 12));
  tail.add(cyl(0.44, 0.44, 0.25, P.accent, 0, -0.3, 0, 12));
  for (const sx of [-1, 1]){
    const fin = box(0.12, 1.3, 0.8, P.chest, sx * 0.42, -3.6, 0); fin.rotation.z = sx * 0.5; tail.add(fin);
  }
  compactGroup(tail);
  addThruster(tail, rig.parts, P.frame, P.flame, 0, -4.75, 0, 0.3, 1.4);
  rig.root.add(tail);

  // elongated head: a single vertical slit sensor, swept twin fins
  addHead(rig, F.shoulderY + 2.0, g => {
    g.add(chamferBox(1.35, 1.3, 2.1, P.main, 0, 0, 0.05, 0.3));
    g.add(chamferBox(1.1, 0.5, 1.6, P.chest, 0, 0.72, -0.15, 0.12));
    g.add(box(0.28, 1.0, 0.16, P.dark, 0, -0.02, 1.12));
    g.add(box(0.12, 0.78, 0.14, P.eye, 0, -0.02, 1.18));
    g.add(chamferBox(0.9, 0.45, 0.7, P.chest, 0, -0.62, 0.72, 0.08));
    for (const sx of [-1, 1]){
      const fin = box(0.1, 0.34, 2.1, P.trim, sx * 0.48, 0.95, -0.85); fin.rotation.x = 0.28; fin.rotation.y = sx * 0.12; g.add(fin);
    }
  }, [0, -0.02, 1.25]);

  addArms(rig, (g, sx) => {
    g.add(sph(0.6, P.joint, 0, 0, 0, 14, 9));
    const pad = chamferBox(2.0, 1.4, 2.4, P.main, sx * 0.2, 0.35, -0.1, 0.22); pad.rotation.z = sx * -0.18; g.add(pad);
    g.add(box(0.1, 0.9, 2.0, P.accent, sx * 1.15, 0.3, -0.1));
    g.add(chamferBox(1.2, 2.5, 1.3, P.frame, 0, -1.7, 0, 0.12));
    g.add(cyl(0.5, 0.5, 0.55, P.joint, 0, -3.1, 0, 12).rotateZ(PI / 2));
    g.add(chamferBox(1.45, 2.8, 1.6, P.main, 0, -4.6, 0.05, 0.16));
    const blade = box(0.12, 2.2, 0.5, P.trim, sx * 0.78, -4.5, -0.4); blade.rotation.x = 0.2; g.add(blade);
    g.add(chamferBox(1.05, 0.8, 1.2, P.frame, 0, -6.05, 0.25, 0.1));
  });

  addLegs(rig, (g, sx) => {
    g.add(sph(0.66, P.joint, 0, 0, 0, 14, 9));
    g.add(chamferBox(1.55, 3.3, 1.75, P.main, 0, -1.9, 0, 0.18));
    g.add(chamferBox(1.35, 0.8, 1.55, P.joint, 0, -3.7, 0, 0.1));
  }, (g, sx, len) => {
    const kneeBlade = chamferBox(1.2, 1.4, 0.45, P.chest, 0, 0.25, 1.0, 0.08); kneeBlade.rotation.x = -0.3; g.add(kneeBlade);
    g.add(chamferBox(1.75, 3.8, 1.9, P.main, 0, -2.2, 0, 0.2));
    g.add(box(0.08, 2.8, 0.08, P.accent, sx * 0.9, -2.2, 0.8));
    g.add(chamferBox(1.2, 1.5, 0.7, P.chest, 0, -len + 1.7, -1.1, 0.1));                // ankle vernier pod
    g.add(chamferBox(1.7, 0.55, 3.0, P.chest, 0, -len + 0.6, 0.6, 0.1));
    g.add(chamferBox(0.9, 0.4, 1.1, P.accent, 0, -len + 0.5, 2.25, 0.06));
    g.add(box(1.8, 0.26, 3.5, P.frame, 0, -len + 0.13, 0.55));
  });
  for (const key of ['legL', 'legR']){
    const knee = rig.parts[key].kneePivot, len = F.hipY + F.kneeY;
    addThruster(knee, rig.parts, P.frame, P.flame, 0, -len + 1.7, -1.55, 0.26, 1.2, 'rear');
  }

  return finish(rig, suit, P, { weaponMount: [0, -6.2, 0.75], meleeMount: [0, -6.2, 0.75] });
}

const BUILDERS = { harrow: buildHarrow, kestrel: buildKestrel, varg: buildVarg, lamia: buildLamia };

export function buildOriginalSuit(suit, M){
  const build = BUILDERS[suit?.id];
  return build ? build(suit, M) : null;
}
