export const SQUAD_MIN_SIZE = 5;
export const SQUAD_MAX_SIZE = 7;
export const SQUAD_ASSAULT_SLOTS = 3;

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
