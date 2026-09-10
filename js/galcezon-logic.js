export const GALCEZON_CRUISE_MIN = 50;
export const GALCEZON_CRUISE_MAX = 100;
export const GALCEZON_BOARD_RADIUS = 80;
export const GALCEZON_BOARD_VERTICAL_REACH = 110;

export function galcezonCruiseAltitude(phase = 0){
  const middle = (GALCEZON_CRUISE_MIN + GALCEZON_CRUISE_MAX) / 2;
  const amplitude = (GALCEZON_CRUISE_MAX - GALCEZON_CRUISE_MIN) * 0.32;
  return middle + Math.sin(Number(phase) || 0) * amplitude;
}

// An attack carrier closes until its weapons are useful, then patrols the
// engagement band. It never receives a negative "retreat from target" input.
export function galcezonAttackRadial(range = 0, preferredRange = 1){
  const distance = Math.max(0, Number(range) || 0);
  const preferred = Math.max(1, Number(preferredRange) || 1);
  if (distance > preferred * 1.15) return 1;
  if (distance > preferred * 0.82) return 0.18;
  return 0;
}

export function playerCanBoardGalcezon({
  sameTeam = false, alive = false, capacity = 0, occupied = 0,
  planarDistance = Infinity, verticalGap = Infinity,
} = {}){
  return !!sameTeam && !!alive && Number(occupied) < Number(capacity)
    && Number(planarDistance) <= GALCEZON_BOARD_RADIUS
    && Number(verticalGap) <= GALCEZON_BOARD_VERTICAL_REACH;
}
