export const MS_TOTAL_MAGAZINES = 3;

export function mobileSuitUsesFiniteAmmo(suit){
  return !!suit && !suit.air && !suit.vehicle && Array.isArray(suit.weapons);
}

export function createAmmoSupply(suit){
  const clips = (suit?.weapons || []).map(weapon => Math.max(0, Number(weapon?.clip) || 0));
  const limited = mobileSuitUsesFiniteAmmo(suit);
  return {
    limited,
    clips,
    reserves: clips.map(clip => limited ? clip * (MS_TOTAL_MAGAZINES - 1) : Infinity),
  };
}

export function weaponAmmoRemaining(unit, weaponIndex = unit?.wi || 0){
  if (!unit?.ammoLimited) return Infinity;
  const loaded = Math.max(0, Number(unit.weaponClips?.[weaponIndex]) || 0);
  const reserve = Math.max(0, Number(unit.ammoReserves?.[weaponIndex]) || 0);
  return loaded + reserve;
}

export function allRangedAmmoSpent(unit){
  if (!unit?.ammoLimited) return false;
  return (unit.weaponClips || []).every((_, index) => weaponAmmoRemaining(unit, index) <= 0.0001);
}
