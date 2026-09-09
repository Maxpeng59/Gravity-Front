import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BY_ID, MAPS } from '../js/maps.js';

test('Operation Odessa is an authored clear-sky ground battlefield with solid combat scenery', () => {
  const map = MAP_BY_ID.odessa;
  assert.ok(map);
  assert.ok(MAPS.includes(map));
  assert.equal(map.mission.type, 'odessa');
  assert.ok(map.fog.near >= 1500);
  assert.ok(map.structures.length >= 35);
  for (const kind of ['road', 'rockcluster', 'hangar', 'depot', 'bunker', 'wall', 'gate', 'guntower'])
    assert.ok(map.structures.some(structure => structure.kind === kind), kind);
});

test('Operation Odessa preset deploys Federation and Zeon combined-arms units', () => {
  const forces = MAP_BY_ID.odessa.recommendedForces;
  const allyIds = new Set(forces.allies.map(unit => unit.id));
  const enemyIds = new Set(forces.enemies.map(unit => unit.id));
  for (const id of ['gm', 'guncannon', 'guntank', 'type61', 'bigtray']) assert.ok(allyIds.has(id), id);
  for (const id of ['zaku2g', 'gouf', 'dom', 'magella', 'weasel', 'dabude']) assert.ok(enemyIds.has(id), id);
});
