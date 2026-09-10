import * as THREE from 'three';

// Galcezon attack SFS: a broad two-MS flight deck surrounded by faceted armour,
// four articulated spherical thruster pods, a pointed command bow and live guns.
// +Z is forward, matching Gravity Front's vehicle and muzzle convention.
export function buildGalcezon(suit, M){
  const root = new THREE.Group();
  const parts = { flames: [], legL: null, legR: null, armL: null, armR: null, gun: null };
  const body = new THREE.Group(); root.add(body); parts.body = body;
  const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); body.add(mesh); return mesh;
  };
  const cyl = (rt, rb, h, material, x = 0, y = 0, z = 0, seg = 16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    mesh.position.set(x, y, z); body.add(mesh); return mesh;
  };
  const wedge = (points, depth, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); body.add(mesh); return mesh;
  };

  const cream = M.main, rust = M.chest, red = M.accent, dark = M.dark, trim = M.trim;
  const deck = new THREE.MeshStandardMaterial({ color: 0xb9ad8b, roughness: 0.74, metalness: 0.28 });
  const intake = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.34, metalness: 0.78 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x301000, emissive: 0xff7a28, emissiveIntensity: 3.2 });

  // Central hull and the long deployable two-machine deck.
  box(10.8, 2.2, 24, rust, 0, 2.0, -0.5);
  box(8.7, 0.65, 21.5, deck, 0, 3.42, -1.0);
  box(7.5, 0.18, 19.5, dark, 0, 3.8, -1.0);
  box(6.9, 0.12, 18.8, deck, 0, 3.92, -1.0);
  // Two visible MS docking bays, each with longitudinal boot rails and hand grips.
  for (const z of [4.2, -5.2]){
    for (const x of [-2.15, 2.15]) box(0.32, 0.2, 6.0, trim, x, 4.08, z);
    for (const x of [-3.05, 3.05]){
      box(0.18, 1.15, 0.18, dark, x, 4.58, z - 1.9);
      box(0.75, 0.18, 0.18, trim, x + (x < 0 ? 0.3 : -0.3), 5.1, z - 1.9);
    }
    box(5.6, 0.12, 0.4, red, 0, 4.05, z + 2.65);
  }

  // Pointed armoured bow / command block with layered sensor glazing.
  wedge([[-5.4,-1.2],[5.4,-1.2],[3.2,1.8],[-3.2,1.8]], 5.5, rust, 0, 2.4, 12.1, Math.PI / 2);
  wedge([[-3.1,-0.8],[3.1,-0.8],[2.0,1.25],[-2.0,1.25]], 3.1, cream, 0, 4.15, 12.7, Math.PI / 2);
  box(3.8, 0.7, 1.6, M.eye, 0, 4.55, 14.0);
  for (const x of [-3.5, 3.5]){
    const cheek = box(2.3, 2.0, 7.0, rust, x, 2.25, 9.6); cheek.rotation.z = x < 0 ? -0.16 : 0.16;
    box(1.55, 0.45, 4.8, cream, x, 3.5, 9.8);
  }

  // Faceted side armour and folding rear hatch/deck extensions.
  for (const sx of [-1, 1]){
    wedge([[-1.0,-2.0],[1.1,-1.25],[1.1,1.25],[-1.0,2.0]], 19.0, rust, sx * 6.2, 2.25, -1.0, 0, 0, sx < 0 ? Math.PI : 0);
    box(1.15, 0.55, 14.0, cream, sx * 6.15, 3.72, -1.0);
    const aft = box(2.6, 0.7, 6.5, cream, sx * 4.5, 3.15, -13.3); aft.rotation.z = sx * -0.12;
    for (let z = -8; z <= 7; z += 3.8) box(0.5, 0.3, 1.8, dark, sx * 6.65, 2.2, z);
  }
  box(8.5, 1.0, 5.0, cream, 0, 2.8, -13.5);
  box(7.2, 0.35, 6.0, deck, 0, 3.55, -14.0);

  // Four ball-mounted jet pods with nested turbine faces and lit exhaust cores.
  for (const [x, z] of [[-8.2,6.0],[8.2,6.0],[-8.2,-7.2],[8.2,-7.2]]){
    const arm = box(2.0, 0.8, 2.8, dark, x * 0.78, 2.4, z); arm.rotation.z = x < 0 ? -0.28 : 0.28;
    const pod = new THREE.Mesh(new THREE.SphereGeometry(3.15, 18, 12), rust); pod.scale.set(1, 0.82, 1.12); pod.position.set(x, 1.95, z); body.add(pod);
    const ring = cyl(2.25, 2.25, 0.8, dark, x, 1.95, z - 3.0, 20); ring.rotation.x = Math.PI / 2;
    const fan = cyl(1.65, 1.65, 0.35, intake, x, 1.95, z - 3.5, 16); fan.rotation.x = Math.PI / 2;
    for (let spoke = 0; spoke < 8; spoke++){
      const blade = box(0.18, 1.45, 0.2, trim, x, 1.95, z - 3.72); blade.rotation.z = spoke * Math.PI / 4;
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.35, 4.6, 12), glow);
    flame.position.set(x, 1.95, z - 5.2); flame.rotation.x = -Math.PI / 2; flame.scale.y = 0.35;
    body.add(flame); parts.flames.push(flame);
  }

  // Traversing dorsal attack turret: triple beam cannon plus two missile racks.
  const turretYaw = new THREE.Group(); turretYaw.position.set(0, 5.0, 10.0); body.add(turretYaw); parts.turretYaw = turretYaw;
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.35, 0.8, 14), dark); turretYaw.add(turretBase);
  const turret = new THREE.Group(); turret.position.y = 0.65; turretYaw.add(turret); parts.turret = turret;
  const beamMuzzles = [];
  for (const x of [-0.72, 0, 0.72]){
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.27, 6.8, 10), dark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(x, 0.2, 3.2); turret.add(barrel);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.7, 10), trim);
    collar.rotation.x = Math.PI / 2; collar.position.set(x, 0.2, 6.45); turret.add(collar);
    const muzzle = new THREE.Object3D(); muzzle.position.set(x, 0.2, 6.9); turret.add(muzzle); beamMuzzles.push(muzzle);
  }
  const missileMuzzles = [];
  for (const sx of [-1, 1]){
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 3.0), red); rack.position.set(sx * 2.0, 0.1, 2.0); turret.add(rack);
    for (const [mx, my] of [[-0.28,-0.22],[0.28,-0.22],[-0.28,0.22],[0.28,0.22]]){
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.8, 8), dark);
      tube.rotation.x = Math.PI / 2; tube.position.set(sx * 2.0 + mx, my + 0.1, 2.2); turret.add(tube);
      const muzzle = new THREE.Object3D(); muzzle.position.set(sx * 2.0 + mx, my + 0.1, 3.7); turret.add(muzzle); missileMuzzles.push(muzzle);
    }
  }
  parts.muzzle = beamMuzzles[1]; parts.muzzles = beamMuzzles;
  parts.weaponMuzzles = [beamMuzzles, missileMuzzles];
  const eye = new THREE.Object3D(); eye.position.set(0, 4.6, 14.6); body.add(eye); parts.eye = eye; parts.head = eye; parts.eyeMat = M.eye;
  const blade = new THREE.Object3D(); blade.visible = false; body.add(blade); parts.blade = blade;
  root.scale.setScalar(suit.scale || 1);
  return { root, parts };
}
