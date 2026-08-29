// Small, dependency-free collision queries shared by movement and projectile code.
// Yaw follows Three.js' +Y convention:
// worldX = cos(yaw) * localX + sin(yaw) * localZ
// worldZ = -sin(yaw) * localX + cos(yaw) * localZ.

const EPS = 1e-10;

const writeRayHit = (out, t, x, y, z, nx, ny, nz, inside) => {
  if (!out) return;
  out.t = t;
  out.x = x;
  out.y = y;
  out.z = z;
  out.nx = nx;
  out.ny = ny;
  out.nz = nz;
  out.inside = inside;
};

/**
 * Tests `origin + direction * t` against a sphere over `[minT, maxT]`.
 * Returns a boolean and, when supplied, fills `out` with
 * `{t,x,y,z,nx,ny,nz,inside}`. A ray already inside reports `minT`.
 */
export function raySphere(
  ox, oy, oz, dx, dy, dz,
  cx, cy, cz, radius,
  out = null, minT = 0, maxT = Infinity,
){
  if (!(radius >= 0) || !(maxT >= minT) || !Number.isFinite(minT)) return false;

  const sx = ox + dx * minT;
  const sy = oy + dy * minT;
  const sz = oz + dz * minT;
  const smx = sx - cx;
  const smy = sy - cy;
  const smz = sz - cz;
  const radiusSq = radius * radius;
  const sampleDistSq = smx * smx + smy * smy + smz * smz;

  if (sampleDistSq <= radiusSq + EPS){
    const length = Math.sqrt(sampleDistSq);
    let nx;
    let ny;
    let nz;
    if (length > EPS){
      const inv = 1 / length;
      nx = smx * inv;
      ny = smy * inv;
      nz = smz * inv;
    } else {
      const dirLength = Math.hypot(dx, dy, dz);
      if (dirLength > EPS){
        const inv = -1 / dirLength;
        nx = dx * inv;
        ny = dy * inv;
        nz = dz * inv;
      } else {
        nx = 1;
        ny = 0;
        nz = 0;
      }
    }
    writeRayHit(out, minT, sx, sy, sz, nx, ny, nz, true);
    return true;
  }

  const a = dx * dx + dy * dy + dz * dz;
  if (a <= EPS) return false;
  const mx = ox - cx;
  const my = oy - cy;
  const mz = oz - cz;
  const halfB = mx * dx + my * dy + mz * dz;
  const c = mx * mx + my * my + mz * mz - radiusSq;
  const discriminant = halfB * halfB - a * c;
  if (discriminant < 0) return false;

  const root = Math.sqrt(Math.max(0, discriminant));
  let t = (-halfB - root) / a;
  if (t < minT - EPS) t = (-halfB + root) / a;
  if (t < minT - EPS || t > maxT + EPS) return false;
  if (t < minT) t = minT;
  if (t > maxT) t = maxT;

  const x = ox + dx * t;
  const y = oy + dy * t;
  const z = oz + dz * t;
  const nx0 = x - cx;
  const ny0 = y - cy;
  const nz0 = z - cz;
  const normalLength = Math.hypot(nx0, ny0, nz0);
  if (normalLength > EPS){
    const inv = 1 / normalLength;
    writeRayHit(out, t, x, y, z, nx0 * inv, ny0 * inv, nz0 * inv, false);
  } else {
    const inv = -1 / Math.sqrt(a);
    writeRayHit(out, t, x, y, z, dx * inv, dy * inv, dz * inv, false);
  }
  return true;
}

/**
 * Tests segment `a -> b` against a sphere. `out.t` is a segment fraction in
 * `[0,1]`; the remaining output fields match {@link raySphere}.
 */
export function segmentSphere(
  ax, ay, az, bx, by, bz,
  cx, cy, cz, radius,
  out = null,
){
  return raySphere(
    ax, ay, az, bx - ax, by - ay, bz - az,
    cx, cy, cz, radius, out, 0, 1,
  );
}

/**
 * Tests `origin + direction * t` against a yaw-oriented 3D box over
 * `[minT,maxT]`. Half sizes are `(halfX,halfY,halfZ)`. Fills the same output
 * shape as {@link raySphere}; normals point out of the box.
 */
export function rayYawBox(
  ox, oy, oz, dx, dy, dz,
  cx, cy, cz, halfX, halfY, halfZ, yaw,
  out = null, minT = 0, maxT = Infinity,
){
  if (
    !(halfX >= 0) || !(halfY >= 0) || !(halfZ >= 0)
    || !(maxT >= minT) || !Number.isFinite(minT)
  ) return false;

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const relX = ox - cx;
  const relY = oy - cy;
  const relZ = oz - cz;
  const localOx = cos * relX - sin * relZ;
  const localOy = relY;
  const localOz = sin * relX + cos * relZ;
  const localDx = cos * dx - sin * dz;
  const localDy = dy;
  const localDz = sin * dx + cos * dz;

  const sampleX = localOx + localDx * minT;
  const sampleY = localOy + localDy * minT;
  const sampleZ = localOz + localDz * minT;
  if (
    Math.abs(sampleX) <= halfX + EPS
    && Math.abs(sampleY) <= halfY + EPS
    && Math.abs(sampleZ) <= halfZ + EPS
  ){
    const distanceX = halfX - Math.abs(sampleX);
    const distanceY = halfY - Math.abs(sampleY);
    const distanceZ = halfZ - Math.abs(sampleZ);
    let localNx = sampleX < 0 ? -1 : 1;
    let localNy = 0;
    let localNz = 0;
    if (distanceY < distanceX && distanceY <= distanceZ){
      localNx = 0;
      localNy = sampleY < 0 ? -1 : 1;
    } else if (distanceZ < distanceX && distanceZ < distanceY){
      localNx = 0;
      localNz = sampleZ < 0 ? -1 : 1;
    }
    const nx = cos * localNx + sin * localNz;
    const nz = -sin * localNx + cos * localNz;
    writeRayHit(
      out, minT,
      ox + dx * minT, oy + dy * minT, oz + dz * minT,
      nx, localNy, nz, true,
    );
    return true;
  }

  let enter = -Infinity;
  let exit = Infinity;
  let hitNx = 0;
  let hitNy = 0;
  let hitNz = 0;

  if (Math.abs(localDx) <= EPS){
    if (localOx < -halfX || localOx > halfX) return false;
  } else {
    let near = (-halfX - localOx) / localDx;
    let far = (halfX - localOx) / localDx;
    let nearNormal = -1;
    if (near > far){
      const swap = near;
      near = far;
      far = swap;
      nearNormal = 1;
    }
    if (near > enter){
      enter = near;
      hitNx = nearNormal;
      hitNy = 0;
      hitNz = 0;
    }
    if (far < exit) exit = far;
    if (enter > exit + EPS) return false;
  }

  if (Math.abs(localDy) <= EPS){
    if (localOy < -halfY || localOy > halfY) return false;
  } else {
    let near = (-halfY - localOy) / localDy;
    let far = (halfY - localOy) / localDy;
    let nearNormal = -1;
    if (near > far){
      const swap = near;
      near = far;
      far = swap;
      nearNormal = 1;
    }
    if (near > enter){
      enter = near;
      hitNx = 0;
      hitNy = nearNormal;
      hitNz = 0;
    }
    if (far < exit) exit = far;
    if (enter > exit + EPS) return false;
  }

  if (Math.abs(localDz) <= EPS){
    if (localOz < -halfZ || localOz > halfZ) return false;
  } else {
    let near = (-halfZ - localOz) / localDz;
    let far = (halfZ - localOz) / localDz;
    let nearNormal = -1;
    if (near > far){
      const swap = near;
      near = far;
      far = swap;
      nearNormal = 1;
    }
    if (near > enter){
      enter = near;
      hitNx = 0;
      hitNy = 0;
      hitNz = nearNormal;
    }
    if (far < exit) exit = far;
    if (enter > exit + EPS) return false;
  }

  if (exit < minT - EPS || enter > maxT + EPS) return false;
  let t = Math.max(enter, minT);
  if (t > maxT) t = maxT;
  const nx = cos * hitNx + sin * hitNz;
  const nz = -sin * hitNx + cos * hitNz;
  writeRayHit(out, t, ox + dx * t, oy + dy * t, oz + dz * t, nx, hitNy, nz, false);
  return true;
}

/**
 * Tests segment `a -> b` against a yaw-oriented box. `out.t` is a segment
 * fraction in `[0,1]`; the remaining output fields match {@link rayYawBox}.
 */
export function segmentYawBox(
  ax, ay, az, bx, by, bz,
  cx, cy, cz, halfX, halfY, halfZ, yaw,
  out = null,
){
  return rayYawBox(
    ax, ay, az, bx - ax, by - ay, bz - az,
    cx, cy, cz, halfX, halfY, halfZ, yaw, out, 0, 1,
  );
}

/**
 * Tests a circle against a yaw-oriented rectangle in XZ. On overlap, fills
 * `out` with `{depth,nx,nz,contactX,contactZ,inside}`. The normal points from
 * the rectangle toward the circle and `depth` is the separating distance.
 */
export function circleYawRectPenetration(
  x, z, radius,
  rectX, rectZ, halfX, halfZ, yaw,
  out = null,
){
  if (!(radius >= 0) || !(halfX >= 0) || !(halfZ >= 0)) return false;

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const relX = x - rectX;
  const relZ = z - rectZ;
  const localX = cos * relX - sin * relZ;
  const localZ = sin * relX + cos * relZ;
  const inside = Math.abs(localX) <= halfX && Math.abs(localZ) <= halfZ;

  let localNx;
  let localNz;
  let contactLocalX;
  let contactLocalZ;
  let depth;

  if (inside){
    const left = localX + halfX;
    const right = halfX - localX;
    const back = localZ + halfZ;
    const front = halfZ - localZ;
    let faceDistance = left;
    localNx = -1;
    localNz = 0;
    contactLocalX = -halfX;
    contactLocalZ = localZ;
    if (right < faceDistance){
      faceDistance = right;
      localNx = 1;
      localNz = 0;
      contactLocalX = halfX;
      contactLocalZ = localZ;
    }
    if (back < faceDistance){
      faceDistance = back;
      localNx = 0;
      localNz = -1;
      contactLocalX = localX;
      contactLocalZ = -halfZ;
    }
    if (front < faceDistance){
      faceDistance = front;
      localNx = 0;
      localNz = 1;
      contactLocalX = localX;
      contactLocalZ = halfZ;
    }
    depth = radius + faceDistance;
  } else {
    contactLocalX = localX < -halfX ? -halfX : localX > halfX ? halfX : localX;
    contactLocalZ = localZ < -halfZ ? -halfZ : localZ > halfZ ? halfZ : localZ;
    const deltaX = localX - contactLocalX;
    const deltaZ = localZ - contactLocalZ;
    const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
    if (distanceSq > radius * radius + EPS) return false;
    const distance = Math.sqrt(Math.max(0, distanceSq));
    if (distance > EPS){
      const inv = 1 / distance;
      localNx = deltaX * inv;
      localNz = deltaZ * inv;
    } else {
      localNx = 1;
      localNz = 0;
    }
    depth = Math.max(0, radius - distance);
  }

  if (out){
    out.depth = depth;
    out.nx = cos * localNx + sin * localNz;
    out.nz = -sin * localNx + cos * localNz;
    out.contactX = rectX + cos * contactLocalX + sin * contactLocalZ;
    out.contactZ = rectZ - sin * contactLocalX + cos * contactLocalZ;
    out.inside = inside;
  }
  return true;
}

/**
 * Sweeps a circle in XZ from `(x,z)` by `(deltaX,deltaZ) * t` against a
 * yaw-oriented rectangle for `t` in `[0,maxT]`. On hit, fills `out` with
 * `{t,x,z,nx,nz,contactX,contactZ,depth,inside}`. The rounded-corner test is
 * exact rather than an expanded-AABB approximation.
 */
export function sweepCircleYawRect(
  x, z, deltaX, deltaZ, radius,
  rectX, rectZ, halfX, halfZ, yaw,
  out = null, maxT = 1,
){
  if (
    !(radius >= 0) || !(halfX >= 0) || !(halfZ >= 0)
    || !(maxT >= 0)
  ) return false;

  if (circleYawRectPenetration(x, z, radius, rectX, rectZ, halfX, halfZ, yaw, out)){
    if (out){
      out.t = 0;
      out.x = x;
      out.z = z;
    }
    return true;
  }

  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const relX = x - rectX;
  const relZ = z - rectZ;
  const localX = cos * relX - sin * relZ;
  const localZ = sin * relX + cos * relZ;
  const localDx = cos * deltaX - sin * deltaZ;
  const localDz = sin * deltaX + cos * deltaZ;
  let bestT = Infinity;
  let bestNx = 0;
  let bestNz = 0;

  // Four straight portions of the rectangle expanded by the circle radius.
  if (localDx > EPS){
    let t = (-halfX - radius - localX) / localDx;
    const atZ = localZ + localDz * t;
    if (t >= -EPS && t <= maxT + EPS && atZ >= -halfZ - EPS && atZ <= halfZ + EPS){
      if (t < 0) t = 0;
      bestT = t;
      bestNx = -1;
      bestNz = 0;
    }
  }
  if (localDx < -EPS){
    let t = (halfX + radius - localX) / localDx;
    const atZ = localZ + localDz * t;
    if (t >= -EPS && t <= maxT + EPS && atZ >= -halfZ - EPS && atZ <= halfZ + EPS){
      if (t < 0) t = 0;
      if (t < bestT){
        bestT = t;
        bestNx = 1;
        bestNz = 0;
      }
    }
  }
  if (localDz > EPS){
    let t = (-halfZ - radius - localZ) / localDz;
    const atX = localX + localDx * t;
    if (t >= -EPS && t <= maxT + EPS && atX >= -halfX - EPS && atX <= halfX + EPS){
      if (t < 0) t = 0;
      if (t < bestT){
        bestT = t;
        bestNx = 0;
        bestNz = -1;
      }
    }
  }
  if (localDz < -EPS){
    let t = (halfZ + radius - localZ) / localDz;
    const atX = localX + localDx * t;
    if (t >= -EPS && t <= maxT + EPS && atX >= -halfX - EPS && atX <= halfX + EPS){
      if (t < 0) t = 0;
      if (t < bestT){
        bestT = t;
        bestNx = 0;
        bestNz = 1;
      }
    }
  }

  // Four quarter-circles make the exact rounded corners of the Minkowski sum.
  const speedSq = localDx * localDx + localDz * localDz;
  if (radius > 0 && speedSq > EPS){
    for (let i = 0; i < 4; i++){
      const sideX = (i & 1) ? 1 : -1;
      const sideZ = (i & 2) ? 1 : -1;
      const cornerX = sideX * halfX;
      const cornerZ = sideZ * halfZ;
      const mx = localX - cornerX;
      const mz = localZ - cornerZ;
      const halfB = mx * localDx + mz * localDz;
      const c = mx * mx + mz * mz - radius * radius;
      const discriminant = halfB * halfB - speedSq * c;
      if (discriminant < 0) continue;
      let t = (-halfB - Math.sqrt(Math.max(0, discriminant))) / speedSq;
      if (t < -EPS || t > maxT + EPS || t >= bestT) continue;
      if (t < 0) t = 0;
      const hitDeltaX = localX + localDx * t - cornerX;
      const hitDeltaZ = localZ + localDz * t - cornerZ;
      if (hitDeltaX * sideX < -EPS || hitDeltaZ * sideZ < -EPS) continue;
      const normalLength = Math.hypot(hitDeltaX, hitDeltaZ);
      if (normalLength <= EPS) continue;
      const inv = 1 / normalLength;
      bestT = t;
      bestNx = hitDeltaX * inv;
      bestNz = hitDeltaZ * inv;
    }
  }

  if (bestT === Infinity || bestT > maxT + EPS) return false;
  const nx = cos * bestNx + sin * bestNz;
  const nz = -sin * bestNx + cos * bestNz;
  const hitX = x + deltaX * bestT;
  const hitZ = z + deltaZ * bestT;
  if (out){
    out.t = bestT;
    out.x = hitX;
    out.z = hitZ;
    out.nx = nx;
    out.nz = nz;
    out.contactX = hitX - nx * radius;
    out.contactZ = hitZ - nz * radius;
    out.depth = 0;
    out.inside = false;
  }
  return true;
}
