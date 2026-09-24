// ---------- anime render pipeline ----------
// Engine-wide cel look, applied without touching any unit's geometry or proportions:
//   1. cel shading  — MeshStandardMaterials on units are patched in place (onBeforeCompile) so direct
//                     light resolves into a hard lit/shadow terminator, a crisp specular glint and a thin
//                     rim; references held by the game (eye flicker, flame scale, blade glow) stay valid.
//   2. ink lines    — every rigid part gets a merged inverted-hull outline with welded normals and a
//                     constant screen-space line weight that thins with distance.
//   3. post         — renderer.render is wrapped once: the frame goes to an HDR multisampled target,
//                     a five-level bloom picks up beams, thrusters and sensor eyes, and a grade pass
//                     adds a soft highlight shoulder, a touch of saturation and a light vignette.
// Everything reads from ANIME at runtime, so the style can be switched off without recompiling.
import * as THREE from 'three';

const STORE_KEY = 'gravityFront.visualStyle';

function readStoredStyle(){
  try { return globalThis.localStorage?.getItem(STORE_KEY) || 'anime'; } catch { return 'anime'; }
}

export const ANIME = {
  style: readStoredStyle(),         // 'anime' | 'classic'
  get enabled(){ return this.style === 'anime'; },
  lineWidth: 2.1,                   // CSS px at close range
  bloomStrength: 0.85,
  bloomThreshold: 0.92,
};

// Shared uniforms: one object drives every patched material, so the style switch is a uniform write.
const CEL_UNIFORMS = {
  uCelMix:      { value: ANIME.enabled ? 1 : 0 },
  uCelEdge:     { value: 0.2 },    // terminator position on N·L
  uCelSoft:     { value: 0.035 },  // terminator softness (keeps the edge from aliasing)
  uCelShadow:   { value: 0.0 },    // direct light kept on the shadow side
  uCelSpec:     { value: 0.42 },
  uRimStrength: { value: 0.22 },
  uShadowTint:  { value: new THREE.Color(0.8, 0.84, 0.98) },
};

export function setVisualStyle(style){
  ANIME.style = style === 'classic' ? 'classic' : 'anime';
  try { globalThis.localStorage?.setItem(STORE_KEY, ANIME.style); } catch {}
  CEL_UNIFORMS.uCelMix.value = ANIME.enabled ? 1 : 0;
  outlineMaterial.visible = ANIME.enabled;
  outlineInstancedMaterial.visible = ANIME.enabled;
  return ANIME.style;
}

// ---------- 1. cel shading ----------
const DIRECT_CEL = /* glsl */`
uniform float uCelMix;
uniform float uCelEdge;
uniform float uCelSoft;
uniform float uCelShadow;
uniform float uCelSpec;
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	// Two painted tones with a faint third step on broad curved armour, as in cel animation.
	float band = smoothstep( uCelEdge - uCelSoft, uCelEdge + uCelSoft, dotNL );
	float lift = 0.88 + 0.12 * smoothstep( 0.6, 0.66, dotNL );
	float celNL = mix( uCelShadow, 1.0, band ) * lift;
	vec3 irradiance = mix( dotNL, celNL, uCelMix ) * directLight.color;
	vec3 pbrSpec = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float nh = saturate( dot( geometryNormal, halfDir ) );
	float glint = smoothstep( 0.972, 0.98, nh ) * band * uCelSpec * ( 0.35 + dot( material.specularColor, vec3( 0.3333 ) ) );
	vec3 spec = mix( pbrSpec, vec3( glint ), uCelMix );
	reflectedLight.directSpecular += irradiance * spec;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
`;

let physicalParsCel = null;
function celLightsChunk(){
  if (physicalParsCel) return physicalParsCel;
  const src = THREE.ShaderChunk.lights_physical_pars_fragment;
  const start = src.indexOf('void RE_Direct_Physical(');
  const end = src.indexOf('void RE_IndirectDiffuse_Physical(');
  if (start < 0 || end < 0) return (physicalParsCel = src); // unknown three build → leave PBR intact
  physicalParsCel = src.slice(0, start) + DIRECT_CEL + src.slice(end);
  return physicalParsCel;
}

function celCompile(shader){
  Object.assign(shader.uniforms, CEL_UNIFORMS);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <lights_physical_pars_fragment>', celLightsChunk())
    .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
	// Paint reads as flat colour: metallic parts keep most of their base tone instead of going dark
	// without an environment map.
	material.diffuseColor = mix( material.diffuseColor, diffuseColor.rgb * ( 1.0 - 0.35 * metalnessFactor ), uCelMix );`)
    .replace('#include <aomap_fragment>', `
	// cool painted shadow: the ambient fill carries a slight blue cast, as on an animation cel
	reflectedLight.indirectDiffuse *= mix( vec3( 1.0 ), uShadowTint, uCelMix );
	#include <aomap_fragment>`)
    .replace('#include <opaque_fragment>', `
	{
		float rimDot = 1.0 - saturate( dot( normal, geometryViewDir ) );
		float rim = smoothstep( 0.8, 0.86, rimDot ) * uRimStrength * uCelMix;
		outgoingLight += diffuseColor.rgb * rim;
	}
	#include <opaque_fragment>`)
    .replace('void main() {', 'uniform float uRimStrength;\nuniform vec3 uShadowTint;\nvoid main() {');
}

export function celPatchMaterial(material){
  if (!material || material.userData.celPatched) return material;
  if (!(material.isMeshStandardMaterial) || material.transparent) return material;
  material.userData.celPatched = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (typeof previous === 'function') previous.call(material, shader, renderer);
    celCompile(shader);
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `anime-cel-1|${previousKey ? previousKey() : ''}`;
  material.needsUpdate = true;
  return material;
}

// Glowing parts (sensor eyes, heat edges, beam blades, thruster flames) read as light, not paint:
// they keep their emissive look and never receive ink.
function isGlowMaterial(material){
  if (!material) return true;
  if (material.transparent) return true;
  if (material.isMeshBasicMaterial || material.isPointsMaterial || material.isLineBasicMaterial) return true;
  const e = material.emissive;
  return !!(e && (material.emissiveIntensity || 0) >= 1.2 && (e.r + e.g + e.b) > 0.3);
}

// ---------- 2. ink lines ----------
const OUTLINE_VERTEX = /* glsl */`
#include <common>
#include <fog_pars_vertex>
uniform vec2 uResolution;
uniform float uWidth;
uniform float uRefDist;
attribute vec3 outlineNormal;
void main() {
	vec4 localPosition = vec4( position, 1.0 );
	vec3 n = outlineNormal;
	#ifdef USE_INSTANCING
		localPosition = instanceMatrix * localPosition;
		n = mat3( instanceMatrix ) * n;
	#endif
	vec4 mvPosition = modelViewMatrix * localPosition;
	vec3 viewNormal = normalize( normalMatrix * n );
	float dist = max( -mvPosition.z, 0.5 );
	// world size of one CSS pixel at this depth (projectionMatrix[1][1] = 1 / tan(fov / 2))
	float pixelWorld = dist * 2.0 / ( projectionMatrix[ 1 ][ 1 ] * uResolution.y );
	float weight = uWidth * clamp( uRefDist / dist, 0.28, 1.0 );
	mvPosition.xyz += viewNormal * weight * pixelWorld;
	gl_Position = projectionMatrix * mvPosition;
	// a hair of depth bias so hull back-faces never poke through thin neighbouring plates
	gl_Position.z += 0.00004 * gl_Position.w;
	#include <fog_vertex>
}`;

const OUTLINE_FRAGMENT = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
void main() {
	gl_FragColor = vec4( uColor, 1.0 );
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;

function makeOutlineMaterial(){
  return new THREE.ShaderMaterial({
    name: 'anime-outline',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uResolution: { value: new THREE.Vector2(1280, 720) },
      uWidth: { value: ANIME.lineWidth },
      uRefDist: { value: 90 },
      uColor: { value: new THREE.Color(0x0b0d14) },
    }]),
    vertexShader: OUTLINE_VERTEX,
    fragmentShader: OUTLINE_FRAGMENT,
    side: THREE.BackSide,
    fog: true,
  });
}
const outlineMaterial = makeOutlineMaterial();
const outlineInstancedMaterial = makeOutlineMaterial();
outlineMaterial.visible = outlineInstancedMaterial.visible = ANIME.enabled;
outlineMaterial.userData.shared = outlineInstancedMaterial.userData.shared = true;

const drawingSize = new THREE.Vector2();
function syncOutlineResolution(renderer, material){
  renderer.getDrawingBufferSize(drawingSize);
  const pr = renderer.getPixelRatio() || 1;
  const u = material.uniforms.uResolution.value;
  const w = drawingSize.x / pr, h = drawingSize.y / pr;
  if (u.x !== w || u.y !== h){ u.set(w, h); material.uniformsNeedUpdate = true; }
}
function outlineBeforeRender(renderer){ syncOutlineResolution(renderer, this.material); }
const noRaycast = () => {};

// Weld duplicate corners and average area-weighted face normals, so a box's hull expands as one
// closed shell instead of splitting open at every hard edge.
function weldedNormals(positions, index){
  const count = positions.length / 3;
  const faceCount = index ? index.length / 3 : count / 3;
  // numeric key: 1/256 m grid, 17 bits per axis (±256 m) packed exactly into a double
  const keyOf = i => {
    const x = Math.round(positions[i * 3] * 256), y = Math.round(positions[i * 3 + 1] * 256), z = Math.round(positions[i * 3 + 2] * 256);
    if (x < -65535 || x > 65535 || y < -65535 || y > 65535 || z < -65535 || z > 65535) return `${x},${y},${z}`;
    return ((x + 65536) * 131072 + (y + 65536)) * 131072 + (z + 65536);
  };
  const slot = new Int32Array(count), buckets = new Map();
  for (let i = 0; i < count; i++){
    const k = keyOf(i);
    let s = buckets.get(k);
    if (s === undefined){ s = buckets.size; buckets.set(k, s); }
    slot[i] = s;
  }
  const acc = new Float32Array(buckets.size * 3);
  for (let f = 0; f < faceCount; f++){
    const a = index ? index[f * 3] : f * 3, b = index ? index[f * 3 + 1] : f * 3 + 1, c = index ? index[f * 3 + 2] : f * 3 + 2;
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const e1x = positions[b * 3] - ax, e1y = positions[b * 3 + 1] - ay, e1z = positions[b * 3 + 2] - az;
    const e2x = positions[c * 3] - ax, e2y = positions[c * 3 + 1] - ay, e2z = positions[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; // area-weighted
    for (const v of [a, b, c]){ const s = slot[v] * 3; acc[s] += nx; acc[s + 1] += ny; acc[s + 2] += nz; }
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    const s = slot[i] * 3, x = acc[s], y = acc[s + 1], z = acc[s + 2];
    const l = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / l; out[i * 3 + 1] = y / l; out[i * 3 + 2] = z / l;
  }
  return out;
}

const tmpMatrix = new THREE.Matrix4(), tmpNormalMatrix = new THREE.Matrix3(), tmpV = new THREE.Vector3();

// entries: [{ geometry, matrix }] → one non-indexed geometry carrying position + outlineNormal
export function buildOutlineGeometry(entries){
  let total = 0;
  const prepared = [];
  for (const { geometry, matrix } of entries){
    const pos = geometry.attributes.position;
    if (!pos || pos.itemSize !== 3) continue;
    const positions = pos.array instanceof Float32Array && !pos.isInterleavedBufferAttribute
      ? pos.array : Float32Array.from({ length: pos.count * 3 }, (_, i) => pos.getComponent(Math.floor(i / 3), i % 3));
    const index = geometry.index ? geometry.index.array : null;
    const normals = weldedNormals(positions, index);
    const vertexCount = index ? index.length : pos.count;
    prepared.push({ positions, normals, index, vertexCount, matrix });
    total += vertexCount;
  }
  if (!total) return null;
  const outPos = new Float32Array(total * 3), outNorm = new Float32Array(total * 3);
  let o = 0;
  for (const { positions, normals, index, vertexCount, matrix } of prepared){
    tmpNormalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < vertexCount; i++){
      const v = index ? index[i] : i;
      tmpV.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]).applyMatrix4(matrix);
      outPos[o * 3] = tmpV.x; outPos[o * 3 + 1] = tmpV.y; outPos[o * 3 + 2] = tmpV.z;
      tmpV.set(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]).applyMatrix3(tmpNormalMatrix).normalize();
      outNorm[o * 3] = tmpV.x; outNorm[o * 3 + 1] = tmpV.y; outNorm[o * 3 + 2] = tmpV.z;
      o++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(outNorm, 3));
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius += 0.6; // room for the line weight
  return geo;
}

function makeHull(geometry, material = outlineMaterial){
  const hull = new THREE.Mesh(geometry, material);
  hull.name = 'anime-outline';
  hull.userData.animeOutline = true;
  hull.raycast = noRaycast;
  hull.onBeforeRender = outlineBeforeRender;
  hull.renderOrder = -1;
  return hull;
}

function collectHandles(parts){
  const handles = new Set();
  const visit = value => {
    if (!value) return;
    if (value.isObject3D){ handles.add(value); return; }
    if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === 'object' && !value.isMaterial && !value.isVector3) {
      for (const inner of Object.values(value)) if (inner?.isObject3D || Array.isArray(inner)) visit(inner);
    }
  };
  for (const value of Object.values(parts || {})) visit(value);
  return handles;
}

function eligibleForInk(object){
  return object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh && !object.userData.animeOutline
    && !object.userData.noOutline && !Array.isArray(object.material) && !isGlowMaterial(object.material)
    && object.geometry?.attributes?.position;
}

// Patch materials and ink every rigid part below root. `parts` lists the engine's animation handles:
// those objects move or toggle independently, so each keeps its own hull instead of being baked into
// its parent's merged one.
export function applyAnimeLook(root, { parts = null, outline = true } = {}){
  if (!root || root.userData.animeApplied) return root;
  root.userData.animeApplied = true;
  const handles = collectHandles(parts);
  root.updateMatrixWorld(true);
  const groups = [];
  root.traverse(node => {
    if (node.userData.animeOutline) return;
    const list = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of list) celPatchMaterial(material);
    if (outline) groups.push(node);
  });
  if (!outline) return root;
  for (const node of groups){
    if (node.userData.animeInked) continue;
    node.userData.animeInked = true;
    const merged = [];
    for (const child of node.children){
      if (!eligibleForInk(child)) continue;
      if (handles.has(child) || !child.visible || child.children.some(c => c.isMesh && !c.userData.animeOutline)){
        // independent part: its own hull rides with it (inherits transform + visibility)
        const geo = buildOutlineGeometry([{ geometry: child.geometry, matrix: tmpMatrix.identity() }]);
        if (geo) child.add(makeHull(geo));
      } else {
        child.updateMatrix();
        merged.push({ geometry: child.geometry, matrix: child.matrix.clone() });
      }
    }
    if (merged.length){
      const geo = buildOutlineGeometry(merged);
      if (geo) node.add(makeHull(geo));
    }
  }
  return root;
}

// Newly attached sub-trees (a weapon built on demand) reuse the same treatment.
export function inkSubtree(object, parts = null){
  if (!object || object.userData.animeApplied) return object;
  return applyAnimeLook(object, { parts });
}

// Far-LOD instanced silhouettes: one instanced hull sharing the silhouette's instance buffer.
const instancedHullCache = new WeakMap();
export function inkInstancedMesh(mesh){
  if (!mesh?.isInstancedMesh || mesh.userData.animeInked) return null;
  mesh.userData.animeInked = true;
  celPatchMaterial(mesh.material);
  let geo = instancedHullCache.get(mesh.geometry);
  if (!geo){
    geo = buildOutlineGeometry([{ geometry: mesh.geometry, matrix: new THREE.Matrix4() }]);
    if (!geo) return null;
    geo.userData.shared = true;                          // lives as long as the silhouette it inks
    instancedHullCache.set(mesh.geometry, geo);
  }
  const hull = new THREE.InstancedMesh(geo, outlineInstancedMaterial, mesh.instanceMatrix.count);
  hull.instanceMatrix = mesh.instanceMatrix;          // shared buffer: no extra upload per frame
  hull.frustumCulled = false;
  hull.userData.animeOutline = true;
  hull.raycast = noRaycast;
  hull.onBeforeRender = function(renderer){ this.count = mesh.count; syncOutlineResolution(renderer, this.material); };
  hull.count = 0;
  mesh.add(hull);
  return hull;
}

// ---------- 3. post: HDR target → bloom → grade ----------
const FULLSCREEN_VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

const BRIGHT_FRAGMENT = /* glsl */`
uniform sampler2D tInput;
uniform float uThreshold;
varying vec2 vUv;
void main() {
	vec3 c = texture2D( tInput, vUv ).rgb;
	float l = max( c.r, max( c.g, c.b ) );
	float k = smoothstep( uThreshold, uThreshold + 0.35, l );
	gl_FragColor = vec4( c * k, 1.0 );
}`;

const BLUR_FRAGMENT = /* glsl */`
uniform sampler2D tInput;
uniform vec2 uDirection;
varying vec2 vUv;
void main() {
	// 9-tap Gaussian (linear-sampled weights)
	vec3 sum = texture2D( tInput, vUv ).rgb * 0.2270270270;
	vec2 o1 = uDirection * 1.3846153846, o2 = uDirection * 3.2307692308;
	sum += texture2D( tInput, vUv + o1 ).rgb * 0.3162162162;
	sum += texture2D( tInput, vUv - o1 ).rgb * 0.3162162162;
	sum += texture2D( tInput, vUv + o2 ).rgb * 0.0702702703;
	sum += texture2D( tInput, vUv - o2 ).rgb * 0.0702702703;
	gl_FragColor = vec4( sum, 1.0 );
}`;

const COMPOSITE_FRAGMENT = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform sampler2D tBloom4;
uniform float uBloom;
uniform float uGrade;
varying vec2 vUv;
vec3 softShoulder( vec3 c ) {
	// untouched below 0.78 so paint colours stay exact; highlights roll off instead of clipping
	vec3 over = max( c - 0.78, 0.0 );
	return min( c, 0.78 ) + over / ( 1.0 + over / 0.22 );
}
vec3 toSRGB( vec3 c ) {
	c = max( c, 0.0 );
	return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) );
}
void main() {
	vec3 c = texture2D( tScene, vUv ).rgb;
	vec3 b = texture2D( tBloom0, vUv ).rgb * 0.34 + texture2D( tBloom1, vUv ).rgb * 0.26
		+ texture2D( tBloom2, vUv ).rgb * 0.2 + texture2D( tBloom3, vUv ).rgb * 0.13 + texture2D( tBloom4, vUv ).rgb * 0.07;
	c += b * uBloom;
	vec3 graded = softShoulder( c );
	float l = dot( graded, vec3( 0.2126, 0.7152, 0.0722 ) );
	graded = mix( vec3( l ), graded, 1.08 );                       // a touch more saturation
	vec2 q = vUv - 0.5;
	graded *= 1.0 - dot( q, q ) * 0.32;                            // light vignette
	c = mix( c, graded, uGrade );
	gl_FragColor = vec4( toSRGB( c ), 1.0 );
}`;

export function installAnimePost(renderer){
  if (!renderer || renderer.userData?.animePost) return;
  renderer.userData = renderer.userData || {};
  renderer.userData.animePost = true;
  const baseRender = renderer.render.bind(renderer);
  const gl = renderer.getContext();
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (!webgl2 || !renderer.extensions.has('EXT_color_buffer_float') && !renderer.extensions.has('EXT_color_buffer_half_float')) return;

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(tri, null); quad.frustumCulled = false; quadScene.add(quad);
  const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const bright = pass(BRIGHT_FRAGMENT, { tInput: { value: null }, uThreshold: { value: ANIME.bloomThreshold } });
  const blur = pass(BLUR_FRAGMENT, { tInput: { value: null }, uDirection: { value: new THREE.Vector2() } });
  const composite = pass(COMPOSITE_FRAGMENT, {
    tScene: { value: null }, tBloom0: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
    tBloom3: { value: null }, tBloom4: { value: null }, uBloom: { value: ANIME.bloomStrength }, uGrade: { value: 1 },
  });
  const LEVELS = 5;
  let sceneTarget = null, mips = [], temps = [], width = 0, height = 0;
  const size = new THREE.Vector2();
  const makeTarget = (w, h, extra = {}) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...extra,
  });
  function ensureTargets(){
    renderer.getDrawingBufferSize(size);
    if (size.x === width && size.y === height && sceneTarget) return;
    width = size.x; height = size.y;
    sceneTarget?.dispose(); mips.forEach(t => t.dispose()); temps.forEach(t => t.dispose());
    sceneTarget = makeTarget(width, height, { depthBuffer: true, samples: 4 });
    mips = []; temps = [];
    let w = Math.round(width / 2), h = Math.round(height / 2);
    for (let i = 0; i < LEVELS; i++){
      mips.push(makeTarget(w, h)); temps.push(makeTarget(w, h));
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
    }
  }
  function draw(material, target){
    quad.material = material;
    renderer.setRenderTarget(target);
    baseRender(quadScene, quadCamera);
  }

  renderer.render = function(scene, camera){
    if (!ANIME.enabled || renderer.getRenderTarget() !== null || renderer.xr?.isPresenting) return baseRender(scene, camera);
    ensureTargets();
    const autoClear = renderer.autoClear;
    renderer.setRenderTarget(sceneTarget);
    if (!autoClear) renderer.clear();
    baseRender(scene, camera);
    renderer.autoClear = true;
    // bloom chain: bright-pass into the half-res level, then blur + downsample
    bright.uniforms.tInput.value = sceneTarget.texture;
    draw(bright, mips[0]);
    for (let i = 0; i < LEVELS; i++){
      const src = i === 0 ? mips[0] : mips[i - 1];
      if (i > 0){ blur.uniforms.tInput.value = src.texture; blur.uniforms.uDirection.value.set(0, 0); draw(blur, mips[i]); }
      blur.uniforms.tInput.value = mips[i].texture;
      blur.uniforms.uDirection.value.set(1 / mips[i].width, 0); draw(blur, temps[i]);
      blur.uniforms.tInput.value = temps[i].texture;
      blur.uniforms.uDirection.value.set(0, 1 / mips[i].height); draw(blur, mips[i]);
    }
    composite.uniforms.tScene.value = sceneTarget.texture;
    for (let i = 0; i < LEVELS; i++) composite.uniforms[`tBloom${i}`].value = mips[i].texture;
    composite.uniforms.uBloom.value = ANIME.bloomStrength;
    draw(composite, null);
    renderer.autoClear = autoClear;
  };
}
