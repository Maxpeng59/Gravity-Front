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
    hp: 42000, speed: 12, turnRate: 0.16, standoff: 920, hoverHeight: 4,
    mainDamage: 520, mainSplash: 12, mainRof: [4.5, 6.2], mainRange: 1500,
    shellSpeed: 680, shellLife: 4.6, shellScale: 1.35, turretCount: 6, activeTurretLimit: 3,
    radius: 31, hitY: 32, role: 'GIANT MOBILE ARMOR', propulsion: 'MINOVSKY CRAFT / THERMONUCLEAR ROCKET',
    ramSpeedMultiplier: 1.35, ramDuration: 14, ramCooldown: 30,
    hitSpheres: [{ x: 0, y: 31, z: 0, r: 24 }, { x: -13, y: 12, z: 0, r: 10 }, { x: 13, y: 12, z: 0, r: 10 }],
  }),
  apsaras3: Object.freeze({
    hp: 34000, speed: 18, turnRate: 0.22, standoff: 1100, hoverHeight: 25,
    mainDamage: 460, mainSplash: 10, mainRof: [5.0, 7.0], mainRange: 1650,
    shellSpeed: 700, shellLife: 4.8, shellScale: 1.25, turretCount: 5, activeTurretLimit: 2,
    radius: 35, hitY: 21, role: 'ATMOSPHERIC SIEGE MOBILE ARMOR', propulsion: 'MINOVSKY FLIGHT SYSTEM',
    ramSpeedMultiplier: 1.45, ramDuration: 16, ramCooldown: 28,
    hitSpheres: [{ x: 0, y: 17, z: 0, r: 34 }, { x: 0, y: 18, z: 25, r: 15 }],
  }),
  neueziel: Object.freeze({
    hp: 38000, speed: 26, turnRate: 0.3, standoff: 780, hoverHeight: 20,
    mainDamage: 390, mainSplash: 8, mainRof: [3.6, 5.2], mainRange: 1400,
    shellSpeed: 780, shellLife: 4.2, shellScale: 1.05, turretCount: 8, activeTurretLimit: 4,
    radius: 34, hitY: 27, role: 'HIGH-MOBILITY ASSAULT MOBILE ARMOR', propulsion: 'MULTI-VERNIER THERMONUCLEAR ROCKET',
    ramSpeedMultiplier: 1.7, ramDuration: 20, ramCooldown: 24,
    hitSpheres: [{ x: 0, y: 25, z: 3, r: 22 }, { x: -20, y: 20, z: -4, r: 15 }, { x: 20, y: 20, z: -4, r: 15 }],
  }),
  dendrobium: Object.freeze({
    hp: 40000, speed: 28, turnRate: 0.2, standoff: 980, hoverHeight: 17,
    mainDamage: 480, mainSplash: 10, mainRof: [4.2, 6.0], mainRange: 1700,
    shellSpeed: 820, shellLife: 4.6, shellScale: 1.25, turretCount: 6, activeTurretLimit: 3,
    radius: 42, hitY: 22, role: 'ARMED-BASE MOBILE ARMOR', propulsion: 'ORCHIS THERMONUCLEAR ROCKET CLUSTER',
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
  const body = sph(22, green, 0, 34, 0, 28, 18); body.scale.set(1.08, 0.72, 1.02); root.add(body);
  root.add(cyl(18, 24, 15, light, 0, 22, 0, 24));
  root.add(cyl(12, 18, 7, dark, 0, 14, 0, 20));
  const cannon = cyl(6, 8.2, 9, dark, 0, 31, 20, 18); cannon.rotation.x = PI / 2; root.add(cannon);
  root.add(sph(5, glow, 0, 31, 25, 16, 10));
  for (const sx of [-1, 1]){
    root.add(cyl(4.5, 6.5, 31, green, sx * 11, 1, 0, 14));
    root.add(cyl(6.2, 6.8, 5, light, sx * 11, 7, 0, 14));
    root.add(chamferBox(13, 4.5, 20, dark, sx * 11, -15, 5, 1.2));
    root.add(chamferBox(4, 3, 9, green, sx * 17, -14, 10, 0.6));
    for (const z of [-3, 5]) root.add(cyl(1.2, 1.7, 3, thrust, sx * 11, -10, z, 10));
  }
  addRingTurrets(root, turrets, light, dark, cooldown, 5, 19, 32, 0.78);
  addTurret(root, turrets, green, dark, cooldown, { x: 0, y: 31, z: 19, width: 4.6, length: 8, secondary: false, damageScale: 1, rangeScale: 1, rofScale: 1.2, splashScale: 1, shellScale: 1.15, arc: PI * 0.42 });
  root.userData.silhouette = 'big-zam-bell-skirt-central-cannon-long-twin-legs';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildApsaras(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const rust = material(0x856044), tan = material(0xb18a58), dark = material(0x3e332d, { metalness: 0.58 });
  const saucer = sph(30, rust, 0, 18, 0, 28, 14); saucer.scale.set(1.18, 0.32, 1); root.add(saucer);
  root.add(cyl(27, 31, 7, dark, 0, 15, 0, 24));
  const dome = sph(14, tan, 0, 27, -4, 22, 14); dome.scale.set(1.2, 0.58, 1); root.add(dome);
  root.add(cyl(10, 14, 8, dark, 0, 16, 22, 18));
  root.add(sph(8.2, glow, 0, 16, 27, 18, 12));
  for (const [x, z] of [[-21, -7], [21, -7], [0, -23]]){
    root.add(cyl(5.5, 7, 16, dark, x, 5, z, 14));
    root.add(chamferBox(9, 4, 9, tan, x, -4, z, 0.7));
    addThruster(root, rust, dark, thrust, x, 4, z - 7, 2.8);
  }
  addRingTurrets(root, turrets, tan, dark, cooldown, 4, 26, 18, 0.8);
  addTurret(root, turrets, rust, dark, cooldown, { x: 0, y: 16, z: 21, width: 5.4, length: 7, secondary: false, damageScale: 1, rangeScale: 1, rofScale: 1.25, splashScale: 1, shellScale: 1.15, arc: PI * 0.36 });
  root.userData.silhouette = 'apsaras-iii-flat-disc-central-mega-cannon-three-landing-pylons';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildNeueZiel(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x315b47), light = material(0x57886d), dark = material(0x17352d, { metalness: 0.65 });
  const torso = sph(16, green, 0, 25, 4, 24, 16); torso.scale.set(0.82, 1.35, 0.9); root.add(torso);
  root.add(chamferBox(12, 11, 24, light, 0, 19, 23, 1.2));
  root.add(chamferBox(8, 7, 10, dark, 0, 34, 13, 0.7));
  root.add(sph(2.8, glow, 0, 34, 19, 14, 9));
  for (const sx of [-1, 1]){
    const binder = sph(12, green, sx * 20, 25, -4, 20, 12); binder.scale.set(0.7, 1.55, 0.72); root.add(binder);
    root.add(chamferBox(7, 10, 30, dark, sx * 17, 21, -20, 0.8));
    root.add(chamferBox(6, 6, 27, light, sx * 24, 18, 18, 0.8));
    root.add(chamferBox(5, 5, 18, dark, sx * 27, 14, 38, 0.6));
    for (const cx of [-1, 0, 1]) root.add(chamferBox(1.5, 2.2, 8, light, sx * (27 + cx * 2.2), 13, 50, 0.3));
    addThruster(root, green, dark, thrust, sx * 22, 21, -28, 4.2);
  }
  for (const x of [-11, 0, 11]) addThruster(root, green, dark, thrust, x, 17, -38, 3.6);
  for (const sx of [-1, 1]) for (const [y, z] of [[31, 2], [22, -12], [16, 28], [12, 42]])
    addTurret(root, turrets, sx > 0 ? light : green, dark, cooldown, { x: sx * (Math.abs(z) > 30 ? 26 : 18), y, z, restYaw: sx * PI / 2, arc: PI * 0.55, width: 2.8, length: 6.5, damageScale: 0.55, rangeScale: 0.86, rofScale: 0.9, splashScale: 0.45 });
  root.userData.silhouette = 'neue-ziel-tall-core-shoulder-binders-long-claw-arms-tail-verniers';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildDendrobium(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const white = material(0xd8dce1), grey = material(0x79828e), dark = material(0x303844, { metalness: 0.66 });
  const blue = material(0x315989), red = material(0xa94343);
  // Orchis reads as two long weapon-container rails around a small exposed Stamen,
  // not as one solid rectangular battleship.
  root.add(chamferBox(18, 9, 58, grey, 0, 17, -3, 1.0));
  for (const sx of [-1, 1]){
    root.add(chamferBox(19, 13, 64, white, sx * 25, 25, -7, 1.2));
    for (let i = 0; i < 4; i++){
      const z = -27 + i * 17;
      root.add(chamferBox(15, 9, 14, white, sx * 25, 29, z, 0.7));
      root.add(box(10, 1.2, 9, dark, sx * 25, 34, z));
    }
  }
  root.add(chamferBox(12, 8, 16, blue, 0, 22, 29, 0.8));
  root.add(chamferBox(7, 8, 10, white, 0, 26, 39, 0.6));
  root.add(box(4, 3, 8, red, 0, 24, 47));
  // Signature cannon is offset beside the central frame, leaving the Stamen visible.
  root.add(box(6.5, 6.5, 92, grey, 13, 15, 55));
  root.add(box(3.8, 3.8, 78, dark, 13, 15, 105));
  root.add(sph(3, glow, 13, 15, 145, 14, 9));
  for (const sx of [-1, 1]){
    root.add(chamferBox(7, 5, 35, grey, sx * 17, 10, 22, 0.8));
    root.add(chamferBox(12, 5, 14, dark, sx * 17, 9, 46, 0.7));
    for (const z of [-31, -20, -9]) addThruster(root, white, dark, thrust, sx * 18, 19, z - 20, 3.6);
  }
  for (const x of [-9, 0, 9]) addThruster(root, white, dark, thrust, x, 19, -38, 4.5);
  for (const sx of [-1, 1]) for (const z of [-18, 10]) addTurret(root, turrets, white, dark, cooldown, { x: sx * 25, y: 34, z, restYaw: sx * PI / 2, arc: PI * 0.48, width: 3, length: 7, damageScale: 0.45, rangeScale: 0.8, rofScale: 0.9, splashScale: 0.4 });
  addTurret(root, turrets, blue, dark, cooldown, { x: -8, y: 28, z: 29, width: 3.8, length: 9, secondary: false, damageScale: 0.72, rangeScale: 1, rofScale: 1.15, splashScale: 0.72, arc: PI * 0.45 });
  addTurret(root, turrets, grey, dark, cooldown, { x: 13, y: 15, z: 29, width: 4.2, length: 11, secondary: false, damageScale: 1, rangeScale: 1, rofScale: 1.35, splashScale: 1, shellScale: 1.15, arc: PI * 0.35 });
  root.userData.silhouette = 'dendrobium-separated-orchis-container-rails-exposed-stamen-offset-mega-cannon';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

export function buildMobileArmor(kind, glow, thrust, cooldown = () => 0){
  if (kind === 'bigzam') return buildBigZam(glow, thrust, cooldown);
  if (kind === 'apsaras3') return buildApsaras(glow, thrust, cooldown);
  if (kind === 'neueziel') return buildNeueZiel(glow, thrust, cooldown);
  if (kind === 'dendrobium') return buildDendrobium(glow, thrust, cooldown);
  return null;
}
