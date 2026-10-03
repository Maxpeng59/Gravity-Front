const PI = Math.PI;

export const SPACE_SHIP_TURN_ALIGNMENT = 0.18;
export const SPACE_SHIP_HOLD_HYSTERESIS = 55;
export const FEDERATION_RAM_CHANCE_PER_SECOND = 0.08;

export function wrapNavalAngle(angle){
  while (angle > PI) angle -= PI * 2;
  while (angle < -PI) angle += PI * 2;
  return angle;
}

export function spaceShipAttackHeading({
  team, turretCount, distance, gunRange, currentYaw, targetYaw, broadsideSide = 0,
  travelMode = 'move',
}){
  // Broadside is a stopped firing posture. A ship that needs to travel always
  // points its bow at the destination before propulsion can engage.
  const canBroadside = travelMode === 'hold'
    && team === 'FED' && turretCount >= 3 && distance <= gunRange;
  if (!canBroadside) return { yaw: targetYaw, broadside: false, side: 0 };

  let side = Math.sign(broadsideSide);
  if (!side){
    const port = wrapNavalAngle(targetYaw + PI / 2);
    const starboard = wrapNavalAngle(targetYaw - PI / 2);
    side = Math.abs(wrapNavalAngle(port - currentYaw))
      <= Math.abs(wrapNavalAngle(starboard - currentYaw)) ? 1 : -1;
  }
  return {
    yaw: wrapNavalAngle(targetYaw + side * PI / 2),
    broadside: true,
    side,
  };
}

export function spaceShipTravelMode(distance, standoff, previous = 'move'){
  if (previous === 'hold'){
    return distance > standoff + SPACE_SHIP_HOLD_HYSTERESIS ? 'move' : 'hold';
  }
  return distance <= standoff ? 'hold' : 'move';
}

export function spaceShipPropulsionEngaged(travelMode, headingError){
  return (travelMode === 'move' || travelMode === 'charge')
    && Math.abs(headingError) <= SPACE_SHIP_TURN_ALIGNMENT;
}

export function federationRamEligible({ team, kind, distance, standoff, cooldown = 0 }){
  return team === 'FED'
    && (kind === 'salamis' || kind === 'magellan')
    && cooldown <= 0
    && distance > 120
    && distance <= standoff + 180;
}

export function spaceShipVelocityToward(offset, speed, horizontal = true, verticalFactor = 0.68){
  const planar = Math.hypot(offset.x, offset.z);
  const maxVertical = speed * verticalFactor;
  const vertical = Math.max(-maxVertical, Math.min(maxVertical, offset.y * 0.32));
  if (!horizontal) return { x: 0, y: vertical, z: 0 };
  if (planar <= 1e-9) return { x: 0, y: vertical, z: 0 };
  const planarSpeed = Math.sqrt(Math.max(0, speed * speed - vertical * vertical));
  return {
    x: offset.x / planar * planarSpeed,
    y: vertical,
    z: offset.z / planar * planarSpeed,
  };
}

export function spaceShipHelmVelocity(yaw, forwardSpeed, verticalSpeed = 0){
  return {
    x: Math.sin(yaw) * forwardSpeed,
    y: verticalSpeed,
    z: Math.cos(yaw) * forwardSpeed,
  };
}

// Continuous point-against-point sweep expanded by both collision radii. The
// return value is the first contact as a fraction of the current frame.
export function sweptHeavyCollisionFraction(a, b, dt){
  const rx = a.pos.x - b.pos.x;
  const ry = a.pos.y - b.pos.y;
  const rz = a.pos.z - b.pos.z;
  const vx = (a.vel.x - b.vel.x) * dt;
  const vy = (a.vel.y - b.vel.y) * dt;
  const vz = (a.vel.z - b.vel.z) * dt;
  const radius = (a.collisionRadius || 0) + (b.collisionRadius || 0);
  const c = rx * rx + ry * ry + rz * rz - radius * radius;
  if (c <= 0) return 0;
  const aa = vx * vx + vy * vy + vz * vz;
  if (aa <= 1e-12) return null;
  const bb = 2 * (rx * vx + ry * vy + rz * vz);
  const discriminant = bb * bb - 4 * aa * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-bb - root) / (2 * aa);
  if (first >= 0 && first <= 1) return first;
  const second = (-bb + root) / (2 * aa);
  return second >= 0 && second <= 1 ? second : null;
}
