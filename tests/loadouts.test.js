import test from 'node:test';
import assert from 'node:assert/strict';
import { suitById } from '../js/data.js';
import {
  applyWeaponLoadout, canModifyWeapons, isSniperWeapon, normalizeWeaponLoadout,
  weaponLoadoutOptions, weaponLoadoutProfile,
} from '../js/loadouts.js';

test('only compatible humanoid mobile suits expose weapon modification', () => {
  assert.equal(canModifyWeapons(suitById('gm')), true);
  assert.equal(canModifyWeapons(suitById('zaku2')), true);
  assert.equal(canModifyWeapons(suitById('guntankmk2')), false);
  assert.equal(canModifyWeapons(suitById('weasel')), false);
  assert.ok(weaponLoadoutOptions(suitById('gmg_a')).primary.some(w => w.id === 'fed_180mm'));
  assert.ok(weaponLoadoutOptions(suitById('zaku2')).primary.some(w => w.id === 'zeon_magella_cannon'));
});

test('invalid or cross-faction weapon choices normalize safely', () => {
  const gm = suitById('gm');
  const normalized = normalizeWeaponLoadout(gm, { primary: 'zeon_anti_ship', support: 'zeon_cracker' });
  assert.notEqual(normalized.primary, 'zeon_anti_ship');
  assert.equal(normalized.support, 'none');
});

test('stock rack is unchanged and modified weapons preserve fixed armament', () => {
  const rx78 = suitById('rx78');
  assert.equal(applyWeaponLoadout(rx78, null), rx78);
  const modified = applyWeaponLoadout(rx78, { primary: 'fed_90mm', support: 'none' });
  assert.equal(modified.weapons[0].name, 'HWF GMG·MG79-90 90MM MACHINE GUN');
  assert.ok(modified.weapons.some(w => w.head && /VULCAN/.test(w.name)));
});

test('carried weapon mass produces a bounded real movement tradeoff', () => {
  const gm = suitById('gm');
  const light = weaponLoadoutProfile(gm, { primary: 'fed_beam_spray', support: 'none' });
  const heavy = weaponLoadoutProfile(gm, { primary: 'fed_hyper_bazooka', support: 'fed_100mm' });
  assert.ok(light.mobility > heavy.mobility);
  assert.ok(heavy.mobility >= 0.78);
  const applied = applyWeaponLoadout(gm, heavy.loadout);
  assert.equal(applied.walk, gm.walk * heavy.mobility);
  assert.equal(applied.boost, gm.boost * heavy.mobility);
});

test('precision weapons expose sniper optics while ordinary and artillery weapons do not', () => {
  const gmSniper = weaponLoadoutOptions(suitById('gm')).primary.find(w => w.id === 'fed_sniper').weapon;
  const beamSpray = weaponLoadoutOptions(suitById('gm')).primary.find(w => w.id === 'fed_beam_spray').weapon;
  assert.equal(isSniperWeapon(gmSniper), true);
  assert.equal(isSniperWeapon(beamSpray), false);
  assert.equal(isSniperWeapon({ name: 'ARTILLERY BOMBARDMENT', type: 'bazooka', arc: true, pref: 1200 }), false);
});
