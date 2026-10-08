// Universal Century mobile armors: huge self-propelled weapons platforms that
// sit between a mobile suit and a capital ship. Gameplay values intentionally
// make them durable battlefield anchors without giving them warship speed.
import { THREE, box, cyl, cone, sph, chamferBox } from './model-kit.js';

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
    hp: 56000, speed: 11, turnRate: 0.13, standoff: 1150, hoverHeight: 4,
    mainDamage: 2200, mainSplash: 34, mainRof: [8.5, 11.5], mainRange: 2200,
    shellSpeed: 1120, shellLife: 4.8, shellScale: 1.8, turretCount: 37, activeTurretLimit: 7,
    radius: 31, hitY: 32, role: '59.6 M FORTRESS-ASSAULT MOBILE ARMOR', propulsion: '560,000 KG THERMONUCLEAR ROCKET ARRAY',
    dimensions: '59.6 m tall', mass: '1,936.0 t full', iField: true,
    weapons: Object.freeze(['13.9 MW LARGE MEGA-PARTICLE GUN', '28 × 2.1 MW MEGA-PARTICLE GUN', '2 × 105 MM VULCAN', '6 × CLAW MISSILE']),
    ramSpeedMultiplier: 1.2, ramDuration: 12, ramCooldown: 32,
    hitSpheres: [{ x: 0, y: 36, z: 0, r: 23 }, { x: -12, y: 9, z: 0, r: 9 }, { x: 12, y: 9, z: 0, r: 9 }],
  }),
  apsaras3: Object.freeze({
    hp: 36000, speed: 19, turnRate: 0.18, standoff: 1450, hoverHeight: 34,
    mainDamage: 2800, mainSplash: 46, mainRof: [10.0, 13.0], mainRange: 2450,
    shellSpeed: 1250, shellLife: 4.4, shellScale: 2.0, turretCount: 1, activeTurretLimit: 1,
    radius: 34, hitY: 20, role: 'MINOVSKY-CRAFT HEAVY SIEGE MOBILE ARMOR', propulsion: 'TWIN MINOVSKY CRAFT / THREE RICK DOM REACTORS',
    dimensions: 'approx. 70 m disc', mass: 'unpublished', iField: false,
    weapons: Object.freeze(['VARIABLE-FOCUS LARGE MEGA-PARTICLE CANNON']),
    ramSpeedMultiplier: 1.15, ramDuration: 10, ramCooldown: 34,
    hitSpheres: [{ x: 0, y: 18, z: -2, r: 33 }, { x: 0, y: 17, z: 25, r: 14 }],
  }),
  neueziel: Object.freeze({
    hp: 48000, speed: 32, turnRate: 0.38, standoff: 850, hoverHeight: 22,
    mainDamage: 1250, mainSplash: 18, mainRof: [4.2, 5.8], mainRange: 1900,
    shellSpeed: 1050, shellLife: 4.2, shellScale: 1.35, turretCount: 22, activeTurretLimit: 9,
    radius: 38, hitY: 28, role: '76.6 M HIGH-MOBILITY ASSAULT MOBILE ARMOR', propulsion: 'MULTI-VERNIER THERMONUCLEAR ROCKET',
    dimensions: '76.6 m long', mass: '403.5 t full', iField: true,
    weapons: Object.freeze(['MEGA CANNON', '9 × MEGA-PARTICLE CANNON', '4 × LARGE MISSILE LAUNCHER', '24 × SMALL MISSILE LAUNCHER', '2 × WIRED CLAW ARM', '4 × BEAM-SABER SUB-ARM']),
    ramSpeedMultiplier: 1.85, ramDuration: 22, ramCooldown: 21,
    hitSpheres: [{ x: 0, y: 27, z: 2, r: 20 }, { x: -19, y: 25, z: -2, r: 13 }, { x: 19, y: 25, z: -2, r: 13 }, { x: 0, y: 15, z: -30, r: 13 }],
  }),
  dendrobium: Object.freeze({
    hp: 46000, speed: 35, turnRate: 0.24, standoff: 1200, hoverHeight: 20,
    mainDamage: 1900, mainSplash: 28, mainRof: [7.0, 9.0], mainRange: 2350,
    shellSpeed: 1320, shellLife: 4.2, shellScale: 1.65, turretCount: 7, activeTurretLimit: 5,
    radius: 49, hitY: 22, role: '140 M ORCHIS FOOTHOLD-DEFENSE MOBILE ARMOR', propulsion: 'ORCHIS THERMONUCLEAR ROCKET CLUSTER',
    dimensions: '140.0 m long / 38.5 m tall', mass: '453.1 t full', iField: true,
    weapons: Object.freeze(['MEGA BEAM CANNON', '2 × LARGE CLAW / LARGE BEAM SABER', 'LARGE MISSILE PODS', 'MICRO-MISSILE CONTAINERS', 'FOLDING BAZOOKAS / BEAM RIFLE', 'EXPLOSIVE CORD']),
    ramSpeedMultiplier: 1.7, ramDuration: 20, ramCooldown: 23,
    hitBoxes: [
      { x: 0, y: 20, z: -4, hx: 31, hy: 10, hz: 31 },
      { x: 13, y: 16, z: 56, hx: 4, hy: 4, hz: 49 },
      { x: -27, y: 25, z: -2, hx: 10, hy: 10, hz: 29 },
      { x: 27, y: 25, z: -2, hx: 10, hy: 10, hz: 29 },
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
  weaponName = 'MOBILE ARMOR MEGA-PARTICLE CANNON', weaponType = 'beam',
  damage = null, splash = null, projectileSpeed = null, projectileLife = null,
  homingTurn = 0, alwaysActive = false,
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
    heavy: weaponType !== 'vulcan', collisionRadius: weaponType === 'missile' ? 1.2 : weaponType === 'vulcan' ? 0.45 : 1.35,
    weaponName, weaponType, damage, splash, projectileSpeed, projectileLife, homingTurn, alwaysActive,
  });
}

function addRingTurrets(root, turrets, armor, dark, cooldown, count, radius, y, zScale = 0.72, options = {}){
  for (let i = 0; i < count; i++){
    const a = i / count * PI * 2;
    addTurret(root, turrets, armor, dark, cooldown, {
      x: Math.sin(a) * radius, y, z: Math.cos(a) * radius * zScale,
      restYaw: a, arc: PI * 0.72, width: 2.5, length: 5.8,
      damageScale: 0.35, rangeScale: 0.72, rofScale: 0.48, splashScale: 0.3,
      ...options,
    });
  }
}

function buildBigZam(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x496b42), light = material(0x78925e), dark = material(0x26352b, { metalness: 0.62 });
  // Canonical 59.6 m silhouette: broad oval command body over two extremely
  // long legs. The underside is a tapered armour bell rather than a torso.
  const body = sph(22, green, 0, 39, 0, 32, 20); body.scale.set(1.1, 0.67, 1.0); root.add(body);
  const crown = sph(15, light, 0, 48, -2, 22, 14); crown.scale.set(1.18, 0.48, 0.92); root.add(crown);
  root.add(cyl(20, 25, 16, light, 0, 25, 0, 28));
  root.add(cyl(12, 20, 7, dark, 0, 15, 0, 24));
  const cannon = cyl(6.4, 8.8, 12, dark, 0, 36, 21, 20); cannon.rotation.x = PI / 2; root.add(cannon);
  root.add(sph(5.4, glow, 0, 36, 27, 18, 10));
  for (const sx of [-1, 1]){
    root.add(cyl(4.3, 6.2, 34, green, sx * 12, 0, 0, 14));
    root.add(cyl(6.5, 7.1, 6, light, sx * 12, 8, 0, 14));
    root.add(chamferBox(14, 5, 19, dark, sx * 12, -18, 4, 1.2));
    for (const toe of [-1, 0, 1]){
      const claw = cone(2.1, 10, green, sx * 12 + toe * 4.2, -18, 14, 9);
      claw.rotation.x = PI / 2; root.add(claw);
    }
    for (const z of [-4, 5]) root.add(cyl(1.3, 1.8, 3.2, thrust, sx * 12, -11, z, 10));
  }
  // Twenty-eight independently aimed 2.1 MW guns form the complete equatorial ring.
  addRingTurrets(root, turrets, light, dark, cooldown, 28, 21, 36, 0.8, {
    width: 1.25, length: 3.8, damage: 175, splash: 2, rangeScale: 0.72,
    rofScale: 0.32, shellScale: 0.42, weaponName: 'BIG ZAM 2.1 MW MEGA-PARTICLE GUN',
  });
  addTurret(root, turrets, green, dark, cooldown, {
    x: 0, y: 36, z: 21, width: 5.2, length: 11, secondary: false, alwaysActive: true,
    damage: 2200, splash: 34, rangeScale: 1, rofScale: 1, shellScale: 1.8,
    arc: PI * 0.42, weaponName: 'BIG ZAM 13.9 MW LARGE MEGA-PARTICLE GUN',
  });
  for (const sx of [-1, 1]) addTurret(root, turrets, light, dark, cooldown, {
    x: sx * 5, y: 45, z: 17, width: 1.1, length: 3.2, secondary: true,
    damage: 48, splash: 0, rangeScale: 0.42, rofScale: 0.08, shellScale: 0.25,
    weaponType: 'vulcan', weaponName: 'BIG ZAM 105 MM VULCAN',
  });
  for (const sx of [-1, 1]) {
    for (const toe of [-1, 0, 1]) addTurret(root, turrets, green, dark, cooldown, {
      x: sx * 12 + toe * 4.2, y: -16, z: 11, width: 1.8, length: 4.5, shots: 1,
      damage: 520, splash: 8, rangeScale: 0.58, rofScale: 1.4, shellScale: 0.8,
      weaponType: 'missile', homingTurn: 0.75, weaponName: 'BIG ZAM CLAW MISSILE',
    });
  }
  root.userData.silhouette = 'big-zam-59m-oval-command-body-28-gun-ring-long-twin-legs-six-claws';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildApsaras(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const rust = material(0x856044), tan = material(0xb18a58), dark = material(0x3e332d, { metalness: 0.58 });
  // The Apsaras III is a thick flying disc with a raised three-reactor dorsal
  // block, one enormous steerable cannon and three folding firing braces.
  const saucer = sph(30, rust, 0, 18, 0, 36, 18); saucer.scale.set(1.18, 0.30, 1); root.add(saucer);
  root.add(cyl(27, 32, 7, dark, 0, 14, 0, 32));
  const dorsal = sph(15, tan, 0, 27, -7, 24, 14); dorsal.scale.set(1.25, 0.54, 0.92); root.add(dorsal);
  for (const x of [-10, 0, 10]){
    root.add(cyl(3.8, 4.8, 8, dark, x, 29, -7, 14));
    root.add(cyl(3, 3.6, 3.5, tan, x, 34, -7, 12));
  }
  root.add(cyl(11, 15, 10, dark, 0, 16, 23, 20));
  root.add(sph(9.4, glow, 0, 16, 29, 20, 12));
  for (const [x, z] of [[-23, -5], [23, -5], [0, -25]]){
    const brace = cyl(4.8, 6.2, 23, dark, x, 1, z, 14); brace.rotation.z = x ? Math.sign(x) * 0.12 : 0; root.add(brace);
    root.add(chamferBox(11, 4, 12, tan, x, -11, z, 0.7));
    addThruster(root, rust, dark, thrust, x, 7, z - 7, 3.2);
  }
  addTurret(root, turrets, rust, dark, cooldown, {
    x: 0, y: 16, z: 22, width: 7.4, length: 10, secondary: false, alwaysActive: true,
    damage: 2800, splash: 46, rangeScale: 1, rofScale: 1, shellScale: 2,
    arc: PI * 0.46, weaponName: 'APSARAS III VARIABLE-FOCUS LARGE MEGA-PARTICLE CANNON',
  });
  root.userData.silhouette = 'apsaras-iii-thick-minovsky-disc-three-reactor-hump-single-giant-cannon-three-firing-braces';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildNeueZiel(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x315b47), light = material(0x57886d), dark = material(0x17352d, { metalness: 0.65 });
  // Narrow central body, enormous rounded shoulder binders, long articulated
  // claw arms, skirt cannon ring, tail and twin propellant tanks.
  const torso = sph(16, green, 0, 28, 5, 26, 18); torso.scale.set(0.78, 1.38, 0.86); root.add(torso);
  root.add(chamferBox(13, 12, 23, light, 0, 20, 24, 1.2));
  root.add(chamferBox(8, 8, 11, dark, 0, 40, 14, 0.7));
  root.add(sph(3, glow, 0, 40, 20, 14, 9));
  root.add(chamferBox(18, 9, 26, dark, 0, 13, -8, 1.0));
  const tail = cone(11, 29, green, 0, 8, -25, 12); tail.rotation.x = PI; root.add(tail);
  for (const sx of [-1, 1]){
    const binder = sph(13, green, sx * 21, 29, -1, 24, 14); binder.scale.set(0.76, 1.58, 0.78); root.add(binder);
    root.add(chamferBox(8, 12, 28, dark, sx * 18, 23, -18, 0.8));
    // Main arm and detachable wired claw.
    root.add(chamferBox(6.5, 6.5, 25, light, sx * 25, 20, 18, 0.8));
    root.add(chamferBox(5.5, 5.5, 18, dark, sx * 28, 17, 38, 0.6));
    const palm = sph(4.1, green, sx * 28, 16, 49, 12, 8); palm.scale.set(1, 0.65, 0.8); root.add(palm);
    for (const cx of [-1, 0, 1]) root.add(chamferBox(1.4, 2.1, 8, light, sx * 28 + cx * 2.2, 15, 55, 0.3));
    // Twin hidden beam-saber sub-arms under each shoulder.
    for (const ax of [-1, 1]) root.add(chamferBox(2.0, 2.3, 15, light, sx * (15 + ax * 2.2), 20, 16, 0.35));
    // External propellant tank and binder thruster.
    root.add(cyl(3.7, 4.2, 32, light, sx * 13, 12, -28, 14).rotateX(PI / 2));
    addThruster(root, green, dark, thrust, sx * 22, 23, -29, 4.4);
  }
  for (const x of [-10, 0, 10]) addThruster(root, green, dark, thrust, x, 13, -39, 3.8);
  addTurret(root, turrets, green, dark, cooldown, {
    x: 0, y: 20, z: 26, width: 4.8, length: 9, secondary: false, alwaysActive: true,
    damage: 1250, splash: 18, rangeScale: 1, rofScale: 1, shellScale: 1.35,
    weaponName: 'NEUE ZIEL WAIST MEGA CANNON', arc: PI * 0.5,
  });
  // Nine rapid-fire mega-particle cannons: four shoulders, five tail-skirt ports.
  for (const sx of [-1, 1]) for (const [y, z] of [[36, 4], [27, -5]])
    addTurret(root, turrets, light, dark, cooldown, {
      x: sx * 20, y, z, restYaw: sx * PI / 2, arc: PI * 0.68, width: 2.2, length: 5.5,
      damage: 255, splash: 3, rangeScale: 0.84, rofScale: 0.38, shellScale: 0.52,
      weaponName: 'NEUE ZIEL RAPID-FIRE MEGA-PARTICLE CANNON',
    });
  for (let i = 0; i < 5; i++){
    const a = (i - 2) * 0.38;
    addTurret(root, turrets, green, dark, cooldown, {
      x: Math.sin(a) * 10, y: 12, z: -11 - Math.abs(i - 2) * 2, restYaw: PI + a,
      arc: PI * 0.55, width: 1.9, length: 4.8, damage: 240, splash: 3,
      rangeScale: 0.78, rofScale: 0.4, shellScale: 0.48,
      weaponName: 'NEUE ZIEL TAIL MEGA-PARTICLE CANNON',
    });
  }
  for (const sx of [-1, 1]){
    // Four large launchers (five rounds each) and paired small-missile banks.
    for (const y of [22, 31]) addTurret(root, turrets, green, dark, cooldown, {
      x: sx * 19, y, z: 7, restYaw: sx * PI / 2, arc: PI * 0.7, width: 2.8, length: 4.8,
      shots: 2, damage: 430, splash: 12, rangeScale: 0.82, rofScale: 1.3, shellScale: 0.7,
      weaponType: 'missile', homingTurn: 1.35, weaponName: 'NEUE ZIEL LARGE MISSILE',
    });
    addTurret(root, turrets, dark, dark, cooldown, {
      x: sx * 23, y: 18, z: -2, restYaw: sx * PI / 2, arc: PI * 0.8, width: 2.6, length: 4,
      shots: 4, damage: 125, splash: 6, rangeScale: 0.72, rofScale: 0.8, shellScale: 0.42,
      weaponType: 'missile', homingTurn: 1.8, weaponName: 'NEUE ZIEL SMALL MISSILE BARRAGE',
    });
    addTurret(root, turrets, light, dark, cooldown, {
      x: sx * 28, y: 16, z: 49, restYaw: sx * 0.2, arc: PI * 0.85, width: 2.1, length: 5.2,
      damage: 310, splash: 2, rangeScale: 0.75, rofScale: 0.42, shellScale: 0.5,
      weaponName: 'NEUE ZIEL WIRED CLAW MEGA-PARTICLE CANNON',
    });
    for (const ax of [-1, 1]) addTurret(root, turrets, light, dark, cooldown, {
      x: sx * (15 + ax * 2.2), y: 20, z: 19, restYaw: sx * 0.28, arc: PI * 0.72,
      width: 1.5, length: 4.2, damage: 225, splash: 1, rangeScale: 0.62,
      rofScale: 0.44, shellScale: 0.4, weaponName: 'NEUE ZIEL SUB-ARM MEGA-PARTICLE CANNON',
    });
  }
  root.userData.silhouette = 'neue-ziel-76m-tall-core-massive-shoulders-wired-claws-four-subarms-tail-skirt-twin-tanks';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildDendrobium(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const white = material(0xd8dce1), grey = material(0x79828e), dark = material(0x303844, { metalness: 0.66 });
  const blue = material(0x315989), red = material(0xa94343);
  // Canonical 140 m Orchis: two separated container banks, the Stamen docked
  // visibly in the center, twin folding claws below and one offset mega cannon.
  root.add(chamferBox(18, 9, 61, grey, 0, 17, -5, 1.0));
  for (const sx of [-1, 1]){
    root.add(chamferBox(19, 14, 67, white, sx * 27, 25, -6, 1.2));
    for (let i = 0; i < 4; i++){
      const z = -28 + i * 18;
      root.add(chamferBox(15, 9, 15, white, sx * 27, 29, z, 0.7));
      root.add(box(11, 1.2, 10, dark, sx * 27, 34, z));
      for (const mx of [-1, 0, 1]) root.add(cyl(0.65, 0.65, 2.2, red, sx * 27 + mx * 2.7, 34.8, z, 8));
    }
  }
  // Recognisable GP03S core: blue chest, white limbs, red chin and V-fin.
  root.add(chamferBox(13, 11, 14, blue, 0, 22, 25, 0.8));
  root.add(chamferBox(8, 8, 9, white, 0, 31, 31, 0.6));
  root.add(box(4, 2, 5, red, 0, 28, 37));
  for (const sx of [-1, 1]){
    root.add(chamferBox(4, 4, 15, white, sx * 8, 22, 30, 0.45));
    const fin = box(0.8, 1.1, 9, white, sx * 3.2, 36, 34); fin.rotation.x = sx * 0.42; root.add(fin);
  }
  // Cannon terminates near +100 while the aft thruster block reaches -40: 140 m overall.
  root.add(box(7.2, 7.2, 88, grey, 14, 15, 52));
  root.add(box(4.2, 4.2, 56, dark, 14, 15, 91));
  root.add(sph(3.3, glow, 14, 15, 120, 14, 9));
  // Large I-field generator dome on the starboard side.
  root.add(cyl(6.5, 7.5, 8, dark, 38, 19, 10, 18).rotateZ(PI / 2));
  root.add(sph(5.2, glow, 42, 19, 10, 14, 9));
  for (const sx of [-1, 1]){
    root.add(chamferBox(7, 5, 34, grey, sx * 17, 9, 20, 0.8));
    root.add(chamferBox(13, 5, 14, dark, sx * 17, 8, 43, 0.7));
    // Folded claw jaws; their emitters generate the huge beam sabers.
    for (const jaw of [-1, 1]){
      const claw = chamferBox(2.3, 2.8, 13, white, sx * 17 + jaw * 3.8, 8, 51, 0.35);
      claw.rotation.y = jaw * 0.16; root.add(claw);
    }
    for (const z of [-31, -20, -9]) addThruster(root, white, dark, thrust, sx * 18, 19, z - 18, 3.8);
  }
  for (const x of [-10, 0, 10]) addThruster(root, white, dark, thrust, x, 19, -40, 4.8);
  addTurret(root, turrets, grey, dark, cooldown, {
    x: 14, y: 15, z: 13, width: 4.8, length: 13, secondary: false, alwaysActive: true,
    damage: 1900, splash: 28, rangeScale: 1, rofScale: 1, shellScale: 1.65,
    arc: PI * 0.34, weaponName: 'DENDROBIUM BATTLESHIP-GRADE MEGA BEAM CANNON',
  });
  for (const sx of [-1, 1]){
    addTurret(root, turrets, white, dark, cooldown, {
      x: sx * 27, y: 33, z: 8, restYaw: sx * PI / 2, arc: PI * 0.7,
      width: 3.1, length: 5.2, shots: 3, damage: 330, splash: 11,
      rangeScale: 0.82, rofScale: 1.15, shellScale: 0.7, weaponType: 'missile', homingTurn: 1.2,
      weaponName: 'DENDROBIUM LARGE MISSILE POD',
    });
    addTurret(root, turrets, dark, dark, cooldown, {
      x: sx * 27, y: 33, z: -17, restYaw: sx * PI / 2, arc: PI * 0.8,
      width: 2.8, length: 4.6, shots: 5, damage: 110, splash: 5,
      rangeScale: 0.72, rofScale: 0.68, shellScale: 0.4, weaponType: 'missile', homingTurn: 1.75,
      weaponName: 'DENDROBIUM MICRO-MISSILE CONTAINER',
    });
    addTurret(root, turrets, blue, dark, cooldown, {
      x: sx * 7, y: 23, z: 27, restYaw: sx * 0.2, arc: PI * 0.7,
      width: 2.5, length: 6.2, damage: 240, splash: 2,
      rangeScale: 0.7, rofScale: 0.42, shellScale: 0.48,
      weaponName: 'GP03S BEAM RIFLE',
    });
  }
  root.userData.silhouette = 'dendrobium-140m-separated-orchis-pods-visible-stamen-offset-cannon-ifield-twin-claws';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

export function buildMobileArmor(kind, glow, thrust, cooldown = () => 0){
  if (kind === 'bigzam') return buildBigZam(glow, thrust, cooldown);
  if (kind === 'apsaras3') return buildApsaras(glow, thrust, cooldown);
  if (kind === 'neueziel') return buildNeueZiel(glow, thrust, cooldown);
  if (kind === 'dendrobium') return buildDendrobium(glow, thrust, cooldown);
  return null;
}
