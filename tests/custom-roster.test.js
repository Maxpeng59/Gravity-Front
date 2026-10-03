import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_SIDE_CAP, customSquadTraits, expandCustomRoster } from '../js/custom-roster.js';
import { suitById } from '../js/data.js';
import { MAPS } from '../js/maps.js';

test('mixed custom rosters classify mobile suits without crashing on landships', () => {
  assert.deepEqual(customSquadTraits(undefined), {
    meleeCapable: false,
    dedicatedSupport: false,
  });
  assert.deepEqual(customSquadTraits({ id: 'bigtray', faction: 'FED' }), {
    meleeCapable: false,
    dedicatedSupport: false,
  });
  assert.equal(customSquadTraits(suitById('gm')).meleeCapable, true);
  assert.equal(customSquadTraits(suitById('rgm79sp')).dedicatedSupport, true);

  const odessa = MAPS.find(map => map.id === 'odessa').recommendedForces;
  const classify = roster => roster.map(entry => customSquadTraits(suitById(entry.id)));
  assert.doesNotThrow(() => classify(odessa.enemies));
  assert.doesNotThrow(() => classify(odessa.allies));
  const enemies = odessa.enemies.map(entry => ({ ...entry }));
  enemies.push({ id: 'zaku2', n: 1 });
  assert.equal(classify(enemies).length, 7);
});

test('custom fleets can deploy more than twelve landships or space ships', () => {
  const landships = expandCustomRoster([{ id: 'bigtray', n: 25, pos: { x: 10, z: 20 } }]);
  const warships = expandCustomRoster([{ id: 'musai', n: 30, pos: { x: -10, z: 80 } }]);

  assert.equal(landships.length, 25);
  assert.equal(landships[24].formationIndex, 24);
  assert.equal(warships.length, 30);
  assert.equal(warships[29].formationIndex, 29);
});

test('custom fleets still obey the shared per-side safety limit', () => {
  const fleet = expandCustomRoster([
    { id: 'salamis', n: 125 },
    { id: 'magellan', n: 125 },
  ]);

  assert.equal(CUSTOM_SIDE_CAP, 200);
  assert.equal(fleet.length, CUSTOM_SIDE_CAP);
  assert.equal(fleet.filter(ship => ship.id === 'salamis').length, 125);
  assert.equal(fleet.filter(ship => ship.id === 'magellan').length, 75);
});
