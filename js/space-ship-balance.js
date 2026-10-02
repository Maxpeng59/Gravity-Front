// Custom-battle profiles for the One Year War fleet hulls. Campaign missions
// can still pass their authored HP, while custom sorties use these class values.
export const SPACE_SHIP_PROFILES = Object.freeze({
  salamis: Object.freeze({
    name: 'Salamis-class', faction: 'FED', hp: 36000, speed: 14, turnRate: 0.13, standoff: 620,
    mainDamage: 360, mainSplash: 12, mainRof: [2.6, 4.2], mainRange: 1400,
    role: 'SPACE CRUISER', code: 'EFSF mass-production cruiser',
  }),
  magellan: Object.freeze({
    name: 'Magellan-class', faction: 'FED', hp: 52000, speed: 10.5, turnRate: 0.095, standoff: 700,
    mainDamage: 440, mainSplash: 15, mainRof: [2.8, 4.4], mainRange: 1600, gunShots: 2,
    role: 'SPACE BATTLESHIP', code: 'EFSF fleet flagship',
  }),
  columbus: Object.freeze({
    name: 'Columbus-class', faction: 'FED', hp: 30000, speed: 8, turnRate: 0.08, standoff: 900,
    mainDamage: 220, mainSplash: 8, mainRof: [4.2, 6.0], mainRange: 1000,
    role: 'FLEET CARRIER', code: 'EFSF supply and MS carrier',
  }),
  musai: Object.freeze({
    name: 'Musai-class', faction: 'ZEON', hp: 34000, speed: 15, turnRate: 0.15, standoff: 620,
    mainDamage: 370, mainSplash: 12, mainRof: [2.5, 4.0], mainRange: 1450,
    role: 'LIGHT CRUISER', code: 'Zeon mobile-suit cruiser',
  }),
  chivvay: Object.freeze({
    name: 'Chivvay-class', faction: 'ZEON', hp: 50000, speed: 11, turnRate: 0.1, standoff: 690,
    mainDamage: 420, mainSplash: 14, mainRof: [2.9, 4.5], mainRange: 1550, gunShots: 2,
    role: 'HEAVY CRUISER', code: 'Zeon high-speed heavy cruiser',
  }),
});

export function spaceShipProfile(kind){
  return SPACE_SHIP_PROFILES[kind] || null;
}

export function isSpaceShipKind(kind){
  return spaceShipProfile(kind) !== null;
}
