// One Year War fleet hulls for campaign and Custom Battle.  The large forms
// use a few explicit longitudinal sections: recognisable silhouettes and hard
// mechanical faces without covering every surface in expensive bevels.
import {
  THREE, box, cyl, sph, chamferBox, profile, compactGroup,
} from './model-kit.js';

const PI = Math.PI;
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.6, metalness: 0.46, ...extra,
});

// Sections are [z, half-width, top-y, bottom-y].  The hull's prow is +Z.
function longitudinalHull(sections, material, x = 0, y = 0, z = 0){
  const positions = [], uvs = [], indices = [];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++){
    const [sz, halfWidth, top, bottom] = sections[sectionIndex];
    positions.push(
      -halfWidth, top, sz,
      halfWidth, top, sz,
      halfWidth, bottom, sz,
      -halfWidth, bottom, sz,
    );
    const v = sections.length === 1 ? 0 : sectionIndex / (sections.length - 1);
    uvs.push(0, v, 1, v, 1, v, 0, v);
  }
  for (let ring = 0; ring < sections.length - 1; ring++){
    const a = ring * 4, b = (ring + 1) * 4;
    for (let side = 0; side < 4; side++){
      const next = (side + 1) % 4;
      indices.push(a + side, b + next, a + next, a + side, b + side, b + next);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const end = (sections.length - 1) * 4;
  indices.push(end, end + 3, end + 2, end, end + 2, end + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function forwardCylinder(radius, length, material, x, y, z){
  const mesh = cyl(radius, radius * 1.06, length, material, x, y, z + length / 2, 10);
  mesh.rotation.x = PI / 2;
  return mesh;
}

function addEngine(parent, armor, dark, thrust, x, y, z, radius){
  const casing = cyl(radius * 1.12, radius * 1.34, radius * 1.8, armor, x, y, z, 14);
  casing.rotation.x = PI / 2; parent.add(casing);
  const ring = cyl(radius * 0.9, radius * 1.05, radius * 0.5, dark, x, y, z - radius * 1.05, 14);
  ring.rotation.x = PI / 2; parent.add(ring);
  const flame = sph(radius * 0.78, thrust, x, y, z - radius * 1.55, 12, 8);
  flame.scale.z = 0.48; parent.add(flame);
}

function addWindows(parent, glow, xs, y, z, width = 1.5){
  for (const x of xs) parent.add(chamferBox(width, 0.58, 0.24, glow, x, y, z, 0.06));
}

function addTurret(root, turrets, armor, dark, cooldown, spec){
  const { x = 0, y, z, width, offsets, length, rear = false, arc = PI } = spec;
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); yaw.rotation.y = rear ? PI : 0; root.add(yaw);
  yaw.add(cyl(width * 0.5, width * 0.62, width * 0.28, dark, 0, 0, 0, 14));
  const gun = new THREE.Group(); gun.position.y = width * 0.18; yaw.add(gun);
  gun.add(chamferBox(width, width * 0.48, width * 0.88, armor, 0, width * 0.16, 0, width * 0.08));
  const muzzles = [];
  for (const bx of offsets){
    gun.add(forwardCylinder(width * 0.07, length, dark, bx, width * 0.2, width * 0.35));
    const muzzle = new THREE.Object3D(); muzzle.position.set(bx, width * 0.2, width * 0.35 + length); gun.add(muzzle);
    muzzles.push(muzzle);
  }
  turrets.push({
    yaw, gun, muzzle: muzzles[0], muzzles, cd: cooldown(),
    restYaw: rear ? PI : 0, arc, shots: offsets.length,
  });
}

function buildMusai(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const green = std(0x657b59), light = std(0x839271), dark = std(0x2e3b31, { metalness: 0.58 });
  staticHull.add(longitudinalHull([
    [-35, 6.4, 17, 7], [-10, 7.2, 18, 5.5], [26, 6.1, 17, 6.5], [48, 2.1, 13, 9],
  ], green));
  staticHull.add(longitudinalHull([[-30, 4.4, 20, 16], [22, 4.8, 21, 15], [39, 2.2, 17, 13]], light));
  staticHull.add(longitudinalHull([[-28, 2.3, 8, 2], [22, 3.5, 8, 2.5], [43, 1.2, 10, 7]], dark));

  // The Musai silhouette is defined by its separated twin engine nacelles.
  for (const sx of [-1, 1]){
    staticHull.add(longitudinalHull([
      [-49, 4.8, 15, 6], [-31, 5.4, 17, 5], [-7, 4.4, 15, 7], [7, 2.2, 12, 9],
    ], green, sx * 13));
    staticHull.add(chamferBox(9.5, 2.8, 6.5, dark, sx * 8.5, 11, -12, 0.36));
    addEngine(staticHull, green, dark, thrust, sx * 13, 10.5, -50, 3.8);
  }
  staticHull.add(chamferBox(4.8, 7, 7, dark, 0, 21, -5, 0.5));
  staticHull.add(sph(3.4, light, 0, 25.5, -4, 18, 12));
  staticHull.add(chamferBox(4.4, 1.2, 0.35, glow, 0, 25.5, -0.6, 0.08));
  staticHull.add(cyl(0.28, 0.28, 8, dark, 0, 32, -5, 8));
  staticHull.add(chamferBox(6.5, 1.0, 8.5, dark, 0, 5.8, 19, 0.18)); // ventral MS hatch
  for (const z of [29, 14, -2]) addTurret(root, turrets, light, dark, cooldown,
    { y: 20.5, z, width: 5.1, offsets: [-1.25, 0, 1.25], length: 9.5, arc: PI * 0.78 });
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

function buildChivvay(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const red = std(0x915654), light = std(0xb06c62), dark = std(0x402f37, { metalness: 0.58 });
  staticHull.add(longitudinalHull([
    [-51, 11, 18, 5], [-28, 14, 21, 3], [10, 15, 23, 3], [39, 10, 19, 6], [54, 3.5, 14, 9],
  ], red));
  staticHull.add(longitudinalHull([[-35, 7, 28, 17], [9, 8.5, 29, 18], [32, 4.5, 23, 17]], light));
  staticHull.add(longitudinalHull([[-24, 4.5, 35, 26], [8, 5.4, 37, 27], [20, 3.2, 31, 25]], red));
  staticHull.add(chamferBox(7.2, 4.8, 8, dark, 0, 39, -8, 0.5));
  addWindows(staticHull, glow, [-2.4, 0, 2.4], 39.2, -3.9, 1.5);
  for (const sx of [-1, 1]){
    const fin = profile([[-2, 0], [-1.2, 10], [1.1, 14], [2.1, 0]], [], 0.8, dark, sx * 8.5, 24, -27);
    staticHull.add(fin);
    addEngine(staticHull, red, dark, thrust, sx * 6.8, 12, -53, 4.2);
  }
  addEngine(staticHull, light, dark, thrust, 0, 12, -55, 4.8);
  for (const [z, rear] of [[34, false], [18, false], [-26, true]]) addTurret(root, turrets, light, dark, cooldown,
    { y: 25, z, width: 6.2, offsets: [-1.4, 1.4], length: 12, rear, arc: PI * 0.72 });
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

function buildSalamis(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const blue = std(0x778a99), light = std(0x9aa8b0), red = std(0x8d4047), dark = std(0x38434c, { metalness: 0.6 });
  const yellow = std(0xc7a64d, { metalness: 0.34 });
  staticHull.add(longitudinalHull([
    [-48, 8.2, 17, 6], [-20, 9.2, 18, 4], [22, 8.4, 18, 5], [45, 5.2, 15, 7], [57, 1.6, 12, 9],
  ], blue));
  staticHull.add(longitudinalHull([[-42, 5.8, 7, 1], [12, 6.5, 7, 0], [43, 3.8, 9, 4]], red));
  staticHull.add(chamferBox(10, 6, 15, blue, 0, 21, -4, 0.7));
  staticHull.add(chamferBox(7.2, 5, 9, light, 0, 26, -5, 0.55));
  staticHull.add(chamferBox(5.2, 3.6, 6, dark, 0, 30, -5, 0.4));
  addWindows(staticHull, glow, [-1.8, 0, 1.8], 30, -1.9, 1.15);
  for (const sx of [-1, 1]){
    const fin = profile([[-1.2, 0], [-0.7, 9], [0.7, 12], [1.2, 0]], [], 0.65, yellow, sx * 4.2, 29, -8);
    staticHull.add(fin);
  }
  for (const ex of [-5.2, 0, 5.2]) addEngine(staticHull, blue, dark, thrust, ex, 10, -50, ex ? 2.6 : 3.4);
  for (const [z, rear] of [[34, false], [20, false], [-28, true]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y: 20, z, width: 4.8, offsets: [-1.05, 1.05], length: 9.5, rear, arc: PI * 0.8 });
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

function buildMagellan(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const teal = std(0x657d7c), light = std(0x829898), dark = std(0x344849, { metalness: 0.62 });
  const yellow = std(0xc8a753, { metalness: 0.36 });
  staticHull.add(longitudinalHull([
    [-55, 10.5, 18, 4], [-32, 13, 21, 2], [15, 14, 23, 2], [43, 9.5, 18, 5], [59, 2.2, 13, 9],
  ], teal));
  staticHull.add(longitudinalHull([[-46, 7, 28, 17], [15, 8.2, 29, 18], [37, 4.4, 23, 17]], light));
  staticHull.add(chamferBox(9.5, 8, 15, teal, 0, 32, -4, 0.8));
  staticHull.add(chamferBox(6.5, 5, 8, dark, 0, 38, -5, 0.5));
  addWindows(staticHull, glow, [-2, 0, 2], 38, -0.8, 1.2);
  for (const sx of [-1, 1]){
    const fin = profile([[-1.4, 0], [-0.7, 11], [0.8, 15], [1.4, 0]], [], 0.7, yellow, sx * 5.2, 35, -10);
    staticHull.add(fin);
  }
  for (const ex of [-7.5, -2.5, 2.5, 7.5]) addEngine(staticHull, teal, dark, thrust, ex, 10, -57, 3.1);
  for (const [z, rear] of [[39, false], [24, false], [-25, true], [-39, true]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y: 25, z, width: 6.1, offsets: [-1.4, 1.4], length: 12, rear, arc: PI * 0.76 });
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

function buildColumbus(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const grey = std(0x7c8791), light = std(0x9aa3aa), dark = std(0x3d4852, { metalness: 0.58 });
  // Broad twin cargo bodies and a short central command spine distinguish the carrier.
  for (const sx of [-1, 1]){
    staticHull.add(longitudinalHull([
      [-42, 7.8, 20, 4], [-25, 8.8, 22, 2], [25, 8.8, 22, 2], [43, 5.2, 17, 6],
    ], grey, sx * 10));
    for (const z of [-21, -4, 13]) staticHull.add(chamferBox(13.5, 3.4, 11.5, light, sx * 10, 23.5, z, 0.35));
    addEngine(staticHull, grey, dark, thrust, sx * 10, 11, -45, 4.2);
  }
  staticHull.add(chamferBox(9, 7, 55, dark, 0, 14, -1, 0.65));
  staticHull.add(chamferBox(7, 6, 11, grey, 0, 25, 17, 0.55));
  addWindows(staticHull, glow, [-2.2, 0, 2.2], 26, 22.7, 1.25);
  staticHull.add(chamferBox(14, 1.2, 16, dark, 0, 5, 31, 0.2)); // forward loading ramp
  for (const sx of [-1, 1]) addTurret(root, turrets, light, dark, cooldown,
    { x: sx * 10, y: 25, z: 29, width: 4.1, offsets: [0], length: 7, arc: PI * 0.7 });
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

export function buildCanonicalSpaceShip(kind, glow, thrust, cooldown = () => 0){
  if (kind === 'musai') return buildMusai(glow, thrust, cooldown);
  if (kind === 'chivvay') return buildChivvay(glow, thrust, cooldown);
  if (kind === 'salamis') return buildSalamis(glow, thrust, cooldown);
  if (kind === 'magellan') return buildMagellan(glow, thrust, cooldown);
  if (kind === 'columbus') return buildColumbus(glow, thrust, cooldown);
  return null;
}
