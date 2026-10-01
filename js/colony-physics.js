// ---------- rotating colony habitat physics ----------
// Gravity inside the colony is artificial: the spinning shell presses objects
// against the inhabited surface, while the central volume behaves like free fall.

export const COLONY_RADIUS = 3200;
export const COLONY_GRAVITY_SCALE = 0.2;
export const COLONY_SURFACE_FALL_ACCEL = 38 * COLONY_GRAVITY_SCALE;
export const COLONY_FLIGHT_ENTER_HEIGHT = 48;
export const COLONY_FLIGHT_EXIT_HEIGHT = 18;
export const COLONY_FLIGHT_ROLL_RATE = Math.PI * 0.75;
export const COLONY_AI_FLIGHT_CRUISE_HEIGHT = 110;

// Lower inside face of a cylinder whose axis runs along world Z. The playable
// strip is the lower arc; callers clamp farther-out coordinates to the rim.
export function colonyFloorHeight(x, radius = COLONY_RADIUS){
  const cx = Math.min(Math.abs(x), radius - 1);
  return radius - Math.sqrt(radius * radius - cx * cx);
}

// Unit-length "up" direction from the inhabited inner shell toward the axis.
// A surface unit's local Y axis follows this vector, keeping it perpendicular
// to the curved deck instead of leaning in world space as it crosses the arc.
export function colonySurfaceNormal(x, radius = COLONY_RADIUS){
  const cx = Math.max(-radius + 1, Math.min(radius - 1, x));
  return { x: -cx / radius, y: Math.sqrt(radius * radius - cx * cx) / radius, z: 0 };
}

export function advanceColonyFlightRoll(current, input, dt, rate = COLONY_FLIGHT_ROLL_RATE){
  let roll = current + Math.max(-1, Math.min(1, input)) * rate * dt;
  while (roll > Math.PI) roll -= Math.PI * 2;
  while (roll < -Math.PI) roll += Math.PI * 2;
  return roll;
}

// Crossing into the low-spin central volume changes a jump into free flight.
// A descending pilot reconnects with the rotating surface close to the deck.
export function colonyFreeFlightState(active, altitude, verticalSpeed){
  if (active) return !(altitude <= COLONY_FLIGHT_EXIT_HEIGHT && verticalSpeed <= 0);
  return altitude >= COLONY_FLIGHT_ENTER_HEIGHT && verticalSpeed > 0;
}
