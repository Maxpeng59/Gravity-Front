import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_HP_MULTIPLIER,
  BUILDING_KINDS,
  buildingHitPoints,
} from '../js/structure-balance.js';

test('every destructible building receives exactly twenty times its base HP', () => {
  assert.equal(BUILDING_HP_MULTIPLIER, 20);
  for (const kind of BUILDING_KINDS) assert.equal(buildingHitPoints(kind, 1250), 25000, kind);
});

test('non-building obstacles, vehicles, and ships retain their original HP', () => {
  for (const kind of ['wall', 'gate', 'guntower', 'radar', 'fueltank', 'truck', 'bigtray', 'musai'])
    assert.equal(buildingHitPoints(kind, 1250), 1250, kind);
});
