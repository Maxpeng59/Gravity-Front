export const STATIONARY_BATTERIES = Object.freeze([
  Object.freeze({
    id: 'fedbattery', kind: 'battery', faction: 'FED',
    name: 'E.F.S.F. Stationary Twin Cannon Battery',
    code: '5,200 HP · RNG 1,850 · twin 180mm artillery',
  }),
  Object.freeze({
    id: 'zeonbattery', kind: 'battery', faction: 'ZEON',
    name: 'Zeon Stationary Twin Cannon Battery',
    code: '5,200 HP · RNG 1,850 · twin 180mm artillery',
  }),
]);

export const STATIONARY_BATTERY_IDS = new Set(STATIONARY_BATTERIES.map(battery => battery.id));

export function stationaryBatteryById(id){
  return STATIONARY_BATTERIES.find(battery => battery.id === id) || null;
}

// Authored maps carry their own emplacements. These four batteries give every
// generated ground battlefield a defended gun line for both factions.
export const DEFAULT_GROUND_BATTERIES = Object.freeze([
  Object.freeze({ kind: 'battery', team: 'FED', x: -250, z: -620, rotY: 0, scale: 1 }),
  Object.freeze({ kind: 'battery', team: 'FED', x: 250, z: -620, rotY: 0, scale: 1 }),
  Object.freeze({ kind: 'battery', team: 'ZEON', x: -250, z: 820, rotY: Math.PI, scale: 1 }),
  Object.freeze({ kind: 'battery', team: 'ZEON', x: 250, z: 820, rotY: Math.PI, scale: 1 }),
]);
