// Custom-battle profiles for the One Year War fleet hulls. Campaign missions
// can still pass their authored HP, while custom sorties use these class values.
// Travel speeds are intentionally four times the original values so capital
// ships cross fleet-scale maps briskly while retaining their class ordering.
export const SPACE_SHIP_PROFILES = Object.freeze({
  salamis: Object.freeze({
    name: 'Salamis-class', faction: 'FED', hp: 36000, speed: 56, turnRate: 0.13, standoff: 620,
    mainDamage: 360, mainSplash: 12, mainRof: [2.6, 4.2], mainRange: 1400,
    missileCount: 6, missileDamage: 420, missileSplash: 14, missileSpeed: 430, missileRange: 1750, missileCooldown: 8,
    torpedo: true, torpedoDamage: 2600, torpedoSplash: 32, torpedoSpeed: 310, torpedoRange: 1900, torpedoCooldown: 14,
    ramSpeedMultiplier: 2.8, ramDuration: 30, ramCooldown: 38,
    role: 'SPACE CRUISER', code: 'EFSF mass-production cruiser',
  }),
  magellan: Object.freeze({
    name: 'Magellan-class', faction: 'FED', hp: 52000, speed: 42, turnRate: 0.095, standoff: 700,
    mainDamage: 440, mainSplash: 15, mainRof: [2.8, 4.4], mainRange: 1600, gunShots: 2,
    missileCount: 6, missileDamage: 500, missileSplash: 16, missileSpeed: 420, missileRange: 1850, missileCooldown: 8.5,
    torpedo: true, torpedoDamage: 3200, torpedoSplash: 36, torpedoSpeed: 300, torpedoRange: 2100, torpedoCooldown: 16,
    ramSpeedMultiplier: 2.65, ramDuration: 34, ramCooldown: 44,
    role: 'SPACE BATTLESHIP', code: 'EFSF fleet flagship',
  }),
  columbus: Object.freeze({
    name: 'Columbus-class', faction: 'FED', hp: 30000, speed: 32, turnRate: 0.08, standoff: 900,
    mainDamage: 220, mainSplash: 8, mainRof: [4.2, 6.0], mainRange: 1000,
    missileCount: 6, missileDamage: 340, missileSplash: 12, missileSpeed: 400, missileRange: 1500, missileCooldown: 10,
    torpedo: true, torpedoDamage: 2100, torpedoSplash: 28, torpedoSpeed: 285, torpedoRange: 1700, torpedoCooldown: 18,
    role: 'FLEET CARRIER', code: 'EFSF supply and MS carrier',
  }),
  musai: Object.freeze({
    name: 'Musai-class', faction: 'ZEON', hp: 34000, speed: 60, turnRate: 0.15, standoff: 620,
    mainDamage: 370, mainSplash: 12, mainRof: [2.5, 4.0], mainRange: 1450,
    missileCount: 6, missileDamage: 460, missileSplash: 15, missileSpeed: 440, missileRange: 1800, missileCooldown: 8,
    role: 'LIGHT CRUISER', code: 'Zeon mobile-suit cruiser',
  }),
  chivvay: Object.freeze({
    name: 'Chivvay-class', faction: 'ZEON', hp: 50000, speed: 44, turnRate: 0.1, standoff: 690,
    mainDamage: 420, mainSplash: 14, mainRof: [2.9, 4.5], mainRange: 1550, gunShots: 2,
    missileCount: 6, missileDamage: 520, missileSplash: 17, missileSpeed: 420, missileRange: 1900, missileCooldown: 9,
    role: 'HEAVY CRUISER', code: 'Zeon high-speed heavy cruiser',
  }),
});

export function spaceShipProfile(kind){
  return SPACE_SHIP_PROFILES[kind] || null;
}

export function isSpaceShipKind(kind){
  return spaceShipProfile(kind) !== null;
}
