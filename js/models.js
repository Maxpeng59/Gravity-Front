// ---------- real 3D model pipeline ----------
// Loads artist-made models from assets/models/ and normalizes them to game
// space: uniform height, feet at y=0, centered, facing +Z. Suits with no
// model file (or before loading finishes) fall back to the procedural
// builder in mecha.js — drop a file in, add/enable a CONFIG entry, done.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { STLLoader } from '../vendor/STLLoader.js';

// yaw: corrective rotation so the model faces +Z (tune per asset).
// height: normalized head-to-toe meters before suit.scale is applied.
// color: material for untextured formats (STL).
// The complete roster now has authored procedural meshes. Keep the loader available for future
// licensed/custom assets, but do not preload the old unrigged Gouf or nonexistent placeholder files.
const CONFIG = {};

const cache = new Map(); // suitId -> normalized template Group

export const modelFor = id => cache.get(id) || null;

function normalize(obj, cfg){
  const wrap = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(obj);
  inner.rotation.y = cfg.yaw || 0;
  wrap.add(inner);

  // measure after the facing fix, then scale to height and plant feet at y=0
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const s = (cfg.height || 17.5) / Math.max(size.y, 0.001);
  inner.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(wrap);
  const c = box2.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -box2.min.y, -c.z);

  wrap.traverse(o => {
    if (o.isMesh){
      o.castShadow = o.receiveShadow = false;
      if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
  wrap.userData.muzzle = cfg.muzzle || null;
  return wrap;
}

export function preloadModels(){
  const gltf = new GLTFLoader();
  const stl = new STLLoader();
  for (const [id, cfg] of Object.entries(CONFIG)){
    if (cfg.type === 'glb'){
      gltf.load(cfg.url,
        g => { cache.set(id, normalize(g.scene, cfg)); console.log(`[models] ${id} ready (${cfg.url})`); },
        undefined,
        () => console.log(`[models] ${id}: ${cfg.url} not found — using procedural mesh`));
    } else if (cfg.type === 'stl'){
      stl.load(cfg.url,
        geo => {
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cfg.color || 0x8a9aa8, roughness: 0.55, metalness: 0.3 }));
          cache.set(id, normalize(mesh, cfg));
          console.log(`[models] ${id} ready (${cfg.url})`);
        },
        undefined,
        () => console.log(`[models] ${id}: ${cfg.url} not found — using procedural mesh`));
    }
  }
}
