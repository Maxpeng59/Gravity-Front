import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GROUND_BATTERIES, STATIONARY_BATTERIES, STATIONARY_BATTERY_IDS,
  stationaryBatteryById,
} from '../js/stationary-batteries.js';

test('both factions expose a selectable stationary battery', () => {
  assert.deepEqual(new Set(STATIONARY_BATTERIES.map(battery => battery.faction)), new Set(['FED', 'ZEON']));
  for (const battery of STATIONARY_BATTERIES){
    assert.equal(STATIONARY_BATTERY_IDS.has(battery.id), true);
    assert.equal(stationaryBatteryById(battery.id), battery);
  }
});

test('generated ground battlefields receive a defended battery line for both factions', () => {
  assert.equal(DEFAULT_GROUND_BATTERIES.length, 4);
  assert.deepEqual(new Set(DEFAULT_GROUND_BATTERIES.map(battery => battery.team)), new Set(['FED', 'ZEON']));
  for (const battery of DEFAULT_GROUND_BATTERIES){
    assert.equal(battery.kind, 'battery');
    assert.ok(Number.isFinite(battery.x) && Number.isFinite(battery.z));
  }
});
