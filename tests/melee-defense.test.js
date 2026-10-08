import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MELEE_PROJECTILE_DEFLECTION_CHANCE, MELEE_WEAPON_LENGTH_SCALE,
  isExplosiveProjectile, meleeDeflectsProjectile, meleeWeaponReach,
  segmentSegmentDistanceSquared, sweptBladeCatchesProjectile,
} from '../js/melee-defense.js';

const point = (x, y, z) => ({ x, y, z });

test('melee projectile deflection is exactly a twenty-percent roll', () => {
  assert.equal(MELEE_PROJECTILE_DEFLECTION_CHANCE, 0.20);
  assert.equal(meleeDeflectsProjectile(0), true);
  assert.equal(meleeDeflectsProjectile(0.199999), true);
  assert.equal(meleeDeflectsProjectile(0.20), false);
  assert.equal(meleeDeflectsProjectile(0.99), false);
});

test('only explosive projectiles are eligible for sword contact', () => {
  assert.equal(isExplosiveProjectile({ splash: 14 }), true);
  assert.equal(isExplosiveProjectile({ splash: 0 }), false);
  assert.equal(isExplosiveProjectile({}), false);
});

test('swept blade collision catches a fast crossing rocket without tunnelling', () => {
  const bladeStart = point(0, 0, 0), bladeEnd = point(0, 0, 15);
  const rocketStart = point(-20, 0, 8), rocketEnd = point(20, 0, 8);
  assert.equal(segmentSegmentDistanceSquared(bladeStart, bladeEnd, rocketStart, rocketEnd), 0);
  assert.equal(sweptBladeCatchesProjectile(bladeStart, bladeEnd, rocketStart, rocketEnd, 2.6), true);
  assert.equal(sweptBladeCatchesProjectile(bladeStart, bladeEnd, point(-20, 8, 8), point(20, 8, 8), 2.6), false);
});

test('all melee families receive a longer visible and defensive reach', () => {
  assert.ok(MELEE_WEAPON_LENGTH_SCALE > 1);
  assert.ok(meleeWeaponReach('HEAT KNIFE') < meleeWeaponReach('BEAM SABER'));
  assert.ok(meleeWeaponReach('BEAM NAGINATA') > meleeWeaponReach('BEAM SABER'));
});

test('battle runtime deflects on success and detonates failed sword contacts', async () => {
  const battle = await readFile(new URL('../js/battle.js', import.meta.url), 'utf8');
  const mecha = await readFile(new URL('../js/mecha.js', import.meta.url), 'utf8');
  assert.match(battle, /interceptExplosiveWithMelee\(p, dt\)/);
  assert.match(battle, /p\.team = defender\.team;[\s\S]*p\.owner = defender;[\s\S]*p\.homing = null/);
  assert.match(battle, /explosion\(contact, p\.splash[\s\S]*splashDamage\(contact, p\.splash/);
  assert.match(battle, /_debugMeleeDefense\(\)[\s\S]*success: run\(0\.10\), failure: run\(0\.90\)/);
  assert.match(mecha, /built\.parts\.blade\.scale\.z \*= MELEE_WEAPON_LENGTH_SCALE/);
});
