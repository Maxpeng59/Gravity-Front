// Universal Century mobile armors: huge self-propelled weapons platforms that
// sit between a mobile suit and a capital ship. Gameplay values intentionally
// make them durable battlefield anchors without giving them warship speed.
import { THREE, box, cyl, cone, sph, chamferBox, profile, tube } from './model-kit.js';

const PI = Math.PI;
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.58, metalness: 0.5, ...extra,
});

// Reference-driven armour plates.  These keep the machines' defining line-art
// silhouettes instead of approximating every hull with scaled spheres.
function frontPlate(points, depth, mat, x = 0, y = 0, z = 0){
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.35, bevelThickness: 0.35 });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); return mesh;
}

function topPlate(points, thickness, mat, x = 0, y = 0, z = 0){
  const plate = frontPlate(points, thickness, mat, x, z, -y);
  plate.rotation.x = PI / 2;
  plate.position.set(x, y, z);
  return plate;
}

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
  const green = material(0x5d7c43), light = material(0x91a85f), dark = material(0x202c24, { metalness: 0.65 });
  const purple = material(0x4b395e), black = material(0x111615, { metalness: 0.72 });
  // MA-08 reference silhouette: a wide, layered crab/manta shell with a small
  // command cupola, not an egg balanced on two cylinders.
  root.add(frontPlate([[-27,35],[-22,48],[-11,55],[0,57],[11,55],[22,48],[27,35],[20,27],[-20,27]], 24, green));
  root.add(frontPlate([[-31,34],[-25,43],[-15,46],[-12,35],[-18,29],[-26,27]], 20, light, 0, 0, -1));
  root.add(frontPlate([[31,34],[25,43],[15,46],[12,35],[18,29],[26,27]], 20, light, 0, 0, -1));
  root.add(frontPlate([[-24,29],[-16,35],[16,35],[24,29],[18,22],[-18,22]], 19, green, 0, 0, -2));
  // Command dome, mono-eye band and the paired swept dorsal horns.
  const cupola = sph(7.4, light, 0, 57, -1, 20, 12); cupola.scale.set(1.2, 0.7, 0.84); root.add(cupola);
  root.add(chamferBox(11, 2.1, 6, black, 0, 57, 5, 0.4));
  root.add(box(4.5, 0.9, 0.8, glow, 0, 57, 8.2));
  for (const sx of [-1, 1]){
    const horn = frontPlate([[0,0],[sx * 5,9],[sx * 3,18],[sx * 8,8]], 1.5, black, sx * 10, 52, -5);
    root.add(horn);
    root.add(cone(0.55, 7, light, sx * 3.4, 64, -1, 7).rotateZ(-sx * 0.2));
  }
  // Huge central cannon is recessed inside three concentric armour collars.
  for (const [r, zz, mat] of [[9.3,11,dark],[7.1,15,black],[5.5,19,glow]]){
    const ring = cyl(r, r * 1.04, 4, mat, 0, 37, zz, 24); ring.rotation.x = PI / 2; root.add(ring);
  }
  // Equatorial weapon band and inset ports.
  root.add(cyl(20, 23.5, 5.5, dark, 0, 28, 0, 28));
  for (const sx of [-1, 1]){
    // Layered hip, knee armour and tapered shin reproduce the model-sheet legs.
    root.add(cyl(5.7, 6.5, 8, dark, sx * 13, 20, 0, 16));
    root.add(profile([[-5,-15],[4,-14],[6,13],[1,18],[-4,14],[-6,-8]], [], 8.5, green, sx * 13, 3, 0));
    root.add(frontPlate([[-7,-1],[-5,6],[0,10],[5,6],[7,-1],[4,-7],[-4,-7]], 9.5, purple, sx * 13, 10, 2));
    root.add(profile([[-6,-15],[4,-13],[5,11],[2,15],[-4,12],[-5,-8]], [], 6.4, light, sx * 13, -17, 0));
    root.add(cyl(3.3, 4.2, 5, dark, sx * 13, -32, 0, 14));
    root.add(chamferBox(13, 4.5, 14, dark, sx * 13, -35, 5, 1.1));
    for (const toe of [-1, 0, 1]){
      const claw = profile([[-3,-1],[1,-2],[14,-0.8],[18,0.5],[12,2],[1,2]], [], 2.8, toe === 0 ? green : purple,
        sx * 13 + toe * 4.1, -36, 14);
      root.add(claw);
    }
    for (const z of [-4, 5]) root.add(cyl(1.3, 1.8, 3.2, thrust, sx * 13, -28, z, 10));
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
      x: sx * 13 + toe * 4.1, y: -36, z: 18, width: 1.8, length: 4.5, shots: 1,
      damage: 520, splash: 8, rangeScale: 0.58, rofScale: 1.4, shellScale: 0.8,
      weaponType: 'missile', homingTurn: 0.75, weaponName: 'BIG ZAM CLAW MISSILE',
    });
  }
  root.userData.silhouette = 'big-zam-reference-layered-manta-shell-command-cupola-horns-28-port-band-segmented-legs-articulated-claws';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildApsaras(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const rust = material(0x6c5638), olive = material(0x8a8050), tan = material(0xb59b63);
  const dark = material(0x343630, { metalness: 0.63 }), yellow = material(0xd5a931);
  // Apsaras III reference: three joined bulbous armour lobes over an exposed
  // mechanical belly.  The planform is a scalloped bat/trefoil, never a disc.
  root.add(topPlate([[-31,-8],[-27,13],[-17,29],[-6,35],[0,25],[6,35],[17,29],[27,13],[31,-8],[19,-23],[0,-29],[-19,-23]], 7, rust, 0, 20, -2));
  for (const [x,z,sx,sz] of [[-18,-1,1.05,1.18],[0,-8,0.95,1.24],[18,-1,1.05,1.18]]){
    const lobe = sph(14.5, olive, x, 25, z, 24, 15); lobe.scale.set(sx,0.58,sz); root.add(lobe);
    root.add(frontPlate([[-10,0],[-8,7],[0,11],[8,7],[10,0],[6,-7],[-6,-7]], 13, tan, x, 24, z + 2));
  }
  // Gray structural lattice and scalloped underside blocks remain visible.
  root.add(chamferBox(39, 4, 28, dark, 0, 14, -3, 0.8));
  for (const x of [-21,-11,0,11,21]){
    root.add(chamferBox(7, 7, 20 - Math.abs(x) * 0.25, dark, x, 12, 0, 0.55));
    root.add(cyl(1.5,1.5,8,dark,x,10,-12,10).rotateX(PI/2));
  }
  // Deep front cannon throat with the distinct yellow collar.
  for (const [r,z,mat] of [[11,18,dark],[8.5,22,yellow],[6.4,25,dark],[4.8,28,glow]]){
    const muzzle = cyl(r,r,3.5,mat,0,18,z,24); muzzle.rotation.x = PI/2; root.add(muzzle);
  }
  // Four tall stabilizer/antenna fins and the field of dorsal spikes.
  for (const [x,z,lean] of [[-27,-7,-0.22],[-17,-22,-0.12],[17,-22,0.12],[27,-7,0.22]]){
    const fin = frontPlate([[-2,0],[-1,19],[2,26],[3,1]], 3.2, dark, x, 27, z);
    fin.rotation.z = lean; root.add(fin);
  }
  for (const x of [-20,-12,-4,4,12,20]) for (const z of [-13,1]){
    const spike = cone(1.25,5.5,tan,x + (z > 0 ? 2 : 0),35 - Math.abs(x)*0.08,z,8); root.add(spike);
  }
  // Three deployable firing legs shown in the standing-mode line art.
  for (const [x,z,lean] of [[-22,-4,-0.14],[22,-4,0.14],[0,-22,0]]){
    const brace = profile([[-3,-12],[2,-12],[4,12],[1,17],[-3,12]],[],5.5,dark,x,-2,z);
    brace.rotation.z = lean; root.add(brace);
    root.add(chamferBox(12,3.5,13,tan,x,-15,z+2,0.7));
    addThruster(root,rust,dark,thrust,x,8,z-6,3.1);
  }
  addTurret(root, turrets, rust, dark, cooldown, {
    x: 0, y: 16, z: 22, width: 7.4, length: 10, secondary: false, alwaysActive: true,
    damage: 2800, splash: 46, rangeScale: 1, rofScale: 1, shellScale: 2,
    arc: PI * 0.46, weaponName: 'APSARAS III VARIABLE-FOCUS LARGE MEGA-PARTICLE CANNON',
  });
  root.userData.silhouette = 'apsaras-iii-reference-three-lobed-trefoil-shell-exposed-belly-yellow-cannon-collar-four-fins-dorsal-spikes-three-braces';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildNeueZiel(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const green = material(0x3f684d), light = material(0xa9b88d), pale = material(0xd0d4b8);
  const dark = material(0x193329, { metalness: 0.68 }), red = material(0xa94538, { emissive: 0x501408, emissiveIntensity: 0.45 });
  // AMX-002 line art is dominated by two enormous down-swept booster binders.
  // The cockpit/core is deliberately tiny between them.
  root.add(profile([[-11,-13],[8,-12],[14,-5],[13,10],[5,20],[-4,21],[-11,10]], [], 14, green, 0, 30, 4));
  root.add(chamferBox(8,7,10,dark,0,50,11,0.8));
  root.add(frontPlate([[-5,0],[-3,6],[0,9],[3,6],[5,0],[3,-4],[-3,-4]],7,pale,0,50,15));
  root.add(box(4.6,1.1,0.8,glow,0,50,19));
  root.add(chamferBox(15,9,24,dark,0,21,-3,1.0));
  // Three long lower booster/tail bodies form the trident-shaped rear mass.
  root.add(profile([[-8,-28],[4,-26],[7,10],[4,16],[-4,16],[-7,8]],[],10,green,0,1,-18));
  for (const sx of [-1,1]) root.add(profile([[-7,-23],[3,-21],[6,8],[3,14],[-4,13],[-6,5]],[],8,light,sx*12,7,-17));
  for (const sx of [-1, 1]){
    // Custom tapered shoulder shell with a sharp lower point and exposed dark rear.
    root.add(frontPlate([[sx*7,7],[sx*15,18],[sx*25,21],[sx*34,16],[sx*30,-7],[sx*22,-25],[sx*13,-18]],18,light,0,31,-6));
    root.add(frontPlate([[sx*16,8],[sx*25,13],[sx*31,9],[sx*27,-4],[sx*20,-17],[sx*16,-12]],19,dark,0,29,-10));
    for (const [yy,zz,rr] of [[38,-18,3.7],[28,-21,3.2],[17,-18,2.7]]){
      const nozzle=cyl(rr,rr*1.12,2.4,red,sx*24,yy,zz,14); nozzle.rotation.x=PI/2; root.add(nozzle);
    }
    // Articulated main arm and wired claw, with visible cable spine.
    root.add(chamferBox(7,7,15,pale,sx*13,27,17,0.8));
    root.add(chamferBox(5.5,5.5,14,green,sx*15,20,27,0.65));
    const cable=tube([[sx*15,20,30],[sx*17,15,34],[sx*17,11,38]],0.7,dark,18,7); root.add(cable);
    const palm=sph(4.4,green,sx*17,11,40,12,8); palm.scale.set(1.05,0.62,0.78); root.add(palm);
    for (const cx of [-1,0,1]){
      const finger=profile([[-1,-1],[8,-0.8],[11,0.5],[7,1.4],[-1,1]],[],1.4,pale,sx*17+cx*2.3,11,45);
      finger.rotation.y=sx*0.08; root.add(finger);
    }
    // Four folded sub-arms tucked around the waist.
    for (const ax of [-1,1]){
      root.add(chamferBox(2.2,2.5,13,pale,sx*(11+ax*2.2),22,15,0.35));
      root.add(chamferBox(2.0,2.2,9,dark,sx*(12+ax*2.5),18,25,0.3));
    }
    addThruster(root,green,dark,thrust,sx*23,19,-33,4.2);
  }
  for (const x of [-11,0,11]) addThruster(root,green,dark,thrust,x,5,-43,3.7);
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
      x: sx * 17, y: 11, z: 40, restYaw: sx * 0.2, arc: PI * 0.85, width: 2.1, length: 5.2,
      damage: 310, splash: 2, rangeScale: 0.75, rofScale: 0.42, shellScale: 0.5,
      weaponName: 'NEUE ZIEL WIRED CLAW MEGA-PARTICLE CANNON',
    });
    for (const ax of [-1, 1]) addTurret(root, turrets, light, dark, cooldown, {
      x: sx * (15 + ax * 2.2), y: 20, z: 19, restYaw: sx * 0.28, arc: PI * 0.72,
      width: 1.5, length: 4.2, damage: 225, splash: 1, rangeScale: 0.62,
      rofScale: 0.44, shellScale: 0.4, weaponName: 'NEUE ZIEL SUB-ARM MEGA-PARTICLE CANNON',
    });
  }
  root.userData.silhouette = 'neue-ziel-reference-tiny-core-enormous-tapered-binders-exposed-rear-thrusters-wired-claws-four-subarms-trident-tail';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

function buildDendrobium(glow, thrust, cooldown){
  const root = new THREE.Group(), turrets = [];
  const white = material(0xd8dce1), grey = material(0x79828e), dark = material(0x303844, { metalness: 0.66 });
  const blue = material(0x315989), red = material(0xa94343);
  // RX-78GP03 line art: a long open Orchis truss, two genuinely separated
  // weapon-container banks, visible Stamen, underslung claws and one absurdly
  // long offset mega beam cannon.
  root.add(profile([[-38,-5],[24,-5],[33,0],[28,6],[-29,6],[-39,2]],[],13,grey,0,18,-2));
  root.add(chamferBox(22,6,20,dark,0,17,-34,0.8));
  for (const sx of [-1, 1]){
    // Angled carrier rail supporting four discrete, hinged containers.
    root.add(profile([[-34,-6],[31,-6],[37,-1],[31,5],[-34,5]],[],5,grey,sx*24,26,-3));
    for (let i = 0; i < 4; i++){
      const z = -27 + i * 18.5;
      const pod = profile([[-8,-5],[7,-5],[9,-2],[8,5],[-8,5],[-10,1]],[],17,white,sx*29,29,z);
      pod.rotation.z=sx*0.025; root.add(pod);
      root.add(chamferBox(13,1.6,11,dark,sx*29,35,z,0.25));
      for (const mx of [-1.5,-0.5,0.5,1.5]) root.add(cyl(0.62,0.62,2.1,red,sx*29+mx*2.4,35.8,z,8));
      root.add(chamferBox(2,4,13,grey,sx*19.5,28,z,0.25));
    }
  }
  // Recognisable GP03S Stamen core, deliberately small relative to Orchis.
  root.add(chamferBox(11,10,13,blue,0,22,26,0.8));
  root.add(chamferBox(7,7,8,white,0,30,32,0.6));
  root.add(box(3.5,1.8,4,red,0,27.5,37));
  for (const sx of [-1, 1]){
    root.add(chamferBox(3.7,3.7,14,white,sx*7.4,22,30,0.45));
    root.add(chamferBox(4.2,8,5,white,sx*4,15,27,0.4));
    const fin=box(0.7,1,8,white,sx*3,35,35); fin.rotation.x=sx*0.42; root.add(fin);
  }
  // Battleship gun extends far ahead of the containers on a starboard truss.
  root.add(profile([[-33,-4],[33,-4],[38,0],[33,4],[-33,4]],[],7,grey,15,14,42));
  root.add(cyl(2.8,3.6,74,dark,15,14,97,16).rotateX(PI/2));
  root.add(cyl(3.2,3.2,4,red,15,14,135,16).rotateX(PI/2));
  root.add(sph(2.7,glow,15,14,137,14,9));
  // Large I-field generator dome on the starboard side.
  root.add(cyl(6.5,7.5,8,dark,39,19,8,18).rotateZ(PI/2));
  root.add(sph(5.2,glow,43,19,8,14,9));
  for (const sx of [-1, 1]){
    // Folding manipulator spars and split claw jaws beneath the frame.
    root.add(profile([[-17,-3],[17,-3],[20,0],[15,3],[-17,3]],[],6,grey,sx*16,9,18));
    root.add(chamferBox(13,5,14,dark,sx*16,8,43,0.7));
    for (const jaw of [-1, 1]){
      const claw=profile([[-6,-1.5],[7,-1.2],[10,0],[7,1.4],[-6,1.5]],[],2.4,white,sx*16+jaw*3.7,8,52);
      claw.rotation.y=jaw*0.16; root.add(claw);
    }
    for (const z of [-31,-20,-9]) addThruster(root,white,dark,thrust,sx*18,19,z-18,3.8);
  }
  // Six-nozzle afterbody seen in the rear reference.
  for (const x of [-12,0,12]) for (const y of [14,25]) addThruster(root,white,dark,thrust,x,y,-46,y===25?3.9:4.7);
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
  root.userData.silhouette = 'dendrobium-reference-140m-open-orchis-truss-eight-separated-containers-visible-stamen-offset-mega-cannon-ifield-folding-claws-six-thrusters';
  return { root, turrets, fixedMuzzles: [], secondaryMuzzles: [] };
}

export function buildMobileArmor(kind, glow, thrust, cooldown = () => 0){
  if (kind === 'bigzam') return buildBigZam(glow, thrust, cooldown);
  if (kind === 'apsaras3') return buildApsaras(glow, thrust, cooldown);
  if (kind === 'neueziel') return buildNeueZiel(glow, thrust, cooldown);
  if (kind === 'dendrobium') return buildDendrobium(glow, thrust, cooldown);
  return null;
}
