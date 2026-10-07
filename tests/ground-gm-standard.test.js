import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { suitById } from '../js/data.js';

test('standard Ground GM is the cheap low-boost fast-action leg-booster replica', () => {
  const standard = suitById('gmg_std');
  const assault = suitById('gmg_a');
  const bazooka = suitById('gmg_b');
  const gm = suitById('gm');
  assert.ok(standard);
  assert.equal(standard.groundOnly, true);
  assert.equal(standard.landType, true);
  assert.equal(standard.legBooster, true);
  assert.deepEqual(standard.colors, assault.colors);
  assert.ok(standard.walk > gm.walk && standard.walk < assault.walk);
  assert.ok(standard.boost < gm.boost && standard.boostFuel < gm.boostFuel);
  assert.ok(standard.cost < gm.cost && standard.cost < assault.cost);
  assert.match(standard.weapons[0].name, /ASSAULT RIFLE/);
  assert.match(standard.weapons[1].name, /BAZOOKA/);
  assert.ok(standard.weapons[0].rof > assault.weapons[0].rof);
  assert.ok(standard.weapons[0].reload < assault.weapons[0].reload);
  assert.ok(standard.weapons[1].rof > bazooka.weapons[0].rof);
  assert.ok(standard.weapons[1].reload < bazooka.weapons[0].reload);
});

test('standard Ground GM mesh includes authored calf booster pods and thrusters', async () => {
  const source = await readFile(new URL('../js/canonical-fed.js', import.meta.url), 'utf8');
  assert.match(source, /if \(suit\.legBooster\)/);
  assert.match(source, /case 'gmg_std'/);
  assert.match(source, /addThruster\(leg, rig\.parts/);
});
