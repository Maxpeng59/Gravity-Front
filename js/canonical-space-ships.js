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

// Every cruiser carries two compact three-tube missile boxes.  The paired
// housings make the requested 2 x 3 salvo readable on the hull without adding
// costly detail across the rest of the model.
function addMissileRacks(parent, armor, dark, x, y, z){
  for (const side of [-1, 1]){
    const rackX = side * x;
    parent.add(chamferBox(3.4, 4.8, 4.2, armor, rackX, y, z, 0.25));
    for (const tubeY of [-1.3, 0, 1.3]) parent.add(forwardCylinder(0.42, 2.3, dark, rackX, y + tubeY, z + 1.8));
  }
}

function addFederationTorpedoTube(parent, armor, dark, y, z){
  parent.add(forwardCylinder(1.15, 4.8, armor, 0, y, z));
  parent.add(forwardCylinder(0.72, 1.2, dark, 0, y, z + 4.2));
}

function addTurret(root, turrets, armor, dark, cooldown, spec){
  const {
    x = 0, y, z, width, offsets, length, rear = false, arc = PI,
    restYaw = rear ? PI : 0, secondary = false, damageScale = 1,
    splashScale = 1, rofScale = 1, rangeScale = 1, shellScale = 1,
    heavy = true, collisionRadius = 2.6, weaponName = 'SHIP MAIN BATTERY',
  } = spec;
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); yaw.rotation.y = restYaw; root.add(yaw);
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
    restYaw, arc, shots: offsets.length, secondary, damageScale, splashScale,
    rofScale, rangeScale, shellScale, heavy, collisionRadius, weaponName,
  });
}

// Federation close-defense batteries are grouped around the armored waist.
// Keeping the five mounts tight makes them read as a deliberate amidships bank
// instead of unrelated guns scattered from bow to engine house.
const FEDERATION_SIDE_BATTERY_Z = Object.freeze([-14, -7, 0, 7, 14]);

function addFederationSideBatteries(root, turrets, armor, dark, cooldown, {
  x, y, zStations = FEDERATION_SIDE_BATTERY_Z, width = 2.35, length = 5.6,
  damageScale = 0.34, rangeScale = 0.68,
}){
  // Five light defensive stations on both port and starboard. Their pivots rest
  // facing outboard, so the silhouette reads as side-mounted armament even idle.
  for (const side of [-1, 1]) for (const z of zStations) addTurret(
    root, turrets, armor, dark, cooldown,
    {
      x: side * x, y, z, width, offsets: [0], length,
      restYaw: side * PI / 2, arc: PI * 0.62,
      secondary: true, damageScale, splashScale: 0.22,
      rofScale: 0.46, rangeScale, shellScale: 0.48,
      heavy: false, collisionRadius: 0.65, weaponName: 'SHIP SIDE BATTERY',
    },
  );
}

function buildMusai(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const green = std(0x5f7855), light = std(0x849773), dark = std(0x28382d, { metalness: 0.58 });
  const red = std(0x7c2d2d, { emissive: 0x3b0909, emissiveIntensity: 0.45 });

  // Organic Zeon prow: a low pointed body beneath the raised command neck.
  staticHull.add(longitudinalHull([
    [-31, 7.2, 17, 6], [-12, 9.5, 20, 4], [15, 11.4, 19, 3],
    [37, 7.2, 15, 5.5], [55, 1.3, 10.5, 7.5],
  ], green));
  staticHull.add(longitudinalHull([
    [-24, 5.4, 22, 16], [12, 7.8, 23, 15], [35, 4.2, 18, 13], [48, 1.5, 13, 10],
  ], light));
  staticHull.add(longitudinalHull([[-30, 3.4, 7, 1], [18, 5.5, 7, 1.5], [47, 1.2, 10, 7]], dark));
  const roundedProw = sph(6.5, light, 0, 13.5, 29, 18, 10);
  roundedProw.scale.set(1.45, 0.62, 2.35); staticHull.add(roundedProw);

  // The Musai silhouette is defined by its widely separated teardrop nacelles.
  for (const sx of [-1, 1]){
    staticHull.add(longitudinalHull([
      [-57, 6.2, 15, 4], [-42, 7.4, 17, 2], [-18, 7.1, 16, 3],
      [5, 5.3, 13, 5], [27, 1.8, 10, 7],
    ], green, sx * 16));
    const nacelleShoulder = sph(5.4, light, sx * 16, 10, -17, 16, 10);
    nacelleShoulder.scale.set(1.25, 0.72, 2.7); staticHull.add(nacelleShoulder);
    staticHull.add(chamferBox(13, 2.4, 7, dark, sx * 10.5, 10, -18, 0.34));
    const tailFin = profile([[-8, 0], [-3, 9], [2, 14], [5, 2], [8, 0]], [], 0.85,
      green, sx * 16, 15, -45);
    staticHull.add(tailFin);
    addEngine(staticHull, green, dark, thrust, sx * 16, 9.5, -59, 4.8);
  }

  // Swan-neck command tower and hammerhead bridge distinguish it at a glance.
  staticHull.add(profile([
    [-13, 0], [-10, 10], [-4, 18], [3, 22], [9, 20], [5, 13], [0, 9], [-3, 0],
  ], [], 7.2, green, 0, 17, -13));
  staticHull.add(longitudinalHull([
    [-17, 5.4, 38, 31], [-5, 6.8, 40, 30], [8, 5.8, 38, 30], [16, 2.4, 34, 31],
  ], light));
  staticHull.add(chamferBox(9.5, 3.2, 8.5, dark, 0, 39.5, -7, 0.4));
  staticHull.add(chamferBox(6.2, 1.1, 0.4, glow, 0, 40, -2.55, 0.06));
  staticHull.add(sph(0.85, red, 0, 43.2, -6.5, 12, 8));
  staticHull.add(cyl(0.28, 0.28, 9, dark, 0, 47, -8, 8));
  staticHull.add(chamferBox(6.5, 1.0, 8.5, dark, 0, 5.8, 19, 0.18)); // ventral MS hatch
  for (const z of [32, 15, -5]) addTurret(root, turrets, light, dark, cooldown,
    { y: 22.5, z, width: 5.1, offsets: [-1.25, 0, 1.25], length: 9.5, arc: PI * 0.78 });
  addMissileRacks(staticHull, green, dark, 9.2, 18.2, 7);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'musai-swan-neck-twin-nacelle';
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
  addMissileRacks(staticHull, red, dark, 10.8, 22.2, 7);
  compactGroup(staticHull); root.add(staticHull);
  return { root, turrets };
}

function buildSalamis(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const blue = std(0x778a99), light = std(0x9aa8b0), red = std(0x8d4047), dark = std(0x38434c, { metalness: 0.6 });
  const yellow = std(0xc7a64d, { metalness: 0.34 });

  // Salamis: triangular prow, a visible inward waist, then a rectangular drive block.
  staticHull.add(longitudinalHull([
    [-48, 11.4, 18, 2], [-31, 11.8, 19, 1], [-15, 9.1, 17, 3],
    [5, 8.2, 17, 3.5], [20, 10.2, 18, 4], [38, 8.2, 16, 5.5],
    [54, 4.5, 13, 7], [64, 0.75, 10, 8],
  ], blue));
  staticHull.add(longitudinalHull([
    [-42, 7.4, 7, 0], [-14, 6.4, 7, -0.5], [9, 5.2, 7, 0],
    [36, 4.8, 9, 4], [56, 1.1, 9, 7],
  ], red));
  staticHull.add(chamferBox(23.5, 16, 21, blue, 0, 10, -50, 0.65));
  staticHull.add(chamferBox(20.5, 10, 8, dark, 0, 10, -61.5, 0.32));
  for (const sx of [-1, 1]){
    staticHull.add(longitudinalHull([
      [-31, 3.2, 16, 5], [-11, 2.7, 15, 5], [7, 1.5, 13, 6], [29, 0.7, 11, 7],
    ], light, sx * 9.2));
    staticHull.add(chamferBox(2.8, 3.5, 19, dark, sx * 9.4, 10, -2, 0.25));
  }
  staticHull.add(chamferBox(11, 6, 15, blue, 0, 21.5, -5, 0.7));
  staticHull.add(chamferBox(7.8, 5.2, 10, light, 0, 27, -6, 0.55));
  staticHull.add(chamferBox(5.4, 3.8, 6.5, dark, 0, 31.2, -6, 0.4));
  addWindows(staticHull, glow, [-1.9, 0, 1.9], 31.3, -2.7, 1.2);
  for (const sx of [-1, 1]){
    const fin = profile([[-1.2, 0], [-0.7, 9], [0.7, 12], [1.2, 0]], [], 0.65, yellow, sx * 4.2, 29, -8);
    staticHull.add(fin);
  }
  for (const ex of [-7, 0, 7]) addEngine(staticHull, blue, dark, thrust, ex, 10, -64, ex ? 2.8 : 3.5);
  for (const [z, rear] of [[39, false], [21, false], [-27, true]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y: 20.5, z, width: 4.8, offsets: [-1.05, 1.05], length: 9.5, rear, arc: PI * 0.8 });
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 11.4, y: 16.8, width: 2.25, length: 5.5 });
  addMissileRacks(staticHull, blue, dark, 7.4, 18.2, 9);
  addFederationTorpedoTube(staticHull, blue, dark, 8.5, 57);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'salamis-triangle-waist-box-drive';
  return { root, turrets };
}

function buildMagellan(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const teal = std(0x657d7c), light = std(0x829898), dark = std(0x344849, { metalness: 0.62 });
  const yellow = std(0xc8a753, { metalness: 0.36 });

  // Magellan: a longer, heavier armored wedge with a broad squared engine house.
  staticHull.add(longitudinalHull([
    [-60, 14.2, 20, 0], [-43, 14.8, 21, -1], [-23, 13.8, 22, 0],
    [7, 14.2, 24, 1], [33, 11.4, 22, 3], [55, 6.2, 16, 7], [72, 1.1, 11, 8],
  ], teal));
  staticHull.add(longitudinalHull([
    [-45, 8.5, 30, 17], [-10, 10, 33, 17], [17, 10.5, 34, 18],
    [38, 6.2, 28, 17], [54, 2.4, 20, 15],
  ], light));
  staticHull.add(chamferBox(29, 18, 24, teal, 0, 10, -61, 0.75));
  staticHull.add(chamferBox(26, 12, 8, dark, 0, 10, -74, 0.38));
  staticHull.add(chamferBox(11.5, 9, 17, teal, 0, 35, -6, 0.8));
  staticHull.add(chamferBox(8, 5.5, 10, dark, 0, 42, -7, 0.5));
  addWindows(staticHull, glow, [-2.5, 0, 2.5], 42, -1.7, 1.35);
  for (const sx of [-1, 1]) for (const z of [-25, -7, 11, 29]){
    staticHull.add(chamferBox(0.7, 2.3, 8.5, dark, sx * 14.25, 12, z, 0.1));
    staticHull.add(chamferBox(0.78, 0.55, 5.6, yellow, sx * 14.65, 12.2, z, 0.05));
  }
  for (const sx of [-1, 1]){
    const fin = profile([[-1.6, 0], [-0.8, 12], [0.8, 17], [1.6, 0]], [], 0.75, yellow, sx * 5.6, 39, -11);
    staticHull.add(fin);
  }
  for (const ex of [-9.5, -3.2, 3.2, 9.5]) addEngine(staticHull, teal, dark, thrust, ex, 10, -77, 3.4);
  for (const [z, rear] of [[48, false], [27, false], [-24, true], [-43, true]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y: 26.5, z, width: 6.1, offsets: [-1.4, 1.4], length: 12, rear, arc: PI * 0.76 });
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 14.8, y: 18.5, zStations: [-16, -8, 0, 8, 16], width: 2.6, length: 6.2, damageScale: 0.38, rangeScale: 0.72 });
  addMissileRacks(staticHull, teal, dark, 11.2, 23.5, 12);
  addFederationTorpedoTube(staticHull, teal, dark, 9.5, 65);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'magellan-long-wedge-heavy-drive';
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
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 18.8, y: 17.5, zStations: [-12, -6, 0, 6, 12], width: 2.05, length: 4.7, damageScale: 0.28, rangeScale: 0.6 });
  addMissileRacks(staticHull, grey, dark, 10, 26.2, 8);
  addFederationTorpedoTube(staticHull, grey, dark, 6, 35);
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
