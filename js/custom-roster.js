const DEFAULT_PREFERRED_RANGE = { mg: 420, beam: 520, bazooka: 480, sniper: 1000 };

export function customSquadTraits(unit){
  // Capital ships are valid custom-roster entries but are deliberately outside
  // the mobile-suit squad net. Treat any non-MS record as neutral here so a
  // mixed Odessa roster can always redraw after another row is appended.
  if (!unit || !Array.isArray(unit.weapons)){
    return { meleeCapable: false, dedicatedSupport: false };
  }
  const longGun = unit.weapons.some(weapon => /SNIPER|LONG[ -]?RANGE/i.test(weapon.name || '') || (
    weapon.pref || DEFAULT_PREFERRED_RANGE[weapon.type] || 400
  ) >= 750);
  return {
    meleeCapable: !!(unit.saber?.dmg > 0) && !unit.vehicle,
    dedicatedSupport: !!unit.vehicle || !!longGun || unit.weapons.some(weapon => weapon.arc),
  };
}
