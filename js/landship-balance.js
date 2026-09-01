// Gameplay-scale profiles derived from the documented OYW roles and batteries.
// Published references do not give canonical top speeds, so movement preserves
// the established ordering: Gallop fastest/agile, Big Tray fast for its size,
// tracked Dobday slowest. HP and shell damage make all three capital threats.
export const LANDSHIP_PROFILES = Object.freeze({
  bigtray: Object.freeze({
    name: 'Big Tray-class', hp: 64000, speed: 18, turnRate: 0.22, standoff: 1650,
    mainDamage: 900, mainSplash: 22, mainRof: [4.8, 6.6], mainRange: 2800, shellSpeed: 620, shellLife: 6.8,
    fixedDamage: 1350, fixedSplash: 28, fixedRof: [8, 11], fixedShots: 2,
    secondaryDamage: 48, secondarySplash: 0, secondaryRof: [1.1, 1.55], secondaryStations: 8, secondaryRange: 1200,
    lengthM: 215, propulsion: 'THERMONUCLEAR HOVER', role: 'MOBILE COMMAND BATTLESHIP',
  }),
  dabude: Object.freeze({
    name: 'Dobday-class', hp: 58000, speed: 8.5, turnRate: 0.095, standoff: 2200,
    mainDamage: 1325, mainSplash: 30, mainRof: [7.2, 9.6], mainRange: 3400, shellSpeed: 560, shellLife: 8,
    fixedDamage: 0, fixedSplash: 0, fixedRof: [99, 99], fixedShots: 0,
    secondaryDamage: 58, secondarySplash: 0, secondaryRof: [1.35, 1.9], secondaryStations: 6, secondaryRange: 1050,
    lengthM: 109, propulsion: 'SIX TRIPLE-ROW TRACK PODS', role: 'HEAVY ARTILLERY COMMAND SHIP',
  }),
  gallop: Object.freeze({
    name: 'Gallop-class', hp: 32000, speed: 30, turnRate: 0.48, standoff: 1250,
    mainDamage: 650, mainSplash: 19, mainRof: [4.4, 6.2], mainRange: 2400, shellSpeed: 680, shellLife: 5.5,
    fixedDamage: 0, fixedSplash: 0, fixedRof: [99, 99], fixedShots: 0,
    secondaryDamage: 44, secondarySplash: 0, secondaryRof: [1.0, 1.45], secondaryStations: 3, secondaryRange: 1000,
    lengthM: 48, propulsion: 'TWIN THERMONUCLEAR HOVER PODS', role: 'FAST MS TRANSPORT',
  }),
});

export function landshipProfile(kind){
  return LANDSHIP_PROFILES[kind] || null;
}

export function isLandshipKind(kind){
  return landshipProfile(kind) !== null;
}

// Landships are advancing fire-support assets. Once their batteries are in
// range they hold position; they never automatically reverse away from a target.
export function landshipTravelState(distance, standoff){
  return distance > standoff * 1.08 ? 'advance' : 'hold';
}
