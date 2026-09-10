export const GALCEZON_CRUISE_MIN = 50;
export const GALCEZON_CRUISE_MAX = 100;
export const GALCEZON_BOARD_RADIUS = 80;
export const GALCEZON_BOARD_VERTICAL_REACH = 110;
export const GALCEZON_UNDERSIDE_RADIUS = 48;
export const GALCEZON_UNDERSIDE_REACH = 200;
export const GALCEZON_ATTACK_STRAFE_WEIGHT = 0.24;

export function galcezonCruiseAltitude(phase = 0){
  const middle = (GALCEZON_CRUISE_MIN + GALCEZON_CRUISE_MAX) / 2;
  const amplitude = (GALCEZON_CRUISE_MAX - GALCEZON_CRUISE_MIN) * 0.32;
  return middle + Math.sin(Number(phase) || 0) * amplitude;
}

// An attack carrier always retains an inward component. It closes hard from
// long range and advances more deliberately while its guns are already useful.
export function galcezonAttackRadial(range = 0, preferredRange = 1){
  const distance = Math.max(0, Number(range) || 0);
  const preferred = Math.max(1, Number(preferredRange) || 1);
  if (distance > preferred * 1.15) return 1;
  if (distance > preferred * 0.82) return 0.72;
  return 0.48;
}

export function playerCanBoardGalcezon({
  sameTeam = false, alive = false, capacity = 0, occupied = 0,
  planarDistance = Infinity, verticalGap = Infinity, carrierAbovePlayer = false,
} = {}){
  const horizontal = Number(planarDistance), vertical = Number(verticalGap);
  const sideApproach = horizontal <= GALCEZON_BOARD_RADIUS
    && vertical <= GALCEZON_BOARD_VERTICAL_REACH;
  const undersideApproach = !!carrierAbovePlayer
    && horizontal <= GALCEZON_UNDERSIDE_RADIUS
    && vertical <= GALCEZON_UNDERSIDE_REACH;
  return !!sameTeam && !!alive && Number(occupied) < Number(capacity)
    && (sideApproach || undersideApproach);
}
