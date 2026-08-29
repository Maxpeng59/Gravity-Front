// Shared high-detail procedural modelling helpers used by the canonical unit builders.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export { THREE };

export const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); return mesh;
};

export const cyl = (rt, rb, h, material, x = 0, y = 0, z = 0, seg = 14) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y, z); return mesh;
};

export const cone = (r, h, material, x = 0, y = 0, z = 0, seg = 10) => {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material);
  mesh.position.set(x, y, z); return mesh;
};

export const sph = (r, material, x = 0, y = 0, z = 0, ws = 18, hs = 12) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), material);
  mesh.position.set(x, y, z); return mesh;
};

export const ico = (r, material, x = 0, y = 0, z = 0, detail = 1) => {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), material);
  mesh.position.set(x, y, z); return mesh;
};

export function chamferBox(w, h, d, material, x = 0, y = 0, z = 0, bevel = 0.12){
  const b = Math.min(bevel, w * 0.16, h * 0.16, d * 0.16);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d, steps: 1, bevelEnabled: b > 0, bevelSegments: 1,
    bevelSize: b, bevelThickness: b,
  });
  geo.translate(0, 0, -d / 2);
  const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); return mesh;
}

// Extruded y/z silhouette. Point pairs are [z, y].
export function profile(points, holes, depth, material, x = 0, y = 0, z = 0){
  const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  for (const hp of holes || []){
    const path = new THREE.Path(); path.moveTo(hp[0][0], hp[0][1]);
    for (let i = 1; i < hp.length; i++) path.lineTo(hp[i][0], hp[i][1]);
    path.closePath(); shape.holes.push(path);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); return mesh;
}

export function tube(points, radius, material, tubularSegments = 32, radialSegments = 8, closed = false){
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed), material);
}

export function ribbedCable(points, radius, material, ribMaterial = material, ribs = 14){
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, ribs * 2), radius * 0.62, 7, false), material));
  const ringGeo = new THREE.TorusGeometry(radius, radius * 0.22, 5, 9);
  const tangent = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1);
  for (let i = 1; i < ribs; i++){
    const t = i / ribs, ring = new THREE.Mesh(ringGeo, ribMaterial);
    ring.position.copy(curve.getPointAt(t)); curve.getTangentAt(t, tangent).normalize();
    ring.quaternion.setFromUnitVectors(up, tangent); group.add(ring);
  }
  return group;
}

export function materialSet(colors, zeon = false){
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3, ...extra });
  return {
    main: standard(colors.main), chest: standard(colors.chest), accent: standard(colors.accent), trim: standard(colors.trim),
    dark: standard(0x25292d, { roughness: 0.68, metalness: 0.42 }),
    frame: standard(0x3a3f43, { roughness: 0.58, metalness: 0.62 }),
    joint: standard(0x202326, { roughness: 0.72, metalness: 0.48 }),
    glass: standard(0x162638, { roughness: 0.12, metalness: 0.52, transparent: true, opacity: 0.82, emissive: 0x324e6f, emissiveIntensity: 0.55 }),
    eye: standard(0x080808, { emissive: zeon ? 0xff3154 : 0x65ffde, emissiveIntensity: 2.6 }),
    flame: standard(0x331100, { emissive: 0xff8830, emissiveIntensity: 2.7, transparent: true, opacity: 0.9 }),
    blade: standard(0x220022, { emissive: zeon ? 0xffc94c : 0xff8ee6, emissiveIntensity: 3, transparent: true, opacity: 0.92 }),
    heat: standard(0x3a1206, { emissive: 0xff5a1e, emissiveIntensity: 2.5 }),
    gold: standard(0xc5a139, { roughness: 0.42, metalness: 0.58 }),
  };
}

// Merge every ordinary mesh below a group into one draw call per material, retaining child anchors
// and InstancedMeshes. Geometry is transformed back into the compacted group's local frame.
export function compactGroup(group){
  group.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), originals = [];
  group.traverse(object => {
    if (object === group || !object.isMesh || object.isInstancedMesh || Array.isArray(object.material)) return;
    const relative = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    let geo = object.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    geo.applyMatrix4(relative);
    let bucket = buckets.get(object.material.uuid);
    if (!bucket){ bucket = { material: object.material, geometries: [] }; buckets.set(object.material.uuid, bucket); }
    bucket.geometries.push(geo); originals.push(object);
  });
  for (const mesh of originals) if (mesh.parent) mesh.parent.remove(mesh);
  for (const bucket of buckets.values()){
    const geo = bucket.geometries.length === 1 ? bucket.geometries[0] : mergeGeometries(bucket.geometries, false);
    if (!geo) continue;
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, bucket.material));
  }
  return group;
}

export function boltRing(parent, material, axis, center, ringRadius, boltRadius = 0.07, count = 8){
  for (let i = 0; i < count; i++){
    const a = i / count * Math.PI * 2;
    const p = new THREE.Vector3(...center);
    let bolt;
    if (axis === 'x'){
      p.y += Math.sin(a) * ringRadius; p.z += Math.cos(a) * ringRadius;
      bolt = cyl(boltRadius, boltRadius, 0.16, material, p.x, p.y, p.z, 8).rotateZ(Math.PI / 2);
    } else if (axis === 'z'){
      p.x += Math.cos(a) * ringRadius; p.y += Math.sin(a) * ringRadius;
      bolt = cyl(boltRadius, boltRadius, 0.16, material, p.x, p.y, p.z, 8).rotateX(Math.PI / 2);
    } else {
      p.x += Math.cos(a) * ringRadius; p.z += Math.sin(a) * ringRadius;
      bolt = cyl(boltRadius, boltRadius, 0.16, material, p.x, p.y, p.z, 8);
    }
    parent.add(bolt);
  }
}

export function addThruster(parent, parts, material, flameMaterial, x, y, z, radius = 0.5, length = 2.1, direction = 'down'){
  const nozzle = cyl(radius * 0.72, radius, radius * 0.85, material, x, y, z, 12);
  const flame = cone(radius * 0.72, length, flameMaterial, x, y, z);
  if (direction === 'rear'){
    nozzle.rotation.x = Math.PI / 2; flame.rotation.x = -Math.PI / 2; flame.position.z -= length * 0.55;
  } else {
    flame.rotation.x = Math.PI; flame.position.y -= length * 0.55;
  }
  flame.scale.y = 0.01; parent.add(nozzle, flame); parts.flames.push(flame);
  return nozzle;
}

// Physical continuous track links around a y/z polyline. One InstancedMesh covers both sides.
export function instancedTrack(path, xCenters, width, pitch, material, grouser = true){
  const matrices = [], PI = Math.PI;
  for (const x of xCenters){
    for (let j = 0; j < path.length; j++){
      const a = path[j], b = path[(j + 1) % path.length];
      const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
      const count = Math.max(1, Math.round(len / pitch));
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI - Math.atan2(dy, dz), 0, 0));
      for (let i = 0; i < count; i++){
        const t = (i + 0.5) / count;
        matrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, a[1] + dy * t, a[0] + dz * t), q, new THREE.Vector3(1, 1, 1)));
      }
    }
  }
  const base = new THREE.BoxGeometry(width, pitch * 0.48, pitch * 0.92).toNonIndexed();
  let geo = base;
  if (grouser){
    const a = new THREE.BoxGeometry(width * 1.06, pitch * 0.22, pitch * 0.22); a.translate(0, pitch * 0.31, -pitch * 0.22);
    const b = new THREE.BoxGeometry(width * 1.06, pitch * 0.22, pitch * 0.22); b.translate(0, pitch * 0.31, pitch * 0.22);
    geo = mergeGeometries([base, a.toNonIndexed(), b.toNonIndexed()], false);
  }
  const links = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((matrix, i) => links.setMatrixAt(i, matrix)); links.instanceMatrix.needsUpdate = true;
  return links;
}
