// Gameplay-scale profiles derived from the documented OYW roles and batteries.
// Published references do not give canonical top speeds, so movement preserves
// the established ordering: Gallop fastest/agile, Big Tray fast for its size,
// tracked Dobday slowest. HP and shell damage make all three capital threats.
export const LANDSHIP_PROFILES = Object.freeze({
  bigtray: Object.freeze({
    name: 'Big Tray-class', hp: 64000, speed: 18, turnRate: 0.22, standoff: 690,
    mainDamage: 900, mainSplash: 22, mainRof: [4.8, 6.6], mainRange: 1500,
    fixedDamage: 1350, fixedSplash: 28, fixedRof: [8, 11], fixedShots: 2,
    secondaryDamage: 48, secondaryRof: [1.1, 1.55], secondaryStations: 8, secondaryRange: 760,
    lengthM: 215, propulsion: 'THERMONUCLEAR HOVER', role: 'MOBILE COMMAND BATTLESHIP',
  }),
  dabude: Object.freeze({
    name: 'Dobday-class', hp: 58000, speed: 8.5, turnRate: 0.095, standoff: 760,
    mainDamage: 1325, mainSplash: 30, mainRof: [7.2, 9.6], mainRange: 1650,
    fixedDamage: 0, fixedSplash: 0, fixedRof: [99, 99], fixedShots: 0,
    secondaryDamage: 58, secondaryRof: [1.35, 1.9], secondaryStations: 6, secondaryRange: 720,
    lengthM: 109, propulsion: 'SIX TRIPLE-ROW TRACK PODS', role: 'HEAVY ARTILLERY COMMAND SHIP',
  }),
  gallop: Object.freeze({
    name: 'Gallop-class', hp: 32000, speed: 30, turnRate: 0.48, standoff: 470,
    mainDamage: 650, mainSplash: 19, mainRof: [4.4, 6.2], mainRange: 1220,
    fixedDamage: 0, fixedSplash: 0, fixedRof: [99, 99], fixedShots: 0,
    secondaryDamage: 44, secondaryRof: [1.0, 1.45], secondaryStations: 3, secondaryRange: 650,
    lengthM: 48, propulsion: 'TWIN THERMONUCLEAR HOVER PODS', role: 'FAST MS TRANSPORT',
  }),
});

export function landshipProfile(kind){
  return LANDSHIP_PROFILES[kind] || null;
}

export function isLandshipKind(kind){
  return landshipProfile(kind) !== null;
}
