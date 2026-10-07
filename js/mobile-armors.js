// Universal Century mobile armors: huge self-propelled weapons platforms that
// sit between a mobile suit and a capital ship. Gameplay values intentionally
// make them durable battlefield anchors without giving them warship speed.
import { THREE, box, cyl, sph, chamferBox } from './model-kit.js';

const PI = Math.PI;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.58, metalness: 0.5, ...extra,
});

export const MOBILE_ARMORS = Object.freeze([
  Object.freeze({ id: 'bigzam', name: 'MA-08 Big Zam', code: 'ZEON GIANT MOBILE ARMOR', faction: 'ZEON' }),
  Object.freeze({ id: 'apsaras3', name: 'Apsaras III', code: 'ZEON ATMOSPHERIC MOBILE ARMOR', faction: 'ZEON' }),
  Object.freeze({ id: 'neueziel', name: 'AMX-002 Neue Ziel', code: 'DELaz FLEET ASSAULT MOBILE ARMOR', faction: 'ZEON' }),
  Object.freeze({ id: 'dendrobium', name: 'RX-78GP03 Dendrobium', code: 'EFSF ORCHIS ARMED-BASE MOBILE ARMOR', faction: 'FED' }),
]);

export const MOBILE_ARMOR_IDS = new Set(MOBILE_ARMORS.map(unit => unit.id));

export const MOBILE_ARMOR_PROFILES = Object.freeze({
  bigzam: Object.freeze({
    hp: 98000, speed: 18, turnRate: 0.2, standoff: 1080, hoverHeight: 4,
    mainDamage: 980, mainSplash: 21, mainRof: [2.1, 3.2], mainRange: 1900,
    shellSpeed: 720, shellLife: 5.2, shellScale: 1.65, turretCount: 12,
    radius: 36, hitY: 34, role: 'GIANT MOBILE ARMOR', propulsion: 'MINOVSKY CRAFT / THERMONUCLEAR ROCKET',
    ramSpeedMultiplier: 1.35, ramDuration: 14, ramCooldown: 30,
    hitSpheres: [{ x: 0, y: 31, z: 0, r: 24 }, { x: -13, y: 12, z: 0, r: 10 }, { x: 13, y: 12, z: 0, r: 10 }],
  }),
  apsaras3: Object.freeze({
    hp: 76000, speed: 24, turnRate: 0.3, standoff: 1250, hoverHeight: 28,
    mainDamage: 860, mainSplash: 18, mainRof: [2.3, 3.6], mainRange: 2050,
    shellSpeed: 760, shellLife: 5.2, shellScale: 1.45, turretCount: 10,
    radius: 39, hitY: 24, role: 'ATMOSPHERIC SIEGE MOBILE ARMOR', propulsion: 'MINOVSKY FLIGHT SYSTEM',
    ramSpeedMultiplier: 1.45, ramDuration: 16, ramCooldown: 28,
    hitSpheres: [{ x: 0, y: 17, z: 0, r: 34 }, { x: 0, y: 18, z: 25, r: 15 }],
  }),
  neueziel: Object.freeze({
    hp: 86000, speed: 30, turnRate: 0.34, standoff: 980, hoverHeight: 22,
    mainDamage: 760, mainSplash: 16, mainRof: [1.7, 2.8], mainRange: 1800,
    shellSpeed: 820, shellLife: 4.6, shellScale: 1.25, turretCount: 14,
    radius: 38, hitY: 28, role: 'HIGH-MOBILITY ASSAULT MOBILE ARMOR', propulsion: 'MULTI-VERNIER THERMONUCLEAR ROCKET',
    ramSpeedMultiplier: 1.7, ramDuration: 20, ramCooldown: 24,
    hitSpheres: [{ x: 0, y: 25, z: 3, r: 22 }, { x: -20, y: 20, z: -4, r: 15 }, { x: 20, y: 20, z: -4, r: 15 }],
  }),
  dendrobium: Object.freeze({
    hp: 82000, speed: 32, turnRate: 0.24, standoff: 1180, hoverHeight: 18,
    mainDamage: 900, mainSplash: 20, mainRof: [1.9, 3.0], mainRange: 2150,
    shellSpeed: 850, shellLife: 5.0, shellScale: 1.5, turretCount: 12,
    radius: 46, hitY: 24, role: 'ARMED-BASE MOBILE ARMOR', propulsion: 'ORCHIS THERMONUCLEAR ROCKET CLUSTER',
    ramSpeedMultiplier: 1.55, ramDuration: 18, ramCooldown: 26,
    hitBoxes: [
      { x: 0, y: 20, z: -2, hx: 32, hy: 10, hz: 28 },
      { x: 0, y: 17, z: 42, hx: 7, hy: 6, hz: 43 },
      { x: -29, y: 24, z: -2, hx: 11, hy: 10, hz: 25 },
      { x: 29, y: 24, z: -2, hx: 11, hy: 10, hz: 25 },
    ],
  }),
});

export const mobileArmorById = id => MOBILE_ARMORS.find(unit => unit.id === id) || null;
export const mobileArmorProfile = id => MOBILE_ARMOR_PROFILES[id] || null;

function forwardCylinder(radius, length, mat, x, y, z){
  const mesh = cyl(radius, radius, length, mat, x, y, z + length / 2, 10);
  mesh.rotation.x = PI / 2;
  return mesh;
}

function addThruster(root, armor, dark, thrust, x, y, z, r = 2.5){
  const casing = cyl(r * 1.2, r * 1.45, r * 1.9, armor, x, y, z, 14);
  casing.rotation.x = PI / 2; root.add(casing);
  const ring = cyl(r, r * 1.18, r * 0.5, dark, x, y, z - r * 1.15, 14);
  ring.rotation.x = PI / 2; root.add(ring);
  const flame = sph(r * 0.82, thrust, x, y, z - r * 1.6, 12, 8);
  flame.scale.z = 0.48; root.add(flame);
}

function addTurret(root, turrets, armor, dark, cooldown, {
  x, y, z, restYaw = 0, arc = PI, width = 3.2, length = 7,
  shots = 1, secondary = true, damageScale = 0.44, rangeScale = 0.8,
  rofScale = 0.62, splashScale = 0.42, shellScale = 0.62,
}){
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); yaw.rotation.y = restYaw; root.add(yaw);
  yaw.add(cyl(width * 0.5, width * 0.62, width * 0.28, dark, 0, 0, 0, 12));
  const gun = new THREE.Group(); gun.position.y = width * 0.16; yaw.add(gun);
  gun.add(chamferBox(width, width * 0.48, width * 0.82, armor, 0, width * 0.12, 0, 0.18));
  const muzzles = [];
  for (let i = 0; i < shots; i++){
    const bx = shots === 1 ? 0 : (i - (shots - 1) / 2) * width * 0.27;
    gun.add(forwardCylinder(width * 0.075, length, dark, bx, width * 0.2, width * 0.3));
    const muzzle = new THREE.Object3D(); muzzle.position.set(bx, width * 0.2, width * 0.3 + length); gun.add(muzzle);
    muzzles.push(muzzle);
  }
  turrets.push({
    yaw, gun, muzzle: muzzles[0], muzzles, cd: cooldown(), restYaw, arc,
    shots, secondary, damageScale, rangeScale, rofScale, splashScale, shellScale,
    heavy: true, collisionRadius: 1.35, weaponName: 'MOBILE ARMOR MEGA-PARTICLE TURRET',
  });
}

function addRingTurrets(root, turrets, armor, dark, cooldown, count, radius, y, zScale = 0.72){
  for (let i = 0; i < count; i++){
    const a = i / count * PI * 2;
    addTurret(root, turrets, armor, dark, cooldown, {
      x: Math.sin(a) * radius, y, z: Math.cos(a) * radius * zScale,
      restYaw: a, arc: PI * 0.72, width: 2.5, length: 5.8,
      damageScale: 0.35, rangeScale: 0.72, rofScale: 0.48, splashScale: 0.3,
    });
  }
}

function buildBigZam(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x496b42), light = material(0x78925e), dark = material(0x26352b, { metalness: 0.62 });
  const body = sph(24, green, 0, 33, 0, 28, 18); body.scale.set(1.08, 0.78, 1.08); root.add(body);
  root.add(cyl(21, 25, 12, light, 0, 20, 0, 24));
  root.add(cyl(15, 19, 8, dark, 0, 14, 0, 20));
  const cannon = cyl(6.2, 8.4, 11, dark, 0, 32, 22, 18); cannon.rotation.x = PI / 2; root.add(cannon);
  root.add(sph(5.2, glow, 0, 32, 28, 16, 10));
  for (const sx of [-1, 1]){
    root.add(cyl(5.7, 7.2, 27, green, sx * 13, 2, 0, 14));
    root.add(chamferBox(15, 5, 22, dark, sx * 13, -12, 4, 1.2));
    for (const z of [-4, 5]) root.add(cyl(1.3, 1.8, 3.2, thrust, sx * 13, -8, z, 10));
  }
  addRingTurrets(root, turrets, light, dark, cooldown, 10, 20, 34, 0.82);
  addTurret(root, turrets, green, dark, cooldown, { x: 0, y: 42, z: 1, width: 5.4, length: 14, shots: 2, secondary: false, damageScale: 1, rangeScale: 1, rofScale: 1, splashScale: 1, shellScale: 1.25 });
  addTurret(root, turrets, green, dark, cooldown, { x: 0, y: 25, z: -19, restYaw: PI, width: 4.4, length: 10, shots: 2, damageScale: 0.7, rangeScale: 0.9 });
  root.userData.silhouette = 'big-zam-bell-body-twin-legs';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildApsaras(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const rust = material(0x856044), tan = material(0xb18a58), dark = material(0x3e332d, { metalness: 0.58 });
  const saucer = sph(31, rust, 0, 17, 0, 28, 14); saucer.scale.set(1.25, 0.42, 1); root.add(saucer);
  const dome = sph(17, tan, 0, 28, -3, 22, 14); dome.scale.y = 0.62; root.add(dome);
  root.add(cyl(8, 12, 10, dark, 0, 16, 23, 18));
  root.add(sph(6.5, glow, 0, 16, 29, 16, 10));
  for (const [x, z] of [[-24, -5], [24, -5], [0, -23]]){
    root.add(cyl(7.5, 9.5, 10, dark, x, 11, z, 16));
    addThruster(root, rust, dark, thrust, x, 8, z - 6, 3.2);
  }
  addRingTurrets(root, turrets, tan, dark, cooldown, 8, 29, 20, 0.82);
  for (const x of [-8, 8]) addTurret(root, turrets, rust, dark, cooldown, { x, y: 28, z: 9, width: 4.6, length: 12, shots: 2, secondary: false, damageScale: 0.82, rangeScale: 1, rofScale: 0.9, splashScale: 0.8 });
  root.userData.silhouette = 'apsaras-third-form-disc-dome-generator-tripod';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildNeueZiel(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x315b47), light = material(0x57886d), dark = material(0x17352d, { metalness: 0.65 });
  const torso = sph(18, green, 0, 25, 4, 24, 16); torso.scale.set(0.85, 1.3, 0.9); root.add(torso);
  root.add(chamferBox(14, 13, 25, light, 0, 21, 24, 1.2));
  root.add(sph(3.2, glow, 0, 30, 18, 14, 9));
  for (const sx of [-1, 1]){
    const binder = sph(14, green, sx * 22, 23, -1, 20, 12); binder.scale.set(0.72, 1.45, 0.72); root.add(binder);
    root.add(chamferBox(7, 9, 34, dark, sx * 18, 21, -18, 0.8));
    root.add(chamferBox(6, 7, 25, light, sx * 27, 16, 15, 0.8));
    root.add(chamferBox(5, 5, 16, dark, sx * 31, 13, 31, 0.6));
    addThruster(root, green, dark, thrust, sx * 22, 21, -28, 4.2);
  }
  for (const x of [-11, 0, 11]) addThruster(root, green, dark, thrust, x, 17, -38, 3.6);
  addRingTurrets(root, turrets, light, dark, cooldown, 10, 24, 24, 0.72);
  for (const sx of [-1, 1]) for (const z of [12, -11]) addTurret(root, turrets, green, dark, cooldown, { x: sx * 17, y: 28, z, restYaw: sx * PI / 2, width: 3.8, length: 9, damageScale: 0.62, rangeScale: 0.9 });
  root.userData.silhouette = 'neue-ziel-long-green-core-binders-claw-arms';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildDendrobium(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const white = material(0xd8dce1), grey = material(0x79828e), dark = material(0x303844, { metalness: 0.66 });
  const blue = material(0x315989), red = material(0xa94343);
  root.add(chamferBox(54, 18, 54, white, 0, 20, -4, 1.4));
  root.add(chamferBox(24, 12, 30, blue, 0, 22, 19, 1.0));
  root.add(chamferBox(12, 10, 18, white, 0, 25, 39, 0.8));
  root.add(box(5, 3.5, 10, red, 0, 24, 48));
  // Signature mega-beam cannon projects far ahead of the Orchis frame.
  root.add(box(7, 7, 88, grey, 0, 17, 60));
  root.add(box(4.2, 4.2, 86, dark, 0, 17, 106));
  root.add(sph(3.4, glow, 0, 17, 150, 14, 9));
  // Eight weapon containers: four on each side of the Stamen core.
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++){
    const z = -23 + i * 14;
    root.add(chamferBox(15, 10, 12, white, sx * 33, 26, z, 0.8));
    root.add(box(11, 1.2, 8, dark, sx * 33, 31.5, z));
  }
  for (const sx of [-1, 1]){
    root.add(chamferBox(8, 6, 34, grey, sx * 23, 10, 24, 0.8));
    root.add(chamferBox(13, 5, 14, dark, sx * 23, 9, 47, 0.7));
    for (const z of [-31, -20, -9]) addThruster(root, white, dark, thrust, sx * 18, 19, z - 20, 3.6);
  }
  for (const x of [-9, 0, 9]) addThruster(root, white, dark, thrust, x, 19, -38, 4.5);
  for (const sx of [-1, 1]) for (const z of [-22, -8, 7, 21]) addTurret(root, turrets, white, dark, cooldown, { x: sx * 29, y: 34, z, restYaw: sx * PI / 2, width: 3.5, length: 8, damageScale: 0.48, rangeScale: 0.84, rofScale: 0.55 });
  for (const x of [-14, 14]) addTurret(root, turrets, blue, dark, cooldown, { x, y: 31, z: 28, width: 4.4, length: 12, shots: 2, secondary: false, damageScale: 0.75, rangeScale: 1, rofScale: 0.82, splashScale: 0.75 });
  for (const x of [-20, 20]) addTurret(root, turrets, grey, dark, cooldown, { x, y: 15, z: 4, restYaw: x < 0 ? -PI / 2 : PI / 2, width: 3.3, length: 7, damageScale: 0.45, rangeScale: 0.8 });
  root.userData.silhouette = 'dendrobium-orchis-eight-containers-long-mega-cannon';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

export function buildMobileArmor(kind, glow, thrust, cooldown = () => 0){
  if (kind === 'bigzam') return buildBigZam(glow, thrust, cooldown);
  if (kind === 'apsaras3') return buildApsaras(glow, thrust, cooldown);
  if (kind === 'neueziel') return buildNeueZiel(glow, thrust, cooldown);
  if (kind === 'dendrobium') return buildDendrobium(glow, thrust, cooldown);
  return null;
}
