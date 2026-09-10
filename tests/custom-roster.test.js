import test from 'node:test';
import assert from 'node:assert/strict';
import { customSquadTraits } from '../js/custom-roster.js';
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
