export const MS_MIN_MAGAZINES = 5;
export const MS_MAX_MAGAZINES = 10;

export function mobileSuitUsesFiniteAmmo(suit){
  return !!suit && !suit.air && !suit.vehicle && Array.isArray(suit.weapons);
}

export function createAmmoSupply(suit, totalMagazines = MS_MIN_MAGAZINES){
  const clips = (suit?.weapons || []).map(weapon => Math.max(0, Number(weapon?.clip) || 0));
  const limited = mobileSuitUsesFiniteAmmo(suit);
  const magazines = limited
    ? Math.max(MS_MIN_MAGAZINES, Math.min(MS_MAX_MAGAZINES, Math.trunc(Number(totalMagazines) || MS_MIN_MAGAZINES)))
    : Infinity;
  return {
    limited,
    magazines,
    clips,
    reserves: clips.map(clip => limited ? clip * (magazines - 1) : Infinity),
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
