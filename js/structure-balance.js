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
