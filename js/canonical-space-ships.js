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

// Federation hulls deliberately use square machinery. The original anime
// designs read from their large wedges and slab-sided drive blocks, so rounded
// engine bells only made the small in-game silhouettes harder to identify.
function addBlockEngine(parent, armor, dark, thrust, x, y, z, width, height, depth = 8){
  parent.add(box(width, height, depth, armor, x, y, z));
  parent.add(box(width * 0.72, height * 0.72, 1.2, dark, x, y, z - depth * 0.56));
  parent.add(box(width * 0.44, height * 0.44, 3.2, thrust, x, y, z - depth * 0.79));
}

function addWindows(parent, glow, xs, y, z, width = 1.5){
  for (const x of xs) parent.add(chamferBox(width, 0.58, 0.24, glow, x, y, z, 0.06));
}

// Every cruiser carries two compact three-tube missile boxes.  The paired
// housings make the requested 2 x 3 salvo readable on the hull without adding
// costly detail across the rest of the model.
function addMissileRacks(parent, armor, dark, x, y, z, boxy = false){
  for (const side of [-1, 1]){
    const rackX = side * x;
    parent.add(boxy
      ? box(3.4, 4.8, 4.2, armor, rackX, y, z)
      : chamferBox(3.4, 4.8, 4.2, armor, rackX, y, z, 0.25));
    for (const tubeY of [-1.3, 0, 1.3]) parent.add(boxy
      ? box(0.84, 0.84, 2.3, dark, rackX, y + tubeY, z + 2.3)
      : forwardCylinder(0.42, 2.3, dark, rackX, y + tubeY, z + 1.8));
  }
}

function addFederationTorpedoTube(parent, armor, dark, y, z){
  parent.add(box(2.4, 2.4, 4.8, armor, 0, y, z + 2.4));
  parent.add(box(1.45, 1.45, 1.2, dark, 0, y, z + 5.1));
}

function addTurret(root, turrets, armor, dark, cooldown, spec){
  const {
    x = 0, y, z, width, offsets, length, rear = false, arc = PI,
    restYaw = rear ? PI : 0, secondary = false, damageScale = 1,
    splashScale = 1, rofScale = 1, rangeScale = 1, shellScale = 1,
    heavy = true, collisionRadius = 2.6, weaponName = 'SHIP MAIN BATTERY',
    boxy = false,
  } = spec;
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); yaw.rotation.y = restYaw; root.add(yaw);
  yaw.add(boxy
    ? box(width * 0.92, width * 0.28, width * 0.82, dark, 0, 0, 0)
    : cyl(width * 0.5, width * 0.62, width * 0.28, dark, 0, 0, 0, 14));
  const gun = new THREE.Group(); gun.position.y = width * 0.18; yaw.add(gun);
  gun.add(boxy
    ? box(width, width * 0.48, width * 0.88, armor, 0, width * 0.16, 0)
    : chamferBox(width, width * 0.48, width * 0.88, armor, 0, width * 0.16, 0, width * 0.08));
  const muzzles = [];
  for (const bx of offsets){
    gun.add(boxy
      ? box(width * 0.14, width * 0.14, length, dark, bx, width * 0.2, width * 0.35 + length / 2)
      : forwardCylinder(width * 0.07, length, dark, bx, width * 0.2, width * 0.35));
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
      boxy: true,
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

  // Salamis: one clean arrowhead prow, an unmistakable pinched waist, and a
  // rectangular three-engine stern. Broad flat faces carry the silhouette.
  staticHull.add(longitudinalHull([
    [-39, 11.6, 18, 2], [-20, 8.1, 17, 3], [17, 10.4, 18, 4],
    [49, 4.8, 14, 6], [66, 0.7, 10, 8],
  ], blue));
  staticHull.add(longitudinalHull([
    [-38, 7.2, 5, -1], [-15, 5.4, 5, -1], [22, 5.4, 7, 1], [58, 0.8, 9, 7],
  ], red));
  staticHull.add(box(24, 16, 22, blue, 0, 10, -50));
  staticHull.add(box(21, 11, 4, dark, 0, 10, -63));
  for (const sx of [-1, 1]){
    staticHull.add(box(3, 6, 42, light, sx * 10.3, 11, -5));
    staticHull.add(box(1, 2.6, 25, dark, sx * 11.9, 11, -4));
  }
  staticHull.add(box(11, 6, 15, blue, 0, 21, -5));
  staticHull.add(box(8, 5, 10, light, 0, 26.5, -6));
  staticHull.add(box(5.5, 4, 6.5, dark, 0, 31, -6));
  for (const x of [-1.9, 0, 1.9]) staticHull.add(box(1.2, 0.6, 0.25, glow, x, 31.2, -2.65));
  for (const sx of [-1, 1]) staticHull.add(box(0.7, 9, 0.7, yellow, sx * 3.5, 35, -7));
  for (const ex of [-7, 0, 7]) addBlockEngine(staticHull, blue, dark, thrust, ex, 10, -63, ex ? 5.2 : 6.2, ex ? 5.2 : 6.2, 8);
  for (const [z, rear] of [[39, false], [21, false], [-27, true]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y: 20.5, z, width: 4.8, offsets: [-1.05, 1.05], length: 9.5, rear, arc: PI * 0.8, boxy: true });
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 11.4, y: 16.8, width: 2.25, length: 5.5 });
  addMissileRacks(staticHull, blue, dark, 7.4, 18.2, 9, true);
  addFederationTorpedoTube(staticHull, blue, dark, 8.5, 57);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'salamis-simple-triangle-waist-box-drive';
  return { root, turrets };
}

function buildMagellan(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const teal = std(0x657d7c), light = std(0x829898), dark = std(0x344849, { metalness: 0.62 });
  const yellow = std(0xc8a753, { metalness: 0.36 });

  // Magellan: a larger two-step wedge with a tall command block and broad,
  // squared four-engine house. It is intentionally heavier than the Salamis.
  staticHull.add(longitudinalHull([
    [-49, 14.5, 21, -1], [8, 14.5, 24, 1], [37, 11.5, 22, 3],
    [58, 6.2, 16, 7], [74, 1.1, 11, 8],
  ], teal));
  staticHull.add(longitudinalHull([
    [-37, 9.5, 31, 17], [18, 10.5, 34, 18], [43, 6.2, 28, 17], [56, 2.2, 20, 15],
  ], light));
  staticHull.add(box(30, 19, 27, teal, 0, 10, -62));
  staticHull.add(box(27, 13, 4, dark, 0, 10, -77));
  staticHull.add(box(16, 7, 30, teal, 0, 30.5, -5));
  staticHull.add(box(11.5, 9, 17, teal, 0, 37.5, -7));
  staticHull.add(box(8, 6, 10, dark, 0, 45, -7));
  for (const x of [-2.5, 0, 2.5]) staticHull.add(box(1.35, 0.6, 0.25, glow, x, 45.2, -1.9));
  for (const sx of [-1, 1]) for (const z of [-25, -7, 11, 29]){
    staticHull.add(box(0.7, 2.3, 8.5, dark, sx * 14.25, 12, z));
    staticHull.add(box(0.78, 0.55, 5.6, yellow, sx * 14.65, 12.2, z));
  }
  for (const sx of [-1, 1]) staticHull.add(box(0.9, 13, 0.9, yellow, sx * 5.6, 50, -10));
  for (const ex of [-9.5, -3.2, 3.2, 9.5]) addBlockEngine(staticHull, teal, dark, thrust, ex, 10, -78, 5.4, 5.8, 8);
  for (const [z, rear, y] of [[48, false, 23.5], [27, false, 35.5], [-24, true, 35.5], [-43, true, 24]]) addTurret(root, turrets, yellow, dark, cooldown,
    { y, z, width: 6.1, offsets: [-1.4, 1.4], length: 12, rear, arc: PI * 0.76, boxy: true });
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 14.8, y: 18.5, zStations: [-16, -8, 0, 8, 16], width: 2.6, length: 6.2, damageScale: 0.38, rangeScale: 0.72 });
  addMissileRacks(staticHull, teal, dark, 11.2, 23.5, 12, true);
  addFederationTorpedoTube(staticHull, teal, dark, 9.5, 65);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'magellan-simple-stepped-wedge-box-drive';
  return { root, turrets };
}

function buildColumbus(glow, thrust, cooldown){
  const root = new THREE.Group(), staticHull = new THREE.Group(), turrets = [];
  const grey = std(0x7c8791), light = std(0x9aa3aa), dark = std(0x3d4852, { metalness: 0.58 });
  // Columbus: two blunt rectangular cargo barges joined by a narrow central
  // spine. This deliberately avoids cruiser curves and reads as a carrier.
  for (const sx of [-1, 1]){
    staticHull.add(box(17, 18, 70, grey, sx * 10, 12, -3));
    staticHull.add(box(15, 4, 62, light, sx * 10, 23, -2));
    for (const z of [-22, -3, 16]) staticHull.add(box(14, 1.2, 2.2, dark, sx * 10, 18, z));
    addBlockEngine(staticHull, grey, dark, thrust, sx * 10, 11, -43, 11.5, 10, 8);
  }
  staticHull.add(box(8, 8, 62, dark, 0, 14, -2));
  staticHull.add(box(8, 6, 12, grey, 0, 27, 16));
  staticHull.add(box(6, 4, 7, dark, 0, 32, 17));
  for (const x of [-2, 0, 2]) staticHull.add(box(1.2, 0.6, 0.25, glow, x, 32.2, 20.6));
  staticHull.add(box(18, 2, 14, dark, 0, 3.5, 34)); // forward loading ramp
  staticHull.add(longitudinalHull([[30, 20, 18, 4], [43, 12, 16, 6], [49, 4, 12, 8]], grey));
  for (const sx of [-1, 1]) addTurret(root, turrets, light, dark, cooldown,
    { x: sx * 10, y: 25, z: 29, width: 4.1, offsets: [0], length: 7, arc: PI * 0.7, boxy: true });
  addFederationSideBatteries(root, turrets, light, dark, cooldown,
    { x: 18.8, y: 17.5, zStations: [-12, -6, 0, 6, 12], width: 2.05, length: 4.7, damageScale: 0.28, rangeScale: 0.6 });
  addMissileRacks(staticHull, grey, dark, 10, 26.2, 8, true);
  addFederationTorpedoTube(staticHull, grey, dark, 6, 35);
  compactGroup(staticHull); root.add(staticHull);
  root.userData.silhouette = 'columbus-simple-twin-box-carrier';
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
