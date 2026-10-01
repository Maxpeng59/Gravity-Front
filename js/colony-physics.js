// ---------- rotating colony habitat physics ----------
// Gravity inside the colony is artificial: the spinning shell presses objects
// against the inhabited surface, while the central volume behaves like free fall.

export const COLONY_RADIUS = 3200;
export const COLONY_GRAVITY_SCALE = 0.2;
export const COLONY_SURFACE_FALL_ACCEL = 38 * COLONY_GRAVITY_SCALE;
export const COLONY_FLIGHT_ENTER_HEIGHT = 48;
export const COLONY_FLIGHT_EXIT_HEIGHT = 18;

// Lower inside face of a cylinder whose axis runs along world Z. The playable
// strip is the lower arc; callers clamp farther-out coordinates to the rim.
export function colonyFloorHeight(x, radius = COLONY_RADIUS){
  const cx = Math.min(Math.abs(x), radius - 1);
  return radius - Math.sqrt(radius * radius - cx * cx);
}

// Crossing into the low-spin central volume changes a jump into free flight.
// A descending pilot reconnects with the rotating surface close to the deck.
export function colonyFreeFlightState(active, altitude, verticalSpeed){
  if (active) return !(altitude <= COLONY_FLIGHT_EXIT_HEIGHT && verticalSpeed <= 0);
  return altitude >= COLONY_FLIGHT_ENTER_HEIGHT && verticalSpeed > 0;
}
