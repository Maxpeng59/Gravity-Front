import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suitById } from '../js/data.js';
import { weaponLoadoutOptions } from '../js/loadouts.js';

const IDS = ['gmii', 'gmiii', 'jegan'];

test('GM II, GM III and Jegan are distinct playable Federation mobile suits', () => {
  const units = IDS.map(suitById);
  assert.deepEqual(units.map(unit => unit.code), ['RMS-179', 'RGM-86R', 'RGM-89']);
  assert.ok(units.every(unit => unit.faction === 'FED' && unit.style === 'gm'));
  assert.ok(units.every(unit => unit.hp > 0 && unit.weapons.length > 0));
  assert.ok(units[0].boost < units[1].boost && units[1].boost < units[2].boost);
});

test('late Federation suits retain their intended stock combat roles', () => {
  const gmiii = suitById('gmiii');
  const jegan = suitById('jegan');
  assert.ok(gmiii.weapons.some(weapon => weapon.integrated && /SHOULDER MISSILE/.test(weapon.name)));
  assert.ok(gmiii.weapons.some(weapon => weapon.integrated && /WAIST MISSILE/.test(weapon.name)));
  assert.ok(jegan.weapons.some(weapon => weapon.integrated && /SHIELD MISSILE/.test(weapon.name)));
  assert.ok(IDS.every(id => weaponLoadoutOptions(suitById(id)).primary.length >= 3));
});

test('each late Federation suit is routed to a dedicated canonical model builder', () => {
  const source = readFileSync(new URL('../js/canonical-fed.js', import.meta.url), 'utf8');
  assert.match(source, /case 'gmii': return buildGMII/);
  assert.match(source, /case 'gmiii': return buildGMIII/);
  assert.match(source, /case 'jegan': return buildJegan/);
  assert.match(source, /weaponMuzzles\[1\] = shoulderMuzzles/);
  assert.match(source, /weaponMuzzles\[2\] = missileMuzzles/);
});
