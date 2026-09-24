// ---------- weapon ballistics ----------
// Pure, engine-independent rules for how rounds fly and what they do on impact:
//   · kinetic rounds fall under the local gravity and shed speed to air drag (none in vacuum)
//   · a fire-control computer raises the bore so the round arcs onto the aim point
//   · kinetic penetration scales with calibre and remaining velocity; armour is set by the unit's
//     rating and effectively thickens on oblique hits, which can ricochet
//   · mega-particle beams ignore penetration but diffuse with range — much faster in atmosphere
//   · sustained fire and movement bloom the cone; the bloom cools off between bursts
// Weapon data stays as authored in data.js; everything here is derived from name, type and speed.

export const GRAVITY_EARTH = 9.81;
export const GRAVITY_MOON = 1.62;

// Local physics for a battlefield. Colonies spin for ~1 g and hold air; airless bodies keep a
// little gravity but no drag; open space has neither.
export function environmentPhysics(env, { airless = false } = {}){
  if (env === 'space') return { gravity: 0, air: 0 };
  if (airless) return { gravity: GRAVITY_MOON, air: 0 };
  return { gravity: GRAVITY_EARTH, air: 1 };
}

// Calibre in millimetres parsed from the weapon's designation ("ZMP-50D 120MM MACHINE GUN" → 120).
export function weaponCalibre(weapon){
  const m = /(\d{2,3})\s*MM/i.exec(weapon?.name || '');
  return m ? Number(m[1]) : null;
}

// Classify a weapon into a ballistic family.
//   beam     mega-particle bolts (no drop, range falloff, no penetration check)
//   kinetic  gun rounds (drop, drag, penetration)
//   rocket   rocket-assisted bazooka / missile rounds (motor offsets most of the drop, HEAT warhead)
//   shell    gun-launched HE/AP shells (full drop, light drag)
export function ballisticProfile(weapon){
  if (!weapon) return null;
  if (weapon._ballistic) return weapon._ballistic;
  const name = (weapon.name || '').toUpperCase();
  const calibre = weaponCalibre(weapon);
  let profile;
  if (weapon.type === 'beam' && !/BEAM|MEGA|CANNON|PARTICLE|ROD/.test(name) && calibre){
    // "beam" slot but a gun designation, e.g. a 75 mm sniper rifle: a kinetic long gun
    profile = kinetic(calibre, weapon, { longGun: true });
  } else if (weapon.type === 'beam'){
    profile = { kind: 'beam', calibre: null, gravityScale: 0, drag: 0, pen: Infinity };
  } else if (/MISSILE|ROCKET/.test(name) && weapon.type !== 'lockmissile'){
    // self-propelled rounds in a gun slot (BOP missile launcher): motor offsets most of the drop
    profile = { kind: 'rocket', calibre, gravityScale: 0.2, drag: 0, pen: (calibre || 120) * 1.6 };
  } else if (weapon.type === 'mg'){
    profile = kinetic(calibre || 30, weapon);
  } else if (weapon.type === 'bazooka' && weapon.shell){
    profile = { kind: 'shell', calibre, gravityScale: 1, drag: dragFor(calibre || 150) * 0.6, pen: (calibre || 150) * 1.1 };
  } else if (weapon.type === 'bazooka'){
    profile = { kind: 'rocket', calibre, gravityScale: 0.35, drag: 0, pen: (calibre || 200) * 1.6 };
  } else {
    profile = { kind: weapon.type || 'other', calibre, gravityScale: 0, drag: 0, pen: Infinity };
  }
  profile.heatPerShot = heatPerShot(weapon, profile);
  Object.defineProperty(weapon, '_ballistic', { value: profile, enumerable: false, configurable: true, writable: true });
  return profile;
}

function dragFor(calibre){
  // quadratic drag coefficient (1/m at sea level): small rounds bleed speed fastest
  return 0.00018 * Math.sqrt(100 / Math.max(10, calibre));
}

function kinetic(calibre, weapon, { longGun = false } = {}){
  return {
    kind: 'kinetic', calibre, longGun,
    gravityScale: 1,
    drag: dragFor(calibre) * (longGun ? 0.55 : 1),
    // RHA-equivalent penetration at the muzzle, scaled by velocity (m/s → km/s)
    pen: calibre * Math.pow(Math.max(0.2, (weapon.speed || 1000) / 1000), 0.8),
  };
}

// Recoil heat added to the spread bloom per trigger pull.
function heatPerShot(weapon, profile){
  if (profile.kind === 'beam') return weapon.pellets ? 0.12 : 0.18;
  if (profile.kind === 'rocket' || profile.kind === 'shell') return 0.3;
  const rof = weapon.rof || 5, cal = profile.calibre || 30;
  // fast light guns climb steadily; heavy guns kick hard per round
  return Math.min(0.28, 0.02 + cal / 1400 + 0.3 / Math.max(1, rof));
}

// Unit armour as RHA-equivalent millimetres from the 0–20 rating in data.js.
export function armorThickness(suit){
  return 40 + (suit?.armor || 0) * 7;
}

// Speed after travelling `distance` metres under quadratic drag.
export function speedAfter(profile, muzzleSpeed, distance, air = 1){
  const k = (profile?.drag || 0) * air;
  return k > 0 ? muzzleSpeed * Math.exp(-k * distance) : muzzleSpeed;
}

// Flight time to `distance` under quadratic drag.
export function timeOfFlight(profile, muzzleSpeed, distance, air = 1){
  const k = (profile?.drag || 0) * air;
  if (!(muzzleSpeed > 0)) return Infinity;
  return k > 1e-9 ? (Math.exp(k * distance) - 1) / (k * muzzleSpeed) : distance / muzzleSpeed;
}

// Fire-control hold-over: how far above the aim point to lay the bore so the round falls onto it.
export function superelevation(profile, muzzleSpeed, distance, physics){
  const g = (physics?.gravity || 0) * (profile?.gravityScale || 0);
  if (g <= 0 || !(distance > 0)) return 0;
  const t = timeOfFlight(profile, muzzleSpeed, distance, physics.air);
  return Math.min(distance * 0.5, 0.5 * g * t * t);
}

// One integration step for a round's velocity (in place on a {x,y,z} vector).
export function stepBallistic(vel, profile, physics, dt){
  const g = (physics?.gravity || 0) * (profile?.gravityScale || 0);
  if (g) vel.y -= g * dt;
  const k = (profile?.drag || 0) * (physics?.air || 0);
  if (k > 0){
    const speed = Math.hypot(vel.x, vel.y, vel.z);
    const f = 1 / (1 + k * speed * dt);
    vel.x *= f; vel.y *= f; vel.z *= f;
  }
  return vel;
}

// Beam diffusion: full power to `start`, easing to `floor` by `end`. Atmosphere scatters the beam
// several times faster than vacuum.
export function beamFalloff(distance, air = 1){
  const start = air > 0 ? 650 : 1300, end = air > 0 ? 1900 : 3200, floor = air > 0 ? 0.55 : 0.72;
  if (distance <= start) return 1;
  const k = Math.min(1, (distance - start) / (end - start));
  return 1 - (1 - floor) * k * k * (3 - 2 * k);
}

// Obliquity: cos of the angle between the round's path and the armour normal (1 = square hit).
// Effective thickness grows as the hit turns glancing; the curve is softened because the game's
// hit volumes are simplified shells, not the real plate layout.
export function effectiveArmor(armorMM, cosImpact){
  const c = Math.min(1, Math.max(0, cosImpact ?? 1));
  return armorMM / (0.55 + 0.45 * c);
}

// Damage multiplier for a round striking a unit.
//   { profile, impactSpeed, muzzleSpeed, cosImpact, armorMM, distance, air, roll }
// returns { mult, ricochet, penetrated }
export function impactMultiplier({ profile, impactSpeed, muzzleSpeed, cosImpact = 1, armorMM = 0, distance = 0, air = 1, roll = 0.5 }){
  if (!profile) return { mult: 1, ricochet: false, penetrated: true };
  if (profile.kind === 'beam') return { mult: beamFalloff(distance, air), ricochet: false, penetrated: true };
  if (profile.kind !== 'kinetic') return { mult: 1, ricochet: false, penetrated: true };
  const v = muzzleSpeed > 0 ? Math.max(0, impactSpeed) / muzzleSpeed : 1;
  const pen = profile.pen * Math.pow(v, 1.3);
  const armour = effectiveArmor(armorMM, cosImpact);
  const ratio = armour > 0 ? pen / armour : Infinity;
  // glancing blows off heavy plate skip away
  if ((cosImpact ?? 1) < 0.26 && ratio < 1 && roll < 0.6) return { mult: 0.15, ricochet: true, penetrated: false };
  if (ratio >= 1) return { mult: 1, ricochet: false, penetrated: true };
  return { mult: 0.25 + 0.75 * ratio * ratio, ricochet: false, penetrated: false };
}

// Spread bloom: 1 when cold and still; sustained fire (heat 0..1) and movement widen the cone.
export function spreadBloom({ heat = 0, speedFrac = 0, boosting = false, beam = false } = {}){
  const h = Math.min(1, Math.max(0, heat));
  const move = Math.min(1, Math.max(0, speedFrac));
  return (1 + h * (beam ? 0.8 : 1.6)) * (1 + move * 0.45) * (boosting ? 1.35 : 1);
}

export const HEAT_COOL_RATE = 1.4;   // heat units per second recovered when the trigger is released
