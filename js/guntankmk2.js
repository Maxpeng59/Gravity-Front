// RTX-440-B Guntank Ground Assault Type B — Requiem for Vengeance hero mesh.
// The model is intentionally procedural so it is available synchronously in the suit picker and
// battle renderer. Static pieces are merged by material; the complete linked tracks are instanced.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z); return mesh;
};
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 12) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z); return mesh;
};
const cone = (r, h, m, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m);
  mesh.position.set(x, y, z); return mesh;
};
const sph = (r, m, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  mesh.position.set(x, y, z); return mesh;
};

export function buildGuntankMk2(suit, M){
  const PI = Math.PI;
  const root = new THREE.Group();
  const staticRoot = new THREE.Group(); root.add(staticRoot);
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };

  // Warm olive-brown RfV armour, with metallic running gear and faded tank markings.
  const body = M.main, armour = M.chest, steel = M.accent, trim = M.trim;
  const track = new THREE.MeshStandardMaterial({ color: 0x202225, roughness: 0.83, metalness: 0.35 });
  const joint = new THREE.MeshStandardMaterial({ color: 0x292d2f, roughness: 0.72, metalness: 0.38 });
  const worn = new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 0.54, metalness: 0.62 });
  const red = new THREE.MeshStandardMaterial({ color: 0x855052, roughness: 0.64, metalness: 0.24 });
  const soot = new THREE.MeshStandardMaterial({ color: 0x0e1112, roughness: 0.9, metalness: 0.12 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc0a64d, roughness: 0.5, metalness: 0.48 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0x4a3517, emissive: 0xffb34d, emissiveIntensity: 1.8, roughness: 0.3 });
  const optic = new THREE.MeshStandardMaterial({ color: 0x061713, emissive: 0x6effcf, emissiveIntensity: 2.5, roughness: 0.2 });

  // True bevels on the principal armour volumes keep the shape from reading as stacked boxes.
  function chamfer(w, h, d, material, x = 0, y = 0, z = 0, bevel = 0.12){
    const b = Math.min(bevel, w * 0.16, h * 0.16, d * 0.16);
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2);
    s.lineTo(-w / 2, h / 2); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: d, steps: 1, bevelEnabled: b > 0, bevelSegments: 1,
      bevelSize: b, bevelThickness: b,
    });
    geo.translate(0, 0, -d / 2);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); return mesh;
  }

  // Extruded y/z side profile. Point pairs are [z,y], matching the profile in the official render.
  function profile(points, holes, depth, material, x = 0, y = 0, z = 0){
    const s = new THREE.Shape(); s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
    s.closePath();
    for (const hp of holes || []){
      const p = new THREE.Path(); p.moveTo(hp[0][0], hp[0][1]);
      for (let i = 1; i < hp.length; i++) p.lineTo(hp[i][0], hp[i][1]);
      p.closePath(); s.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth, steps: 1, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2); geo.rotateY(-PI / 2);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); return mesh;
  }

  function hose(points, r = 0.08){
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 28, r, 7, false), soot);
  }

  function bolt(x, y, z, material = worn, r = 0.075){
    const mesh = cyl(r, r, 0.16, material, x, y, z, 8); mesh.rotation.z = PI / 2; return mesh;
  }

  // Bake a hierarchy to one mesh per material in the group's local frame. Instanced links stay separate.
  function compact(group){
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const buckets = new Map(), originals = [];
    group.traverse(o => {
      if (o === group || !o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
      const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      let geo = o.geometry.clone();
      if (geo.index) geo = geo.toNonIndexed();
      geo.applyMatrix4(rel);
      let bucket = buckets.get(o.material.uuid);
      if (!bucket){ bucket = { material: o.material, geometries: [] }; buckets.set(o.material.uuid, bucket); }
      bucket.geometries.push(geo); originals.push(o);
    });
    for (const o of originals) if (o.parent) o.parent.remove(o);
    for (const bucket of buckets.values()){
      const geo = bucket.geometries.length === 1
        ? bucket.geometries[0]
        : mergeGeometries(bucket.geometries, false);
      if (!geo) continue;
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, bucket.material));
    }
  }

  // ==================== TYPE-B RUNNING GEAR ====================
  // High at the rear (-z), low at the nose (+z): intentionally not an equilateral triangle.
  const trackOuter = [[-7.45, 0.28], [7.45, 0.28], [7.28, 2.18], [-2.05, 6.08], [-7.15, 3.02]];
  const trackInner = [[-5.8, 1.02], [5.95, 1.02], [5.7, 1.72], [-2.08, 4.65], [-5.75, 2.48]];
  const shoeMatrices = [];

  function shoeRun(sx, a, b){
    const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
    const count = Math.max(1, Math.round(len / 0.62));
    // The outline is counter-clockwise; this flips local +y toward the outside of the belt.
    const rx = PI - Math.atan2(dy, dz);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0));
    for (let i = 0; i < count; i++){
      const t = (i + 0.5) / count;
      const p = new THREE.Vector3(sx * 4.22, a[1] + dy * t, a[0] + dz * t);
      shoeMatrices.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  }

  for (const sx of [-1, 1]){
    staticRoot.add(profile(trackOuter, [trackInner], 3.18, track, sx * 4.22));
    for (let i = 0; i < trackOuter.length; i++)
      shoeRun(sx, trackOuter[i], trackOuter[(i + 1) % trackOuter.length]);

    // Five road wheels, front/rear idlers and the high rear drive sprocket.
    const wheels = [
      [-5.35, 1.28, 0.92], [-3.0, 1.18, 0.92], [-0.65, 1.18, 0.92],
      [1.7, 1.18, 0.92], [4.05, 1.22, 0.92], [6.3, 1.55, 1.14],
      [-2.05, 5.15, 1.13], [-6.2, 2.28, 1.08],
    ];
    for (const [wz, wy, wr] of wheels){
      staticRoot.add(cyl(wr, wr, 3.24, joint, sx * 4.22, wy, wz, 18).rotateZ(PI / 2));
      staticRoot.add(cyl(wr * 0.72, wr * 0.72, 3.34, worn, sx * 4.22, wy, wz, 18).rotateZ(PI / 2));
      staticRoot.add(cyl(wr * 0.25, wr * 0.25, 3.48, soot, sx * 4.22, wy, wz, 12).rotateZ(PI / 2));
      for (let k = 0; k < 6; k++){
        const a = k / 6 * PI * 2;
        staticRoot.add(bolt(sx * 5.98, wy + Math.sin(a) * wr * 0.48, wz + Math.cos(a) * wr * 0.48, joint, 0.055));
      }
    }
    // Open spokes remain visible behind the physical tread links.
    for (let k = 0; k < 8; k++){
      const sp = box(0.13, 1.72, 0.17, joint, sx * 5.88, 5.15, -2.05);
      sp.rotation.x = k * PI / 8; staticRoot.add(sp);
    }

    // Outer suspension skirt with exposed lower wheels, fasteners and final-drive boss.
    const skirt = [[-6.0, 2.12], [5.55, 2.12], [5.2, 2.72], [-2.0, 5.22], [-5.75, 2.82]];
    staticRoot.add(profile(skirt, [], 0.24, armour, sx * 5.83));
    staticRoot.add(chamfer(0.28, 1.25, 8.4, body, sx * 5.98, 2.02, -0.15, 0.05));
    for (const z of [-4.9, -3.55, -2.2, -0.85, 0.5, 1.85, 3.2, 4.55])
      staticRoot.add(bolt(sx * 6.0, 2.15, z, trim, 0.065));
    staticRoot.add(cyl(0.48, 0.48, 0.25, steel, sx * 5.98, 3.45, -2.1, 16).rotateZ(PI / 2));
    staticRoot.add(cyl(0.24, 0.24, 0.29, joint, sx * 6.0, 3.45, -2.1, 12).rotateZ(PI / 2));
    for (const [by, bz] of [[2.7, -5.0], [3.25, -4.3], [2.55, 4.7]])
      staticRoot.add(bolt(sx * 6.0, by, bz));
  }

  // A single instanced double-grouser shoe goes around both complete belts.
  const shoeBase = new THREE.BoxGeometry(3.42, 0.3, 0.56).toNonIndexed();
  const grouserA = new THREE.BoxGeometry(3.62, 0.13, 0.16); grouserA.translate(0, 0.2, -0.14);
  const grouserB = new THREE.BoxGeometry(3.62, 0.13, 0.16); grouserB.translate(0, 0.2, 0.14);
  const shoeGeo = mergeGeometries([shoeBase, grouserA.toNonIndexed(), grouserB.toNonIndexed()], false);
  const shoes = new THREE.InstancedMesh(shoeGeo, track, shoeMatrices.length);
  shoeMatrices.forEach((matrix, i) => shoes.setMatrixAt(i, matrix));
  shoes.instanceMatrix.needsUpdate = true; root.add(shoes);

  // ==================== LOW CENTRAL HULL / LONG FACETED NOSE ====================
  staticRoot.add(chamfer(6.2, 1.48, 12.7, body, 0, 2.15, 0.0, 0.16));
  staticRoot.add(chamfer(5.82, 1.75, 9.7, armour, 0, 3.96, 1.0, 0.14).rotateX(0.17));
  staticRoot.add(chamfer(5.35, 0.26, 8.8, body, 0, 4.77, 0.9, 0.06).rotateX(0.17));
  staticRoot.add(chamfer(5.72, 0.7, 3.2, body, 0, 3.0, 6.25, 0.11).rotateX(0.28));
  staticRoot.add(chamfer(6.3, 0.48, 0.65, steel, 0, 2.15, 6.75, 0.08));

  const hatch = chamfer(2.2, 0.16, 3.0, body, 0, 4.93, 0.5, 0.05);
  hatch.rotation.x = 0.17; staticRoot.add(hatch);
  // Large layered maintenance panels and edge rails break up the Type-B's long glacis.
  for (const sx of [-1, 1]){
    const service = chamfer(1.5, 0.12, 2.15, steel, sx * 0.92, 5.05, 2.45, 0.04);
    service.rotation.x = 0.17; staticRoot.add(service);
    const inset = chamfer(1.08, 0.08, 1.55, joint, sx * 0.92, 5.13, 2.45, 0.025);
    inset.rotation.x = 0.17; staticRoot.add(inset);
    const rail = box(0.1, 0.12, 6.85, joint, sx * 2.52, 4.98, 0.72);
    rail.rotation.x = 0.17; staticRoot.add(rail);
  }
  const nosePlate = chamfer(2.15, 0.12, 1.2, body, 0, 4.53, 5.02, 0.04);
  nosePlate.rotation.x = 0.27; staticRoot.add(nosePlate);
  for (const sx of [-1, 1]) for (const z of [1.7, 3.15]){
    const fastener = cyl(0.065, 0.065, 0.1, worn, sx * 1.48, 5.19, z, 8);
    fastener.rotation.x = PI / 2 + 0.17; staticRoot.add(fastener);
  }
  for (const sx of [-1, 1]){
    const ventBase = box(0.78, 0.13, 3.15, soot, sx * 1.95, 4.91, 0.75);
    ventBase.rotation.x = 0.17; staticRoot.add(ventBase);
    for (let i = 0; i < 8; i++){
      const slat = box(0.84, 0.09, 0.14, worn, sx * 1.95, 5.01, -0.52 + i * 0.38);
      slat.rotation.x = 0.17; staticRoot.add(slat);
    }
  }
  for (const sx of [-1, 1]){
    // Twin headlamps, tow hooks and shock bodies across the nose.
    staticRoot.add(chamfer(0.75, 0.55, 0.58, steel, sx * 2.18, 3.17, 6.5, 0.09));
    for (const lx of [-0.17, 0.17])
      staticRoot.add(cyl(0.1, 0.1, 0.17, lamp, sx * 2.18 + lx, 3.2, 6.84, 10).rotateX(PI / 2));
    staticRoot.add(cyl(0.18, 0.18, 1.4, worn, sx * 1.55, 2.62, 6.93, 12).rotateZ(PI / 2));
    staticRoot.add(chamfer(0.34, 0.72, 0.46, joint, sx * 2.55, 1.82, 6.88, 0.06));
  }
  staticRoot.add(cyl(0.1, 0.1, 4.6, worn, 0, 2.72, 6.97, 10).rotateZ(PI / 2));

  // ==================== NARROW WAIST AND HEADLESS CASEMATE ====================
  staticRoot.add(cyl(2.05, 2.25, 0.66, joint, 0, 5.75, -0.55, 16));
  staticRoot.add(chamfer(3.45, 3.35, 3.2, body, 0, 7.25, -0.55, 0.2));
  staticRoot.add(chamfer(3.8, 0.58, 3.5, steel, 0, 8.78, -0.45, 0.1));
  for (const sx of [-1, 1]){
    const brace = box(0.4, 3.1, 0.5, joint, sx * 1.5, 7.18, 0.42);
    brace.rotation.z = -sx * 0.16; staticRoot.add(brace);
    staticRoot.add(cyl(0.16, 0.2, 2.2, worn, sx * 1.17, 7.2, 1.05, 10));
    staticRoot.add(chamfer(0.72, 1.3, 0.28, armour, sx * 1.2, 7.25, 1.25, 0.06));
  }

  staticRoot.add(chamfer(7.35, 4.35, 4.85, body, 0, 10.7, 0.0, 0.28));
  staticRoot.add(chamfer(7.75, 0.66, 5.0, joint, 0, 8.73, -0.02, 0.13));
  staticRoot.add(chamfer(6.72, 0.34, 4.42, armour, 0, 12.82, -0.08, 0.09));
  staticRoot.add(chamfer(6.5, 3.25, 0.5, armour, 0, 10.65, 2.56, 0.12));
  staticRoot.add(chamfer(5.95, 0.46, 0.42, joint, 0, 9.02, 2.75, 0.08));
  staticRoot.add(chamfer(2.7, 2.45, 0.25, body, 0.52, 10.9, 2.88, 0.06));
  staticRoot.add(chamfer(0.42, 0.72, 0.18, soot, 1.12, 11.55, 3.04, 0.04));
  staticRoot.add(chamfer(0.23, 0.48, 0.12, optic, 1.12, 11.55, 3.16, 0.03));
  for (const sx of [-1, 1]){
    const cheek = chamfer(1.15, 2.65, 0.35, steel, sx * 2.65, 10.68, 2.8, 0.1);
    cheek.rotation.z = -sx * 0.08; staticRoot.add(cheek);
    for (let i = 0; i < 5; i++)
      staticRoot.add(box(0.12, 0.24, 0.16, joint, sx * 3.05, 9.75 + i * 0.42, 3.03));
  }

  // Compact ring-and-cross Earth Federation crest on the chest.
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 6, 20), gold);
  crest.position.set(0.4, 10.55, 3.18); staticRoot.add(crest);
  staticRoot.add(box(0.08, 0.72, 0.06, gold, 0.4, 10.55, 3.18));
  staticRoot.add(box(0.72, 0.08, 0.06, gold, 0.4, 10.55, 3.18));

  // Side radiator banks and twelve smoke dischargers (six per shoulder).
  for (const sx of [-1, 1]){
    staticRoot.add(chamfer(0.28, 1.5, 1.12, soot, sx * 3.82, 10.05, -0.45, 0.05));
    for (let i = 0; i < 6; i++)
      staticRoot.add(box(0.12, 0.13, 1.0, worn, sx * 3.98, 9.45 + i * 0.22, -0.45));
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++){
      const discharger = cyl(0.105, 0.13, 0.68, joint, sx * (3.05 + col * 0.2), 12.1 + row * 0.22, 2.18, 8);
      discharger.rotation.x = PI / 2 - 0.18; discharger.rotation.z = -sx * 0.14;
      staticRoot.add(discharger);
    }
  }

  // ==================== SEGMENTED ARMS / ASYMMETRIC WEAPON PODS ====================
  for (const sx of [-1, 1]){
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), joint);
    shoulder.position.set(sx * 4.1, 11.05, 0.0); shoulder.scale.set(1.12, 1, 1.05);
    staticRoot.add(shoulder);
    const cap = chamfer(1.25, 1.62, 2.05, armour, sx * 4.62, 11.37, -0.08, 0.15);
    cap.rotation.z = -sx * 0.18; staticRoot.add(cap);

    const upper = cyl(0.73, 0.78, 2.35, joint, sx * 4.75, 10.25, 0.45, 18);
    upper.rotation.z = -sx * 0.72; staticRoot.add(upper);
    for (let i = -2; i <= 2; i++){
      const t = i * 0.29;
      const band = cyl(0.87, 0.87, 0.24, armour, sx * (4.75 + t * 0.66), 10.25 - t * 0.75, 0.45, 16);
      band.rotation.z = -sx * 0.72; staticRoot.add(band);
    }
    const elbow = sph(0.82, joint, sx * 5.35, 9.55, 0.86);
    elbow.scale.set(1, 1, 1.15); staticRoot.add(elbow);

    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(1.23, 2.0, 7, 18), armour);
    pod.position.set(sx * 5.4, 9.55, 2.65); pod.rotation.x = PI / 2; staticRoot.add(pod);
    for (const pz of [1.05, 2.0, 3.05, 4.05])
      staticRoot.add(cyl(1.29, 1.29, 0.16, steel, sx * 5.4, 9.55, pz, 18).rotateX(PI / 2));
    staticRoot.add(chamfer(1.0, 0.38, 3.0, body, sx * 5.4, 10.72, 2.52, 0.08));
    for (let k = 0; k < 8; k++){
      const a = k / 8 * PI * 2;
      staticRoot.add(bolt(sx * 5.4 + Math.cos(a) * 1.02, 9.55 + Math.sin(a) * 1.02, 4.48, worn, 0.055));
    }

    if (sx < 0){
      // Vehicle-right arm: four 30 mm Bop barrels in a 2×2 cluster.
      for (const ox of [-0.42, 0.42]) for (const oy of [-0.42, 0.42]){
        staticRoot.add(cyl(0.19, 0.24, 2.4, joint, sx * 5.4 + ox, 9.55 + oy, 5.55, 12).rotateX(PI / 2));
        staticRoot.add(cyl(0.27, 0.27, 0.28, worn, sx * 5.4 + ox, 9.55 + oy, 6.68, 12).rotateX(PI / 2));
        staticRoot.add(cyl(0.12, 0.12, 0.08, soot, sx * 5.4 + ox, 9.55 + oy, 6.86, 10).rotateX(PI / 2));
      }
    } else {
      // Vehicle-left arm: twin Bop guns below one oversized flamethrower nozzle.
      for (const ox of [-0.38, 0.38]){
        staticRoot.add(cyl(0.18, 0.23, 2.15, joint, sx * 5.4 + ox, 9.18, 5.45, 12).rotateX(PI / 2));
        staticRoot.add(cyl(0.11, 0.11, 0.08, soot, sx * 5.4 + ox, 9.18, 6.58, 10).rotateX(PI / 2));
      }
      staticRoot.add(cyl(0.42, 0.55, 2.15, joint, sx * 5.4, 10.12, 5.48, 14).rotateX(PI / 2));
      staticRoot.add(cyl(0.31, 0.31, 0.1, soot, sx * 5.4, 10.12, 6.62, 12).rotateX(PI / 2));
      staticRoot.add(chamfer(0.9, 0.72, 0.55, steel, sx * 5.4, 10.86, 4.1, 0.09));
    }
  }

  // ==================== LONG REAR FUEL PACKS ====================
  for (const sx of [-1, 1]){
    staticRoot.add(chamfer(1.62, 4.45, 1.55, body, sx * 1.55, 10.42, -3.12, 0.18));
    staticRoot.add(chamfer(1.35, 3.6, 0.38, steel, sx * 1.55, 10.35, -4.0, 0.08));
    for (let i = 0; i < 5; i++)
      staticRoot.add(box(1.46, 0.18, 0.48, joint, sx * 1.55, 8.77 + i * 0.31, -4.12));
    // Red-banded transverse caps visible over the chest from the front.
    staticRoot.add(cyl(0.78, 0.78, 2.0, trim, sx * 1.55, 13.15, -3.0, 18).rotateZ(PI / 2));
    staticRoot.add(cyl(0.84, 0.84, 0.46, red, sx * 1.55, 13.15, -3.0, 18).rotateZ(PI / 2));
    staticRoot.add(cyl(0.62, 0.62, 0.12, joint, sx * 2.55, 13.15, -3.0, 14).rotateZ(PI / 2));
    staticRoot.add(chamfer(1.78, 0.52, 1.72, armour, sx * 1.55, 13.72, -3.02, 0.1));
    const antenna = cyl(0.022, 0.038, 6.7, joint, sx * 1.78, 17.15, -3.18, 6);
    antenna.rotation.z = -sx * 0.07; antenna.rotation.x = 0.045; staticRoot.add(antenna);
  }
  staticRoot.add(hose([[5.55, 10.55, 1.45], [6.35, 11.2, 0.2], [5.65, 12.45, -2.2], [3.0, 12.6, -3.15]], 0.09));
  staticRoot.add(hose([[5.75, 9.95, 1.3], [6.65, 10.5, -0.2], [5.4, 11.7, -2.75], [2.7, 11.4, -3.45]], 0.075));

  // ==================== REAR CONCAVE DOZER BLADE ====================
  for (const sx of [-1, 1]){
    const push = box(0.58, 0.7, 4.1, joint, sx * 2.55, 2.1, -7.25);
    push.rotation.x = -0.18; staticRoot.add(push);
  }
  const bladeC = chamfer(4.9, 2.65, 0.42, worn, 0, 1.72, -9.3, 0.08);
  bladeC.rotation.x = -0.07; staticRoot.add(bladeC);
  for (const sx of [-1, 1]){
    const wing = chamfer(3.25, 2.65, 0.42, worn, sx * 3.95, 1.72, -9.02, 0.08);
    wing.rotation.y = -sx * 0.17; wing.rotation.x = -0.07; staticRoot.add(wing);
    staticRoot.add(box(0.18, 2.45, 0.24, joint, sx * 2.48, 1.75, -9.52));
  }
  staticRoot.add(box(11.35, 0.25, 0.54, steel, 0, 0.43, -9.22));
  for (let i = 0; i < 17; i++)
    staticRoot.add(cyl(0.055, 0.055, 0.12, joint, -5.15 + i * 0.65, 0.52, -9.54, 8).rotateX(PI / 2));

  // ==================== VEHICLE-RIGHT TORSO 220 MM CANNON ====================
  const cannonMount = new THREE.Group();
  cannonMount.position.set(-2.2, 11.72, 1.72); cannonMount.rotation.x = -0.045; root.add(cannonMount);
  cannonMount.add(chamfer(1.62, 1.72, 1.5, joint, 0, 0, 0.15, 0.2));
  cannonMount.add(cyl(0.88, 0.88, 0.46, steel, 0, 0, 0.75, 18).rotateX(PI / 2));
  const cannonSlide = new THREE.Group(); cannonMount.add(cannonSlide);
  cannonSlide.add(cyl(0.72, 0.82, 2.15, armour, 0, 0, 1.62, 20).rotateX(PI / 2));
  cannonSlide.add(cyl(0.66, 0.66, 0.33, joint, 0, 0, 2.42, 18).rotateX(PI / 2));
  cannonSlide.add(cyl(0.55, 0.62, 1.7, steel, 0, 0, 3.05, 20).rotateX(PI / 2));
  cannonSlide.add(cyl(0.24, 0.43, 9.4, joint, 0, 0, 7.85, 18).rotateX(PI / 2));
  for (const z of [3.65, 4.15])
    cannonSlide.add(cyl(0.52, 0.52, 0.18, worn, 0, 0, z, 18).rotateX(PI / 2));

  // Perforated cylindrical muzzle brake with three rings of inset ports.
  cannonSlide.add(cyl(0.39, 0.39, 2.0, worn, 0, 0, 13.35, 18).rotateX(PI / 2));
  for (const z of [12.75, 13.3, 13.85]) for (let i = 0; i < 8; i++){
    const a = i / 8 * PI * 2;
    const port = cyl(0.065, 0.065, 0.16, soot, Math.cos(a) * 0.38, Math.sin(a) * 0.38, z, 7);
    port.rotation.z = a - PI / 2; cannonSlide.add(port);
  }
  cannonSlide.add(cyl(0.3, 0.34, 0.22, soot, 0, 0, 14.43, 16).rotateX(PI / 2));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 14.58); cannonSlide.add(muzzle);
  parts.muzzle = muzzle; parts.turret = cannonMount; parts.cannonSlide = cannonSlide; parts.gun = cannonSlide;
  compact(cannonSlide);

  // Gameplay anchors and rear exhaust flicker.
  for (const sx of [-1, 1]){
    const flame = cone(0.32, 1.25, M.flame, sx * 1.55, 9.0, -4.2);
    flame.rotation.x = -PI / 2; flame.scale.y = 0.01; root.add(flame); parts.flames.push(flame);
  }
  const eye = new THREE.Object3D(); eye.position.set(1.12, 11.55, 3.18); root.add(eye); parts.eye = eye;
  const head = new THREE.Object3D(); head.position.set(0, 10.8, 0); root.add(head); parts.head = head;
  const blade = cyl(0.08, 0.08, 1, M.blade, 0, 3, 0); blade.visible = false; root.add(blade); parts.blade = blade;
  parts.eyeMat = optic;

  compact(staticRoot);
  root.userData.heroMesh = 'RTX-440-B';
  root.scale.setScalar(suit.scale);
  return { root, parts };
}
