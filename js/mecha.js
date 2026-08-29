// ---------- procedural mobile suit meshes ----------
// Builds an ~18m stylized MS from primitives, per-style silhouettes:
// gundam (v-fin, twin eyes, shield, saber rack), gm (visor), guncannon
// (shoulder cannons), guntank (treads + barrels), zaku (mono-eye, spiked
// shoulder, shield, power cable), gouf, dom (skirt, hover, chest scatter
// gun), gelgoog (head fin, flared shoulders), acguy (round hull, claws),
// tank (Type 61 twin-cannon / Magella Attack high turret).
// Engine anchors every build must provide: head, eye (head-gun muzzle),
// muzzle, gun?, blade, flames[], eyeMat, legL/legR/armL/armR (or null).
import * as THREE from 'three';
import { modelFor } from './models.js';
import { buildGuntankMk2 } from './guntankmk2.js';
import { buildCanonicalAircraft } from './canonical-aircraft.js';
import { buildZeonCanonical } from './canonical-zeon.js';
import { buildFederationCanonical } from './canonical-fed.js';

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.52, metalness: 0.3 }, extra));

// When a real model exists for the suit, mount it whole and attach the
// gameplay anchors (head/eye/muzzle/flames/blade) the engine expects.
function buildFromModel(suit, template){
  const zeon = suit.faction === 'ZEON';
  const root = new THREE.Group();
  root.add(template.clone());
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };
  const h = 17.5;

  const head = new THREE.Object3D(); head.position.set(0, h * 0.92, 0);
  root.add(head); parts.head = head;
  const eye = new THREE.Object3D(); eye.position.set(0, h * 0.9, 1.5);
  root.add(eye); parts.eye = eye;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(...(template.userData.muzzle || [2.2, h * 0.5, 3.2]));
  root.add(muzzle); parts.muzzle = muzzle;

  const flameMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff8830, emissiveIntensity: 2.6, transparent: true, opacity: 0.9 });
  for (const sx of [-0.9, 0.9]){
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 8), flameMat);
    fl.position.set(sx, h * 0.6, -2.6);
    fl.rotation.x = Math.PI; fl.scale.y = 0.01;
    root.add(fl); parts.flames.push(fl);
  }

  // ---- melee weapon, SHAPED to its name: heat hawk (axe) · heat sword (solid blade) · beam saber (energy) ----
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x220022, emissive: zeon ? 0xffcc55 : 0xff9ae0, emissiveIntensity: 3.0, transparent: true, opacity: 0.92 });
  const meleeSteel = new THREE.MeshStandardMaterial({ color: 0x3b414a, roughness: 0.5, metalness: 0.72 });
  const meleeHeat = new THREE.MeshStandardMaterial({ color: 0x3a1206, emissive: 0xff5a1e, emissiveIntensity: 2.7 });
  const meleeCore = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.2, transparent: true, opacity: 0.95 });
  const sName = (suit.saber && suit.saber.name) || 'BEAM SABER';
  const blade = new THREE.Group();
  if (/HAWK|AXE/.test(sName)){                                              // heat hawk — a stubby heated battle-axe
    blade.add(cyl(0.22, 0.26, 6.6, meleeSteel, 0, -0.6, 0, 8));             // haft (along +y = forward)
    blade.add(cyl(0.36, 0.36, 0.6, meleeSteel, 0, 2.7, 0, 8));             // head collar
    blade.add(box(0.5, 2.7, 2.6, meleeSteel, 0, 3.2, 0.8));                // axe head plate
    blade.add(box(0.6, 3.0, 0.7, meleeHeat, 0, 3.2, 2.3));                 // glowing cutting edge
    const spike = cone(0.32, 1.3, meleeSteel, 0, 3.2, -1.0); spike.rotation.x = -Math.PI / 2; blade.add(spike); // rear spike
  } else if (/SWORD/.test(sName)){                                          // heat sword — a long solid heated blade
    blade.add(cyl(0.22, 0.26, 1.7, meleeSteel, 0, -3.7, 0, 8));            // grip
    blade.add(box(1.7, 0.4, 0.7, meleeSteel, 0, -2.7, 0));                 // crossguard
    blade.add(box(0.62, 7.8, 0.3, meleeSteel, 0, 1.0, 0));                 // blade spine
    blade.add(box(0.34, 8.0, 0.52, meleeHeat, 0.28, 1.0, 0));              // heated cutting edge
    blade.add(cone(0.36, 1.1, meleeHeat, 0, 5.3, 0));                      // heated point
  } else {                                                                  // beam saber — energy blade with a white core
    blade.add(cyl(0.2, 0.26, 1.6, meleeSteel, 0, -3.9, 0, 8));             // hilt
    blade.add(cyl(0.33, 0.33, 8.2, bladeMat, 0, 1.0, 0, 10));              // glow blade
    blade.add(cyl(0.14, 0.05, 8.2, meleeCore, 0, 1.0, 0, 8));              // white-hot core
  }
  blade.position.set(2.2, h * 0.5, 6.5);
  blade.rotation.x = Math.PI / 2; blade.visible = false;
  root.add(blade); parts.blade = blade;

  // dummy sensor material so damage flicker has something to write to
  parts.eyeMat = new THREE.MeshStandardMaterial({ emissive: zeon ? 0xff3355 : 0x66ffcc, emissiveIntensity: 2.4 });

  root.scale.setScalar(suit.scale);
  root.userData.sharedAsset = true; // cloned GLB/STL geometry/materials belong to the loader cache
  return { root, parts };
}

function box(w, h, d, m, x = 0, y = 0, z = 0){
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.position.set(x, y, z); return g;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 10){
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  g.position.set(x, y, z); return g;
}
function cone(r, h, m, x = 0, y = 0, z = 0){
  const g = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m);
  g.position.set(x, y, z); return g;
}
function sph(r, m, x = 0, y = 0, z = 0){
  const g = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
  g.position.set(x, y, z); return g;
}
// ribbed cable — a run of fat rings on a thin core, along local +y. Caller positions/rotates the group.
function ribbedCable(len, r, m){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, len, 8), m)); // continuous inner core
  const segs = Math.max(4, Math.round(len / 0.6));
  for (let i = 0; i < segs; i++)
    g.add(cyl(r, r, 0.3, m, 0, -len / 2 + (i + 0.5) * (len / segs), 0, 8));       // ribs
  return g;
}

// Anti-materiel cannon (Desert-Tech-HTI silhouette) — long bolt-action big-bore rifle: SLOTTED M-LOK
// handguard with rows of vent holes, a BARE full-length Picatinny top rail, a round bolt-carrier tube +
// side bolt knob, a tall central box magazine, a ported muzzle brake, and an angular polymer stock with a
// monopod spike. SHARED by the Zaku Tank shoulder mount (buildMech) AND the cockpit viewmodel
// (buildWeaponMesh) so outside matches the cockpit. Barrel runs toward +z; origin at the action. `hold` adds a grip.
function amCannon(M, hold){
  const g = new THREE.Group();
  const steel = M.accent, body = M.main, dk = M.dark, hole = M.dark;
  // ---- receiver / action: boxy body with the round bolt-carrier tube on top ----
  g.add(box(1.08, 1.2, 4.2, dk, 0, 0, 0.1));                                     // receiver body
  g.add(box(1.14, 0.5, 3.8, body, 0, 0.62, 0.1));                               // top deck
  g.add(cyl(0.4, 0.4, 3.0, steel, 0, 0.7, -0.2, 12).rotateX(Math.PI / 2));      // bolt-carrier tube
  g.add(cyl(0.44, 0.44, 0.5, dk, 0, 0.7, 1.3, 12).rotateX(Math.PI / 2));        // ejection-port collar
  g.add(cyl(0.12, 0.12, 0.75, steel, -0.78, 0.55, -0.5, 8).rotateZ(Math.PI / 2)); // bolt handle (-x)
  g.add(sph(0.24, dk, -1.22, 0.55, -0.5));                                       // bolt knob (round)
  // ---- BARE full-length Picatinny top rail (no optic, matching the photo) over receiver + handguard ----
  g.add(box(0.6, 0.2, 8.4, dk, 0, 1.02, 1.6));                                   // rail base
  for (let z = -1.7; z <= 5.9; z += 0.34) g.add(box(0.56, 0.22, 0.2, steel, 0, 1.22, z)); // rail teeth
  g.add(box(0.14, 0.5, 0.14, dk, 0, 1.45, 5.7));                                // low front sight post
  // ---- tall central box magazine, canted forward under the receiver ----
  const mag = box(0.9, 2.0, 1.5, dk, 0, -1.35, 0.9); mag.rotation.x = -0.12; g.add(mag);
  g.add(box(0.94, 0.34, 1.5, steel, 0, -2.4, 0.75));                            // mag floorplate
  // ---- long SLOTTED M-LOK handguard: octagonal tube with rows of holes/slots (the signature look) ----
  const hgZ = 4.2, hgLen = 4.0, hgR = 0.6;
  g.add(cyl(hgR, hgR, hgLen, body, 0, 0.05, hgZ, 8).rotateX(Math.PI / 2));      // handguard tube (octagonal)
  g.add(cyl(hgR + 0.06, hgR + 0.06, 0.28, dk, 0, 0.05, hgZ - hgLen / 2 + 0.1, 8).rotateX(Math.PI / 2)); // rear collar
  g.add(cyl(0.5, 0.5, 0.3, dk, 0, 0.05, hgZ + hgLen / 2 - 0.05, 8).rotateX(Math.PI / 2));               // front cap
  for (let i = 0; i < 6; i++){
    const hz = hgZ - hgLen / 2 + 0.7 + i * 0.6;
    for (const sx of [-1, 1]) g.add(cyl(0.15, 0.15, 0.24, hole, sx * hgR, 0.05, hz, 8).rotateZ(Math.PI / 2)); // side vent holes
    if (i % 2 === 0) g.add(box(0.5, 0.16, 0.34, hole, 0, 0.05 - hgR, hz));       // bottom slots (alternating)
  }
  // ---- barrel past the handguard + fluted section + ported muzzle brake ----
  g.add(cyl(0.34, 0.34, 3.0, steel, 0, 0.05, 6.7, 12).rotateX(Math.PI / 2));    // exposed barrel
  for (const bz of [6.2, 6.7, 7.2]) g.add(cyl(0.4, 0.4, 0.1, dk, 0, 0.05, bz, 12).rotateX(Math.PI / 2)); // flute rings
  g.add(cyl(0.5, 0.5, 1.2, dk, 0, 0.05, 8.15, 10).rotateX(Math.PI / 2));        // muzzle brake body
  for (const bz of [7.75, 8.15, 8.55]) for (const sx of [-1, 1])                // horizontal brake ports (both sides)
    g.add(box(0.28, 0.34, 0.16, steel, sx * 0.42, 0.05, bz));
  g.add(cyl(0.3, 0.22, 0.35, M.scope, 0, 0.05, 8.72, 10).rotateX(Math.PI / 2)); // dark bore / flash face
  // ---- angular polymer stock: wrist, slab body, cheek riser, buttpad + monopod spike ----
  g.add(box(1.0, 1.3, 1.0, dk, 0, -0.05, -1.9));                               // stock wrist
  g.add(box(0.85, 1.9, 1.6, body, 0, 0.1, -3.0));                             // stock body (angular slab)
  g.add(box(0.5, 0.55, 1.4, dk, 0, 1.05, -3.1));                              // raised cheek riser
  g.add(box(0.95, 1.7, 0.5, dk, 0, 0.05, -3.9));                              // buttpad
  g.add(box(0.35, 0.9, 0.35, steel, 0, -1.15, -3.7));                         // monopod spike housing
  g.add(cyl(0.09, 0.09, 0.7, dk, 0, -1.9, -3.7, 8));                          // monopod spike
  if (hold){
    g.add(box(0.5, 1.25, 0.7, dk, 0, -1.2, -1.4));                            // pistol grip
    g.add(box(0.12, 0.5, 1.0, dk, 0, -0.65, -0.9));                           // trigger guard
    g.add(box(0.4, 0.8, 0.45, dk, 0, -0.9, 3.2));                             // forward vertical foregrip
  }
  return g;
}

// ---------- held weapons — ONE builder shared by the in-world suit AND the cockpit viewmodel ----------
// The gun you see on the suit from outside is the exact same mesh you see in the cockpit (battle.js
// mounts it scaled + turned). Weapon-local frame: origin at the hand grip, barrel toward +z.
const WEAP_DARK = mat(0x23272e, { roughness: 0.6 });
const WEAP_HEAT = new THREE.MeshStandardMaterial({ color: 0x3a1206, emissive: 0xff5a1e, emissiveIntensity: 2.4 });
const WEAP_SCOPE = new THREE.MeshStandardMaterial({ color: 0x161000, emissive: 0xffc63a, emissiveIntensity: 2.4 });
const weapMatCache = new Map(); // suit.id → materials (suit-colored main/accent + shared fixed mats)
function weaponMats(suit){
  let m = weapMatCache.get(suit.id);
  if (!m){
    const c = suit.colors || { main: 0x8a919c, accent: 0x5a4a4a };
    m = { main: mat(c.main), accent: mat(c.accent), dark: WEAP_DARK, heat: WEAP_HEAT, scope: WEAP_SCOPE };
    weapMatCache.set(suit.id, m);
  }
  return m;
}
// where shots leave the held weapon (weapon-local z) — tuned to each mesh's visible barrel tip
export function heldMuzzleZ(suit, w){
  const gmStyle = suit.style === 'gm' || suit.style === 'gundam';
  return /ANTI-MATERIEL|ARTILLERY/.test(w.name) ? 8.7
    : /GRENADE/.test(w.name) ? 3.9
    : /MISSILE/.test(w.name) ? 4.3
    : /FINGER/.test(w.name) ? 3.6
    : /HEAT ROD/.test(w.name) ? 4.9
    : /SPRAY/.test(w.name) ? 4.0
    : /MINIGUN/.test(w.name) ? 5.4
    : /100MM/.test(w.name) ? 5.8
    : /GATLING/.test(w.name) ? 6.2
    : (w.dmg > 600 || /SNIPER|SATELLITE/.test(w.name)) ? 8.7
    : w.type === 'bazooka' ? (gmStyle ? 5.6 : 4.4) : (gmStyle ? 6.2 : 5.9);
}
// held weapon, shaped to MATCH ITS NAME: sniper scope+bipod, rotary gatling, Zaku ammo drum,
// revolver grenade launcher, Dom giant bazooka, twin-barrel buster, satellite cannon, heat rod...
export function buildWeaponMesh(suit, w){
  const M = weaponMats(suit);
  const st = suit.style;
  const gmStyle = st === 'gm' || st === 'gundam';
  const gun = new THREE.Group();
  const nm = w.name || '';
  if (/ANTI-MATERIEL|ARTILLERY/.test(nm)) return amCannon(M, true); // Zaku Tank cannon (cockpit view) — same mesh as the shoulder mount
  if (w.type === 'beam'){
    if (/SPRAY/.test(nm)){ // GM beam spray gun (BOWA BR-M-79C-1): stubby, boxy, wide flared emitter (the spread)
      gun.add(box(0.85, 1.25, 2.2, M.dark, 0, 0, 0.4));                    // boxy receiver / emitter housing
      gun.add(box(0.9, 0.28, 1.5, M.main, 0, 0.72, 0.3));                  // top rib
      gun.add(box(0.5, 1.3, 0.7, M.dark, 0, -1.05, -0.5));                 // pistol grip
      gun.add(box(0.14, 0.5, 1.0, M.dark, 0, -0.6, 0.0));                  // trigger guard
      gun.add(box(0.72, 0.95, 0.9, M.accent, 0, -0.9, 0.85));             // underside e-cap magazine (wedge)
      gun.add(cyl(0.34, 0.4, 1.6, M.dark, 0, 0.15, 2.3).rotateX(Math.PI / 2)); // short fat barrel
      gun.add(cyl(0.74, 0.42, 0.7, M.dark, 0, 0.15, 3.35).rotateX(Math.PI / 2)); // WIDE FLARED emitter aperture (front-wide)
      gun.add(cyl(0.5, 0.26, 0.32, M.scope, 0, 0.15, 3.7).rotateX(Math.PI / 2)); // glowing spray emitter
      return gun;
    }
    if (/HEAT ROD/.test(nm)){ // Gouf heat rod: forearm launcher, coil rings, white-hot tip
      gun.add(box(1.25, 1.0, 2.8, M.dark, 0, 0.1, 0.9));                    // launcher body
      gun.add(box(1.35, 0.3, 2.9, M.accent, 0, 0.7, 0.9));                  // armored cover
      for (let i = 0; i < 4; i++) gun.add(cyl(0.5, 0.5, 0.18, M.main, 0, 0.1, 2.5 + i * 0.5).rotateX(Math.PI / 2)); // coil
      gun.add(cyl(0.2, 0.3, 0.9, M.dark, 0, 0.1, 4.4).rotateX(Math.PI / 2)); // rod throat
      gun.add(cyl(0.16, 0.07, 0.7, M.heat, 0, 0.1, 4.9).rotateX(Math.PI / 2)); // heated rod tip
      return gun;
    }
    const sniper = /SNIPER/.test(nm);
    const satellite = /SATELLITE/.test(nm);
    // Gundam X's SHIELD BUSTER RIFLE is a single-barrel folding rifle — not a twin-barrel buster
    const twin = /TWIN/.test(nm) || (/BUSTER/.test(nm) && !/SHIELD BUSTER/.test(nm));
    const long = sniper || w.dmg > 600;
    gun.add(box(twin ? 1.3 : 0.95, 1.5, 3.0, M.dark, 0, 0, 0.3));           // receiver
    gun.add(box(twin ? 1.36 : 1.0, 0.3, 2.6, M.main, 0, 0.85, 0.3));        // top cover
    gun.add(box(0.5, 1.4, 0.7, M.dark, 0, -1.15, -0.7));                    // pistol grip
    gun.add(box(0.12, 0.5, 1.1, M.dark, 0, -0.72, -0.15));                  // trigger guard
    gun.add(box(0.7, 1.1, 1.4, M.dark, 0, -0.2, -1.9));                     // shoulder stock
    gun.add(box(0.4, 0.9, 0.5, M.dark, 0, -0.95, 2.3));                     // vertical fore grip
    if (satellite){ // Gundam X satellite cannon: huge square-jacketed cannon + dorsal cooling fin
      gun.add(box(1.35, 1.5, 6.6, M.dark, 0, 0.25, 5.0));
      gun.add(box(0.22, 1.9, 4.2, M.main, 0, 1.6, 4.6));                    // cooling fin
      gun.add(cyl(0.62, 0.62, 0.5, M.main, 0, 0.25, 8.35).rotateX(Math.PI / 2));
      gun.add(cyl(0.5, 0.3, 0.4, M.scope, 0, 0.25, 8.7).rotateX(Math.PI / 2)); // glowing emitter maw
    } else if (twin){ // twin buster / twin beam cannon: two barrels side by side + bridge
      const bl = long ? 6.4 : 4.2, bc = long ? 5.2 : 3.6;
      for (const bx of [-0.42, 0.42]){
        gun.add(cyl(0.22, 0.26, bl, M.dark, bx, 0.25, bc).rotateX(Math.PI / 2));
        gun.add(cyl(0.36, 0.36, 0.5, M.main, bx, 0.25, bc + bl / 2 + 0.1).rotateX(Math.PI / 2)); // muzzle steps
        gun.add(cyl(0.18, 0.1, 0.3, M.scope, bx, 0.25, bc + bl / 2 + 0.45).rotateX(Math.PI / 2)); // emitters
      }
      gun.add(box(1.2, 0.25, 1.6, M.main, 0, 0.62, bc));                    // barrel bridge
    } else {
      const bl = long ? 6.8 : 4.2, bc = long ? 5.0 : 3.4;
      gun.add(cyl(0.26, 0.3, bl, M.dark, 0, 0.2, bc).rotateX(Math.PI / 2)); // barrel
      for (let i = 0; i < 3; i++)                                            // barrel shroud rings
        gun.add(cyl(0.38, 0.38, 0.2, M.main, 0, 0.2, bc + (i - 1) * bl * 0.28).rotateX(Math.PI / 2));
      gun.add(cyl(0.42, 0.42, 0.6, M.dark, 0, 0.2, bc + bl / 2 + 0.1).rotateX(Math.PI / 2)); // muzzle
      gun.add(cyl(0.2, 0.12, 0.25, M.scope, 0, 0.2, bc + bl / 2 + 0.5).rotateX(Math.PI / 2)); // beam emitter glow
    }
    gun.add(box(0.28, 0.55, 1.9, M.dark, 0, 1.25, 0.1));                    // carry handle
    gun.add(box(0.28, 0.25, 1.9, M.dark, 0, 0.78, 0.1));
    if (st === 'gundam' && !satellite) gun.add(cyl(0.5, 0.5, 1.5, M.accent, 0, 1.05, -0.4).rotateX(Math.PI / 2)); // sensor drum
    if (sniper){ // long scope + glowing eyepiece + folded bipod
      gun.add(cyl(0.5, 0.5, 1.0, M.dark, 0, 1.15, -0.9).rotateX(Math.PI / 2));
      gun.add(cyl(0.42, 0.42, 0.22, M.scope, 0, 1.15, -1.45).rotateX(Math.PI / 2));
      for (const s of [-1, 1]){ const leg = box(0.14, 1.7, 0.14, M.dark, s * 0.8, -1.0, 7.4); leg.rotation.z = s * 0.5; gun.add(leg); }
    }
    return gun;
  }
  if (w.type === 'mg'){
    if (/GATLING/.test(nm)){ // rotary gatling: motor block, housing, 4-barrel cluster, side ammo drum
      gun.add(box(1.1, 1.4, 2.8, M.dark, 0, 0, 0.2));                       // motor housing
      gun.add(box(0.5, 1.3, 0.7, M.dark, 0, -1.1, -0.6));                   // grip
      gun.add(cyl(0.62, 0.66, 1.8, M.main, 0, 0.15, 2.4).rotateX(Math.PI / 2)); // barrel housing
      gun.add(cyl(0.55, 0.55, 0.25, M.dark, 0, 0.15, 6.05).rotateX(Math.PI / 2)); // front plate
      for (let i = 0; i < 4; i++){
        const a = i * Math.PI / 2 + Math.PI / 4;
        gun.add(cyl(0.16, 0.16, 3.2, M.dark, Math.cos(a) * 0.33, 0.15 + Math.sin(a) * 0.33, 4.5).rotateX(Math.PI / 2));
      }
      gun.add(cyl(0.85, 0.85, 0.8, M.accent, 1.05, -0.5, 0.4, 12).rotateZ(Math.PI / 2)); // side ammo drum
      gun.add(box(0.6, 0.5, 1.4, M.dark, 0.6, 0.1, 0.4));                   // feed chute
      return gun;
    }
    if (/FINGER/.test(nm)){ // Gouf finger vulcans: armored gauntlet, the barrels ARE the fingers
      gun.add(box(1.7, 1.1, 2.2, M.accent, 0, 0.1, 0.6));                   // gauntlet
      gun.add(box(1.8, 0.35, 0.9, M.main, 0, 0.75, 1.4));                   // knuckle plate
      for (const bx of [-0.57, -0.19, 0.19, 0.57]){
        gun.add(cyl(0.14, 0.15, 1.9, M.dark, bx, 0.05, 2.5).rotateX(Math.PI / 2)); // finger barrels
        gun.add(cyl(0.19, 0.19, 0.2, M.main, bx, 0.05, 3.45).rotateX(Math.PI / 2)); // muzzle collars
      }
      return gun;
    }
    if (/MINIGUN/.test(nm)){ // GM Spartan minigun: 3-barrel triangular cluster + underslung handgun + grenade tubes
      gun.add(box(1.1, 1.35, 2.8, M.dark, 0, 0, 0.3));                     // chunky box receiver
      gun.add(box(1.15, 0.3, 1.8, M.main, 0, 0.75, 0.2));                  // top handguard rib
      gun.add(box(0.5, 1.3, 0.75, M.dark, 0, -1.1, -0.5));                 // pistol grip
      gun.add(box(0.5, 0.9, 0.7, M.dark, 0, -0.85, 1.7));                  // forward foregrip
      gun.add(cyl(0.62, 0.66, 1.4, M.main, 0, 0.1, 2.2).rotateX(Math.PI / 2)); // barrel shroud (rear)
      for (const [bx, by] of [[0, 0.42], [-0.36, -0.2], [0.36, -0.2]])    // 3 barrels bound in a triangle
        gun.add(cyl(0.18, 0.18, 3.2, M.dark, bx, 0.1 + by, 3.4).rotateX(Math.PI / 2));
      gun.add(cyl(0.62, 0.62, 0.3, M.dark, 0, 0.1, 5.0).rotateX(Math.PI / 2)); // slotted muzzle shroud cap
      gun.add(cyl(0.28, 0.28, 1.8, M.dark, 0, -0.75, 2.2).rotateX(Math.PI / 2)); // underslung handgun barrel
      for (const gx of [-0.3, 0, 0.3]) gun.add(cyl(0.14, 0.14, 0.7, M.accent, gx, -0.78, 1.0).rotateX(Math.PI / 2)); // 3 grenade tubes
      return gun;
    }
    if (/100MM/.test(nm)){ // ground GM/Gundam YF-MG100 100mm MG: TOP box magazine, skeletal folding wire stock, foregrip
      gun.add(box(0.7, 1.0, 3.6, M.dark, 0, 0, 0.8));                      // boxy receiver
      gun.add(box(0.55, 0.9, 1.5, M.main, 0, 1.0, -0.3));                  // TOP-mounted box magazine (stands up)
      gun.add(box(0.5, 1.05, 0.8, M.dark, 0, -1.0, -0.6));                 // pistol grip
      gun.add(box(0.14, 0.5, 1.0, M.dark, 0, -0.55, -0.15));              // trigger guard
      gun.add(box(0.4, 0.8, 0.45, M.dark, 0, -0.85, 2.4));                // forward vertical foregrip
      gun.add(cyl(0.17, 0.2, 3.2, M.dark, 0, 0.05, 3.6).rotateX(Math.PI / 2)); // medium barrel
      gun.add(cyl(0.26, 0.26, 0.3, M.dark, 0, 0.05, 5.3).rotateX(Math.PI / 2)); // muzzle
      gun.add(box(0.1, 0.35, 0.1, M.dark, 0, 0.5, 1.9));                   // front sight post
      for (const sx of [-0.35, 0.35]) gun.add(box(0.08, 0.08, 2.0, M.dark, sx, 0, -1.7)); // folding wire stock struts
      gun.add(box(0.85, 0.1, 0.1, M.dark, 0, 0, -2.6));                    // stock butt bar
      return gun;
    }
    if (gmStyle){
      // GM 90mm machine gun: slim receiver, long barrel, box magazine, top rail, slotted muzzle brake
      gun.add(box(0.55, 0.95, 4.2, M.dark, 0, 0, 1.2));                     // receiver body
      gun.add(box(0.6, 0.22, 3.4, M.main, 0, 0.55, 1.1));                   // top cover strip
      gun.add(box(0.5, 1.05, 0.8, M.dark, 0, -1.0, -0.55));                 // pistol grip
      gun.add(cyl(0.15, 0.18, 3.4, M.dark, 0, 0.18, 4.4).rotateX(Math.PI / 2)); // long thin barrel
      gun.add(cyl(0.26, 0.26, 0.45, M.dark, 0, 0.18, 6.2).rotateX(Math.PI / 2)); // muzzle brake
      gun.add(box(0.5, 0.1, 0.12, M.main, 0, 0.18, 6.2));                   // brake slots
      gun.add(box(0.52, 1.5, 1.05, M.dark, 0, -1.05, 1.9));                 // box magazine
      gun.add(box(0.34, 0.5, 2.0, M.dark, 0, 0.78, 0.7));                   // top scope / carry rail
      gun.add(box(0.4, 0.75, 0.45, M.dark, 0, -0.8, 3.1));                  // vertical foregrip
      gun.add(box(0.1, 0.5, 0.1, M.dark, 0, 0.6, 5.6));                     // front sight post
    } else {
      // Zaku 120mm: drum magazine, conical flash hider, hooded front sight, shoulder stock
      gun.add(box(1.0, 1.5, 4.2, M.dark, 0, 0, 1.0));                       // receiver
      gun.add(box(1.06, 0.3, 3.2, M.main, 0, 0.75, 0.9));                   // top cover
      gun.add(cyl(0.9, 0.9, 0.9, M.dark, 0, -1.2, 1.4, 12).rotateX(Math.PI / 2)); // drum mag
      gun.add(cyl(0.95, 0.95, 0.12, M.main, 0, -1.2, 1.85, 12).rotateX(Math.PI / 2)); // drum face plate
      gun.add(cyl(0.24, 0.24, 2.6, M.dark, 0, 0.2, 4.2).rotateX(Math.PI / 2)); // barrel
      gun.add(cyl(0.42, 0.2, 0.6, M.dark, 0, 0.2, 5.6).rotateX(Math.PI / 2)); // conical flash hider
      gun.add(box(0.12, 0.55, 0.12, M.dark, 0, 0.65, 4.9));                 // front sight post
      gun.add(box(0.5, 0.14, 0.3, M.dark, 0, 0.95, 4.9));                   // sight hood
      gun.add(box(0.4, 0.9, 1.6, M.dark, 0, 0.4, -1.3));                    // stock
    }
    return gun;
  }
  // ---- bazooka family ----
  if (/GRENADE/.test(nm)){ // stubby revolver grenade launcher
    gun.add(cyl(0.5, 0.5, 2.4, M.dark, 0, 0.2, 2.4).rotateX(Math.PI / 2));  // short tube
    gun.add(cyl(0.62, 0.5, 0.5, M.main, 0, 0.2, 3.6).rotateX(Math.PI / 2)); // muzzle ring
    gun.add(cyl(0.85, 0.85, 1.3, M.accent, 0, 0.2, 0.6, 12).rotateX(Math.PI / 2)); // revolver cylinder
    for (let i = 0; i < 5; i++){
      const a = i * Math.PI * 2 / 5;
      gun.add(cyl(0.2, 0.2, 1.4, M.dark, Math.cos(a) * 0.5, 0.2 + Math.sin(a) * 0.5, 0.6).rotateX(Math.PI / 2)); // chambers
    }
    gun.add(box(0.5, 1.3, 0.7, M.dark, 0, -1.0, -0.4));                     // grip
    gun.add(box(0.6, 1.0, 1.5, M.dark, 0, -0.1, -1.6));                     // stock
    return gun;
  }
  if (/MISSILE/.test(nm)){ // hand missile pod: 2×2 tubes with the warhead noses visible
    gun.add(box(1.8, 1.8, 3.2, M.dark, 0, 0.2, 2.2));                       // pod
    gun.add(box(1.9, 0.3, 3.3, M.main, 0, 1.2, 2.2));                       // top armor
    for (const [mx, my] of [[-0.45, 0.62], [0.45, 0.62], [-0.45, -0.22], [0.45, -0.22]]){
      gun.add(cyl(0.3, 0.3, 0.3, M.main, mx, my, 3.85).rotateX(Math.PI / 2)); // tube lips
      gun.add(cone(0.22, 0.55, M.accent, mx, my, 4.0).rotateX(Math.PI / 2)); // missile noses
    }
    gun.add(box(0.5, 1.2, 0.7, M.dark, 0, -1.0, 0.6));                      // grip
    return gun;
  }
  const giant = /GIANT/.test(nm);
  if (gmStyle){
    // GM hyper bazooka: long fat tube, wide front muzzle, rear cap, top box sight w/ glowing lens
    gun.add(cyl(0.6, 0.6, 7.6, M.dark, 0, 0.3, 0.9).rotateX(Math.PI / 2));  // main tube
    gun.add(cyl(0.92, 0.74, 1.1, M.dark, 0, 0.3, 4.9).rotateX(Math.PI / 2)); // wide muzzle flare
    gun.add(cyl(0.7, 0.7, 1.1, M.dark, 0, 0.3, -3.0).rotateX(Math.PI / 2)); // rear cap
    gun.add(cyl(0.66, 0.66, 0.3, M.accent, 0, 0.3, 2.4).rotateX(Math.PI / 2)); // barrel band
    gun.add(box(1.0, 0.7, 1.8, M.dark, 0, 1.0, 0.4));                       // top box sight / magazine
    gun.add(cyl(0.16, 0.16, 0.1, M.scope, 0, 1.15, -0.6).rotateX(Math.PI / 2)); // sight lens
    gun.add(box(0.6, 1.15, 0.65, M.dark, 0, -0.75, 0.7));                   // pistol grip
    gun.add(box(0.42, 0.75, 0.5, M.dark, 0, -0.62, 2.6));                   // fore grip
  } else {
    // Zeon bazooka — the Dom's GIANT version is visibly fatter and longer
    const r = giant ? 0.8 : 0.62, len = giant ? 7.4 : 6.6, zc = giant ? 0.5 : 0.6;
    gun.add(cyl(r, r, len, M.dark, 0, 0.3, zc).rotateX(Math.PI / 2));       // main tube
    gun.add(cyl(r + 0.16, r + 0.16, 1.2, M.accent, 0, 0.3, zc + len / 2 - 0.7).rotateX(Math.PI / 2)); // muzzle ring
    gun.add(cyl(r + 0.08, r + 0.2, 0.9, M.dark, 0, 0.3, zc - len / 2 + 0.3).rotateX(Math.PI / 2)); // rear exhaust
    gun.add(box(0.7, 0.55, 1.3, M.dark, 0, r + 0.75, 0.2));                 // top sight block
    gun.add(cyl(0.15, 0.15, 0.1, M.scope, 0, r + 0.85, -0.5).rotateX(Math.PI / 2)); // sight lens
    gun.add(box(0.6, 1.1, 1.4, M.dark, 0, -0.7, 0.2));                      // grip block
  }
  return gun;
}

// ---------- ground vehicles (built at MS proportions, suit.scale shrinks) ----------
function buildTank(suit, M){
  const root = new THREE.Group();
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };
  const magella = suit.id === 'magella';

  // running gear: treads with fenders and a sloped glacis up front
  for (const sx of [-1, 1]){
    root.add(box(3.2, 3.4, 13.0, M.dark, sx * 3.7, 1.7, 0));
    root.add(box(2.8, 0.9, 13.6, M.accent, sx * 3.7, 3.6, 0));
    root.add(cyl(1.5, 1.5, 3.0, M.dark, sx * 3.7, 1.7, 6.4, 12).rotateZ(Math.PI / 2)); // idler wheel hint
  }
  root.add(box(6.6, 2.6, 11.0, M.main, 0, 4.4, -0.4));                       // hull
  const glacis = box(6.2, 1.9, 3.6, M.main, 0, 4.1, 6.0);
  glacis.rotation.x = 0.42; root.add(glacis);                                // sloped front armor
  root.add(box(5.4, 1.0, 3.6, M.accent, 0, 5.8, -3.8));                      // engine deck
  root.add(box(0.5, 0.9, 0.5, M.dark, -2.6, 6.0, -5.2));                     // exhaust stack
  root.add(box(0.5, 0.9, 0.5, M.dark, 2.6, 6.0, -5.2));

  const turret = new THREE.Group();
  if (magella){
    // Magella Top: tall pedestal turret, high-mounted 175mm, VTOL wing stubs
    root.add(box(3.2, 2.4, 3.6, M.main, 0, 6.8, 0.6));                       // pedestal riser
    turret.position.set(0, 9.0, 0.6);
    turret.add(box(4.6, 2.2, 5.2, M.main, 0, 0, 0));
    turret.add(box(2.0, 0.5, 2.8, M.accent, -3.2, 0.4, -0.3));               // wing stubs
    turret.add(box(2.0, 0.5, 2.8, M.accent, 3.2, 0.4, -0.3));
    const gun = cyl(0.36, 0.44, 10.0, M.dark, 0, 0.5, 6.6).rotateX(Math.PI / 2);
    gun.rotation.x += -0.05; turret.add(gun);                                // 175mm, slightly elevated
    turret.add(box(1.4, 0.9, 1.4, M.dark, 0, 1.5, -1.4));                    // commander cupola
    turret.add(sph(0.46, M.eye, 0, 0.6, 2.7));                               // optics
  } else {
    // Type 61: long low turret, twin side-by-side 155mm cannons
    turret.position.set(0, 6.6, -0.4);
    turret.add(box(5.6, 1.9, 6.6, M.main, 0, 0, -0.4));
    turret.add(box(3.4, 1.3, 2.6, M.main, 0, 0.2, -3.9));                    // bustle
    for (const sx of [-0.85, 0.85])
      turret.add(cyl(0.3, 0.36, 9.0, M.dark, sx, 0.25, 7.0, 8).rotateX(Math.PI / 2));
    turret.add(box(1.3, 0.8, 1.3, M.dark, -1.4, 1.3, -1.6));                 // cupola
    turret.add(sph(0.42, M.eye, 0, 0.5, 2.6));                               // optics
  }
  root.add(turret); parts.turret = turret;

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, magella ? 0.5 : 0.25, magella ? 11.8 : 11.6);
  turret.add(muzzle); parts.muzzle = muzzle;
  const eye = new THREE.Object3D(); eye.position.set(0, 0.6, 2.8);
  turret.add(eye); parts.eye = eye;
  const head = new THREE.Object3D(); head.position.set(0, magella ? 10.6 : 8.4, 0.4);
  root.add(head); parts.head = head;

  for (const sx of [-1, 1]){                                                 // exhaust glow
    const fl = cone(0.5, 2.2, M.flame, sx * 2.6, 2.6, -7.2);
    fl.rotation.x = -Math.PI / 2; fl.scale.y = 0.01;
    root.add(fl); parts.flames.push(fl);
  }
  const blade = cyl(0.3, 0.3, 6, M.blade, 0, 4.8, 6.5);
  blade.rotation.x = Math.PI / 2; blade.visible = false;
  root.add(blade); parts.blade = blade;
  parts.eyeMat = M.eye;
  root.scale.setScalar(suit.scale);
  return { root, parts };
}

// ---------- retired pre-Type-B placeholder (kept only for easy historical comparison) ----------
// This dark crane/rifle concept is no longer routed by buildMech; RTX-440-B lives in guntankmk2.js.
// It used a DARK hull on TRIANGULAR track units, a raised pedestal carrying an
// angular turret with a left gatling pod + right cylindrical pod w/ ribbed cables, twin red-capped
// drums on the rear deck, antenna whips and a front dozer blade. The one FUNCTIONAL weapon is the
// oversized anti-materiel RIFLE (the user's rifle reference) as the main gun; the pods are cosmetic.
function buildCraneLegacy(suit, M){
  const PI = Math.PI;
  const root = new THREE.Group();
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };
  const body = M.main, steel = M.accent, dk = M.dark, trim = M.trim;
  const tan = new THREE.MeshStandardMaterial({ color: 0x8a8258, roughness: 0.7, metalness: 0.2 });   // rifle receiver 'dark-earth' (per the rifle reference)
  const rubber = new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.9 });                // grey cheek / butt pad
  const red = new THREE.MeshStandardMaterial({ color: 0x9c3a2e, roughness: 0.55, metalness: 0.3 });  // red drum caps
  const black = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.85, metalness: 0.15 }); // black tracks / barrel

  // ============ TRIANGULAR TWIN-TRACK SYSTEM ============
  // each side's track is an upright TRIANGLE (side profile): a flat bottom run of road wheels + two
  // slopes rising to a high top drive-sprocket apex. Built from an extruded triangular belt (black).
  for (const sx of [-1, 1]){
    const T = new THREE.Group(); T.position.set(sx * 6.3, 0.2, 0); root.add(T);
    const shape = new THREE.Shape();                                          // outer triangle
    shape.moveTo(-9.6, 0); shape.lineTo(9.6, 0); shape.lineTo(0, 9.4); shape.closePath();
    const hole = new THREE.Path();                                            // inner cutout → a track BELT ring
    hole.moveTo(-6.4, 1.9); hole.lineTo(6.4, 1.9); hole.lineTo(0, 6.5); hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 4.8, bevelEnabled: false });
    g.translate(0, 0, -2.4); g.rotateY(PI / 2);                              // extrude axis → track width (x)
    T.add(new THREE.Mesh(g, black));                                          // black triangular track belt
    for (let z = -9; z <= 9; z += 1.4) T.add(box(4.9, 0.55, 0.7, black, 0, -0.15, z)); // tread lugs on the bottom run
    T.add(cyl(2.2, 2.2, 5.2, steel, 0, 9.0, 0, 12).rotateZ(PI / 2));         // top drive sprocket (apex)
    T.add(cyl(0.55, 0.55, 5.3, black, 0, 9.0, 0, 8).rotateZ(PI / 2));        // sprocket hub
    for (const zz of [-9.0, 9.0]) T.add(cyl(2.2, 2.2, 5.0, steel, 0, 1.7, zz, 14).rotateZ(PI / 2)); // corner idlers
    for (const rz of [-5.7, -1.9, 1.9, 5.7]) T.add(cyl(1.9, 1.9, 5.1, steel, 0, 1.4, rz, 12).rotateZ(PI / 2)); // road wheels
  }

  // ============ CENTRAL ARMOURED HULL (slung between the triangular tracks) ============
  root.add(box(9.8, 4.6, 16.6, body, 0, 3.3, 0));                           // lower hull belly
  root.add(box(8.4, 3.2, 15.0, body, 0, 6.9, 0));                           // upper hull
  root.add(box(7.4, 0.9, 13.6, steel, 0, 8.7, 0));                          // top deck plate
  root.add(box(5.4, 0.4, 9.0, black, 0, 9.2, 1.0));                         // deck hatch panels
  root.add(box(2.2, 0.7, 2.2, black, 2.2, 9.3, -3.5));                      // deck hatch/vent
  const glacis = box(9.6, 3.6, 3.2, body, 0, 4.4, 8.8); glacis.rotation.x = 0.5; root.add(glacis); // sloped front glacis
  for (const sz of [-1, 1]) root.add(box(6.0, 0.6, 1.4, black, 0, 2.6, sz * -7.6)); // trim strakes

  // ---- front DOZER BLADE (reference bottom view): wide blade on twin push-arms ahead of the tracks ----
  for (const sx of [-1, 1]){ const arm = box(1.3, 1.3, 5.2, dk, sx * 3.4, 3.0, 9.6); arm.rotation.x = 0.18; root.add(arm); }
  const blade9 = box(15.4, 4.6, 1.2, body, 0, 3.2, 12.4); blade9.rotation.x = -0.22; root.add(blade9); // blade face
  root.add(box(15.6, 1.0, 1.6, steel, 0, 5.3, 12.0));                       // top lip
  root.add(box(15.0, 1.0, 0.9, black, 0, 1.2, 12.8));                       // cutting edge
  for (const rx of [-6.0, -2.0, 2.0, 6.0]) root.add(box(0.8, 3.4, 0.6, dk, rx, 3.3, 11.9)); // reinforcing ribs

  // ============ RAISED PEDESTAL (the 'crane' waist the turret rides on) ============
  root.add(box(5.6, 3.6, 6.4, dk, 0, 10.6, -0.5));                          // pedestal column
  root.add(box(6.6, 1.0, 7.4, steel, 0, 12.4, -0.5));                       // pedestal cap ring

  // ============ CENTRAL ANGULAR TURRET (rides high on the pedestal) ============
  const tur = new THREE.Group(); tur.position.set(0, 12.8, -0.5); root.add(tur);
  tur.add(box(8.4, 6.2, 9.4, body, 0, 3.0, 0));                             // turret mass
  const face = box(7.8, 5.4, 1.0, steel, 0, 2.8, 4.5); face.rotation.x = 0.3; tur.add(face); // sloped faceplate
  tur.add(box(3.0, 2.4, 0.4, dk, 1.7, 3.0, 5.0));                           // face access panel
  tur.add(box(1.6, 1.6, 0.35, M.gold, -2.5, 3.3, 5.1));                     // gold emblem crest
  tur.add(box(8.6, 1.0, 9.6, steel, 0, 6.2, 0));                            // turret roof plate
  tur.add(cyl(1.1, 1.3, 1.5, dk, 2.4, 7.0, -1.8, 12));                      // commander cupola
  tur.add(box(1.0, 0.5, 0.35, M.eye, 2.4, 7.1, -0.6));                      // cupola optic (glow)

  // ---- MAIN GUN: the oversized anti-materiel RIFLE (user's reference), left side, angled up ----
  const gunG = new THREE.Group(); gunG.position.set(-2.7, 3.0, 3.4); gunG.rotation.x = -0.2; tur.add(gunG);
  gunG.add(box(3.0, 3.0, 2.2, dk, 0, 0, 0));                                // mantlet
  gunG.add(box(2.3, 2.5, 6.0, tan, 0, 0, 3.8));                            // receiver
  gunG.add(box(1.6, 2.4, 1.6, dk, 0, -2.2, 2.0));                          // pistol grip
  gunG.add(box(2.0, 2.0, 7.6, tan, 0, 0.25, 9.8));                         // perforated handguard
  for (let i = 0; i < 5; i++) gunG.add(cyl(0.42, 0.42, 2.1, dk, 0, 0.25, 7.0 + i * 1.35, 10).rotateZ(PI / 2)); // round cutouts
  gunG.add(box(0.9, 0.55, 7.6, dk, 0, 1.45, 9.8));                         // top rail
  gunG.add(box(1.9, 2.4, 2.6, dk, 0, -0.2, -2.6));                         // buttstock over the turret
  gunG.add(box(2.0, 0.9, 2.2, rubber, 0, 1.2, -2.4));                      // cheek riser
  gunG.add(cyl(0.5, 0.64, 11.5, black, 0, 0.25, 19.0, 12).rotateX(PI / 2)); // long barrel (black)
  gunG.add(box(1.8, 1.5, 2.4, black, 0, 0.25, 25.6));                      // muzzle brake
  gunG.add(box(2.0, 1.7, 0.5, steel, 0, 0.25, 27.0));                      // brake face
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.25, 27.4); gunG.add(muzzle); parts.muzzle = muzzle;

  // ---- LEFT GATLING pod (cosmetic) — big multi-barrel cluster standing proud off the front-left ----
  tur.add(box(2.0, 2.0, 3.4, dk, -4.4, 2.0, 4.0));                         // mounting arm off the turret face
  const podL = new THREE.Group(); podL.position.set(-4.7, 1.9, 7.0); tur.add(podL);
  podL.add(cyl(2.5, 2.7, 4.6, steel, 0, 0, 0, 16).rotateX(PI / 2));        // drum housing (lighter, so it reads)
  podL.add(cyl(2.65, 2.65, 0.7, dk, 0, 0, 2.5, 16).rotateX(PI / 2));       // muzzle face ring
  podL.add(cyl(0.4, 0.44, 5.2, black, 0, 0, 3.2).rotateX(PI / 2));         // center barrel
  for (let i = 0; i < 6; i++){ const a = i / 6 * PI * 2;                   // 6-barrel gatling ring
    podL.add(cyl(0.4, 0.44, 5.2, black, Math.cos(a) * 1.35, Math.sin(a) * 1.35, 3.2).rotateX(PI / 2)); }
  podL.add(cyl(1.0, 1.0, 0.5, dk, 0, 0, 5.9, 10).rotateX(PI / 2));         // barrel clamp plate

  // ---- RIGHT cylindrical weapon pod + ribbed cables (cosmetic) — big drum standing proud front-right ----
  tur.add(box(2.4, 2.4, 3.4, dk, 4.4, 1.8, 3.6));                          // mounting arm
  const podR = new THREE.Group(); podR.position.set(4.6, 1.7, 6.8); tur.add(podR);
  podR.add(cyl(2.9, 3.1, 7.2, steel, 0, 0, 0, 16).rotateX(PI / 2));        // big drum (lighter)
  podR.add(cyl(3.05, 3.05, 0.9, dk, 0, 0, 3.0, 16).rotateX(PI / 2));       // front cap ring
  for (const [bx, by] of [[-0.75, 0.35], [0.75, 0.35]])
    podR.add(cyl(0.38, 0.42, 4.4, dk, bx, by, 4.0).rotateX(PI / 2));       // twin barrels
  for (const oz of [-3.8, -1.6]){ const c = ribbedCable(5.6, 0.34, dk); c.position.set(2.6, 0.3, oz); c.rotation.set(0.35, 0, 0.7); podR.add(c); } // hoses to the turret

  // ---- twin red-capped drums on the rear deck ----
  for (const sx of [-1, 1]){
    tur.add(cyl(1.5, 1.5, 5.2, dk, sx * 2.3, 6.5, -2.6, 12).rotateX(PI / 2));    // drum body
    tur.add(cyl(1.62, 1.62, 1.0, red, sx * 2.3, 6.5, -0.2, 12).rotateX(PI / 2)); // red front cap
    tur.add(cyl(1.62, 1.62, 1.0, red, sx * 2.3, 6.5, -5.0, 12).rotateX(PI / 2)); // red rear cap
  }
  // ---- antenna whips ----
  for (const sx of [-1, 1]) tur.add(cyl(0.05, 0.05, 15, steel, sx * 2.6, 12, -3.2, 5));

  // ---- anchors the engine expects ----
  for (const sx of [-1, 1]){ const fl = cone(0.55, 2.4, M.flame, sx * 3.2, 4.0, -10.4); fl.rotation.x = -PI / 2; fl.scale.y = 0.01; root.add(fl); parts.flames.push(fl); }
  const eye = new THREE.Object3D(); eye.position.set(2.4, 19.9, -1.6); root.add(eye); parts.eye = eye;
  const head = new THREE.Object3D(); head.position.set(0, 19.0, -0.5); root.add(head); parts.head = head;
  const blade = cyl(0.3, 0.3, 6, M.blade, 0, 6, 6.5); blade.rotation.x = PI / 2; blade.visible = false; root.add(blade); parts.blade = blade;
  parts.eyeMat = M.eye;
  root.scale.setScalar(suit.scale);
  return { root, parts };
}

// ---------- Guntank MK-I: big fast fire-support guntank (Guntank Early Type, light grey) ----------
// Built to the user's reference: a beefy tank chassis with BIG round end wheels bulging past the
// fenders, an MS torso with the classic visored Guntank head, TWO long artillery cannons angled up
// over the shoulders (the arc back-artillery — parts.turret elevates the bank, parts.muzzle at a
// barrel tip), and a quad-barrel autocannon pod on each arm (parts.muzzles alternate L/R).
function buildGuntankMk1(suit, M){
  const PI = Math.PI;
  const root = new THREE.Group();
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };
  const body = M.main, mid = M.accent, dk = M.dark, chest = M.chest;
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.85, metalness: 0.15 }); // tracks / barrels

  // ---- tracks: big round end wheels + road wheels under a high fender ----
  for (const sx of [-1, 1]){
    const T = new THREE.Group(); T.position.set(sx * 5.4, 0, 0); root.add(T);
    T.add(box(4.4, 4.8, 17.2, black, 0, 2.9, 0));                            // track band
    T.add(cyl(3.3, 3.3, 4.6, mid, 0, 3.3, 8.8, 18).rotateZ(PI / 2));         // big front wheel (bulges past the band)
    T.add(cyl(1.1, 1.1, 4.8, dk, 0, 3.3, 8.8, 10).rotateZ(PI / 2));          // front hub
    T.add(cyl(3.3, 3.3, 4.6, mid, 0, 3.3, -8.8, 18).rotateZ(PI / 2));        // big rear wheel
    T.add(cyl(1.1, 1.1, 4.8, dk, 0, 3.3, -8.8, 10).rotateZ(PI / 2));         // rear hub
    for (const rz of [-5.2, -2.6, 0, 2.6, 5.2])                              // road wheels along the bottom run
      T.add(cyl(1.6, 1.6, 4.7, mid, 0, 1.6, rz, 12).rotateZ(PI / 2));
    T.add(box(4.9, 1.4, 15.0, body, 0, 5.8, 0));                             // fender
    T.add(box(4.3, 1.0, 3.6, dk, 0, 6.9, -5.6));                             // fender stowage box
  }

  // ---- hull between the tracks ----
  root.add(box(7.4, 4.6, 15.6, body, 0, 4.5, 0));                            // hull
  const glacis = box(7.2, 3.2, 3.6, chest, 0, 4.7, 8.2); glacis.rotation.x = 0.5; root.add(glacis); // sloped glacis
  root.add(box(6.6, 1.0, 13.2, mid, 0, 7.1, -0.4));                          // deck plate
  root.add(box(3.0, 0.6, 2.4, dk, 1.6, 7.6, 4.2));                           // driver hatch
  root.add(box(2.0, 0.5, 2.0, dk, -2.2, 7.6, 4.0));                          // second hatch

  // ---- waist pedestal + MS torso ----
  root.add(box(5.0, 2.4, 5.4, dk, 0, 8.6, -0.6));                            // waist joint block
  root.add(cyl(3.0, 3.4, 1.2, mid, 0, 10.0, -0.6, 14));                      // turntable ring
  root.add(box(8.6, 4.4, 6.0, body, 0, 12.3, -0.6));                         // chest
  const plate = box(7.4, 2.6, 1.2, chest, 0, 12.9, 2.3); plate.rotation.x = -0.25; root.add(plate); // angled chest plate
  root.add(box(1.5, 1.5, 0.4, M.gold, -2.3, 12.7, 2.9));                     // Fed emblem
  root.add(box(2.3, 1.1, 0.5, dk, 1.8, 11.5, 2.8));                          // cockpit hatch
  for (const sx of [-1, 1]) root.add(box(2.8, 3.8, 4.8, mid, sx * 5.5, 12.5, -0.8)); // shoulder blocks

  // ---- Guntank head: boxy helmet + green visor strip ----
  root.add(cyl(1.5, 1.8, 1.0, dk, 0, 14.9, -0.2, 10));                       // neck
  root.add(box(3.1, 2.3, 3.4, body, 0, 16.2, 0));                            // helmet
  root.add(box(3.2, 0.9, 0.5, black, 0, 16.3, 1.7));                         // visor recess
  root.add(box(2.6, 0.55, 0.45, M.eye, 0, 16.3, 1.82));                      // glowing visor
  root.add(box(1.5, 0.6, 1.4, mid, 0, 17.5, -0.4));                          // sensor bump
  root.add(box(3.3, 0.5, 2.2, chest, 0, 15.2, 0.6));                         // chin guard

  // ---- TWIN LONG BACK CANNONS on an elevating bank (parts.turret; the arc artillery) ----
  const bank = new THREE.Group(); bank.position.set(0, 14.6, -1.8); root.add(bank); parts.turret = bank;
  for (const sx of [-1, 1]){
    const c = new THREE.Group(); c.position.set(sx * 3.5, 0, 0); c.rotation.x = -0.6; bank.add(c); // angled up over the shoulder
    c.add(box(2.0, 2.2, 4.0, dk, 0, -0.2, -0.8));                            // breech block
    c.add(cyl(0.72, 0.85, 4.0, mid, 0, 0, 2.6, 10).rotateX(PI / 2));         // barrel root sleeve
    c.add(cyl(0.5, 0.66, 16.0, black, 0, 0, 12.0, 12).rotateX(PI / 2));      // long barrel
    c.add(cyl(0.74, 0.74, 1.5, mid, 0, 0, 19.6, 10).rotateX(PI / 2));        // muzzle collar
    if (sx === 1){ const mz = new THREE.Object3D(); mz.position.set(0, 0, 20.6); c.add(mz); parts.muzzle = mz; }
  }
  bank.add(box(5.4, 1.6, 2.6, dk, 0, 0.2, -0.4));                            // cross-yoke between the trunnions

  // ---- ARM PODS: a quad-barrel autocannon drum on each side (the MG weapon; muzzles alternate) ----
  parts.muzzles = [];
  for (const sx of [-1, 1]){
    const A = new THREE.Group(); A.position.set(sx * 7.2, 12.3, 0.2); root.add(A);
    A.add(sph(1.5, dk, 0, 0.3, 0));                                          // shoulder joint
    A.add(box(1.9, 1.9, 2.4, body, sx * 0.3, -0.6, 1.0));                    // short arm
    A.add(cyl(1.9, 2.05, 3.8, mid, sx * 0.4, -0.9, 3.2, 14).rotateX(PI / 2));// pod drum
    A.add(cyl(2.0, 2.0, 0.6, black, sx * 0.4, -0.9, 5.2, 14).rotateX(PI / 2)); // muzzle face plate
    for (const [bx, by] of [[-0.8, 0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8]])
      A.add(cyl(0.3, 0.34, 3.6, black, sx * 0.4 + bx, -0.9 + by, 6.0).rotateX(PI / 2)); // 4 barrels
    const mz = new THREE.Object3D(); mz.position.set(sx * 0.4, -0.9, 7.9); A.add(mz); parts.muzzles.push(mz);
  }
  // The arm pods and the back artillery are different weapons.  Keep their
  // banks explicit so selecting the cannon can never fall back to an arm tip.
  parts.weaponMuzzles = [parts.muzzles, [parts.muzzle]];

  // ---- anchors the engine expects ----
  for (const sx of [-1, 1]){ const fl = cone(0.55, 2.4, M.flame, sx * 2.8, 3.6, -8.6); fl.rotation.x = -PI / 2; fl.scale.y = 0.01; root.add(fl); parts.flames.push(fl); }
  const eye = new THREE.Object3D(); eye.position.set(0, 16.3, 1.9); root.add(eye); parts.eye = eye;
  const headA = new THREE.Object3D(); headA.position.set(0, 16.2, 0); root.add(headA); parts.head = headA;
  const blade = cyl(0.3, 0.3, 6, M.blade, 0, 6, 6.5); blade.rotation.x = PI / 2; blade.visible = false; root.add(blade); parts.blade = blade;
  parts.eyeMat = M.eye;
  root.scale.setScalar(suit.scale);
  return { root, parts };
}

// ---------- aircraft (fighters): a delta/winged jet, nose forward (+Z) ----------
// Built at MS-comparable bulk, suit.scale shrinks it. Anchors: muzzle (nose),
// eye (cockpit), flames (engine exhaust). No legs/arms/head/blade.
function buildFighter(suit, M){
  const root = new THREE.Group();
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null, turret: null };
  const body = new THREE.Group(); root.add(body);              // banking body (rolls/pitches in flight)
  parts.body = body;
  // tinted cockpit glass (purple-ish FED, blue-ish Zeon)
  const glass = new THREE.MeshStandardMaterial({ color: suit.faction === 'ZEON' ? 0x24405e : 0x2b2746, emissive: 0x6678b4, emissiveIntensity: 0.4, roughness: 0.18, metalness: 0.5, transparent: true, opacity: 0.82 });
  const addFlame = (x, y, z, r = 0.8, len = 3.2) => { const fl = cone(r, len, M.flame, x, y, z); fl.rotation.x = -Math.PI / 2; fl.scale.y = 0.01; body.add(fl); parts.flames.push(fl); };
  const swept = (mesh, sx, ang = 0.32) => { mesh.rotation.y = sx * -ang; body.add(mesh); return mesh; };

  switch (suit.id){
    case 'saberfish5000': { // EFSF white/blue twin-body, big wings, engine cluster, twin canopies, forked nose
      body.add(box(3.0, 2.4, 13, M.main, 0, 0, -1));
      body.add(box(3.2, 0.7, 12, M.chest, 0, -1.05, -1));                  // blue belly spine
      for (const sx of [-1, 1]){                                          // forked nose prongs
        const p = box(1.2, 1.3, 6, M.main, sx * 1.15, -0.2, 7); p.rotation.y = sx * 0.05; body.add(p);
        body.add(cone(0.62, 2.4, M.chest, sx * 1.15, -0.2, 10.3).rotateX(Math.PI / 2));
      }
      for (const sx of [-1, 1]) body.add(box(2.4, 2.2, 11, M.main, sx * 3.7, -0.1, -1.5)); // outboard engine bodies
      for (const sx of [-1, 1]){                                          // twin canopies
        body.add(box(1.5, 1.0, 3.4, M.main, sx * 0.95, 0.9, 3.4));
        body.add(box(1.05, 0.6, 2.5, glass, sx * 0.95, 1.42, 3.6));
      }
      for (const sx of [-1, 1]){                                          // big swept wings
        swept(box(11, 0.6, 7, M.main, sx * 7.8, -0.1, -2.5), sx);
        swept(box(11, 0.62, 1.7, M.chest, sx * 7.8, -0.06, -5), sx);      // blue trailing edge
        swept(box(0.6, 1.3, 4.4, M.accent, sx * 12.6, 0.2, -3.4), sx);    // orange tip
      }
      body.add(box(0.55, 5.0, 5, M.main, 0, 2.8, -5.8));                  // tall swept tail
      body.add(box(0.6, 1.4, 4.4, M.chest, 0, 4.9, -6.6));               // blue tail cap
      for (const [ex, ey] of [[-1.0, 0.5], [1.0, 0.5], [-1.0, -0.6], [1.0, -0.6]]) // engine cluster
        body.add(cyl(0.55, 0.62, 1.6, M.dark, ex, ey, -8).rotateX(Math.PI / 2));
      addFlame(-1.0, -0.05, -9.4, 0.7, 3.0); addFlame(1.0, -0.05, -9.4, 0.7, 3.0);
      break;
    }
    case 'saberfish': { // sleeker grey twin-body, long pointed nose, yellow-glass canopies, single tail
      body.add(box(2.4, 2.0, 12, M.main, 0, 0, -1));
      body.add(cone(1.05, 8, M.main, 0, -0.2, 9).rotateX(Math.PI / 2));    // long pointed nose
      for (const sx of [-1, 1]) body.add(box(1.7, 1.7, 10, M.main, sx * 2.9, -0.05, -2)); // slim nacelles
      for (const sx of [-1, 1]){                                          // twin yellow canopies
        body.add(box(1.3, 0.9, 3.0, M.main, sx * 0.85, 0.8, 3.0));
        body.add(box(0.95, 0.55, 2.2, M.trim, sx * 0.85, 1.25, 3.2));
      }
      for (const sx of [-1, 1]){
        swept(box(9, 0.5, 6, M.main, sx * 6.4, 0, -2), sx, 0.3);
        swept(box(0.5, 1.0, 3.4, M.accent, sx * 10.4, 0.1, -2.5), sx, 0.3); // red wingtip
      }
      body.add(box(0.45, 3.6, 3.4, M.main, 0, 2.1, -5.6));               // single tail
      body.add(box(0.5, 1.0, 3.0, M.chest, 0, 3.7, -6.2));
      for (const sx of [-1, 1]){ body.add(cyl(0.85, 0.95, 3, M.dark, sx * 1.3, -0.1, -7).rotateX(Math.PI / 2)); addFlame(sx * 1.3, -0.1, -9, 0.72, 3.0); }
      break;
    }
    case 'flymanta': { // tan stealth jet, blended body, bubble canopy, dorsal humps, outward twin tails, orange tips
      body.add(box(5.5, 1.5, 11, M.main, 0, 0, -1));                      // wide flat body
      body.add(cone(2.2, 6, M.main, 0, -0.15, 8).rotateX(Math.PI / 2));   // chiseled nose
      body.add(box(1.6, 1.3, 3.2, M.main, 0, 0.7, 3.5));                  // canopy hump
      body.add(box(1.2, 0.7, 2.4, glass, 0, 1.25, 3.7));                  // bubble canopy
      for (const sx of [-1, 1]) body.add(box(1.6, 1.1, 6, M.main, sx * 1.6, 0.7, -1.5)); // two dorsal engine humps
      for (const sx of [-1, 1]){                                          // blended swept wings + orange tip
        swept(box(9, 0.5, 8, M.main, sx * 6.5, -0.1, -1.5), sx, 0.4);
        swept(box(1.2, 0.55, 5, M.accent, sx * 10.8, 0, -1.5), sx, 0.4);
      }
      for (const sx of [-1, 1]){                                          // twin tails canted OUTWARD
        const t = box(0.45, 3.4, 3.2, M.main, sx * 1.8, 1.8, -5.5); t.rotation.z = sx * -0.5; body.add(t);
      }
      for (const sx of [-1, 1]){ body.add(box(1.3, 1.0, 1.4, M.dark, sx * 1.6, 0.4, -5)); addFlame(sx * 1.6, 0.4, -6.2, 0.6, 2.6); }
      break;
    }
    case 'dopp': { // green insect-craft, bubble canopy, round dotted engine face, forked lightning-bolt tails
      body.add(cyl(2.2, 1.6, 7, M.main, 0, 0, 0).rotateX(Math.PI / 2));   // bulbous central pod (tapers back)
      body.add(sph(2.2, M.main, 0, 0.5, 2.0));                            // rounded forward shell
      for (const [cx, cz] of [[-0.8, 3.0], [0.8, 3.0], [-0.8, 1.6], [0.8, 1.6]])
        body.add(box(1.0, 0.5, 1.0, glass, cx, 1.5, cz));               // four canopy panes
      body.add(cyl(1.7, 1.7, 1.6, M.dark, 0, 0, -3.4).rotateX(Math.PI / 2)); // round engine face
      for (const [hx, hy] of [[-0.6, 0.4], [0.6, 0.4], [0, -0.5], [-0.6, -0.5], [0.6, -0.5]])
        body.add(cyl(0.26, 0.26, 0.5, M.dark, hx, hy, -4.1).rotateX(Math.PI / 2)); // intake dots
      for (const sx of [-1, 1]) swept(box(8, 0.4, 5, M.main, sx * 5.5, -0.4, -0.5), sx, 0.45); // swept wings
      for (const sx of [-1, 1]){                                          // forked lightning-bolt tail fins
        const a = box(0.4, 0.9, 5, M.trim, sx * 1.2, 0.8, -5); a.rotation.z = sx * -0.4; a.rotation.x = -0.2; body.add(a);
        const b = box(0.4, 0.8, 3.4, M.trim, sx * 2.7, 2.0, -6.8); b.rotation.z = sx * -0.7; body.add(b);
      }
      addFlame(0, 0, -4.6, 1.1, 3.2);
      break;
    }
    case 'gattle': { // red two-seater, twin bubble canopies, side thruster pods, big rear engine, tall tail, skis
      body.add(box(3.2, 2.6, 11, M.main, 0, 0, -1));                      // boxy body
      body.add(box(2.4, 1.6, 4, M.main, 0, -0.2, 6));                     // forward fuselage
      for (const sx of [-1, 1]){                                          // twin blue bubble canopies
        body.add(sph(1.0, M.main, sx * 0.85, 1.1, 4.2));
        body.add(sph(0.78, glass, sx * 0.85, 1.25, 4.4));
      }
      for (const sx of [-1, 1]){                                          // side thruster pods + nozzle cluster
        body.add(box(1.4, 2.4, 4.2, M.accent, sx * 2.6, 0.2, 0.5));
        for (const ny of [-0.8, 0, 0.8]) body.add(cyl(0.3, 0.3, 0.6, M.dark, sx * 2.6, ny, -1.6).rotateX(Math.PI / 2));
      }
      body.add(cyl(1.5, 1.5, 6, M.dark, 0, -0.2, -5).rotateX(Math.PI / 2)); // big rear engine cylinder
      for (const sx of [-1, 1]) swept(box(7, 0.5, 4.5, M.main, sx * 5, 0.3, -1), sx, 0.25);
      body.add(box(0.5, 4.2, 4.5, M.main, 0, 2.6, -4)); body.add(box(0.55, 1.2, 3.5, M.accent, 0, 4.6, -4.6)); // tall swept tail
      for (const sx of [-1, 1]){                                          // ski landing gear
        body.add(box(0.25, 1.6, 0.25, M.dark, sx * 1.6, -2.0, 1.5));
        body.add(box(0.5, 0.25, 4.5, M.dark, sx * 1.6, -2.8, 1.0));
      }
      addFlame(0, -0.2, -8.2, 1.2, 3.6);
      break;
    }
    case 'gaw': { // Zeon GAW attack carrier — broad flying wing, feathered turbine intakes, orange-framed cockpit, single tall tail, belly hangar
      const maw = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8 });    // intake shadow
      const exGlow = new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0xffa820, emissiveIntensity: 1.3 });
      // ---- blended central hull (flying-wing centre) ----
      body.add(box(7.5, 2.6, 15, M.main, 0, 0, -1));                               // broad central spine
      body.add(box(6.0, 1.4, 6, M.main, 0, 1.0, 3.5));                             // raised forward deck
      body.add(box(5.6, 0.35, 13, M.accent, 0, 1.85, -1));                         // red dorsal centre line
      // smooth rounded nose (whale-blunt — no shark mouth)
      body.add(box(4.8, 2.2, 4.5, M.main, 0, -0.1, 7.2));                          // snout block
      body.add(sph(2.5, M.main, 0, 0.0, 8.6));                                     // rounded nose dome
      body.add(box(4.6, 0.4, 2.4, M.accent, 0, 1.15, 6.8));                        // red nose deck stripe
      // orange-framed cockpit canopy on the hump
      body.add(box(2.8, 1.3, 3.6, M.main, 0, 1.7, 4.6));                           // cockpit hump
      body.add(box(2.0, 0.9, 2.8, glass, 0, 2.2, 4.8));                            // dark canopy
      for (const sx of [-1, 1]) body.add(box(0.26, 1.0, 3.0, M.trim, sx * 1.1, 2.2, 4.8)); // orange frame rails
      body.add(box(2.3, 0.28, 2.9, M.trim, 0, 2.62, 4.8));                         // orange frame spine
      // ---- broad back-swept flying wings, each with the signature feathered turbine-intake banks ----
      for (const sx of [-1, 1]){
        const wing = new THREE.Group(); wing.position.set(sx * 2.0, 0, 0.5); wing.rotation.y = sx * -0.26; body.add(wing);
        wing.add(box(11, 1.3, 9.5, M.main, sx * 6.5, 0, 0));                       // main wing
        wing.add(box(4.5, 0.8, 5.5, M.main, sx * 11.5, 0.1, 2.4));                 // tapered tip
        wing.add(box(12, 0.42, 0.8, M.accent, sx * 6.5, 0.72, 4.4));              // red leading-edge trim
        for (const [bx, bz, blen, n] of [[sx * 4.6, -0.6, 5.2, 9], [sx * 9.2, 0.4, 4.4, 8]]){
          wing.add(box(blen + 0.7, 0.5, 4.8, maw, bx, 0.5, bz));                   // dark intake trough
          for (let i = 0; i < n; i++){                                            // slanted blades → feathered intake
            const f = box(blen, 0.7, 0.3, M.main, bx, 0.96, bz - 2.1 + i * (4.2 / (n - 1)));
            f.rotation.x = 0.6; f.rotation.z = sx * 0.07; wing.add(f);
          }
        }
      }
      // ---- bulbous belly hangar pod ----
      body.add(box(6.0, 3.0, 11, M.chest, 0, -2.4, -1));                           // hangar block
      body.add(sph(3.1, M.chest, 0, -2.2, 4.0));                                   // rounded belly front
      body.add(box(6.2, 0.5, 9, M.dark, 0, -3.9, -1));                             // belly underside plate
      body.add(cyl(1.3, 1.3, 0.5, M.dark, 0, -2.9, 3.6).rotateX(Math.PI / 2));     // round belly port
      for (const bx of [-1.5, 1.5]) body.add(box(0.3, 1.5, 6, M.dark, bx, -3.7, -1)); // hangar door seams
      // ---- single tall swept central tail with Zeon emblem ----
      const tail = box(0.9, 7.0, 6.0, M.main, 0, 3.6, -6.8); tail.rotation.x = 0.30; body.add(tail);
      body.add(box(1.0, 1.8, 4.0, M.accent, 0, 6.6, -8.2));                        // red top band
      body.add(box(0.95, 1.3, 1.3, M.trim, 0, 5.4, -7.3));                         // emblem patch
      // ---- rear engine block + exhausts ----
      for (const ex of [-3.0, 0, 3.0]) body.add(cyl(1.3, 1.5, 2.4, M.dark, ex, -0.2, -8.0).rotateX(Math.PI / 2));
      for (const ex of [-3.0, 0, 3.0]) body.add(cyl(1.45, 1.45, 0.4, exGlow, ex, -0.2, -6.9).rotateX(Math.PI / 2));
      for (const ex of [-3.0, 3.0]) addFlame(ex, -0.2, -9.6, 1.1, 4.8);
      // ---- independent defensive turrets — the engine traverses + fires these (parts.turrets) ----
      parts.turrets = [];
      for (const [tx, ty, tz] of [[-2.6, 1.7, -3.6], [2.6, 1.7, -3.6], [-4.2, -1.0, 2.6], [4.2, -1.0, 2.6]]){
        const tur = new THREE.Group(); tur.position.set(tx, ty, tz); body.add(tur);
        tur.add(cyl(0.7, 0.85, 0.5, M.dark, 0, 0, 0, 10));               // turret ring/base
        const gun = new THREE.Group(); gun.position.set(0, 0.35, 0); tur.add(gun);
        gun.add(box(0.8, 0.55, 0.9, M.main, 0, 0, 0));                   // turret head
        for (const bx of [-0.2, 0.2]) gun.add(box(0.14, 0.14, 1.9, M.dark, bx, 0.05, 1.0)); // twin barrels (+z)
        const muz = new THREE.Object3D(); muz.position.set(0, 0.05, 2.0); gun.add(muz);
        parts.turrets.push({ yaw: tur, gun, muzzle: muz });
      }
      break;
    }
    case 'gfighter': { // FED G-Fighter / GM Bomber — blue/red, 4 big bomb pods, twin forward cannons, gold nose, rear turret
      body.add(box(3.2, 2.0, 13, M.main, 0, 0, -1));                              // blue fuselage
      body.add(box(2.6, 0.5, 6, M.accent, 0, 1.05, 0.5));                         // red dorsal panel
      body.add(box(2.2, 1.7, 3, M.main, 0, -0.1, 5.2));                           // Gundam-style nose block
      body.add(cone(1.15, 3.6, M.trim, 0, -0.55, 8.2).rotateX(Math.PI / 2));      // gold nose cone
      body.add(box(1.7, 0.5, 2.2, M.dark, 0, 0.7, 6.4));                          // grey nose deck
      body.add(box(1.5, 0.9, 1.9, glass, 0, 1.0, 3.9));                          // canopy
      body.add(box(1.7, 0.9, 1.8, M.dark, 0, 1.35, 4.6));                         // twin-cannon mount (the MG)
      for (const bx of [-0.5, 0.5]) body.add(cyl(0.18, 0.22, 6.5, M.dark, bx, 1.45, 8.4).rotateX(Math.PI / 2)); // long forward cannons
      for (const sx of [-1, 1]){                                                   // swept blue wings + red leading edge
        const wing = box(8.5, 0.55, 6.5, M.main, sx * 5.6, -0.2, -1); wing.rotation.y = sx * -0.28; body.add(wing);
        const edge = box(8.5, 0.58, 1.0, M.accent, sx * 5.6, -0.16, 1.7); edge.rotation.y = sx * -0.28; body.add(edge);
      }
      for (const [px, pz] of [[-2.7, 1.8], [2.7, 1.8], [-3.7, -3.2], [3.7, -3.2]]){ // FOUR big bomb-dispenser pods (signature)
        body.add(box(2.4, 3.6, 4.0, M.dark, px, 1.5, pz));                         // tall pod, stands above the wing
        body.add(box(2.5, 0.32, 4.1, M.accent, px, 3.05, pz));                     // red cap band
        body.add(box(2.45, 1.4, 0.16, M.main, px, 1.4, pz + 2.05));               // blue front face detail
      }
      body.add(box(0.5, 3.6, 3.2, M.main, 0, 1.9, -5.4));                         // tall tail
      body.add(box(0.55, 1.3, 2.6, M.accent, 0, 3.7, -5.9));                      // red tail tip
      for (const sx of [-1, 1]){ body.add(cyl(0.85, 0.95, 2.6, M.dark, sx * 1.0, -0.3, -6.8).rotateX(Math.PI / 2)); addFlame(sx * 1.0, -0.3, -8.6, 0.7, 3); }
      // one rear auto-turret (updateTurrets traverses + fires it on its own)
      parts.turrets = [];
      const tur = new THREE.Group(); tur.position.set(0, 1.6, -2.2); body.add(tur);
      tur.add(cyl(0.5, 0.6, 0.4, M.dark, 0, 0, 0, 10));
      const gun = new THREE.Group(); gun.position.set(0, 0.3, 0); tur.add(gun);
      gun.add(box(0.55, 0.4, 0.6, M.main, 0, 0, 0));
      for (const bx of [-0.14, 0.14]) gun.add(box(0.09, 0.09, 1.2, M.dark, bx, 0.05, 0.7));
      const tmuz = new THREE.Object3D(); tmuz.position.set(0, 0.05, 1.3); gun.add(tmuz);
      parts.turrets.push({ yaw: tur, gun, muzzle: tmuz });
      break;
    }
    default: { // Core Fighter / fallback — compact jet
      body.add(box(2.2, 1.8, 12, M.main, 0, 0, 0));
      body.add(cone(1.1, 5, M.main, 0, 0, 9).rotateX(Math.PI / 2));
      body.add(box(1.6, 1.2, 3, M.main, 0, 0.5, 3.5)); body.add(box(1.1, 0.6, 2, glass, 0, 1.0, 3.7));
      for (const sx of [-1, 1]) swept(box(7, 0.45, 5, M.main, sx * 5, 0, -1), sx, 0.3);
      body.add(box(0.4, 2.8, 2.6, M.main, 0, 1.6, -5));
      for (const sx of [-1, 1]){ body.add(cyl(0.8, 0.9, 3, M.dark, sx * 1.1, 0, -6).rotateX(Math.PI / 2)); addFlame(sx * 1.1, 0, -8, 0.7, 3); }
      break;
    }
  }

  // standard fighter anchors (nose guns / missiles fire from the muzzle)
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.2, 9); body.add(muzzle); parts.muzzle = muzzle;
  const eye = new THREE.Object3D(); eye.position.set(0, 1.0, 4.2); body.add(eye); parts.eye = eye;
  const head = new THREE.Object3D(); head.position.set(0, 1.0, 4.2); body.add(head); parts.head = head;
  const blade = box(0.1, 0.1, 0.1, M.blade, 0, 0, 0); blade.visible = false; body.add(blade); parts.blade = blade;
  parts.eyeMat = M.eye;
  root.scale.setScalar(suit.scale);
  return { root, parts };
}

// Mech faces +Z. Root origin at ground between the feet.
// Per-variant signature geometry so the 11 Gundam-frame suits don't all look
// identical. Each case bolts a few primitives onto the shared frame, keyed on
// suit.id; rx78 is the baseline and adds nothing. torY/shY match buildMech.
function addGundamVariant(suit, root, parts, M){
  const torY = 13;
  const { armL, armR, head } = parts;
  switch (suit.id){
    case 'fa78': // Full Armor: heavy bolt-on plates + twin shoulder beam cannon
      root.add(box(6.0, 4.0, 1.4, M.accent, 0, torY + 0.2, 1.9));     // thick chest plate
      root.add(box(2.6, 1.2, 1.0, M.trim, 0, torY + 1.9, 2.3));       // collar vent
      root.add(box(4.0, 3.2, 1.0, M.main, 0, torY - 3.6, 1.7));       // abdomen skirt armor
      if (armL) armL.add(box(3.8, 3.2, 4.0, M.main, -0.4, 0.6, 0));   // shoulder armor
      if (armR) armR.add(box(3.8, 3.2, 4.0, M.main, 0.4, 0.6, 0));
      if (armL) armL.add(box(2.5, 3.2, 2.7, M.main, 0, -4.9, 0.4));   // forearm armor
      if (armR) armR.add(box(2.5, 3.2, 2.7, M.main, 0, -4.9, 0.4));
      for (const sx of [-0.7, 0.7])                                   // twin beam cannon over the shoulders
        root.add(cyl(0.42, 0.5, 5.4, M.dark, sx, 17.4, 0.7).rotateX(Math.PI / 2));
      root.add(box(3.2, 2.2, 1.2, M.dark, 0, 17.4, -1.4));           // cannon mount
      break;
    case 'rx79g': // Ground Type: boxy weapon-container backpack + side antenna
      root.add(box(4.6, 3.4, 1.4, M.dark, 0, torY + 0.6, -3.0));
      root.add(box(1.2, 1.2, 1.4, M.accent, -1.6, torY + 2.2, -3.0));
      root.add(box(1.2, 1.2, 1.4, M.accent, 1.6, torY + 2.2, -3.0));
      if (head){ const a = box(0.4, 0.4, 1.6, M.trim, 0.95, 0.7, 0.3); a.rotation.x = 0.3; head.add(a); }
      break;
    case 'ez8': // EZ-8: field-modified armoured head (cheek guards, brow, blade antenna)
      if (head){
        head.add(box(0.7, 1.3, 1.9, M.main, -1.0, -0.1, 0.3));
        head.add(box(0.7, 1.3, 1.9, M.main, 1.0, -0.1, 0.3));
        head.add(box(2.1, 0.5, 0.6, M.accent, 0, 0.95, 0.6));         // heavy brow
        const ant = box(0.18, 2.3, 0.5, M.trim, 0.9, 1.4, 0.2); ant.rotation.z = -0.25; head.add(ant);
      }
      break;
    case 'nt1': // Alex: arm gatling guns + chest gatling hatches
      for (const arm of [armL, armR]) if (arm){
        arm.add(box(1.9, 1.7, 2.8, M.dark, 0, -4.6, 1.5));
        arm.add(cyl(0.5, 0.5, 2.4, M.dark, 0, -4.6, 3.4).rotateX(Math.PI / 2));
      }
      root.add(box(1.6, 1.5, 0.5, M.dark, -1.2, torY + 0.3, 2.0));
      root.add(box(1.6, 1.5, 0.5, M.dark, 1.2, torY + 0.3, 2.0));
      break;
    case 'gp01': // Zephyranthes: split dorsal fin binders + belly intake
      for (const sx of [-1, 1]){
        const fin = box(0.5, 4.0, 1.6, M.main, sx * 1.4, torY + 1.6, -2.7); fin.rotation.z = sx * 0.2; root.add(fin);
      }
      root.add(box(2.0, 1.2, 0.6, M.accent, 0, torY - 0.5, 2.0));
      break;
    case 'mk2': // Mk-II: rectangular vented shoulder armour + wide forehead vent
      if (armL) armL.add(box(3.9, 2.9, 3.7, M.main, -0.5, 0.9, 0));
      if (armR) armR.add(box(3.9, 2.9, 3.7, M.main, 0.5, 0.9, 0));
      for (const arm of [armL, armR]) if (arm) for (const oz of [-0.9, 0, 0.9])
        arm.add(box(2.1, 0.18, 0.5, M.dark, 0, 2.0, oz));
      if (head) head.add(box(2.4, 0.4, 0.5, M.trim, 0, 1.2, 0.3));
      break;
    case 'gundamx': { // Gundam X: big folded Satellite Cannon over the back + head fins
      const cannon = new THREE.Group(); cannon.position.set(0, torY + 2.8, -2.6);
      cannon.add(box(5.2, 1.1, 2.2, M.dark, 0, 0, 0));               // shoulder yoke
      for (const sx of [-1, 1]){
        cannon.add(cyl(0.7, 0.85, 6.4, M.main, sx * 1.7, 0.2, -1.2).rotateX(Math.PI / 2));
        cannon.add(cyl(0.95, 0.95, 0.9, M.accent, sx * 1.7, 0.2, -4.3).rotateX(Math.PI / 2));
      }
      root.add(cannon);
      if (head) for (const sx of [-1, 1]){ const f = box(0.3, 0.45, 1.9, M.trim, sx * 0.95, 0.9, 0.3); f.rotation.x = -0.3; head.add(f); }
      break;
    }
  }
}

// Finish a canonical humanoid body supplied by the family-specific builders. Those builders own the
// silhouette, armor, head, backpack, native shield and limb proportions; this shared step preserves
// the game's weapon switching, muzzle anchors, blocking contract and melee animation contract.
function equipCanonicalHumanoid(suit, M, built){
  const { root, parts } = built;
  if (!parts.flames) parts.flames = [];

  function fallbackShield(faceMat, cross){
    const group = new THREE.Group();
    // Tapered six-sided plate made from layered chamfered blocks, with the mounting hardware behind it.
    group.add(box(0.55, 4.5, 3.25, faceMat, 0, 0.35, 0));
    group.add(box(0.58, 1.35, 2.55, faceMat, 0, 2.95, 0));
    group.add(box(0.58, 1.1, 2.05, faceMat, 0, -2.35, 0));
    group.add(box(0.62, 5.9, 0.48, M.dark, 0.42, 0.1, 0));
    if (cross){
      group.add(box(0.66, 3.4, 0.36, M.trim, 0.52, 0.8, 0));
      group.add(box(0.66, 0.55, 2.0, M.trim, 0.52, 1.55, 0));
    }
    group.add(box(0.65, 0.75, 1.5, M.dark, -0.62, 0.95, 0));
    group.add(box(0.65, 0.75, 1.5, M.dark, -0.62, -1.05, 0));
    return group;
  }

  if (!parts.shield && parts.armL && built.allowDefaultShield !== false){
    const native = suit.style === 'gundam' || suit.style === 'gm';
    const shield = fallbackShield(native ? (suit.style === 'gundam' ? M.chest : M.main) : M.main, suit.style === 'gundam');
    shield.position.set(1.65, -3.05, 0.35); shield.rotation.y = -0.08;
    shield.visible = native;
    parts.armL.add(shield); parts.shield = shield; parts.shieldKind = native ? 'native' : 'block';
  }

  const muzzle = parts.muzzle || new THREE.Object3D();
  if (!parts.fixedWeapon && parts.armR){
    const mount = built.weaponMount || [0, -6.4, 0.8];
    const guns = new Map();
    const makeGun = (weapon, wi) => {
      const gun = buildWeaponMesh(suit, weapon);
      gun.position.set(...mount); gun.visible = false; parts.armR.add(gun); guns.set(wi, gun); return gun;
    };
    parts.rebuildGun = wi => {
      const weapon = suit.weapons[wi] || suit.weapons[0];
      for (const gun of guns.values()) gun.visible = false;
      parts.deployWeapon?.(wi);
      const integrated = !!(weapon.head || weapon.integrated);
      parts.weaponIsHeld = !integrated;
      parts.aimIntegrated = integrated && !(parts.integratedAimArms?.[wi]?.length);
      parts.aimArms = integrated ? (parts.integratedAimArms?.[wi] || []) : [parts.armR];
      parts.aimArm = parts.aimArms[0] || null;
      parts.aimGun = null; parts.gun = null; parts.heldWeapon = null;
      if (integrated) return;
      const next = guns.get(wi) || makeGun(weapon, wi);
      // Enforce the shared humanoid contract even if a cached gun was moved by
      // an earlier custom state: every single-handed ranged weapon lives on the
      // physical right arm and owns the muzzle used for its shots.
      if (next.parent !== parts.armR) parts.armR.add(next);
      next.visible = true; parts.gun = next; parts.heldWeapon = next; parts.aimGun = next;
      muzzle.position.set(0, 0.2, heldMuzzleZ(suit, weapon)); next.add(muzzle);
    };
    parts.rebuildGun(0);
  } else if (!parts.muzzle && parts.armR){
    muzzle.position.set(...(built.fixedMuzzle || [0, -6.3, 2.2])); parts.armR.add(muzzle);
  }
  parts.muzzle = muzzle;
  if (!parts.rebuildGun) parts.rebuildGun = () => {};
  if (parts.weaponIsHeld == null) parts.weaponIsHeld = false;

  if (!parts.blade){
    const name = (suit.saber && suit.saber.name || '').toUpperCase();
    const blade = new THREE.Group();
    if (/HAWK|AXE/.test(name)){
      blade.add(cyl(0.13, 0.13, 4.6, M.dark, 0, 0, 0).rotateX(Math.PI / 2));
      blade.add(box(0.25, 2.7, 2.0, M.gold, 0, 0.75, 2.55));
      blade.add(box(0.28, 3.0, 0.34, M.heat, 0, 0.8, 3.58));
    } else if (/KNIFE/.test(name)){
      blade.add(box(0.18, 0.52, 2.7, M.gold, 0, 0, 1.45));
      blade.add(box(0.2, 0.16, 2.5, M.heat, 0, 0.3, 1.5));
    } else if (/SWORD/.test(name) && !/BEAM/.test(name)){
      blade.add(box(0.2, 0.9, 8.0, M.gold, 0, 0, 4.2));
      blade.add(box(0.22, 0.28, 8.0, M.heat, 0, 0.42, 4.2));
    } else if (suit.saber && suit.saber.dmg > 0){
      const length = /NAGINATA/.test(name) ? 11 : /LARGE/.test(name) ? 10.5 : 9.5;
      const core = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.4, transparent: true, opacity: 0.95 });
      blade.add(cyl(0.16, 0.2, 1.2, M.dark, 0, 0, 0, 8).rotateX(Math.PI / 2));
      blade.add(cyl(0.24, 0.24, 0.3, M.trim, 0, 0, 0.6, 8).rotateX(Math.PI / 2));
      blade.add(cyl(0.34, 0.14, length, M.blade, 0, 0, 0.75 + length / 2, 10).rotateX(Math.PI / 2));
      blade.add(cyl(0.13, 0.04, length, core, 0, 0, 0.75 + length / 2, 8).rotateX(Math.PI / 2));
    }
    blade.position.set(...(built.meleeMount || [0, -6.4, 0.8])); blade.visible = false;
    if (parts.armR) parts.armR.add(blade); else root.add(blade);
    parts.blade = blade;
  }

  if (!parts.eye){ parts.eye = new THREE.Object3D(); root.add(parts.eye); }
  if (!parts.head){ parts.head = new THREE.Object3D(); root.add(parts.head); }
  if (!parts.eyeMat) parts.eyeMat = M.eye;
  root.scale.setScalar(suit.scale);
  return { root, parts };
}

export function buildMech(suit){
  const c = suit.colors;
  const zeon = suit.faction === 'ZEON';
  const M = {
    main: mat(c.main), chest: mat(c.chest), accent: mat(c.accent), trim: mat(c.trim),
    dark: mat(0x23272e, { roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: zeon ? (suit.style === 'gouf' ? 0xff4d8d : 0xff3355) : 0x66ffcc, emissiveIntensity: 2.4 }),
    flame: new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff8830, emissiveIntensity: 2.6, transparent: true, opacity: 0.9 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x220022, emissive: zeon ? 0xffcc55 : 0xff9ae0, emissiveIntensity: 3.0, transparent: true, opacity: 0.92 }),
    gold: mat(0xc7a23c, { metalness: 0.55, roughness: 0.45 }),                 // heat-blade edge / metal
    heat: new THREE.MeshStandardMaterial({ color: 0x3a1206, emissive: 0xff5a1e, emissiveIntensity: 2.4 }), // glowing hot edge
    scope: new THREE.MeshStandardMaterial({ color: 0x161000, emissive: 0xffc63a, emissiveIntensity: 2.4 }),// sniper lens glow
  };

  // Canonical aircraft are complete meshes with their own fixed guns, engine anchors and (for
  // carriers) live defensive turrets. Keep the legacy builder only as an unsupported-unit fallback.
  if (suit.style === 'fighter'){
    const canonical = buildCanonicalAircraft(suit, M);
    if (canonical){
      canonical.root.scale.setScalar(suit.scale);
      canonical.parts.rebuildGun ||= () => {};
      return { root: canonical.root, parts: canonical.parts };
    }
  }

  // Requiem for Vengeance's RTX-440-B keeps its dedicated hero builder.
  if (suit.id === 'guntankmk2') return buildGuntankMk2(suit, M);

  if (suit.faction === 'FED'){
    const canonical = buildFederationCanonical(suit, M);
    if (canonical){
      if (canonical.kind === 'humanoid') return equipCanonicalHumanoid(suit, M, canonical);
      canonical.root.scale.setScalar(suit.scale);
      canonical.parts.rebuildGun ||= () => {};
      return { root: canonical.root, parts: canonical.parts };
    }
  }

  if (suit.faction === 'ZEON'){
    const canonical = buildZeonCanonical(suit, M);
    if (canonical){
      if (canonical.kind === 'humanoid') return equipCanonicalHumanoid(suit, M, canonical);
      canonical.root.scale.setScalar(suit.scale);
      canonical.parts.rebuildGun ||= () => {};
      return { root: canonical.root, parts: canonical.parts };
    }
  }

  const real = modelFor(suit.id);
  if (real) return buildFromModel(suit, real);

  const st = suit.style;
  if (st === 'tank') return buildTank(suit, M);
  if (st === 'crane') return buildGuntankMk2(suit, M);
  if (suit.id === 'guntankmk1') return buildGuntankMk1(suit, M); // keeps style 'guntank' engine gates, own mesh
  if (st === 'fighter') return buildFighter(suit, M);

  const root = new THREE.Group();
  const parts = { flames: [] };
  const roundLegs = st === 'zaku' || st === 'gouf' || st === 'dom' || st === 'gelgoog';
  const legBoost = suit.hover && (st === 'gm' || st === 'zaku'); // desert ground GM/Zaku: calf + sole thrusters

  // ---- legs / undercarriage ----
  if (st === 'guntank'){
    for (const sx of [-1, 1]){
      root.add(box(2.8, 3.0, 8.2, M.accent, sx * 2.3, 1.6, 0));               // navy caterpillar tread
      root.add(box(2.4, 1.1, 8.6, M.main, sx * 2.3, 3.5, 0));                 // white fender
      root.add(cyl(1.4, 1.4, 2.6, M.dark, sx * 2.3, 1.6, 4.0, 12).rotateZ(Math.PI / 2));  // drive sprocket
      root.add(cyl(1.4, 1.4, 2.6, M.dark, sx * 2.3, 1.6, -4.0, 12).rotateZ(Math.PI / 2)); // idler
      for (const rz of [-2.4, 0, 2.4])                                        // road wheels along the tread
        root.add(cyl(0.9, 0.9, 2.7, M.dark, sx * 2.3, 1.0, rz, 10).rotateZ(Math.PI / 2));
    }
    root.add(box(4.8, 1.8, 5.8, M.main, 0, 3.9, 0));
    parts.legL = parts.legR = null;
  } else if (st === 'zakutank'){
    // Zaku Tank lower body: two wide tracked units + a hull that rises to carry the Zaku torso
    for (const sx of [-1, 1]){
      root.add(box(3.2, 3.8, 12, M.accent, sx * 3.7, 2.1, 0));                // track skirt
      root.add(box(3.7, 1.5, 12.4, M.main, sx * 3.7, 4.3, 0));               // fender
      root.add(box(3.3, 0.5, 12, M.dark, sx * 3.7, 0.2, 0));                 // track shoe base
      root.add(cyl(1.75, 1.75, 3.4, M.dark, sx * 3.7, 2.1, 5.4, 16).rotateZ(Math.PI / 2)); // drive sprocket
      root.add(cyl(1.75, 1.75, 3.4, M.dark, sx * 3.7, 2.1, -5.4, 16).rotateZ(Math.PI / 2)); // idler
      for (const rz of [-3.2, -1.1, 1.1, 3.2])                                // road wheels
        root.add(cyl(1.2, 1.2, 3.5, M.dark, sx * 3.7, 1.4, rz, 12).rotateZ(Math.PI / 2));
      root.add(box(0.5, 1.3, 3.0, M.dark, sx * 5.4, 3.0, 3.6));              // side stowage boxes
    }
    root.add(box(6.8, 3.2, 9.0, M.main, 0, 5.6, -0.3));                       // central hull body
    root.add(box(5.8, 1.7, 7.0, M.accent, 0, 7.4, -0.3));                     // upper deck
    root.add(box(4.0, 0.9, 5.4, M.dark, 0, 8.3, -0.6));                       // deck plating
    root.add(cyl(2.7, 3.0, 1.6, M.dark, 0, 8.5, 0, 16));                      // turret ring the torso sits on
    parts.legL = parts.legR = null;
  } else {
    const hipY = st === 'acguy' ? 7.6 : 9.6;
    const stub = st === 'acguy' ? 0.72 : 1;
    const wide = st === 'dom' ? 1.25 : 1;
    for (const [key, sx] of [['legL', -1], ['legR', 1]]){
      const leg = new THREE.Group(); leg.position.set(sx * 1.8, hipY, 0);
      leg.add(sph(0.95 * wide, M.dark, 0, 0.2, 0));                           // hip joint
      if (roundLegs){
        leg.add(cyl(1.15 * wide, 1.3 * wide, 3.4 * stub, M.main, 0, -1.9 * stub, 0, 12)); // thigh
        leg.add(box(1.7, 1.0, 1.9, M.dark, 0, -3.9 * stub, 0));               // knee joint
        leg.add(box(1.55, 0.9, 0.5, M.trim, 0, -3.85 * stub, 1.15));          // knee accent cap
        leg.add(cyl(1.2 * wide, 1.55 * wide, 3.8 * stub, zeon ? M.chest : M.main, 0, -6.0 * stub, 0.1, 12)); // shin (darker two-tone)
        leg.add(box(0.5, 2.6 * stub, 0.4, M.trim, 0, -6.0 * stub, 1.45 * wide)); // shin trim strake
      } else {
        leg.add(box(2.2 * wide, 3.4 * stub, 2.4, M.main, 0, -1.9 * stub, 0));
        leg.add(box(1.8, 1.1, 2.0, M.dark, 0, -3.9 * stub, 0));               // knee
        leg.add(box(1.5, 1.2, 0.5, M.main, 0, -3.8 * stub, 1.25));            // knee cap
        if (st === 'gm') for (const dy of [-0.35, 0, 0.35])                   // GM 3-dot knee detail
          leg.add(cyl(0.16, 0.16, 0.2, M.dark, 0, -3.8 * stub + dy, 1.5).rotateX(Math.PI / 2));
        leg.add(box(2.4 * wide, 3.7 * stub, 2.6, M.main, 0, -6.0 * stub, 0.1));
        leg.add(box(2.0, 1.9, 1.0, M.main, 0, -5.3 * stub, -1.6));            // calf flare
      }
      leg.add(box(1.3, 0.8, 1.5, M.dark, 0, -hipY + 1.5, 0));                 // ankle
      leg.add(box(2.5, 1.1, 3.9, M.dark, 0, -hipY + 0.55, 0.5));              // foot
      leg.add(box(2.3, 0.9, 1.3, st === 'gundam' ? M.accent : M.main, 0, -hipY + 0.6, 2.2)); // toe
      if (legBoost){
        // back-of-calf booster: nozzle housing on the rear of the shin, plume streams aft (-z)
        leg.add(box(1.5, 2.2, 1.0, M.accent, 0, -5.8 * stub, -2.0));                            // thruster pack
        leg.add(cyl(0.5, 0.62, 0.9, M.dark, 0, -5.8 * stub, -2.7).rotateX(Math.PI / 2));        // nozzle bell
        const cfl = cone(0.44, 2.3, M.flame, 0, -5.8 * stub, -3.6);
        cfl.rotation.x = Math.PI / 2; cfl.scale.y = 0.01;                                       // apex aft → plume backward
        leg.add(cfl); parts.flames.push(cfl);
        // under-foot booster: nozzle recessed in the sole, plume streams down for hover/skim
        leg.add(cyl(0.62, 0.72, 0.6, M.dark, 0, -hipY + 0.15, 0.5));                            // sole nozzle housing
        const sfl = cone(0.5, 1.9, M.flame, 0, -hipY - 0.85, 0.5);
        sfl.rotation.x = Math.PI; sfl.scale.y = 0.01;                                           // apex down → plume to ground
        leg.add(sfl); parts.flames.push(sfl);
      }
      root.add(leg); parts[key] = leg;
    }
    // waist: pelvis + skirts
    root.add(box(4.4, 2.1, 2.8, M.chest, 0, hipY + 0.7, 0));
    root.add(box(2.3, 1.9, 0.5, M.main, 0, hipY - 0.5, 1.4));                 // front skirt
    if (st === 'dom') root.add(cyl(3.4, 5.8, 5.8, M.accent, 0, 7.4, 0, 14));  // wide dark flared hover-skirt
    if (st === 'gelgoog') root.add(cyl(2.9, 4.2, 4.4, M.main, 0, 8.0, 0, 14));
    if (st !== 'dom' && st !== 'acguy' && st !== 'gelgoog'){
      root.add(box(1.5, 2.5, 0.6, M.main, -2.7, hipY - 0.5, 0.7));            // side skirts
      root.add(box(1.5, 2.5, 0.6, M.main, 2.7, hipY - 0.5, 0.7));
      root.add(box(2.6, 1.8, 0.5, M.main, 0, hipY - 0.4, -1.4));              // rear skirt
    }
  }

  // ---- torso ----
  const torY = st === 'guntank' ? 6.6 : st === 'zakutank' ? 11.5 : st === 'acguy' ? 10.4 : 13;
  if (st === 'acguy'){
    root.add(cyl(2.9, 3.2, 5.4, M.main, 0, torY, 0, 14));                     // round hull
    root.add(box(4.4, 3.2, 1.0, M.chest, 0, torY, 2.6));
    root.add(box(3.6, 1.0, 0.6, M.accent, 0, torY - 2.0, 2.7));               // belly vent
  } else {
    root.add(box(3.4, 1.3, 2.3, M.dark, 0, torY - 2.3, 0));                   // waist joint
    root.add(box(5.2, 3.4, 3.1, (st === 'gundam' || zeon) ? M.chest : M.main, 0, torY, 0)); // torso (darker for a two-tone Zeon body)
    const plate = box(4.4, 2.0, 1.0, zeon ? M.main : M.chest, 0, torY + 0.7, 1.65);
    plate.rotation.x = -0.18; root.add(plate);                                // angled chest plate (lighter armour over the dark torso)
    root.add(box(2.6, 0.8, 2.3, M.main, 0, torY + 2.0, 0.2));                 // collar
    root.add(box(1.3, 1.1, 0.4, M.accent, 0, torY - 1.2, 1.7));               // cockpit hatch
    if (zeon){                                                                 // Zeon two-tone accents: side armour blocks + a trim belt
      for (const s2 of [-1, 1]) root.add(box(0.7, 2.6, 2.2, M.main, s2 * 2.65, torY, 0.2)); // lighter side torso armour
      root.add(box(4.2, 0.45, 0.4, M.trim, 0, torY - 1.7, 1.6));              // trim belt stripe
      root.add(box(3.0, 0.7, 0.4, M.dark, 0, torY - 0.4, 1.72));              // dark ab band
    }
    if (!zeon){
      root.add(box(0.9, 0.8, 0.25, M.trim, -1.5, torY + 0.4, 2.15));          // yellow intake vents
      root.add(box(0.9, 0.8, 0.25, M.trim, 1.5, torY + 0.4, 2.15));
    }
    if (st === 'gm'){                                                          // central chevron chest vent
      for (const s2 of [-1, 1]){
        const v = box(1.5, 0.4, 0.3, M.trim, s2 * 0.6, torY + 0.55, 2.05);
        v.rotation.z = s2 * 0.5; root.add(v);
      }
    }
    if (st === 'dom') root.add(box(2.8, 1.1, 0.4, M.trim, 0, torY + 0.2, 1.95)); // chest scatter gun
    if (zeon && (st === 'zaku' || st === 'gouf' || st === 'zakutank')){
      // signature Zeon ribbed power pipe running from the waist up to the neck (both sides)
      for (const sx of [-1, 1]){
        const cable = ribbedCable(4.2, 0.34, M.dark);
        cable.position.set(sx * 1.15, torY + 1.0, 1.55); cable.rotation.x = -0.35;
        root.add(cable);
      }
    }
  }

  // ---- backpack + thrusters ----
  root.add(box(3.4, 2.7, 1.5, M.dark, 0, torY + 0.4, -2.2));
  if (st === 'gundam' || st === 'gm'){
    root.add(cyl(0.24, 0.24, 1.7, M.main, -1.25, torY + 2.3, -2.2));          // saber rack
    root.add(cyl(0.24, 0.24, 1.7, M.main, 1.25, torY + 2.3, -2.2));
  }
  if (st === 'dom') root.add(box(4.4, 2.2, 0.9, M.accent, 0, torY + 0.2, -2.8)); // hover plate
  for (const sx of [-0.9, 0.9]){
    root.add(cyl(0.55, 0.72, 1.1, M.dark, sx, torY - 1.0, -2.3));
    const fl = cone(0.5, 2.4, M.flame, sx, torY - 2.5, -2.3);
    fl.rotation.x = Math.PI; fl.scale.y = 0.01;
    root.add(fl); parts.flames.push(fl);
  }

  // ---- shoulders + arms ----
  const shY = st === 'guntank' ? 7.8 : st === 'zakutank' ? 13.3 : st === 'acguy' ? 12.2 : 14.6;
  // armR (gun arm) sits at -x, armL (shield arm) at +x: the pursuit cam views the mech's BACK, so -x
  // renders to screen-RIGHT — this puts the weapon on the right & shield on the left in BOTH views,
  // matching the cockpit viewmodel (viewGun +x=right, viewShield -x=left).
  for (const [key, sx] of [['armL', 1], ['armR', -1]]){
    const arm = new THREE.Group(); arm.position.set(sx * 3.6, shY, 0);
    if ((st === 'zaku' || st === 'zakutank') && sx === 1){
      const sh = box(0.9, 3.8, 3.8, M.main, 1.0, 0.5, 0); sh.rotation.z = -0.2; arm.add(sh);  // shoulder shield
      arm.add(box(0.5, 3.2, 3.2, M.dark, 1.5, 0.5, 0));
    } else if (st === 'zaku' && sx === -1){
      arm.add(sph(1.8, M.accent, -0.2, 0.7, 0));                              // spiked pauldron
      for (const [ox, oy, oz] of [[-0.9, 1.6, 0], [0.2, 1.9, 0.8], [0.2, 1.9, -0.8]])
        arm.add(cone(0.32, 1.3, M.trim, ox, oy, oz));
    } else if (st === 'gouf'){
      arm.add(sph(1.85, M.accent, 0, 0.7, 0));                                // curved pauldron
      for (const oz of [-0.75, 0, 0.75])                                      // row of short upward spikes
        arm.add(cone(0.26, 1.0, M.trim, sx * 0.3, 2.0, oz));
    } else if (st === 'dom'){
      arm.add(sph(2.25, M.accent, sx * 0.45, 0.8, 0));                        // enormous rounded ball pauldron
    } else if (st === 'gelgoog'){
      const sh = box(2.9, 2.3, 3.2, M.main, sx * 0.4, 0.9, 0);
      sh.rotation.z = sx * -0.3; arm.add(sh);                                 // flared pads
      arm.add(box(2.6, 0.5, 3.0, M.trim, sx * 0.7, 2.0, 0));
    } else if (st === 'guntank'){
      arm.add(box(1.9, 1.9, 4.4, M.dark, 0, 0, 1));                           // missile pod
      arm.add(box(1.7, 1.7, 0.4, M.accent, 0, 0, 3.25));
    } else if (st === 'acguy'){
      arm.add(sph(1.6, M.main, 0, 0.4, 0));
    } else {
      arm.add(box(2.8, 2.2, 2.9, st === 'gundam' ? M.main : M.accent, sx * 0.25, 0.8, 0));
      if (st === 'guncannon') arm.add(box(2.4, 1.0, 2.5, M.accent, sx * 0.25, 2.2, 0));
    }
    if (st === 'guntank'){ root.add(arm); parts[key] = arm; continue; }
    if (st === 'acguy'){
      arm.add(cyl(1.2, 1.35, 4.6, M.main, 0, -2.6, 0, 12));                   // fat arm
      arm.add(cyl(1.3, 1.3, 1.0, M.accent, 0, -5.0, 0, 12));
      for (const a of [0, 2.1, 4.2])                                          // iron claws
        arm.add(cone(0.3, 1.6, M.trim, Math.sin(a) * 0.7, -6.2, Math.cos(a) * 0.7).rotateX(Math.PI));
    } else {
      arm.add(box(1.8, 2.7, 1.9, M.main, 0, -1.7, 0));                        // upper arm
      arm.add(box(1.5, 0.9, 1.6, M.dark, 0, -3.3, 0));                        // elbow
      arm.add(box(1.9, 2.8, 2.0, M.main, 0, -4.9, 0));                        // forearm
      arm.add(box(1.35, 1.35, 1.45, M.dark, 0, -6.4, 0));                     // hand
    }
    root.add(arm); parts[key] = arm;
  }

  // ---- Zaku Tank shoulder cannon: a big anti-materiel rifle on a trunnion over the right (-x) shoulder.
  // parts.turret ELEVATES to aim (poseAim); parts.cannonSlide RECOILS along the bore on fire; parts.turretDock
  // holds the two docking poses — shoulder (direct fire) and swung up over the back (artillery bombardment). ----
  if (st === 'zakutank'){
    const mount = new THREE.Group();
    mount.position.set(-2.8, shY + 1.7, -0.6);                                // trunnion pivot at the shoulder
    mount.add(box(1.7, 1.5, 2.0, M.dark, 0, -0.75, -0.3));                    // cradle / yoke around the breech
    mount.add(cyl(0.42, 0.42, 2.5, M.dark, 0, -0.2, -0.3, 10).rotateZ(Math.PI / 2)); // trunnion axle
    mount.add(box(0.8, 2.3, 0.8, M.dark, 0, -1.85, 0.5));                     // support strut down to the shoulder
    const slide = new THREE.Group();                                         // the cannon recoils along this
    slide.add(amCannon(M, false));
    mount.add(slide);
    root.add(mount);
    parts.turret = mount; parts.cannonSlide = slide;
    parts.turretDock = { dir: { x: -2.8, y: shY + 1.7, z: -0.6 }, art: { x: 0, y: shY + 3.6, z: -2.8 } };
  }

  // ---- shield (left forearm, +x outboard) — also the F block guard ----
  // A proper RX-78-style shield: tapered hex plate with real thickness, a raised central ridge, a
  // contrasting cross emblem, and a forearm mounting bracket (outward face is +x; bracket faces -x).
  function makeShield(faceMat, withCross){
    const g = new THREE.Group();
    g.add(box(1.0, 4.4, 3.4, faceMat, 0, 0.4, 0));            // main plate (thick)
    g.add(box(1.0, 1.4, 2.6, faceMat, 0, 2.9, 0));            // narrower top cap (hex shoulder)
    g.add(box(1.0, 1.1, 2.1, faceMat, 0, -2.2, 0));           // lower step
    g.add(box(1.0, 1.0, 1.1, faceMat, 0, -3.2, 0));           // pointed tip
    g.add(box(0.55, 6.4, 0.8, M.dark, 0.55, 0.0, 0));         // raised central ridge (outward face)
    if (withCross){                                            // RX-78 cross emblem
      g.add(box(0.5, 3.6, 0.6, M.trim, 0.62, 0.9, 0));        // vertical bar
      g.add(box(0.5, 0.6, 2.2, M.trim, 0.62, 1.7, 0));        // horizontal bar
    }
    g.add(box(0.7, 0.9, 1.6, M.dark, -0.75, 1.1, 0));         // forearm bracket (upper)
    g.add(box(0.7, 0.9, 1.6, M.dark, -0.75, -1.1, 0));        // forearm bracket (lower)
    g.add(cyl(0.34, 0.34, 1.1, M.dark, -1.0, 0, 0).rotateX(Math.PI / 2)); // mounting pivot
    return g;
  }
  if (st === 'gundam' || st === 'gm'){
    const shield = makeShield(st === 'gundam' ? M.chest : M.main, st === 'gundam');
    shield.position.set(1.7, -3.0, 0.4); shield.rotation.y = -0.08;
    parts.armL.add(shield);
    parts.shield = shield; parts.shieldKind = 'native';
  } else if (parts.armL && st !== 'acguy'){
    const shield = makeShield(M.main, false);
    shield.position.set(1.6, -3.0, 0.4); shield.rotation.y = -0.08;
    shield.visible = false;                                    // shown only while blocking
    parts.armL.add(shield);
    parts.shield = shield; parts.shieldKind = 'block';
  }

  // ---- weapon in the right hand, shaped per the ACTIVE weapon (rebuilt on switch) ----
  const armed = st !== 'guntank' && st !== 'acguy' && st !== 'guncannon' && st !== 'zakutank';
  const gmStyle = st === 'gm' || st === 'gundam';
  // the held-weapon mesh comes from the SHARED module-level builder (buildWeaponMesh) so the gun on
  // the suit and the cockpit viewmodel are the exact same design; here we only add the hand offset
  const muzzleZ = w => heldMuzzleZ(suit, w);
  const makeHeldGun = w => {
    const gun = buildWeaponMesh(suit, w);
    gun.position.set(0, -6.4, 0.8);
    return gun;
  };

  // muzzle reference point rides the weapon so shots track the pose
  const muzzle = new THREE.Object3D();
  if (armed){
    const gun = makeHeldGun(suit.weapons[0]);
    parts.armR.add(gun); parts.gun = gun; parts.heldWeapon = gun; parts.weaponIsHeld = true;
    parts.aimIntegrated = false; parts.aimArms = [parts.armR]; parts.aimArm = parts.armR; parts.aimGun = gun;
    muzzle.position.set(0, 0.2, muzzleZ(suit.weapons[0]));
    gun.add(muzzle);
    // swap the held weapon + muzzle offset when the active weapon's type changes
    parts.rebuildGun = wi => {
      const w = suit.weapons[wi] || suit.weapons[0];
      if (parts.gun) parts.armR.remove(parts.gun);
      const integrated = !!(w.head || w.integrated);
      parts.weaponIsHeld = !integrated; parts.heldWeapon = null;
      parts.aimIntegrated = integrated; parts.aimArms = integrated ? [] : [parts.armR];
      parts.aimArm = integrated ? null : parts.armR; parts.aimGun = null; parts.gun = null;
      if (integrated) return;
      const g = makeHeldGun(w);
      parts.armR.add(g); parts.gun = g; parts.heldWeapon = g; parts.aimGun = g;
      muzzle.position.set(0, 0.2, muzzleZ(w));
      g.add(muzzle);
    };
  } else if (st === 'acguy'){
    muzzle.position.set(0, -6.4, 1.4);
    parts.armR.add(muzzle);
  } else if (st === 'guncannon'){
    muzzle.position.set(2.3, 16.4, 3.6);                                      // right shoulder cannon
    root.add(muzzle);
  } else if (st === 'zakutank'){
    muzzle.position.set(0, 0.05, 8.7);                                        // cannon muzzle brake tip (rides the recoiling slide)
    parts.cannonSlide.add(muzzle);
  } else { // guntank
    muzzle.position.set(1.4, 8.6, 6.4);
    root.add(muzzle);
  }
  parts.muzzle = muzzle;
  if (!parts.rebuildGun) parts.rebuildGun = () => {};
  if (parts.weaponIsHeld == null) parts.weaponIsHeld = false;

  // ---- melee weapon (hidden until a swing) — shaped from the suit's saber name ----
  const sname = (suit.saber && suit.saber.name || '').toUpperCase();
  let blade;
  if (/HAWK/.test(sname)){
    // Zaku Heat Hawk: dark haft + fan-shaped golden blade with a glowing hot edge
    blade = new THREE.Group();
    blade.add(cyl(0.13, 0.13, 4.6, M.dark, 0, 0, 0).rotateX(Math.PI / 2));      // haft
    const headG = new THREE.Group(); headG.position.set(0, 0, 2.6);
    headG.add(box(0.22, 3.0, 2.0, M.gold, 0, 0.7, 0.2));                        // blade body
    headG.add(box(0.24, 1.0, 2.4, M.gold, 0, 1.9, 0.5));                        // flared top of the fan
    headG.add(box(0.26, 3.4, 0.4, M.heat, 0, 0.8, 1.4));                        // heated cutting edge
    blade.add(headG);
    blade.position.set(0, -6.4, 0.6);
  } else if (/KNIFE/.test(sname)){
    // heat knife: short straight blade with a glowing edge
    blade = new THREE.Group();
    blade.add(box(0.16, 0.5, 2.4, M.gold, 0, 0, 1.2));
    blade.add(box(0.18, 0.18, 2.2, M.heat, 0, 0.28, 1.3));                      // hot edge
    blade.position.set(0, -6.4, 0.6);
  } else if (/SWORD/.test(sname)){
    // Gouf Heat Sword: long solid blade, hot edge
    blade = new THREE.Group();
    blade.add(box(0.2, 0.9, 8.0, M.gold, 0, 0, 4.2));
    blade.add(box(0.22, 0.3, 8.0, M.heat, 0, 0.4, 4.2));
    blade.position.set(0, -6.4, 1.0);
  } else {
    // beam saber / naginata: metal hilt + tapered glowing blade with a white-hot core
    const len = /NAGINATA/.test(sname) ? 11 : 9.5;
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.4, transparent: true, opacity: 0.95 });
    blade = new THREE.Group();
    blade.position.set(0, -6.4, 0.8);
    blade.add(cyl(0.16, 0.2, 1.2, M.dark, 0, 0, 0, 8).rotateX(Math.PI / 2));       // hilt in the hand
    blade.add(cyl(0.24, 0.24, 0.3, M.trim, 0, 0, 0.6, 8).rotateX(Math.PI / 2));     // emitter ring
    const bcz = 0.75 + len / 2;
    blade.add(cyl(0.34, 0.14, len, M.blade, 0, 0, bcz, 10).rotateX(Math.PI / 2));   // tapered glow sheath
    blade.add(cyl(0.13, 0.04, len, coreMat, 0, 0, bcz, 8).rotateX(Math.PI / 2));    // bright inner core
  }
  blade.visible = false;
  if (parts.armR) parts.armR.add(blade);
  parts.blade = blade;

  // ---- head (every style also places the eye anchor for head vulcans) ----
  const headY = st === 'guntank' ? 9.8 : st === 'zakutank' ? 14.7 : st === 'acguy' ? 13.8 : st === 'dom' ? 15.2 : 16.1;
  const head = new THREE.Group(); head.position.set(0, headY, 0);
  const eye = new THREE.Object3D();
  if (st === 'acguy'){
    head.add(sph(1.9, M.main, 0, 0, 0));
    head.add(box(2.6, 0.7, 0.6, M.dark, 0, 0.2, 1.5));
    head.add(sph(0.45, M.eye, 0, 0.2, 1.7));
    eye.position.set(0, 0.2, 2.1);
  } else if (st === 'guntank'){
    head.add(box(2.6, 1.6, 3.0, M.main, 0, 0, 0.4));                          // cockpit canopy
    head.add(box(2.0, 0.9, 1.6, M.eye, 0, 0.3, 1.6));
    eye.position.set(0, 0.3, 2.5);
  } else if (st === 'dom'){
    // Dom head: small, wide, low, hunkered into the collar — a cross-ridged faceplate + a mono-eye, no side hoses
    const dm = sph(1.55, M.main, 0, -0.15, -0.1); dm.scale.set(1.35, 0.6, 1.15); head.add(dm);  // wide flattened dome
    head.add(box(2.6, 0.5, 0.5, M.dark, 0, -0.1, 1.05));                      // recessed eye slit
    const domeye = cyl(0.3, 0.3, 0.3, M.eye, 0, -0.1, 1.2, 12).rotateX(Math.PI / 2); // mono-eye (slides in the slit)
    head.add(domeye); parts.monoeye = domeye;
    head.add(box(0.36, 1.5, 0.42, M.main, 0, 0.15, 1.1));                     // vertical face ridge  ┐ forms
    head.add(box(2.3, 0.34, 0.44, M.main, 0, 0.42, 1.0));                     // horizontal brow bar  ┘ the cross
    for (const sx2 of [-1, 1]) head.add(box(0.42, 0.4, 0.5, M.dark, sx2 * 1.35, -0.35, 0.5)); // compact side intakes
    eye.position.set(0, -0.1, 1.6);
  } else if (zeon){
    // Zeon mono-eye head (Zaku / Gouf / Gelgoog / Zaku Tank): a wide domed helmet with a hooded brow, a
    // recessed slit holding a single MOVING mono-eye, a vented jaw, and the signature ribbed respiration
    // pipes looping down BOTH sides to the chin (body-coloured — nothing but the eye glows)
    const dome = sph(1.32, M.main, 0, 0.3, -0.05); dome.scale.set(1.12, 0.98, 1.12); head.add(dome); // crown dome
    head.add(cyl(1.24, 1.12, 1.15, M.main, 0, -0.35, 0, 14));                 // lower helmet / cheeks
    head.add(box(2.05, 0.55, 0.55, M.dark, 0, 0.02, 1.0));                    // recessed dark eye channel
    const monoeye = cyl(0.27, 0.27, 0.3, M.eye, 0, 0.02, 1.16, 12).rotateX(Math.PI / 2); // mono-eye lens (slides in the slit)
    head.add(monoeye); parts.monoeye = monoeye;
    const brow = box(2.0, 0.42, 0.72, M.main, 0, 0.46, 1.05); brow.rotation.x = 0.24; head.add(brow); // hooded brow overhang
    head.add(box(1.4, 0.72, 0.95, M.main, 0, -0.74, 1.05));                   // forward-jutting jaw
    head.add(box(1.55, 0.72, 0.32, M.dark, 0, -0.74, 1.5));                   // mouth-vent grille (dark recess)
    for (const gy of [-0.55, -0.74, -0.93]) head.add(box(1.2, 0.07, 0.22, M.main, 0, gy, 1.66)); // green vent slats
    // ribbed respiration pipes — BOTH sides, body-coloured, arcing from the upper head down to the chin
    for (const sx2 of [-1, 1]){
      const p = ribbedCable(2.1, 0.3, M.main);
      p.position.set(sx2 * 1.2, -0.05, 0.35); p.rotation.x = -0.5; p.rotation.z = sx2 * 0.16;
      head.add(p);
      head.add(cyl(0.37, 0.3, 0.55, M.main, sx2 * 0.95, -1.0, 1.15, 10).rotateX(Math.PI / 2)); // intake elbow into the chin
    }
    if (st === 'gelgoog') head.add(box(0.3, 1.9, 1.9, M.trim, 0, 1.15, 0.05)); // tall head fin
    if (st === 'gouf'){
      head.add(box(0.2, 1.95, 2.5, M.trim, 0, 1.15, -0.15));                  // vertical dorsal blade crest
      const tip = box(0.18, 0.95, 1.0, M.trim, 0, 2.05, -1.1); tip.rotation.x = 0.35; head.add(tip); // swept rear tip
    }
    if (st === 'zaku' && suit.ace){ const a = box(0.16, 1.6, 0.55, M.trim, 0.42, 1.2, 0.05); a.rotation.x = -0.3; head.add(a); } // commander blade antenna
    eye.position.set(0, 0.02, 1.55);
  } else {
    head.add(box(2.0, 1.8, 2.1, M.main));
    head.add(box(1.0, 0.6, 0.6, M.dark, 0, -0.2, -1.2));                      // rear sensor
    if (st === 'gm'){
      // mass-production GM: single wide visor band, forehead crest, no V-fin
      head.add(box(1.05, 1.5, 2.15, M.main, 0, 0.05, 0));                     // flat wide faceframe
      head.add(box(1.7, 0.62, 0.3, M.eye, 0, 0.12, 1.1));                     // continuous visor strip
      head.add(box(0.55, 0.5, 0.4, M.accent, 0, -0.62, 1.0));                 // chin
      head.add(box(0.55, 0.42, 0.3, M.trim, 0, 0.92, 0.7));                   // forehead crest
      const ant = cyl(0.06, 0.1, 1.5, M.trim, 0, 1.5, 0.2);                   // slim command antenna
      ant.rotation.x = -0.2; head.add(ant);
      head.add(cyl(0.17, 0.17, 0.5, M.dark, -1.0, 0.4, 0.7));                 // head vulcan housings
      head.add(cyl(0.17, 0.17, 0.5, M.dark, 1.0, 0.4, 0.7));
      eye.position.set(0, 0.12, 1.5);
    } else if (st === 'guncannon'){
      // Guncannon: goggle band with twin eye cameras, head vulcans, NO V-fin
      head.add(box(1.95, 0.66, 0.4, M.dark, 0, 0.15, 0.95));                  // goggle band
      head.add(box(1.5, 0.34, 0.32, M.eye, 0, 0.15, 1.16));                   // twin eye cameras
      head.add(box(0.55, 0.5, 0.42, M.accent, 0, -0.6, 1.0));                 // chin
      head.add(cyl(0.16, 0.16, 0.42, M.dark, -0.82, 0.5, 0.95));             // head vulcans
      head.add(cyl(0.16, 0.16, 0.42, M.dark, 0.82, 0.5, 0.95));
      eye.position.set(0, 0.15, 1.5);
    } else {
      // RX-78 Gundam: twin slanted eyes, chin, splayed V-fin with jewel
      head.add(box(1.5, 0.45, 0.3, M.eye, 0, 0.25, 1.1));                     // twin eyes
      head.add(box(0.55, 0.55, 0.45, M.accent, 0, -0.55, 1.05));              // chin
      head.add(box(0.4, 0.3, 0.3, M.trim, 0, 0.85, 1.0));                     // sensor jewel
      eye.position.set(0, 0.25, 1.5);
      head.add(cyl(0.22, 0.22, 0.5, M.dark, -1.1, 0.55, 0.6));                // head vulcans
      head.add(cyl(0.22, 0.22, 0.5, M.dark, 1.1, 0.55, 0.6));
      for (const sx of [-1, 1]){                                              // wide-splayed V-fin
        const fin = box(1.8, 0.3, 0.12, M.trim, sx * 0.85, 1.05, 1.0);
        fin.rotation.z = sx * 0.55; head.add(fin);
      }
      head.add(box(0.34, 0.4, 0.2, M.accent, 0, 1.0, 1.08));                  // red fin-base jewel
    }
  }
  head.add(eye); parts.eye = eye;
  root.add(head); parts.head = head;
  parts.eyeMat = M.eye;

  // ---- style extras ----
  if (st === 'guncannon')
    for (const sx of [-1, 1]){
      root.add(cyl(0.6, 0.6, 5.6, M.dark, sx * 2.3, 16.4, 0.6).rotateX(Math.PI / 2));
      root.add(cyl(0.72, 0.72, 1.0, M.dark, sx * 2.3, 16.4, 3.3).rotateX(Math.PI / 2));
    }
  if (st === 'guntank'){
    if (suit.id === 'guntankaa'){
      // anti-air: a flak battery on an elevating mount (parts.turret pitches it skyward). On EACH side of the
      // central arm sits a tri-gun built from TWO stacked triangles of 3 barrels (so 6 barrels per side).
      const mount = new THREE.Group(); mount.position.set(0, 9.3, 0.8); root.add(mount); parts.turret = mount;
      mount.add(box(6.0, 1.4, 2.6, M.main, 0, -0.3, -0.9));                          // traverse base across both sides
      mount.add(box(1.5, 1.7, 1.6, M.accent, 0, 0.6, -1.5));                         // central sighting block
      parts.muzzles = [];                                                           // shots alternate L/R pod barrel tips
      for (const sx of [-1, 1]){
        const pod = new THREE.Group(); pod.position.set(sx * 2.7, 0.2, 0); mount.add(pod);
        pod.add(box(2.0, 3.0, 2.2, M.accent, 0, 0.15, -0.9));                        // tall pod housing
        for (const ty of [0.95, -0.6])                                              // two triangles stacked vertically
          for (const [bx, by] of [[-0.45, 0.3], [0.45, 0.3], [0, -0.32]]){          // triangle: two over one
            pod.add(cyl(0.17, 0.21, 9.6, M.dark, bx, ty + by, 4.7).rotateX(Math.PI / 2));   // long barrel
            pod.add(cyl(0.3, 0.3, 0.6, M.trim, bx, ty + by, 9.3).rotateX(Math.PI / 2));     // muzzle brake
          }
        const muz = new THREE.Object3D(); muz.position.set(0, 0.2, 9.6); pod.add(muz); parts.muzzles.push(muz); // fire from these barrel tips
      }
      if (parts.muzzle){ root.remove(parts.muzzle); mount.add(parts.muzzle); parts.muzzle.position.set(0, 0.3, 10); } // fallback muzzle
    } else {
      for (const sx of [-1, 1]){
        root.add(cyl(0.52, 0.6, 8.0, M.dark, sx * 1.4, 8.6, 2.6).rotateX(Math.PI / 2));
        root.add(cyl(0.64, 0.64, 0.9, M.dark, sx * 1.4, 8.6, 6.2).rotateX(Math.PI / 2));
      }
    }
  }

  if (st === 'gundam') addGundamVariant(suit, root, parts, M);

  root.scale.setScalar(suit.scale);
  return { root, parts };
}

// walk-cycle pose; phase advances with distance moved, amp 0..1
export function poseWalk(parts, phase, amp){
  if (parts.legL){
    parts.legL.rotation.x = Math.sin(phase) * 0.55 * amp;          // measured stride (no over-swing / no sideways sway)
    parts.legR.rotation.x = Math.sin(phase + Math.PI) * 0.55 * amp;
  }
  if (parts.armL) parts.armL.rotation.x = Math.sin(phase + Math.PI) * 0.26 * amp;
}

// combat stance: right arm raised and pointing, weapon held on the aim line.
// pitch is the aim elevation (radians, + up); k is a smoothing factor 0..1.
export function poseAim(parts, pitch, k = 1){
  const easeArm = arm => {
    if (arm) arm.rotation.x += (0 - arm.rotation.x) * k;
  };
  if (parts.turret){
    easeArm(parts.armR);
    // artillery mode drives the mount itself (high lob angle over the back) — don't fight it
    if (parts.turret.userData.artillery) return;
    // Vehicle builders can opt into exact barrel elevation; legacy tanks keep their gentler half-angle motion.
    const pitchScale = parts.turretPitchScale ?? 0.5;
    parts.turret.rotation.x += (-pitch * pitchScale - parts.turret.rotation.x) * k;
    return;
  }
  if (parts.aimIntegrated){ easeArm(parts.armR); return; }
  const aimArms = parts.aimArms?.length ? parts.aimArms : [parts.aimArm || parts.armR].filter(Boolean);
  if (parts.armR && !aimArms.includes(parts.armR)) easeArm(parts.armR);
  if (!aimArms.length) return;
  const target = -(1.45 + pitch * 0.8);
  for (const arm of aimArms) arm.rotation.x += (target - arm.rotation.x) * k;
  // counter-rotate the gun so the barrel tracks the aim exactly
  const aimGun = parts.aimGun || parts.gun;
  if (aimGun) aimGun.rotation.x = -aimArms[0].rotation.x - pitch;
}
