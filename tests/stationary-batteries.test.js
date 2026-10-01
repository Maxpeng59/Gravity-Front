import test from 'node:test';
import assert from 'node:assert/strict';
import * as stationaryBatteryModule from '../js/stationary-batteries.js';
import {
  STATIONARY_BATTERIES, STATIONARY_BATTERY_IDS,
  stationaryBatteryById,
} from '../js/stationary-batteries.js';

test('both factions expose a selectable stationary battery', () => {
  assert.deepEqual(new Set(STATIONARY_BATTERIES.map(battery => battery.faction)), new Set(['FED', 'ZEON']));
  for (const battery of STATIONARY_BATTERIES){
    assert.equal(STATIONARY_BATTERY_IDS.has(battery.id), true);
    assert.equal(stationaryBatteryById(battery.id), battery);
  }
});

test('stationary batteries are roster choices rather than automatic battlefield defaults', () => {
  assert.equal('DEFAULT_GROUND_BATTERIES' in stationaryBatteryModule, false);
});
