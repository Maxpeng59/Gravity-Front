// ---------- anime battle effects ----------
// Hard-edged, cel-animated combat effects: hot-core fireballs that break into two-tone smoke,
// star-cross muzzle flashes, spark streaks, shock rings and glowing beam / tracer bolts.
// Everything is pooled and budgeted so mass battles keep their frame rate: the oldest effect is
// recycled when a pool is full, and distant muzzle flashes are skipped outright.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

// ---------- shared textures ----------
function canvasTexture(size, paint){
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); paint(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let textures = null;
function sharedTextures(){
  if (textures) return textures;
  textures = {
    glow: canvasTexture(128, (g, s) => {
      const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.22, 'rgba(255,255,255,0.95)');
      r.addColorStop(0.5, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, s, s);
    }),
    // four-point animation star used for muzzle flashes and hit sparks
    star: canvasTexture(128, (g, s) => {
      const c = s / 2;
      g.translate(c, c);
      g.fillStyle = '#fff';
      for (let i = 0; i < 4; i++){
        g.rotate(Math.PI / 2);
        g.beginPath(); g.moveTo(0, -c * 0.98); g.lineTo(c * 0.1, -c * 0.12); g.lineTo(-c * 0.1, -c * 0.12); g.closePath(); g.fill();
      }
      for (let i = 0; i < 4; i++){
        g.rotate(Math.PI / 2);
        g.beginPath(); g.moveTo(0, -c * 0.5); g.lineTo(c * 0.08, -c * 0.1); g.lineTo(-c * 0.08, -c * 0.1); g.closePath();
        g.save(); g.rotate(Math.PI / 4); g.fill(); g.restore();
      }
      const r = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.34);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.beginPath(); g.arc(0, 0, c * 0.34, 0, Math.PI * 2); g.fill();
    }),
  };
  return textures;
}

// ---------- cel fire / smoke shader ----------
const CEL_FIRE_VERTEX = /* glsl */`
varying vec3 vN;
varying vec3 vView;
varying vec3 vP;
#include <fog_pars_vertex>
void main() {
	vP = position;
	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
	vN = normalize( normalMatrix * normal );
	vView = normalize( -mvPosition.xyz );
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;

const CEL_FIRE_FRAGMENT = /* glsl */`
uniform float uT;
uniform float uSeed;
uniform float uSmoke;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
uniform vec3 uSmokeLit;
uniform vec3 uSmokeShade;
varying vec3 vN;
varying vec3 vView;
varying vec3 vP;
#include <fog_pars_fragment>
float hash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float noise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( hash( i ), hash( i + vec3( 1, 0, 0 ) ), f.x ), mix( hash( i + vec3( 0, 1, 0 ) ), hash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( hash( i + vec3( 0, 0, 1 ) ), hash( i + vec3( 1, 0, 1 ) ), f.x ), mix( hash( i + vec3( 0, 1, 1 ) ), hash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
void main() {
	float facing = clamp( dot( normalize( vN ), normalize( vView ) ), 0.0, 1.0 );
	float n = noise( vP * 2.4 + uSeed ) * 0.62 + noise( vP * 5.3 + uSeed * 1.7 ) * 0.38;
	// dissolve eats in from the rim as the effect ages — hard cut, no alpha blending
	if ( n < uT * 1.12 - facing * 0.3 ) discard;
	vec3 color;
	if ( uSmoke > 0.5 ) {
		float lit = step( 0.42, dot( normalize( vN ), normalize( vec3( 0.35, 0.85, 0.4 ) ) ) * 0.5 + 0.5 + ( n - 0.5 ) * 0.25 );
		color = mix( uSmokeShade, uSmokeLit, lit );
	} else {
		float heat = facing * 0.95 + ( n - 0.5 ) * 0.5 - uT * 1.05;
		color = heat > 0.62 ? uHot : heat > 0.34 ? uMid : heat > 0.08 ? uCool : uSmokeShade;
	}
	gl_FragColor = vec4( color, 1.0 );
	#include <fog_fragment>
}`;

function celFireMaterial(smoke = false){
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uT: { value: 0 }, uSeed: { value: 0 }, uSmoke: { value: smoke ? 1 : 0 },
      uHot: { value: new THREE.Color(3.6, 3.3, 2.4) },      // HDR: the core blooms white-hot
      uMid: { value: new THREE.Color(2.6, 1.45, 0.32) },
      uCool: { value: new THREE.Color(1.25, 0.34, 0.08) },
      uSmokeLit: { value: new THREE.Color(0.17, 0.158, 0.15) },
      uSmokeShade: { value: new THREE.Color(0.052, 0.048, 0.054) },
    }]),
    vertexShader: CEL_FIRE_VERTEX, fragmentShader: CEL_FIRE_FRAGMENT, fog: true,
  });
}

// ---------- beam / tracer glow shader ----------
const BOLT_VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const BOLT_FRAGMENT = /* glsl */`
uniform vec3 uCore;
uniform vec3 uHalo;
uniform vec2 uHalf;      // (unused by the crossed ribbons, kept for tuning parity)
varying vec2 vUv;
void main() {
	float r = abs( vUv.x - 0.5 ) * 2.0;
	float along = abs( vUv.y - 0.5 ) * 2.0;
	float tip = 1.0 - smoothstep( 0.72, 1.0, along );
	float core = 1.0 - smoothstep( 0.16, 0.26, r );
	float halo = pow( max( 1.0 - r, 0.0 ), 2.2 );
	vec3 c = ( uCore * core + uHalo * halo ) * tip;
	gl_FragColor = vec4( c, 1.0 );
}`;

// two perpendicular ribbons along +z: an energy bolt reads from any side without a volume shader
function crossedRibbon(width, length){
  const a = new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2);            // lies in XZ
  const b = new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2).rotateZ(Math.PI / 2); // lies in YZ
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'uv']){
    const x = a.attributes[name].array, y = b.attributes[name].array;
    const merged = new Float32Array(x.length + y.length); merged.set(x); merged.set(y, x.length);
    geo.setAttribute(name, new THREE.BufferAttribute(merged, a.attributes[name].itemSize));
  }
  const ia = a.index.array, ib = b.index.array, offset = a.attributes.position.count;
  geo.setIndex([...ia, ...Array.from(ib, i => i + offset)]);
  a.dispose(); b.dispose();
  return geo;
}

function boltMaterial(core, halo, halfWidth, halfLength){
  return new THREE.ShaderMaterial({
    uniforms: { uCore: { value: core }, uHalo: { value: halo }, uHalf: { value: new THREE.Vector2(halfWidth, halfLength) } },
    vertexShader: BOLT_VERTEX, fragmentShader: BOLT_FRAGMENT,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  });
}

const FACTION_BEAM = {
  FED:  { core: new THREE.Color(3.2, 3.0, 3.2), halo: new THREE.Color(2.8, 0.3, 1.6) },  // pink mega-particle
  ZEON: { core: new THREE.Color(3.3, 3.2, 2.6), halo: new THREE.Color(2.8, 1.5, 0.1) }, // amber mega-particle
};

export function createAnimeFx(scene, { space = false } = {}){
  const tex = sharedTextures();
  const group = new THREE.Group(); group.name = 'anime-fx'; scene.add(group);
  const live = [];
  const geo = {
    sphere: new THREE.IcosahedronGeometry(1, 2),
    streak: new THREE.BoxGeometry(0.14, 0.14, 1).translate(0, 0, 0.5),
    ring: new THREE.RingGeometry(0.82, 1, 48),
    beam: crossedRibbon(1.9, 14),
    tracer: crossedRibbon(0.62, 3.6),
    round: new THREE.BoxGeometry(0.16, 0.16, 1.5),
  };
  for (const g of Object.values(geo)) g.userData.shared = true;
  const mats = {
    beam: {
      FED: boltMaterial(FACTION_BEAM.FED.core, FACTION_BEAM.FED.halo, 0.55, 7),
      ZEON: boltMaterial(FACTION_BEAM.ZEON.core, FACTION_BEAM.ZEON.halo, 0.55, 7),
    },
    tracer: boltMaterial(new THREE.Color(3.4, 2.9, 1.6), new THREE.Color(2.2, 0.95, 0.2), 0.23, 1.8),
    ball: new THREE.MeshBasicMaterial({ color: 0x8a7446 }),   // untraced ball round: a dull brass streak
    spark: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
  };
  for (const m of [mats.beam.FED, mats.beam.ZEON, mats.tracer, mats.ball, mats.spark]) m.userData.shared = true;

  // pools: every effect object is recycled rather than allocated per shot
  const pools = new Map();
  const take = (key, make) => {
    const pool = pools.get(key);
    const obj = pool && pool.length ? pool.pop() : make();
    obj.visible = true; group.add(obj); return obj;
  };
  const give = (key, obj) => {
    group.remove(obj);
    let pool = pools.get(key); if (!pool){ pool = []; pools.set(key, pool); }
    if (pool.length < 160) pool.push(obj); else disposeObject(obj);
  };
  const disposeObject = obj => { if (obj.material && !obj.material.userData?.shared) obj.material.dispose(); };

  const spriteMat = (map, color) => new THREE.SpriteMaterial({
    map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const makeSprite = map => new THREE.Sprite(spriteMat(map, new THREE.Color(1, 1, 1)));
  const makeFire = () => new THREE.Mesh(geo.sphere, celFireMaterial(false));
  const makeSmoke = () => new THREE.Mesh(geo.sphere, celFireMaterial(true));
  const makeSpark = () => new THREE.Mesh(geo.streak, mats.spark);
  const makeRing = () => new THREE.Mesh(geo.ring, mats.ring.clone());

  const BUDGET = { explosions: 42, sparks: 260, flashes: 48, dust: 70 };
  let activeExplosions = 0, activeSparks = 0, activeFlashes = 0, activeDust = 0;
  const camPos = new THREE.Vector3();
  let camera = null;

  function push(effect){ live.push(effect); return effect; }

  function addSpark(pos, dir, speed, life, length = 1.6){
    if (activeSparks >= BUDGET.sparks) return;
    const mesh = take('spark', makeSpark);
    mesh.position.copy(pos);
    mesh.scale.set(1, 1, length);
    activeSparks++;
    push({ kind: 'spark', key: 'spark', mesh, vel: dir.clone().multiplyScalar(speed), life, maxLife: life, length });
  }

  function flashSprite(pos, size, color, life, map = tex.glow, rotation = 0){
    const sprite = take(map === tex.star ? 'star' : 'glow', () => makeSprite(map));
    sprite.material.color.copy(color);
    sprite.material.opacity = 1;
    sprite.material.rotation = rotation;
    sprite.position.copy(pos);
    sprite.scale.setScalar(size);
    return push({ kind: 'flash', key: map === tex.star ? 'star' : 'glow', mesh: sprite, life, maxLife: life, size, grow: 1.35 });
  }

  const HOT_FLASH = new THREE.Color(3.2, 2.7, 1.9);
  const RING_TINT = new THREE.Color(2.0, 1.8, 1.4);

  function explosion(pos, r = 6, { ground = null } = {}){
    const scale = Math.max(1.2, r);
    const full = activeExplosions < BUDGET.explosions;
    activeExplosions++;
    // 1. white-hot flash
    flashSprite(pos, scale * 3.4, HOT_FLASH, 0.16);
    // 2. cel fireball that eats itself into smoke
    const fire = take('fire', makeFire);
    fire.position.copy(pos);
    fire.material.uniforms.uSeed.value = Math.random() * 40;
    fire.material.uniforms.uT.value = 0;
    fire.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    fire.scale.setScalar(scale * 0.35);
    push({ kind: 'fire', key: 'fire', mesh: fire, life: 0.75, maxLife: 0.75, size: scale, counted: true });
    if (!full) return;
    // 3. smoke puffs drifting up and out
    const puffs = scale > 8 ? 5 : 3;
    for (let i = 0; i < puffs; i++){
      const smoke = take('smoke', makeSmoke);
      const off = new THREE.Vector3().randomDirection().multiplyScalar(scale * 0.45);
      if (!space) off.y = Math.abs(off.y) * 0.6;
      smoke.position.copy(pos).add(off);
      smoke.material.uniforms.uSeed.value = Math.random() * 40;
      smoke.material.uniforms.uT.value = 0;
      smoke.scale.setScalar(scale * 0.3);
      const drift = off.clone().normalize().multiplyScalar(scale * 0.5);
      if (!space) drift.y += scale * 0.9;
      const life = 1.4 + Math.random() * 0.6;
      push({ kind: 'smoke', key: 'smoke', mesh: smoke, life, maxLife: life, size: scale * (0.42 + Math.random() * 0.3), vel: drift, delay: 0.12 + i * 0.05 });
    }
    // 4. spark streaks
    const sparks = Math.min(14, 5 + Math.round(scale * 0.7));
    for (let i = 0; i < sparks; i++){
      const d = new THREE.Vector3().randomDirection();
      if (!space && d.y < 0) d.y *= -0.4;
      addSpark(pos, d, scale * (7 + Math.random() * 9), 0.35 + Math.random() * 0.35, 1.2 + scale * 0.12);
    }
    // 5. shock ring — flat on the ground, facing the camera in space
    const ring = take('ring', makeRing);
    ring.position.copy(pos);
    const flat = !space && ground !== null && pos.y - ground < scale * 1.8;
    if (flat){ ring.position.y = ground + 0.4; ring.rotation.set(-Math.PI / 2, 0, 0); }
    ring.material.color.copy(RING_TINT);
    ring.material.opacity = 0.9;
    ring.scale.setScalar(scale * 0.4);
    push({ kind: 'ring', key: 'ring', mesh: ring, life: 0.42, maxLife: 0.42, size: scale * 3.2, billboard: !flat });
  }

  const SPARK_FLASH = new THREE.Color(3.4, 3.0, 1.6);
  function spark(pos, strong = false){
    flashSprite(pos, strong ? 7 : 4.2, SPARK_FLASH, strong ? 0.14 : 0.1, tex.star, Math.random() * Math.PI);
    const n = strong ? 9 : 5;
    for (let i = 0; i < n; i++) addSpark(pos, new THREE.Vector3().randomDirection(), 30 + Math.random() * 40, 0.18 + Math.random() * 0.2, 1.1);
  }

  const DUST_LIT = new THREE.Color(0.62, 0.56, 0.45), DUST_SHADE = new THREE.Color(0.36, 0.32, 0.26);
  function dust(pos, r = 4){
    if (activeDust >= BUDGET.dust) return;
    for (let i = 0; i < 2; i++){
      activeDust++;
      const puff = take('dust', () => { const m = makeSmoke(); m.material.uniforms.uSmokeLit.value = DUST_LIT.clone(); m.material.uniforms.uSmokeShade.value = DUST_SHADE.clone(); return m; });
      puff.position.copy(pos); puff.position.x += (Math.random() - 0.5) * r; puff.position.z += (Math.random() - 0.5) * r; puff.position.y += 1;
      puff.material.uniforms.uSeed.value = Math.random() * 40;
      puff.material.uniforms.uT.value = 0;
      puff.scale.setScalar(r * 0.2);
      push({ kind: 'smoke', key: 'dust', mesh: puff, life: 0.9, maxLife: 0.9, size: r * 0.55, vel: new THREE.Vector3(0, r * 0.5, 0), delay: 0, countedDust: true });
    }
  }

  // muzzle flash: a star-cross and a short cone of sparks along the bore; beams flash in faction colour
  const FLASH_COLORS = {
    beam: { FED: new THREE.Color(3.0, 1.2, 2.4), ZEON: new THREE.Color(3.0, 2.2, 0.6) },
    kinetic: new THREE.Color(3.4, 2.4, 1.0),
  };
  function muzzleFlash(pos, dir, type, faction = 'FED', size = 1){
    if (activeFlashes >= BUDGET.flashes) return;
    if (camera && camPos.distanceToSquared(pos) > 1100 * 1100) return;   // too far to read
    const beam = type === 'beam';
    const color = beam ? (FACTION_BEAM[faction] ? FLASH_COLORS.beam[faction] : FLASH_COLORS.beam.FED) : FLASH_COLORS.kinetic;
    const s = (type === 'bazooka' ? 7.5 : beam ? 5.2 : 3.6) * size;
    activeFlashes++;
    const e = flashSprite(pos.clone().addScaledVector(dir, s * 0.18), s, color, beam ? 0.09 : 0.06, tex.star, Math.random() * Math.PI);
    e.countedFlash = true;
    if (!beam) for (let i = 0; i < (type === 'bazooka' ? 5 : 2); i++){
      const d = dir.clone().addScaledVector(new THREE.Vector3().randomDirection(), 0.28).normalize();
      addSpark(pos, d, 60 + Math.random() * 40, 0.08 + Math.random() * 0.06, 0.9);
    }
  }

  // projectile visuals (the battle keeps ownership; these are just meshes)
  function beamMesh(faction){ return new THREE.Mesh(geo.beam, mats.beam[faction] || mats.beam.FED); }
  function tracerMesh(){ return new THREE.Mesh(geo.tracer, mats.tracer); }
  function ballMesh(){ return new THREE.Mesh(geo.round, mats.ball); }

  const q = new THREE.Quaternion(), tmp = new THREE.Vector3();
  function update(dt, cam){
    camera = cam || camera;
    if (camera) camPos.setFromMatrixPosition(camera.matrixWorld);
    for (let i = live.length - 1; i >= 0; i--){
      const e = live[i];
      if (e.delay > 0){ e.delay -= dt; e.mesh.visible = false; continue; }
      e.mesh.visible = true;
      e.life -= dt;
      const k = Math.min(1, 1 - e.life / e.maxLife);
      switch (e.kind){
        case 'flash':
          e.mesh.scale.setScalar(e.size * (1 + (e.grow - 1) * k));
          e.mesh.material.opacity = 1 - k * k;
          break;
        case 'fire': {
          const grow = 1 - Math.pow(1 - Math.min(1, k * 2.4), 3);                 // fast ease-out bloom
          e.mesh.scale.setScalar(e.size * (0.35 + 0.95 * grow));
          e.mesh.material.uniforms.uT.value = Math.max(0, k - 0.18) * 1.2;
          break;
        }
        case 'smoke':
          e.mesh.position.addScaledVector(e.vel, dt);
          e.vel.multiplyScalar(Math.max(0, 1 - dt * 1.6));
          e.mesh.scale.setScalar(e.size * (0.45 + 0.75 * Math.sqrt(k)));
          e.mesh.material.uniforms.uT.value = Math.max(0, k - 0.35) * 1.45;
          break;
        case 'spark':
          if (!space) e.vel.y -= 26 * dt;
          e.mesh.position.addScaledVector(e.vel, dt);
          q.setFromUnitVectors(FWD, tmp.copy(e.vel).normalize());
          e.mesh.quaternion.copy(q);
          e.mesh.scale.z = e.length * Math.max(0.2, 1 - k);
          break;
        case 'ring':
          e.mesh.scale.setScalar(e.size * (0.15 + 0.85 * Math.sqrt(k)));
          e.mesh.material.opacity = 0.9 * (1 - k);
          if (e.billboard && camera) e.mesh.quaternion.copy(camera.quaternion);
          break;
      }
      if (e.life <= 0){
        if (e.counted) activeExplosions--;
        if (e.countedFlash) activeFlashes--;
        if (e.countedDust) activeDust--;
        if (e.kind === 'spark') activeSparks--;
        give(e.key, e.mesh);
        live.splice(i, 1);
      }
    }
  }

  function dispose(){
    for (const e of live) disposeObject(e.mesh);
    for (const pool of pools.values()) for (const obj of pool) disposeObject(obj);
    live.length = 0; pools.clear();
    for (const g of Object.values(geo)) g.dispose();
    for (const m of [mats.beam.FED, mats.beam.ZEON, mats.tracer, mats.ball, mats.spark, mats.ring]) m.dispose();
    scene.remove(group);
  }

  return {
    explosion, spark, dust, muzzleFlash, beamMesh, tracerMesh, ballMesh, update, dispose,
    get activeCount(){ return live.length; },
  };
}
