// Source-faithful OYW landship meshes. These are deliberately kept separate from
// battle.js so their silhouettes, armament and propulsion layouts can be audited
// without touching gameplay code. Every hull faces +Z and rests on y=0.
import {
  THREE, box, cyl, cone, sph, chamferBox, profile, instancedTrack, compactGroup,
} from './model-kit.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.68, metalness: 0.34, ...extra,
});

function barrel(parent, material, x, y, z, length, radius, rear = false){
  const mesh = cyl(radius, radius * 1.06, length, material, x, y, z + (rear ? -1 : 1) * length / 2, 10);
  mesh.rotation.x = Math.PI / 2; parent.add(mesh); return mesh;
}

function turret(root, turrets, material, dark, spec, cooldown){
  const { x, y, z, width, height, depth, offsets, length, radius, rear = false } = spec;
  const yaw = new THREE.Group(); yaw.position.set(x, y, z); if (rear) yaw.rotation.y = Math.PI; root.add(yaw);
  yaw.add(cyl(width * 0.54, width * 0.66, height * 0.42, dark, 0, 0, 0, 16));
  const gun = new THREE.Group(); gun.position.y = height * 0.28; yaw.add(gun);
  const hood = chamferBox(width, height, depth, material, 0, height * 0.3, 0, 0.28); gun.add(hood);
  gun.add(box(width * 0.82, height * 0.22, depth * 0.92, dark, 0, height * 0.16, 0));
  for (const bx of offsets){
    const sleeve = cyl(radius * 1.5, radius * 1.65, depth * 0.52, dark, bx, height * 0.35, depth * 0.56, 12);
    sleeve.rotation.x = Math.PI / 2; gun.add(sleeve);
    barrel(gun, dark, bx, height * 0.35, depth * 0.48, length, radius);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, height * 0.35, depth * 0.48 + length); gun.add(muzzle);
  turrets.push({ yaw, gun, muzzle, cd: cooldown(), restYaw: rear ? Math.PI : 0 });
  return yaw;
}

function addWindows(parent, glow, xs, y, z, width = 2.2, height = 0.65){
  for (const x of xs) parent.add(chamferBox(width, height, 0.24, glow, x, y, z, 0.08));
}

function buildBigTray(glow, cooldown){
  const root = new THREE.Group(), turrets = [];
  glow ||= std(0x15212c, { emissive: 0x5aa7d8, emissiveIntensity: 1.2 });
  const sand = std(0x8e835e), green = std(0x59664a), dark = std(0x292b32, { metalness: 0.5 });
  const armor = std(0x777451), vent = std(0x181b20, { roughness: 0.82 });
  const hull = new THREE.Group(); root.add(hull);

  // Thermonuclear hover skirt and the low, boat-like armored hull used in 08th MS Team/IGLOO.
  hull.add(profile([[-48, 3], [-43, 8], [-28, 11], [29, 11], [47, 7], [51, 3]], [], 56, dark, 0, 0, 0));
  hull.add(profile([[-44, 7], [-33, 14], [24, 15], [45, 9], [48, 6]], [], 50, sand, 0, 0, 0));
  hull.add(profile([[-27, 13], [-17, 21], [15, 22], [33, 14]], [], 40, green, 0, 0, -3));
  hull.add(chamferBox(34, 5, 39, armor, 0, 18.2, -6, 0.65));

  // Segmented hover intakes and exhaust louvers run around the full skirt.
  for (const sx of [-1, 1]){
    for (let z = -39; z <= 39; z += 8) hull.add(chamferBox(0.8, 2.2, 5.2, vent, sx * 27.6, 4.1, z, 0.12));
    for (const z of [-35, -20, -5, 10, 25, 40]){
      const vane = box(1.1, 4.2, 0.35, armor, sx * 28.2, 7.5, z); vane.rotation.z = sx * -0.18; hull.add(vane);
    }
  }

  // Two fixed large-calibre bow guns sit low in the prow.
  for (const x of [-8, 8]){
    hull.add(cyl(2.05, 2.35, 3.8, dark, x, 11.5, 42.5, 16).rotateX(Math.PI / 2));
    barrel(hull, dark, x, 11.5, 43.5, 18, 0.72);
  }

  // Three triple-gun batteries: port/starboard amidships plus the aft center mount.
  turret(root, turrets, sand, dark,
    { x: -18, y: 19.5, z: 8, width: 9.5, height: 4, depth: 8, offsets: [-2.1, 0, 2.1], length: 16, radius: 0.52 }, cooldown);
  turret(root, turrets, sand, dark,
    { x: 18, y: 19.5, z: 8, width: 9.5, height: 4, depth: 8, offsets: [-2.1, 0, 2.1], length: 16, radius: 0.52 }, cooldown);
  turret(root, turrets, green, dark,
    { x: 0, y: 22, z: -31, width: 10.5, height: 4.4, depth: 9, offsets: [-2.25, 0, 2.25], length: 17, radius: 0.55, rear: true }, cooldown);

  // High armored command block, panoramic bridge bands and the signature twin fins.
  hull.add(chamferBox(22, 10, 18, green, 0, 26, -10, 1.0));
  hull.add(chamferBox(17, 6, 14, sand, 0, 33.2, -12, 0.8));
  addWindows(hull, glow, [-6, -2, 2, 6], 33, -4.9, 2.8, 0.9);
  addWindows(hull, glow, [-5, 0, 5], 36, -8.1, 3.2, 0.75);
  for (const sx of [-1, 1]){
    const fin = profile([[-2.2, 0], [-1.2, 15], [1.1, 19], [2.2, 0]], [], 1.05, sand, sx * 10.5, 31, -16);
    hull.add(fin);
    for (let y = 35; y < 48; y += 2.6) hull.add(box(1.4, 0.26, 3.1, dark, sx * 10.5, y, -16));
  }
  hull.add(cyl(0.22, 0.22, 13, dark, 0, 43, -15, 8));

  // Eight twin AA stations and their small ammunition lockers.
  for (const [x, z] of [[-20,-22],[20,-22],[-21,-7],[21,-7],[-20,25],[20,25],[-8,32],[8,32]]){
    hull.add(cyl(1.25, 1.5, 0.7, armor, x, 18.2, z, 12));
    for (const dx of [-0.38, 0.38]) barrel(hull, dark, x + dx, 19, z + 0.2, 4.8, 0.14);
  }
  compactGroup(hull);
  return { root, turrets };
}

function trackPod(material, dark, z, side){
  const pod = new THREE.Group(); pod.position.set(side * 26, 0, z);
  pod.add(instancedTrack([[-12,2],[-9,0],[8,0],[12,2],[10,6],[-9,6]], [0], 9.5, 1.1, dark));
  pod.add(profile([[-11, 2.2], [-8, 7.2], [8, 7.2], [11, 3]], [], 8.6, material, 0, 0, 0));
  for (const wz of [-8.5, -4.25, 0, 4.25, 8.5]){
    const wheel = cyl(2.1, 2.1, 9.0, dark, 0, 3.2, wz, 16); wheel.rotation.z = Math.PI / 2; pod.add(wheel);
    const hub = cyl(0.7, 0.7, 9.4, material, 0, 3.2, wz, 12); hub.rotation.z = Math.PI / 2; pod.add(hub);
  }
  return pod;
}

function buildDobday(glow, cooldown){
  const root = new THREE.Group(), turrets = [];
  glow ||= std(0x241719, { emissive: 0xe74c54, emissiveIntensity: 1.15 });
  const green = std(0x68745a), light = std(0x849078), dark = std(0x292d2b, { metalness: 0.55 });
  const deck = std(0x4e594a), red = std(0x8d3738), silver = std(0x858b8c, { metalness: 0.78 });
  const hull = new THREE.Group(); root.add(hull);

  // The IGLOO/Gravity Front version rides on six independent triple-row caterpillar units.
  for (const side of [-1, 1]) for (const z of [-27, 0, 27]) hull.add(trackPod(green, dark, z, side));
  hull.add(profile([[-43,7],[-36,14],[-19,18],[28,18],[43,12],[46,7]], [], 42, green, 0, 0, 0));
  hull.add(chamferBox(37, 5, 71, deck, 0, 17.2, -2, 0.7));
  hull.add(chamferBox(30, 5, 25, light, 0, 21, -8, 0.7));

  // Twin large cannon turrets on high armored side barbettes.
  turret(root, turrets, green, dark,
    { x: -17, y: 18, z: 18, width: 12, height: 6.2, depth: 15, offsets: [-2.3, 2.3], length: 25, radius: 0.8 }, cooldown);
  turret(root, turrets, green, dark,
    { x: 17, y: 18, z: 18, width: 12, height: 6.2, depth: 15, offsets: [-2.3, 2.3], length: 25, radius: 0.8 }, cooldown);

  // Tall, forward-projecting observation bridge with continuous red glazing.
  hull.add(profile([[-17,18],[-13,31],[-8,38],[4,40],[12,34],[13,20]], [], 19, green, -5, 0, -5));
  hull.add(chamferBox(21, 7, 16, light, -5, 37, -13, 1.1));
  for (const x of [-12,-8,-4,0,4]) hull.add(chamferBox(3.0, 0.9, 0.3, red, x, 37.3, -4.9, 0.08));
  hull.add(chamferBox(16, 1.1, 0.25, glow, -5, 35, -4.75, 0.08));
  hull.add(cyl(0.32, 0.32, 13, dark, -5, 48, -18, 8));
  for (const sx of [-1, 1]){
    const mast = box(0.7, 15, 2.2, dark, -5 + sx * 6.4, 48, -19); mast.rotation.x = sx * 0.08; hull.add(mast);
  }

  // Rear circular MS/aircraft deck, six VLS doors and the four firing outriggers.
  hull.add(cyl(15, 15, 0.7, dark, 0, 20, -27, 28));
  hull.add(cyl(13.8, 13.8, 0.8, light, 0, 20.5, -27, 28));
  hull.add(cyl(0.3, 0.3, 20, red, 0, 21, -27, 32));
  for (let i = 0; i < 6; i++) hull.add(chamferBox(3.2, 0.5, 6.5, deck, -10 + i * 4, 20.3, -43, 0.12));
  for (const [x,z] of [[-32,-35],[32,-35],[-32,34],[32,34]]){
    hull.add(cyl(1.55, 1.55, 12, green, x, 7, z, 12));
    hull.add(cyl(1.05, 1.05, 3.5, silver, x, 0.8, z, 12));
    const foot = cone(2.2, 3.2, dark, x, 1.2, z, 8); foot.rotation.x = Math.PI; hull.add(foot);
  }

  // Secondary twin machine-gun blisters around the command structure.
  for (const [x,y,z,sgn] of [[-13,29,-3,-1],[3,29,-3,1],[-15,25,5,-1],[5,25,5,1],[-13,23,-20,-1],[7,23,-20,1]]){
    hull.add(cyl(1.3, 1.55, 0.8, light, x, y, z, 12));
    for (const dx of [-0.32, 0.32]) barrel(hull, dark, x + dx, y + 0.7, z, 5, 0.16, sgn < 0);
  }
  compactGroup(hull);
  return { root, turrets };
}

function buildGallop(glow, cooldown){
  const root = new THREE.Group(), turrets = [];
  const gold = std(0xc89932), orange = std(0xa86125), violet = std(0x29213e, { metalness: 0.44 });
  const dark = std(0x17151f, { metalness: 0.55 }), glass = glow || std(0x32283d, { emissive: 0xff6c52, emissiveIntensity: 1 });
  const hull = new THREE.Group(); root.add(hull);

  // Compact 48m transport: a rounded hover body, front MS ramp and two four-engine pods.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(25, 28, 4.5, 24), violet); skirt.position.y = 2.4; skirt.scale.z = 0.9; hull.add(skirt);
  hull.add(profile([[-23,4],[-18,13],[-8,18],[10,17],[23,9],[25,4]], [], 38, gold, 0, 0, 0));
  hull.add(chamferBox(20, 14, 5.5, orange, 0, 10.5, 21.4, 0.7)); // hangar/ramp
  hull.add(chamferBox(15.5, 10.5, 0.5, violet, 0, 10.4, 24.3, 0.25));
  for (const x of [-5,-1.7,1.7,5]) hull.add(box(0.45, 8.8, 0.6, dark, x, 10.5, 24.6));

  // Ejectable combat bridges flank the ramp; the central navigation band sits above it.
  for (const sx of [-1,1]){
    hull.add(sph(4.3, orange, sx * 9, 14, 15.8, 16, 10));
    hull.add(chamferBox(5.5, 1.05, 0.28, glass, sx * 9, 14.3, 19.9, 0.12));
  }
  addWindows(hull, glass, [-5,-2.5,0,2.5,5], 17.1, 18.8, 1.8, 0.65);

  // Outboard thermonuclear engine pods with four circular exhaust/intake openings each.
  for (const sx of [-1,1]){
    const pod = chamferBox(13, 8.5, 20, orange, sx * 23, 13, -2, 1.2); hull.add(pod);
    hull.add(chamferBox(13.4, 5.8, 3.2, violet, sx * 23, 13, 8.8, 0.5));
    for (const x of [-4.4,-1.45,1.45,4.4]){
      const nozzle = cyl(1.25, 1.5, 2.6, dark, sx * 23 + x, 13, 10, 14); nozzle.rotation.x = Math.PI / 2; hull.add(nozzle);
      hull.add(cyl(0.8, 0.8, 0.25, violet, sx * 23 + x, 13, 11.4, 12).rotateX(Math.PI / 2));
    }
    for (const z of [-7,-2,3]) hull.add(box(12.6, 0.45, 1.2, violet, sx * 23, 17.2, z));
  }

  // Rear-facing twin artillery mount and paired forward AA blisters.
  turret(root, turrets, violet, dark,
    { x: 0, y: 16, z: -8, width: 8.5, height: 4.2, depth: 7, offsets: [-1.45,1.45], length: 15, radius: 0.44, rear: true }, cooldown);
  for (const sx of [-1,1]){
    hull.add(sph(2.4, violet, sx * 10.5, 18.5, 6.5, 14, 9));
    for (const dx of [-0.34,0.34]) barrel(hull, dark, sx * 10.5 + dx, 19, 7, 5.2, 0.15);
  }

  // Panoramic observation cupola, two very tall aerials, and the stern tow coupling.
  hull.add(cyl(2.3, 3.3, 4.8, orange, 0, 20.5, 2, 14));
  hull.add(sph(2.25, glass, 0, 23, 2, 16, 9));
  for (const sx of [-1,1]){
    const mast = cone(0.55, 15, gold, sx * 8.5, 26, 4, 10); hull.add(mast);
    hull.add(cyl(0.12, 0.12, 18, dark, sx * 8.5, 41.5, 4, 6));
  }
  hull.add(cyl(1.1, 1.1, 4, violet, 0, 9, -25, 12).rotateX(Math.PI / 2));
  hull.add(sph(1.35, dark, 0, 9, -27));
  compactGroup(hull);
  return { root, turrets };
}

// `cooldown` keeps the battle engine's seeded timing while leaving construction independent.
export function buildCanonicalLandship(kind, glow, cooldown = () => 0){
  if (kind === 'bigtray') return buildBigTray(glow, cooldown);
  if (kind === 'dabude') return buildDobday(glow, cooldown);
  if (kind === 'gallop') return buildGallop(glow, cooldown);
  return null;
}
