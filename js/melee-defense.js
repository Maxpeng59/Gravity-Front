// Shared melee interception tuning and geometry. Kept independent from Three.js
// so the 20% rule and swept collision can be tested without the renderer.
export const MELEE_PROJECTILE_DEFLECTION_CHANCE = 0.20;
export const MELEE_WEAPON_LENGTH_SCALE = 1.28;
export const MELEE_PROJECTILE_CATCH_RADIUS = 2.6;

export function meleeWeaponReach(name = ''){
  const upper = String(name).toUpperCase();
  if (/KNIFE/.test(upper)) return 4.2;
  if (/HAWK|AXE/.test(upper)) return 7.0;
  if (/NAGINATA|LARGE/.test(upper)) return 13.0;
  if (/SWORD/.test(upper) && !/BEAM/.test(upper)) return 10.5;
  return 11.5;
}

export function isExplosiveProjectile(projectile){
  return !!projectile && Number(projectile.splash) > 0;
}

export function meleeDeflectsProjectile(roll){
  return Number(roll) < MELEE_PROJECTILE_DEFLECTION_CHANCE;
}

// Squared shortest distance between finite 3D segments a0-a1 and b0-b1.
// This is the swept test: the projectile travels along one segment during the
// frame while the extended weapon occupies the other.
export function segmentSegmentDistanceSquared(a0, a1, b0, b1){
  const ux = a1.x - a0.x, uy = a1.y - a0.y, uz = a1.z - a0.z;
  const vx = b1.x - b0.x, vy = b1.y - b0.y, vz = b1.z - b0.z;
  const wx = a0.x - b0.x, wy = a0.y - b0.y, wz = a0.z - b0.z;
  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const eps = 1e-9;
  let sN, sD = a * c - b * b;
  let tN, tD = sD;

  if (a <= eps && c <= eps){
    const dx = a0.x - b0.x, dy = a0.y - b0.y, dz = a0.z - b0.z;
    return dx * dx + dy * dy + dz * dz;
  }
  if (a <= eps){
    sN = 0; sD = 1; tN = e; tD = c;
  } else if (c <= eps){
    tN = 0; tD = 1; sN = -d; sD = a;
  } else {
    if (sD < eps){ sN = 0; sD = 1; tN = e; tD = c; }
    else {
      sN = b * e - c * d;
      tN = a * e - b * d;
      if (sN < 0){ sN = 0; tN = e; tD = c; }
      else if (sN > sD){ sN = sD; tN = e + b; tD = c; }
    }
    if (tN < 0){
      tN = 0;
      if (-d < 0) sN = 0;
      else if (-d > a) sN = sD;
      else { sN = -d; sD = a; }
    } else if (tN > tD){
      tN = tD;
      if (-d + b < 0) sN = 0;
      else if (-d + b > a) sN = sD;
      else { sN = -d + b; sD = a; }
    }
  }

  const sc = Math.abs(sN) < eps ? 0 : sN / sD;
  const tc = Math.abs(tN) < eps ? 0 : tN / tD;
  const dx = wx + sc * ux - tc * vx;
  const dy = wy + sc * uy - tc * vy;
  const dz = wz + sc * uz - tc * vz;
  return dx * dx + dy * dy + dz * dz;
}

export function sweptBladeCatchesProjectile(bladeStart, bladeEnd, projectileStart, projectileEnd, radius = MELEE_PROJECTILE_CATCH_RADIUS){
  return segmentSegmentDistanceSquared(bladeStart, bladeEnd, projectileStart, projectileEnd) <= radius * radius;
}
