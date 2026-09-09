export const SQUAD_MIN_SIZE = 5;
export const SQUAD_MAX_SIZE = 7;
export const SQUAD_ASSAULT_SLOTS = 3;
export const PROTECTION_MAX_RANGE = 100;
export const PROTECTION_MELEE_RANGE = 50;
export const ASSAULT_SUPPORT_TETHER = 225;

export function shouldProtectAlly({ selfValue = 0, allyValue = 0, hpFraction = 0 } = {}){
  return Number(selfValue) < Number(allyValue) && Number(hpFraction) > 0.5;
}

export function targetPriorityScore(value = 0, distance = 0){
  const tacticalValue = Math.max(1, Number(value) || 1);
  const range = Math.max(0, Number(distance) || 0);
  // Value wins the strategic choice, but distance prevents the squad from
  // ignoring an immediate threat for a flagship on the far side of the map.
  const proximity = 1 + range / 900;
  const closeThreat = range <= PROTECTION_MELEE_RANGE ? 4 : range <= 180 ? 1.6 : 1;
  return tacticalValue * closeThreat / proximity;
}

export function chooseRouteSide({ leftBlocked = false, rightBlocked = false, leftRise = 0, rightRise = 0, fallback = 1 } = {}){
  const leftScore = (leftBlocked ? 1000 : 0) + Math.max(0, Number(leftRise) || 0);
  const rightScore = (rightBlocked ? 1000 : 0) + Math.max(0, Number(rightRise) || 0);
  if (leftScore === rightScore) return fallback < 0 ? -1 : 1;
  return leftScore < rightScore ? -1 : 1;
}

export function squadSizes(total){
  const count = Math.max(0, Math.trunc(Number(total)) || 0);
  if (!count) return [];
  if (count <= SQUAD_MAX_SIZE) return [count];
  if (count < SQUAD_MIN_SIZE * 2) return [SQUAD_MIN_SIZE, count - SQUAD_MIN_SIZE];
  const groups = Math.ceil(count / SQUAD_MAX_SIZE);
  const base = Math.floor(count / groups), extra = count % groups;
  return Array.from({ length: groups }, (_, index) => base + (index < extra ? 1 : 0));
}

export function assignSquadRoles(members){
  const list = Array.isArray(members) ? members : [];
  const meleeCapable = list.filter(member => member?.meleeCapable).length;
  const assaultCount = Math.min(SQUAD_ASSAULT_SLOTS, meleeCapable, Math.max(1, Math.ceil(list.length / 2)));
  const ranked = list.map((member, index) => ({
    index,
    score: (member?.meleeCapable ? 100 : 0) + (Number(member?.meleeScore) || 0)
      - (member?.dedicatedSupport ? 80 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  const assault = new Set(ranked.slice(0, assaultCount).map(item => item.index));
  let supportIndex = 0, assaultIndex = 0;
  return list.map((_, index) => assault.has(index)
    ? { role: 'assault', slot: assaultIndex++ }
    : { role: 'support', slot: supportIndex++ });
}

// Local combat-formation coordinates. `forward` points toward the squad's
// target and `lateral` points to its right. The assault element forms a shallow
// arrowhead; ranged machines occupy a wider, deeper gun line so their muzzles
// are not masked by the front rank.
export function formationSlotOffset(role = 'support', slot = 0){
  const index = Math.max(0, Math.trunc(Number(slot)) || 0);
  if (role === 'assault'){
    if (index === 0) return { forward: 0, lateral: 0 };
    const row = Math.ceil(index / 2);
    return {
      forward: -48 * row,
      lateral: (index % 2 ? -1 : 1) * (62 + (row - 1) * 24),
    };
  }
  if (index === 0) return { forward: -155, lateral: 0 };
  const row = Math.ceil(index / 2);
  return {
    forward: -180 - (row - 1) * 82,
    lateral: (index % 2 ? -1 : 1) * (82 + (row - 1) * 28),
  };
}

export function formationSteeringStrength({
  role = 'support', distanceToSlot = 0, targetRange = 0, preferredRange = 1,
  reposition = false, meleeReady = false,
} = {}){
  const tolerance = role === 'assault' ? 42 : 62;
  const error = Math.max(0, Number(distanceToSlot) || 0);
  if (error <= tolerance || reposition || meleeReady) return 0;
  const preferred = Math.max(1, Number(preferredRange) || 1);
  const range = Math.max(0, Number(targetRange) || 0);
  // Formation is strongest once the squad reaches combat range. On a long
  // approach it becomes a light correction so nobody marches sideways forever
  // instead of closing with the enemy.
  const approachUrgency = Math.max(0, Math.min(1, (range - preferred * 1.55) / (preferred * 0.85)));
  const base = role === 'assault' ? 0.62 : 0.72;
  const errorScale = Math.max(0.25, Math.min(1, (error - tolerance) / 220));
  return base * errorScale * (1 - approachUrgency * 0.58);
}

export function minimumAttackAdvance(targetRange = 0, preferredRange = 1){
  const range = Math.max(0, Number(targetRange) || 0);
  const preferred = Math.max(1, Number(preferredRange) || 1);
  if (range > preferred * 2.2) return 0.72;
  if (range > preferred * 1.55) return 0.42;
  return 0;
}

export function groundTacticalDecision({
  role = 'line', range = 0, preferredRange = 1, highGround = 0,
  localSlope = 0, routeRise = 0, lineOfSight = true, hasMelee = false,
  anchorSupport = false,
} = {}){
  const distance = Math.max(0, Number(range) || 0);
  const preferred = Math.max(1, Number(preferredRange) || 1);
  const slope = Math.max(0, Number(localSlope) || 0);
  const ridge = Math.max(0, Number(routeRise) || 0);
  const elevation = Number(highGround) || 0;
  const support = role === 'support';
  const stableGround = slope <= (anchorSupport ? 0.46 : 0.36);
  const firingBand = distance >= preferred * (anchorSupport ? 0.42 : 0.55)
    && distance <= preferred * (anchorSupport ? 1.95 : 1.65);
  const kneel = support && lineOfSight && stableGround && ridge < 12
    && elevation > -0.5 && firingBand;
  const reposition = support && (!lineOfSight || slope > 0.52 || ridge >= 16 || elevation < -0.65);
  const melee = role === 'assault' && hasMelee && distance <= 520
    && slope < 0.5 && ridge < 19 && elevation > -0.55;
  return { kneel, reposition, melee, holdRange: support, stableGround, firingBand };
}
