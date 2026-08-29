// Canonical One Year War aircraft silhouettes.
//
// All builders face +Z, return an UNSCALED root (the caller applies suit.scale), and preserve the
// aircraft contract used by battle.js: a bankable parts.body plus cockpit/head, muzzle array,
// thruster flames, and optional independently traversing carrier turrets. Fixed detail is compacted
// by material; moving anchors, flames, turret pivots, and the G-Fighter's instanced tracks remain live.
import {
  THREE, box, cyl, cone, sph, chamferBox, profile, materialSet,
  compactGroup, instancedTrack,
} from './model-kit.js';

const PI = Math.PI;

const zCyl = (rt, rb, length, material, x, y, z, segments = 14) => {
  const mesh = cyl(rt, rb, length, material, x, y, z, segments);
  mesh.rotation.x = PI / 2;
  return mesh;
};

const zCone = (radius, length, material, x, y, z, segments = 12) => {
  const mesh = cone(radius, length, material, x, y, z, segments);
  mesh.rotation.x = PI / 2;
  return mesh;
};

// Thin extruded plate in the X/Z plane. Points are [x,z], viewed from above.
function planform(points, thickness, material, y = 0){
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, steps: 1, bevelEnabled: false,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  return mesh;
}

function context(suit, supplied){
  // buildMech's legacy material set does not have glass/frame/joint entries; fill those from the
  // shared kit while retaining the exact suit-coloured materials supplied by the caller.
  const M = { ...materialSet(suit.colors, suit.faction === 'ZEON'), ...(supplied || {}) };
  const root = new THREE.Group();
  const body = new THREE.Group();
  const fixed = new THREE.Group();
  root.add(body); body.add(fixed);
  const parts = {
    body, flames: [], muzzles: [], weaponMuzzles: [], turrets: null,
    legL: null, legR: null, armL: null, armR: null,
    gun: null, turret: null,
  };
  return { suit, M, root, body, fixed, parts };
}

function anchor(parent, x, y, z){
  const node = new THREE.Object3D();
  node.position.set(x, y, z); parent.add(node);
  return node;
}

function weaponAnchor(C, weaponIndex, x, y, z){
  const node = anchor(C.body, x, y, z);
  C.parts.muzzles.push(node);
  (C.parts.weaponMuzzles[weaponIndex] ||= []).push(node);
  return node;
}

function rearThruster(C, x, y, z, radius = 0.6, flameLength = 2.8, visibleFlame = true){
  const { M, fixed, body, parts } = C;
  fixed.add(zCyl(radius * 0.76, radius, radius * 0.9, M.frame, x, y, z, 14));
  fixed.add(zCyl(radius * 0.54, radius * 0.68, radius * 0.34, M.dark, x, y, z - radius * 0.54, 14));
  if (!visibleFlame) return;
  const flame = cone(radius * 0.72, flameLength, M.flame, x, y, z - flameLength * 0.58, 10);
  flame.rotation.x = -PI / 2;
  flame.scale.y = 0.01;
  body.add(flame); parts.flames.push(flame);
}

function forwardBarrel(C, x, y, zCenter, length, radius, material = null){
  const { M, fixed, body, parts } = C;
  fixed.add(zCyl(radius, radius * 1.08, length, material || M.dark, x, y, zCenter, 10));
  fixed.add(zCyl(radius * 1.42, radius * 1.42, radius * 0.55, M.frame, x, y,
    zCenter + length / 2, 10));
  const muzzle = weaponAnchor(C, 0, x, y, zCenter + length / 2 + radius * 0.32);
  return muzzle;
}

function finish(C, cockpit, fallbackMuzzle){
  const { suit, M, root, body, fixed, parts } = C;
  compactGroup(fixed);

  parts.muzzle = parts.muzzle || parts.muzzles[0]
    || anchor(body, fallbackMuzzle[0], fallbackMuzzle[1], fallbackMuzzle[2]);
  body.add(sph(0.12, M.eye, cockpit[0], cockpit[1], cockpit[2] + 0.12, 10, 7));
  parts.eye = anchor(body, cockpit[0], cockpit[1], cockpit[2]);
  parts.head = anchor(body, cockpit[0], cockpit[1], cockpit[2]);
  parts.blade = new THREE.Object3D(); parts.blade.visible = false; body.add(parts.blade);
  parts.eyeMat = M.eye;

  root.userData.canonicalAircraft = suit.id;
  root.userData.unscaled = true;
  return { root, parts, kind: 'complete' };
}

function addMissileFace(parent, material, dark, x, y, z, columns, rows, spacing, tubeRadius = 0.12){
  parent.add(chamferBox(
    Math.max(0.7, (columns - 1) * spacing + 0.65),
    Math.max(0.6, (rows - 1) * spacing + 0.65),
    0.34, material, x, y, z, 0.06));
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++){
    const ox = (col - (columns - 1) / 2) * spacing;
    const oy = (row - (rows - 1) / 2) * spacing;
    parent.add(zCyl(tubeRadius, tubeRadius, 0.16, dark, x + ox, y + oy, z + 0.24, 9));
  }
}

// FF-S3: narrow fuselage, broad swept plane, and the defining four booster/missile packs.
// The 5000 is explicitly a Gravity Front upgrade, so it keeps this canonical chassis and adds
// larger AGL pods, armour, and a centerline lock-on missile instead of inventing a new airframe.
function buildSaberfish(suit, supplied, upgraded){
  const C = context(suit, supplied), { M, fixed } = C;
  const wing = upgraded ? 9.8 : 9.0;

  fixed.add(planform([
    [-1.1, 3.1], [1.1, 3.1], [wing, -1.8], [wing - 1.0, -4.0],
    [2.0, -2.8], [-2.0, -2.8], [-wing + 1.0, -4.0], [-wing, -1.8],
  ], 0.5, M.main, -0.05));
  // Dark trailing panels and red outboard recognition tips.
  for (const sx of [-1, 1]){
    const trailing = box(5.4, 0.22, 0.75, M.chest, sx * 5.6, -0.13, -3.0);
    trailing.rotation.y = sx * -0.32; fixed.add(trailing);
    const tip = box(1.25, 0.58, 2.7, M.accent, sx * (wing - 0.55), 0.02, -2.45);
    tip.rotation.y = sx * -0.12; fixed.add(tip);
  }

  fixed.add(profile([
    [-7.0, -0.65], [-5.8, -1.0], [3.9, -0.9], [8.1, -0.05],
    [5.4, 1.15], [-2.8, 1.3], [-6.7, 0.45],
  ], [], 2.55, M.main));
  fixed.add(chamferBox(2.72, 0.45, 8.8, M.chest, 0, -0.5, -0.8, 0.1));
  fixed.add(zCone(1.02, 3.4, M.main, 0, -0.05, 7.45, 14));
  fixed.add(chamferBox(1.9, 0.45, 2.9, M.accent, 0, -0.72, 4.15, 0.08));

  const canopy = sph(1, M.glass, 0, 1.12, 3.55, 20, 12);
  canopy.scale.set(1.15, 0.52, 1.85); fixed.add(canopy);
  fixed.add(box(0.13, 0.72, 2.9, M.frame, 0, 1.13, 3.5));
  fixed.add(box(2.1, 0.18, 0.16, M.frame, 0, 1.22, 3.8));

  // Single dorsal and ventral tail planes, matching the MSV space-fighter silhouette.
  fixed.add(profile([[-6.9, 0], [-3.5, 0], [-6.2, 3.45]], [], 0.42, M.main, 0, 0.35));
  fixed.add(profile([[-6.8, 0], [-4.2, 0], [-6.2, -1.8]], [], 0.36, M.chest, 0, -0.55));

  // Four wing booster packs: upper/lower on both sides, each with three launcher mouths.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]){
    const x = sx * 4.65, y = sy * 0.82, z = -0.65;
    fixed.add(chamferBox(upgraded ? 1.7 : 1.45, upgraded ? 1.38 : 1.16,
      upgraded ? 7.8 : 6.9, sy > 0 ? M.main : M.chest, x, y, z, 0.13));
    fixed.add(chamferBox(1.1, 0.23, 4.9, M.accent, x, y + sy * 0.69, z - 0.15, 0.04));
    addMissileFace(fixed, M.frame, M.dark, x, y, z + (upgraded ? 3.96 : 3.5), 3, 1, 0.32, 0.115);
    weaponAnchor(C, 1, x, y, z + (upgraded ? 4.2 : 3.75));
    rearThruster(C, x, y, z - (upgraded ? 4.0 : 3.55), upgraded ? 0.64 : 0.55, upgraded ? 3.5 : 3.0);
  }

  if (upgraded){
    // Supplemental AGL six-tube packs sit inboard; the heavy lock-on round is centerline.
    for (const sx of [-1, 1]){
      fixed.add(chamferBox(1.35, 1.0, 4.3, M.chest, sx * 2.65, -0.78, 0.25, 0.12));
      addMissileFace(fixed, M.trim, M.dark, sx * 2.65, -0.78, 2.5, 3, 2, 0.3, 0.1);
      const vane = box(0.18, 1.9, 2.5, M.trim, sx * 7.7, 0.8, -3.0);
      vane.rotation.z = sx * -0.38; fixed.add(vane);
    }
    fixed.add(zCyl(0.48, 0.62, 5.5, M.dark, 0, -1.35, -0.2, 12));
    fixed.add(zCone(0.48, 1.25, M.accent, 0, -1.35, 3.15, 12));
    weaponAnchor(C, 2, 0, -1.35, 3.85);
    for (const sx of [-1, 1]) fixed.add(box(0.9, 0.12, 1.4, M.trim, sx * 0.65, -1.35, -2.0));
  }

  // Four fixed 25 mm nose guns, arranged as two pairs.
  for (const x of [-0.56, 0.56]) for (const y of [-0.25, 0.18])
    forwardBarrel(C, x, y, 6.85, 2.4, 0.09);

  return finish(C, [0, 1.1, 3.8], [0, 0, 8.2]);
}

function buildCoreFighter(suit, supplied){
  const C = context(suit, supplied), { M, fixed } = C;

  // Compact 8.6 m craft after suit.scale: broad folding white wings around a red/blue core block.
  fixed.add(planform([
    [-1.25, 2.1], [1.25, 2.1], [6.1, -0.1], [5.8, -2.35],
    [1.7, -1.45], [-1.7, -1.45], [-5.8, -2.35], [-6.1, -0.1],
  ], 0.48, M.main, 0));
  for (const sx of [-1, 1]){
    const leading = box(4.5, 0.2, 0.58, M.accent, sx * 3.35, 0.08, 0.52);
    leading.rotation.y = sx * -0.36; fixed.add(leading);
    fixed.add(zCyl(0.34, 0.34, 1.25, M.frame, sx * 1.8, 0.1, 0.3, 12)); // fold hinge
  }

  fixed.add(profile([
    [-6.4, -0.75], [-5.0, -1.0], [2.5, -0.95], [7.0, -0.15],
    [5.0, 1.0], [0.8, 1.35], [-4.7, 0.85],
  ], [], 2.75, M.accent));
  fixed.add(chamferBox(3.35, 2.2, 5.0, M.chest, 0, 0.15, -0.7, 0.2));
  fixed.add(zCone(1.15, 3.2, M.accent, 0, -0.12, 6.45, 12));
  fixed.add(chamferBox(2.8, 0.65, 2.8, M.trim, 0, -0.62, 3.65, 0.08));

  const canopy = sph(0.92, M.glass, 0, 1.25, 2.7, 18, 12);
  canopy.scale.set(1.0, 0.58, 1.7); fixed.add(canopy);
  fixed.add(box(0.12, 0.75, 2.1, M.frame, 0, 1.28, 2.75));
  fixed.add(profile([[-6.2, 0], [-3.8, 0], [-5.65, 2.45]], [], 0.35, M.chest, 0, 0.4));
  for (const sx of [-1, 1]){
    const fin = profile([[-5.8, 0], [-3.8, 0], [-5.2, 1.45]], [], 0.26, M.accent, sx * 1.25, 0.18);
    fin.rotation.z = sx * -0.08; fixed.add(fin);
  }

  // Two recessed four-shot launchers rise from the fuselage shoulders in the source design.
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(0.7, 1.2, 2.4, M.main, sx * 1.55, 0.35, 0.9, 0.09));
    addMissileFace(fixed, M.frame, M.dark, sx * 1.55, 0.45, 2.18, 2, 2, 0.27, 0.085);
    weaponAnchor(C, 1, sx * 1.55, 0.45, 2.42);
    rearThruster(C, sx * 1.15, -0.05, -5.75, 0.74, 3.0);
  }

  for (const x of [-0.55, 0.55]) for (const y of [-0.4, -0.08])
    forwardBarrel(C, x, y, 5.8, 2.45, 0.075);

  return finish(C, [0, 1.25, 2.9], [0, -0.1, 7.3]);
}

function buildFlyManta(suit, supplied){
  const C = context(suit, supplied), { M, fixed } = C;

  // FF/B-2: 17 m long, 13 m wide after suit.scale. The entire aircraft is a thick manta-like
  // blended wing rather than a conventional fuselage with rectangular wings.
  fixed.add(planform([
    [0, 11.4], [2.4, 8.0], [8.85, 1.1], [8.35, -3.1], [4.6, -6.6],
    [1.85, -8.5], [-1.85, -8.5], [-4.6, -6.6], [-8.35, -3.1],
    [-8.85, 1.1], [-2.4, 8.0],
  ], 0.72, M.main, -0.15));
  fixed.add(planform([
    [0, 10.2], [1.45, 6.4], [6.8, 0.8], [4.0, -4.9],
    [0, -6.3], [-4.0, -4.9], [-6.8, 0.8], [-1.45, 6.4],
  ], 0.22, M.chest, 0.28));
  for (const sx of [-1, 1]){
    const edge = box(6.8, 0.22, 0.52, M.accent, sx * 4.25, 0.18, 3.4);
    edge.rotation.y = sx * -0.62; fixed.add(edge);
  }

  fixed.add(profile([
    [-8.2, -0.55], [-5.8, -1.2], [6.8, -1.0], [11.4, -0.1],
    [6.1, 1.5], [-2.0, 1.65], [-7.4, 0.55],
  ], [], 3.6, M.main));
  fixed.add(chamferBox(3.2, 0.7, 8.4, M.chest, 0, -0.85, -0.2, 0.12));
  fixed.add(zCone(1.28, 4.2, M.main, 0, -0.05, 9.55, 14));

  const canopy = sph(1.05, M.glass, 0, 1.5, 4.8, 20, 12);
  canopy.scale.set(1.05, 0.58, 1.75); fixed.add(canopy);
  fixed.add(box(0.14, 0.82, 2.55, M.frame, 0, 1.54, 4.7));

  // Twin dorsal jet nacelles and the only two main exhausts specified for the Fly Manta.
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(2.05, 1.55, 8.6, M.main, sx * 2.05, 0.72, -2.6, 0.18));
    fixed.add(chamferBox(1.45, 0.34, 6.4, M.accent, sx * 2.05, 1.58, -2.3, 0.06));
    fixed.add(chamferBox(1.55, 0.62, 1.3, M.dark, sx * 2.05, 0.72, 1.85, 0.09)); // intake
    rearThruster(C, sx * 2.05, 0.65, -7.2, 0.72, 3.4);
    fixed.add(profile([[-7.2, 0], [-4.2, 0], [-6.35, 2.55]], [], 0.34, M.main, sx * 3.05, 0.15));
  }

  // Ventral bomb bay and compact underwing stores retain the game's bomber role.
  fixed.add(chamferBox(3.0, 0.42, 5.6, M.dark, 0, -1.22, -1.25, 0.07));
  for (const sx of [-1, 1]) for (const z of [-1.8, 1.2]){
    fixed.add(zCyl(0.28, 0.36, 2.7, M.frame, sx * 5.3, -0.72, z, 10));
    fixed.add(zCone(0.29, 0.72, M.accent, sx * 5.3, -0.72, z + 1.7, 10));
    weaponAnchor(C, 1, sx * 5.3, -0.72, z + 2.15);
  }
  for (const x of [-0.52, 0.52]) forwardBarrel(C, x, -0.15, 9.35, 2.7, 0.085);

  return finish(C, [0, 1.5, 5.0], [0, -0.1, 11.4]);
}

function buildDopp(suit, supplied){
  const C = context(suit, supplied), { M, fixed } = C;

  // DFA-03 proportions become approximately 9.2 x 12.1 x 4.6 m after suit.scale. The elevated
  // all-round-vision cockpit and weapon pods are deliberately more prominent than the fuselage.
  fixed.add(planform([
    [-1.1, 2.7], [1.1, 2.7], [9.25, -0.45], [7.7, -2.8],
    [2.2, -1.8], [-2.2, -1.8], [-7.7, -2.8], [-9.25, -0.45],
  ], 0.52, M.main, -0.35));
  const pod = sph(1.75, M.main, 0, 0.25, 0.9, 20, 14);
  pod.scale.set(1.3, 0.88, 2.05); fixed.add(pod);
  fixed.add(zCone(1.35, 3.1, M.main, 0, -0.05, 4.15, 14));

  const cockpitShell = sph(1.45, M.main, 0, 2.15, 1.8, 20, 14);
  cockpitShell.scale.set(1.12, 0.9, 1.28); fixed.add(cockpitShell);
  const canopy = sph(1.18, M.glass, 0, 2.37, 2.2, 20, 14);
  canopy.scale.set(1.06, 0.65, 1.12); fixed.add(canopy);
  for (const x of [-0.58, 0.58]) fixed.add(box(0.12, 1.12, 2.0, M.frame, x, 2.38, 2.15));
  fixed.add(box(2.3, 0.12, 0.14, M.frame, 0, 2.62, 2.2));

  // A single oversized thrust unit forces the intentionally poor-aerodynamic craft through the air.
  fixed.add(zCyl(1.55, 1.75, 3.1, M.dark, 0, 0.1, -3.2, 18));
  rearThruster(C, 0, 0.1, -4.75, 1.35, 3.8);
  for (const sx of [-1, 1]){
    fixed.add(profile([[-4.2, 0], [-1.3, 0], [-3.3, 3.0]], [], 0.42, M.trim, sx * 2.4, 0.15));
    const weaponX = sx * 2.75;
    fixed.add(chamferBox(2.05, 2.05, 4.0, M.chest, weaponX, 0.25, 2.0, 0.2));
    // Six missiles ring the central 20 mm vulcan in each cheek pod.
    for (let i = 0; i < 6; i++){
      const a = i / 6 * PI * 2;
      fixed.add(zCyl(0.145, 0.145, 0.2, M.dark,
        weaponX + Math.cos(a) * 0.55, 0.25 + Math.sin(a) * 0.55, 4.08, 9));
    }
    fixed.add(zCyl(0.19, 0.19, 1.85, M.dark, weaponX, 0.25, 4.72, 10));
    weaponAnchor(C, 0, weaponX, 0.25, 5.7);
    weaponAnchor(C, 1, weaponX, 0.25, 4.45);
  }
  // Attitude-control verniers around the fat center body.
  for (const x of [-1.35, 1.35]) for (const y of [-0.65, 0.85])
    fixed.add(cyl(0.18, 0.24, 0.36, M.frame, x, y, -1.2, 9).rotateZ(PI / 2));

  return finish(C, [0, 2.35, 2.35], [0, 0.25, 5.7]);
}

function buildGattle(suit, supplied){
  const C = context(suit, supplied), { M, fixed } = C;

  fixed.add(profile([
    [-7.4, -1.0], [-6.0, -1.45], [4.3, -1.3], [7.0, -0.25],
    [4.0, 1.35], [-3.8, 1.45], [-7.2, 0.45],
  ], [], 3.0, M.main));
  fixed.add(chamferBox(3.8, 2.7, 10.0, M.main, 0, 0, -1.1, 0.22));
  fixed.add(zCone(1.45, 3.4, M.main, 0, -0.15, 5.9, 14));
  fixed.add(planform([
    [-1.5, 1.8], [1.5, 1.8], [7.0, -1.1], [6.1, -3.4],
    [1.8, -2.5], [-1.8, -2.5], [-6.1, -3.4], [-7.0, -1.1],
  ], 0.54, M.accent, 0.05));

  // Separate pilot and copilot escape-capsule canopies.
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(1.65, 1.5, 4.2, M.main, sx * 1.05, 0.9, 2.8, 0.17));
    const canopy = sph(0.85, M.glass, sx * 1.05, 1.55, 3.65, 18, 12);
    canopy.scale.set(0.85, 0.58, 1.45); fixed.add(canopy);
    fixed.add(box(0.1, 0.65, 2.0, M.frame, sx * 1.05, 1.56, 3.55));

    // One five-tube launcher outside each cockpit.
    fixed.add(chamferBox(2.05, 2.25, 4.4, M.chest, sx * 3.0, 0.0, 1.9, 0.2));
    const tubePoints = [[0, 0.62], [-0.58, 0.2], [0.58, 0.2], [-0.36, -0.48], [0.36, -0.48]];
    for (const [ox, oy] of tubePoints)
      fixed.add(zCyl(0.18, 0.18, 0.22, M.dark, sx * 3.0 + ox, oy, 4.18, 9));

    // Two 30 mm guns serve each cockpit.
    for (const ox of [-0.23, 0.23]) forwardBarrel(C, sx * 1.05 + ox, -0.28, 5.05, 2.6, 0.085);

    // Large optional anti-ship missile on each outer pylon.
    fixed.add(zCyl(0.45, 0.55, 5.4, M.dark, sx * 5.2, -1.05, -0.1, 12));
    fixed.add(zCone(0.46, 1.25, M.trim, sx * 5.2, -1.05, 3.2, 12));
    fixed.add(box(0.16, 1.1, 1.6, M.trim, sx * 5.2, -1.05, -2.5));
    weaponAnchor(C, 1, sx * 5.2, -1.05, 3.9);
  }

  fixed.add(profile([[-7.0, 0], [-3.9, 0], [-6.1, 3.55]], [], 0.45, M.main, 0, 0.3));
  fixed.add(zCyl(1.8, 2.0, 3.2, M.dark, 0, -0.1, -6.15, 18));
  // Six thermonuclear rocket engines in a two-by-three bank.
  for (const x of [-0.92, 0, 0.92]) for (const y of [-0.58, 0.58])
    rearThruster(C, x, y - 0.1, -7.75, 0.42, 2.7);
  for (const x of [-4.8, 4.8]) for (const y of [-0.35, 0.55])
    fixed.add(cyl(0.16, 0.22, 0.32, M.frame, x, y, -2.7, 9).rotateZ(PI / 2));

  return finish(C, [0, 1.5, 3.65], [0, -0.25, 6.4]);
}

function addCarrierTurret(C, x, y, z, scale = 1){
  const { M, body, parts } = C;
  if (!parts.turrets) parts.turrets = [];
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); body.add(yaw);
  yaw.add(cyl(0.62 * scale, 0.76 * scale, 0.38 * scale, M.dark, 0, 0, 0, 14));
  const gun = new THREE.Group(); gun.position.y = 0.35 * scale; yaw.add(gun);
  gun.add(chamferBox(1.3 * scale, 0.72 * scale, 1.55 * scale, M.main, 0, 0, 0, 0.11 * scale));
  for (const bx of [-0.3, 0.3]){
    const barrel = zCyl(0.09 * scale, 0.11 * scale, 2.7 * scale, M.frame,
      bx * scale, 0.04 * scale, 1.75 * scale, 9);
    gun.add(barrel);
  }
  const muzzle = anchor(gun, 0, 0.04 * scale, 3.15 * scale);
  parts.turrets.push({ yaw, gun, muzzle, cd: 0 });
  parts.muzzles.push(muzzle); (parts.weaponMuzzles[0] ||= []).push(muzzle);
  return muzzle;
}

function buildGaw(suit, supplied){
  const C = context(suit, supplied), { M, fixed } = C;

  // Dimensions are normalized so suit.scale 7.3 yields roughly the established 159 m span and
  // 147 m length. The Gaw is a thick lifting body with hangars at both wing roots, not a thin jet.
  fixed.add(planform([
    [0, 9.8], [3.2, 8.4], [10.9, 2.2], [10.35, -4.2], [7.3, -6.4],
    [2.8, -5.1], [1.6, -8.8], [-1.6, -8.8], [-2.8, -5.1],
    [-7.3, -6.4], [-10.35, -4.2], [-10.9, 2.2], [-3.2, 8.4],
  ], 1.12, M.main, 0));
  fixed.add(planform([
    [0, 8.8], [2.1, 7.8], [9.4, 2.0], [8.7, -3.6], [2.4, -4.4],
    [0, -6.3], [-2.4, -4.4], [-8.7, -3.6], [-9.4, 2.0], [-2.1, 7.8],
  ], 0.35, M.accent, 0.76));

  fixed.add(profile([
    [-8.0, -1.7], [-5.5, -2.7], [5.3, -2.5], [9.8, -0.7],
    [7.1, 2.2], [1.8, 3.0], [-4.6, 2.1], [-7.6, 0.7],
  ], [], 5.8, M.main));
  fixed.add(chamferBox(6.2, 3.8, 10.5, M.chest, 0, -1.35, 1.2, 0.3)); // MS hangar belly
  fixed.add(chamferBox(4.8, 1.4, 4.6, M.main, 0, 2.5, 4.8, 0.2));
  const bridgeGlass = chamferBox(3.2, 0.75, 2.6, M.glass, 0, 3.35, 5.3, 0.12);
  fixed.add(bridgeGlass);
  for (const sx of [-1, 1]) fixed.add(box(0.16, 0.9, 2.8, M.trim, sx * 1.65, 3.35, 5.25));

  // Twin Dopp hangars at the wing roots, with ribbed blast shutters and red warning frames.
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(4.1, 2.8, 8.2, M.chest, sx * 5.8, -0.55, -0.2, 0.25));
    fixed.add(chamferBox(3.45, 1.65, 0.25, M.dark, sx * 5.8, -0.6, 4.05, 0.05));
    for (let i = -3; i <= 3; i++) fixed.add(box(0.16, 1.7, 0.28, M.accent,
      sx * 5.8 + i * 0.48, -0.6, 4.16));
    fixed.add(chamferBox(3.55, 1.5, 0.22, M.dark, sx * 5.8, -0.6, -4.35, 0.04));
  }

  // Tall, single steering fin and the rear Komusai/deck block.
  fixed.add(profile([[-8.5, 0], [-2.4, 0], [-6.0, 7.0]], [], 0.72, M.main, 0, 0.55));
  fixed.add(profile([[-8.0, 0], [-4.0, 0], [-6.35, 5.1]], [], 0.76, M.accent, 0, 0.65));
  fixed.add(chamferBox(5.2, 1.6, 4.1, M.chest, 0, 0.85, -6.2, 0.18));
  fixed.add(chamferBox(4.3, 0.28, 3.2, M.dark, 0, 1.82, -6.05, 0.06));

  // Eighteen compact thermonuclear jet nozzles. Six representative plumes remain dynamic.
  const engineXs = [-8.0, -6.0, -4.0, -2.0, 0, 2.0, 4.0, 6.0, 8.0];
  for (const x of engineXs) for (const y of [-0.72, 0.62])
    rearThruster(C, x, y, -5.55 - Math.abs(x) * 0.08, 0.34, 2.25,
      y > 0 && [-8, -4, 0, 4, 8].includes(x) || (x === 0 && y < 0));

  // Belly bomb-bay doors and four fixed beam-cannon ports.
  fixed.add(chamferBox(4.5, 0.28, 5.8, M.dark, 0, -3.35, 0.7, 0.06));
  for (const x of [-1.6, -0.55, 0.55, 1.6]) fixed.add(box(0.08, 0.12, 5.35, M.frame, x, -3.53, 0.7));
  for (const x of [-7.4, -2.2, 2.2, 7.4])
    fixed.add(zCyl(0.16, 0.2, 1.8, M.dark, x, -0.9, 3.9, 10));

  // Three canonical retractable twin mega-particle positions: one center and one per wing.
  const centerMuzzle = addCarrierTurret(C, 0, 3.2, 1.0, 1.0);
  addCarrierTurret(C, -6.4, 1.15, 0.6, 0.82);
  addCarrierTurret(C, 6.4, 1.15, 0.6, 0.82);
  C.parts.weaponMuzzles[1] = C.parts.weaponMuzzles[0].slice();
  C.parts.muzzle = centerMuzzle;

  return finish(C, [0, 3.35, 5.4], [0, 3.2, 4.2]);
}

function buildGFighter(suit, supplied){
  const C = context(suit, supplied), { M, fixed, body } = C;

  // Canonical G-Parts support craft: red A-parts nose/cockpit, blue B-parts propulsion body,
  // reversible wings, two long mega-particle guns, and the unmistakable side caterpillar units.
  fixed.add(chamferBox(6.4, 3.8, 10.2, M.accent, 0, 0.15, 4.0, 0.3)); // A-parts
  fixed.add(chamferBox(7.2, 4.2, 11.5, M.main, 0, 0.0, -5.2, 0.32));  // B-parts
  fixed.add(chamferBox(5.4, 1.25, 4.0, M.trim, 0, -0.65, 10.2, 0.18));
  fixed.add(zCone(1.65, 3.0, M.trim, 0, -0.65, 12.75, 12));
  fixed.add(chamferBox(2.8, 1.2, 3.3, M.accent, 0, 1.9, 6.6, 0.17));
  fixed.add(chamferBox(2.15, 0.72, 2.3, M.glass, 0, 2.65, 6.9, 0.12));

  fixed.add(planform([
    [-2.2, 0.8], [2.2, 0.8], [9.1, -3.3], [8.1, -7.2],
    [2.8, -5.6], [-2.8, -5.6], [-8.1, -7.2], [-9.1, -3.3],
  ], 0.72, M.main, 0.45));
  for (const sx of [-1, 1]){
    const lead = box(6.5, 0.28, 0.8, M.accent, sx * 5.25, 0.56, -2.65);
    lead.rotation.y = sx * -0.38; fixed.add(lead);
    fixed.add(chamferBox(1.2, 1.0, 3.4, M.trim, sx * 8.3, 0.25, -5.0, 0.13));
  }

  // Visible G-Bull caterpillar mechanisms along both sides of the A-parts.
  const trackPath = [[-0.8, 0.15], [8.4, 0.15], [9.0, 0.75], [8.25, 1.7], [-0.9, 1.7], [-1.55, 0.8]];
  fixed.add(instancedTrack(trackPath, [-3.45, 3.45], 1.32, 0.58, M.joint, true));
  for (const sx of [-1, 1]){
    for (const z of [0.0, 2.2, 4.4, 6.6, 8.0]){
      fixed.add(cyl(0.65, 0.65, 1.45, M.frame, sx * 3.45, 0.82, z, 14).rotateZ(PI / 2));
      fixed.add(cyl(0.24, 0.24, 1.55, M.dark, sx * 3.45, 0.82, z, 12).rotateZ(PI / 2));
    }
    fixed.add(chamferBox(1.75, 0.55, 9.4, M.main, sx * 3.45, 1.92, 3.65, 0.09));
  }

  // Long forward mega-particle guns flank the cockpit and clear the gold nose.
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(1.05, 1.3, 5.1, M.dark, sx * 2.3, 2.0, 5.4, 0.13));
    forwardBarrel(C, sx * 2.3, 2.05, 10.35, 8.3, 0.22, M.frame);
  }

  // Empty Gundam-support cradle plus compact missile packs retain the G-Parts modular structure.
  fixed.add(chamferBox(4.8, 0.5, 6.6, M.dark, 0, 2.35, -3.2, 0.08));
  for (const sx of [-1, 1]) fixed.add(box(0.45, 1.45, 5.8, M.frame, sx * 2.25, 2.8, -3.2));
  for (const sx of [-1, 1]){
    fixed.add(chamferBox(1.65, 1.0, 4.2, M.dark, sx * 6.2, -0.8, 1.2, 0.12));
    addMissileFace(fixed, M.trim, M.dark, sx * 6.2, -0.8, 3.42, 3, 2, 0.31, 0.1);
    weaponAnchor(C, 1, sx * 6.2, -0.8, 3.7);
  }

  for (const sx of [-1, 1]){
    fixed.add(chamferBox(2.35, 2.3, 4.2, M.chest, sx * 2.4, -0.1, -10.1, 0.2));
    rearThruster(C, sx * 2.4, -0.1, -12.35, 0.9, 4.0);
  }
  for (const sx of [-1, 1]) fixed.add(profile([[-11.8, 0], [-7.2, 0], [-10.2, 3.2]], [], 0.38, M.accent, sx * 2.1, 0.7));

  // Keep the tracks banked with the craft; they already live under parts.body via fixed.
  C.parts.muzzle = C.parts.muzzles[0];
  body.userData.gParts = true;
  return finish(C, [0, 2.65, 7.0], [0, 2.05, 14.5]);
}

export function buildCanonicalAircraft(suit, M){
  if (!suit) return null;
  switch (suit.id){
    case 'saberfish': return buildSaberfish(suit, M, false);
    case 'saberfish5000': return buildSaberfish(suit, M, true);
    case 'corefighter': return buildCoreFighter(suit, M);
    case 'flymanta': return buildFlyManta(suit, M);
    case 'dopp': return buildDopp(suit, M);
    case 'gattle': return buildGattle(suit, M);
    case 'gaw': return buildGaw(suit, M);
    case 'gfighter': return buildGFighter(suit, M);
    default: return null;
  }
}
