export const BUILDING_HP_MULTIPLIER = 20;

export const BUILDING_KINDS = new Set([
  'cityblock',
  'hangar',
  'barracks',
  'bunker',
  'commandpost',
  'base',
  'depot',
]);

export function buildingHitPoints(kind, baseHp){
  const hp = Number(baseHp) || 0;
  return BUILDING_KINDS.has(kind) ? hp * BUILDING_HP_MULTIPLIER : hp;
}

// Campaign objectives use explicitly authored combat HP. They are targets, not
// scenery, so the 20x building-survivability rule must never turn a 2,200 HP
// depot into a 44,000 HP mission blocker.
export function campaignObjectiveHitPoints(baseHp){
  return Math.max(1, Number(baseHp) || 1);
}
