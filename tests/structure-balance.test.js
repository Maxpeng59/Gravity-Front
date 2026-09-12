import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDING_HP_MULTIPLIER,
  BUILDING_KINDS,
  buildingHitPoints,
  campaignObjectiveHitPoints,
} from '../js/structure-balance.js';

test('every destructible building receives exactly twenty times its base HP', () => {
  assert.equal(BUILDING_HP_MULTIPLIER, 20);
  for (const kind of BUILDING_KINDS) assert.equal(buildingHitPoints(kind, 1250), 25000, kind);
});

test('non-building obstacles, vehicles, and ships retain their original HP', () => {
  for (const kind of ['wall', 'gate', 'guntower', 'radar', 'fueltank', 'truck', 'bigtray', 'musai'])
    assert.equal(buildingHitPoints(kind, 1250), 1250, kind);
});

test('campaign targets keep authored combat HP instead of receiving the scenery multiplier', () => {
  assert.equal(campaignObjectiveHitPoints(2200), 2200);
  assert.equal(campaignObjectiveHitPoints(2600), 2600);
  assert.equal(campaignObjectiveHitPoints(0), 1);
  assert.equal(buildingHitPoints('base', campaignObjectiveHitPoints(2200)), 44000,
    'ordinary building scaling remains independently available');
});
