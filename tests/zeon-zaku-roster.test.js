import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITS, suitById } from '../js/data.js';
import { weaponAimProfile, weaponLoadoutOptions } from '../js/loadouts.js';

test('new Zaku generations extend the Zeon roster without replacing existing machines', () => {
  const ids = ['zaku1', 'zaku1sniper', 'zaku2', 'zaku2g', 'zaku2b', 'zaku2s', 'zaku3', 'rfzaku'];
  assert.ok(ids.every(id => suitById(id)?.faction === 'ZEON'));
  assert.equal(new Set(SUITS.map(suit => suit.id)).size, SUITS.length);
  assert.deepEqual(ids.map(id => suitById(id).code),
    ['MS-05', 'MS-05L', 'MS-06F', 'MS-06J', 'MS-06F', 'MS-06S', 'AMX-011', 'OMS-06RF']);
  assert.ok(['gouf', 'dom', 'gelgoog', 'acguy', 'zakutank'].every(id => suitById(id)));
});

test('MS-05 has exactly the requested 90 mm gun and no alternative weapon or melee slot', () => {
  const old = suitById('zaku1');
  assert.equal(old.weapons.length, 1);
  assert.match(old.weapons[0].name, /90MM/);
  assert.equal(old.weapons[0].type, 'mg');
  assert.equal(old.saber.dmg, 0);
  assert.deepEqual(weaponLoadoutOptions(old), { primary: [], support: [] });
});

test('MS-05L has a real precision beam sniper rifle rather than a generic machine gun', () => {
  const sniper = suitById('zaku1sniper');
  assert.match(sniper.weapons[0].name, /BEAM SNIPER RIFLE/);
  assert.equal(sniper.weapons[0].type, 'beam');
  assert.equal(sniper.weapons[0].scope, true);
  assert.equal(weaponAimProfile(sniper.weapons[0]).id, 'precision');
  assert.ok(sniper.weapons[0].pref >= 1000);
  assert.notEqual(sniper.groundOnly, true);
});

test('ground Zaku II is dramatically faster while the F type keeps a varied Zeon field armory', () => {
  const f = suitById('zaku2'), j = suitById('zaku2g');
  assert.ok(j.walk >= f.walk * 1.4);
  assert.ok(j.boost >= f.boost * 1.35);
  assert.equal(j.groundOnly, true);
  const names = weaponLoadoutOptions(f).primary.map(option => option.name);
  assert.ok(names.some(name => /120MM/.test(name)));
  assert.ok(names.some(name => /90MM/.test(name)));
  assert.ok(names.some(name => /BAZOOKA/.test(name)));
  assert.ok(names.some(name => /LONG-RANGE RIFLE/.test(name)));
});

test('later Zakus mount era-appropriate beam and integrated weapons', () => {
  const iii = suitById('zaku3'), rf = suitById('rfzaku');
  assert.equal(iii.weapons[0].type, 'beam');
  assert.ok(iii.weapons.some(weapon => weapon.integrated && /TORSO BEAM/.test(weapon.name)));
  assert.ok(iii.weapons.some(weapon => weapon.integrated && /HEAD BEAM/.test(weapon.name)));
  assert.ok(rf.weapons.some(weapon => weapon.integrated && /2-BARREL VULCAN/.test(weapon.name)));
  assert.ok(rf.weapons.some(weapon => weapon.integrated && /SEA SERPENT/.test(weapon.name) && weapon.nonChargeBeam));
  assert.match(rf.saber.name, /BEAM AXE/);
  assert.ok(weaponLoadoutOptions(rf).primary.some(option => /BEAM BAZOOKA/.test(option.name)));
});

test('all added machines route through canonical meshes and fixed guns own a muzzle anchor', () => {
  const zeon = readFileSync(new URL('../js/canonical-zeon.js', import.meta.url), 'utf8');
  const equip = readFileSync(new URL('../js/mecha.js', import.meta.url), 'utf8');
  for (const id of ['zaku1', 'zaku1sniper', 'zaku3', 'rfzaku'])
    assert.match(zeon, new RegExp(`case '${id}': return build`));
  assert.match(zeon, /function buildZakuIII/);
  assert.match(zeon, /integratedMuzzles = \{ 1: waistMuzzle \}/);
  assert.match(zeon, /parts\.integratedMuzzles\[2\] = headMuzzle/);
  assert.match(zeon, /parts\.integratedMuzzles\[2\] = serpentMuzzle/);
  assert.match(equip, /const fixedMuzzle = parts\.integratedMuzzles\?\.\[wi\]/);
  const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');
  assert.match(battle, /!weapon\.nonChargeBeam/);
});
