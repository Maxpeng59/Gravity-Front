import test from 'node:test';
import assert from 'node:assert/strict';
import { suitById } from '../js/data.js';

test('Galcezon is an armed two-MS Zeon squad carrier', () => {
  const craft = suitById('galcezon');
  assert.equal(craft.faction, 'ZEON');
  assert.equal(craft.carrierSfs, true);
  assert.equal(craft.msCapacity, 2);
  assert.equal(craft.vehicle, true);
  assert.equal(craft.hover, true);
  assert.equal(craft.cruiseAltitudeMin, 50);
  assert.equal(craft.cruiseAltitudeMax, 100);
  assert.ok(craft.weapons.length >= 2);
  assert.ok(craft.weapons.every(weapon => weapon.dmg > 0 && weapon.pref >= 600));
  assert.ok(craft.hitSpheres.length >= 7);
});
