import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT, SUITS, suitById } from '../js/data.js';
import {
  applyWeaponLoadout, canAimWeapon, canModifyWeapons, isSniperWeapon, normalizeRestrictedWeaponLoadout, normalizeWeaponLoadout,
  weaponAimCoefficient, weaponAimProfile, weaponLoadoutOptions, weaponLoadoutProfile,
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

test('every ranged weapon family receives a distinct aim system and coefficient', () => {
  const examples = [
    [{ name: '75MM SNIPER RIFLE', type: 'beam', pref: 900 }, 'precision'],
    [{ name: 'BEAM RIFLE', type: 'beam', pref: 520 }, 'rifle'],
    [{ name: '90MM MACHINE GUN', type: 'mg', pref: 330 }, 'reflex'],
    [{ name: 'BEAM SPRAY GUN', type: 'beam', pellets: 6 }, 'scatter'],
    [{ name: 'HYPER BAZOOKA', type: 'bazooka' }, 'rocket'],
    [{ name: 'MISSILE LAUNCHER', type: 'bazooka' }, 'seeker'],
    [{ name: 'LOCK-ON MISSILE', type: 'lockmissile' }, 'seeker'],
    [{ name: 'ARTILLERY BOMBARDMENT', type: 'bazooka', arc: true }, 'artillery'],
    [{ name: 'CARPET BOMB', type: 'bomb' }, 'bombing'],
  ];
  for (const [weapon, id] of examples){
    assert.equal(canAimWeapon(weapon), true);
    assert.equal(weaponAimProfile(weapon).id, id);
    assert.ok(weaponAimCoefficient(weapon, 1) > 0 && weaponAimCoefficient(weapon, 1) < 1);
    assert.ok(weaponAimCoefficient(weapon, 0) > weaponAimCoefficient(weapon, 1));
  }
  assert.ok(weaponAimCoefficient(examples[0][0], 1) < weaponAimCoefficient(examples[2][0], 1));
  const rifle = weaponAimProfile(examples[1][0]);
  const automatic = weaponAimProfile(examples[2][0]);
  const rocket = weaponAimProfile(examples[4][0]);
  assert.ok(automatic.recoilPitch < rifle.recoilPitch);
  assert.ok(rifle.recoilPitch < rocket.recoilPitch);
  assert.ok(automatic.stabilityKick < 0.02);
});

test('every weapon mounted by every playable unit is aim-capable', () => {
  const missing = [...SUITS, ...AIRCRAFT]
    .flatMap(unit => unit.weapons.map(weapon => ({ unit: unit.id, weapon })))
    .filter(({ weapon }) => !canAimWeapon(weapon));
  assert.deepEqual(missing, []);
});

test('PvP restriction falls back to stock and removes a locked support weapon', () => {
  const gm = suitById('gm');
  assert.deepEqual(
    normalizeRestrictedWeaponLoadout(gm, { primary: 'fed_sniper', support: 'none' }, new Set(['fed_90mm'])),
    { primary: 'stock', support: 'stock' },
  );
  assert.deepEqual(
    normalizeRestrictedWeaponLoadout(gm, { primary: 'fed_90mm', support: 'fed_hyper_bazooka' }, new Set(['fed_90mm'])),
    { primary: 'fed_90mm', support: 'none' },
  );
});
