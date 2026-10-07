import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITS, AIRCRAFT } from '../js/data.js';
import {
  MS_MAX_MAGAZINES, MS_MIN_MAGAZINES, allRangedAmmoSpent, createAmmoSupply, mobileSuitUsesFiniteAmmo,
} from '../js/ammo-supply.js';

const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');

test('every ordinary mobile suit deploys with five to ten finite magazines per ranged weapon', () => {
  assert.equal(MS_MIN_MAGAZINES, 5);
  assert.equal(MS_MAX_MAGAZINES, 10);
  const mobileSuits = SUITS.filter(mobileSuitUsesFiniteAmmo);
  assert.ok(mobileSuits.length > 0);
  for (const suit of mobileSuits){
    for (const magazines of [5, 7, 10]){
      const supply = createAmmoSupply(suit, magazines);
      assert.equal(supply.limited, true, suit.id);
      assert.equal(supply.magazines, magazines, suit.id);
      suit.weapons.forEach((weapon, index) => {
        assert.equal(supply.clips[index], weapon.clip, `${suit.id} ${weapon.name} loaded`);
        assert.equal(supply.clips[index] + supply.reserves[index], weapon.clip * magazines,
          `${suit.id} ${weapon.name} total`);
      });
    }
  }
});

test('mobile-suit magazine counts are clamped to the five-to-ten range', () => {
  const suit = SUITS.find(entry => entry.id === 'gm');
  assert.equal(createAmmoSupply(suit, 2).magazines, 5);
  assert.equal(createAmmoSupply(suit, 14).magazines, 10);
});

test('aircraft and vehicle chassis keep their existing reload behavior', () => {
  for (const suit of [...AIRCRAFT, ...SUITS.filter(suit => suit.vehicle)]){
    const supply = createAmmoSupply(suit);
    assert.equal(supply.limited, false, suit.id);
    assert.equal(supply.magazines, Infinity, suit.id);
    assert.ok(supply.reserves.every(value => value === Infinity), suit.id);
  }
});

test('a depleted mobile suit has no ranged ammunition left', () => {
  const supply = createAmmoSupply(SUITS.find(suit => suit.id === 'gm'));
  const unit = { ammoLimited: true, weaponClips: supply.clips.map(() => 0), ammoReserves: supply.reserves.map(() => 0) };
  assert.equal(allRangedAmmoSpent(unit), true);
});

test('battle runtime transfers finite reserves and forces an empty player and AI into melee', () => {
  assert.match(battle, /createAmmoSupply\(suit, rng\.int\(MS_MIN_MAGAZINES, MS_MAX_MAGAZINES\)\)/);
  assert.match(battle, /function completeReload\(m\)[\s\S]*Math\.min\(needed, reserve\)[\s\S]*m\.ammoReserves\[wi\] = reserve - transfer/);
  assert.match(battle, /if \(allRangedAmmoSpent\(player\) && hasSaber\)[\s\S]*switchWeapon\(SABER_SLOT\)/);
  assert.match(battle, /const ammoDry = allRangedAmmoSpent\(m\)/);
  assert.match(battle, /const canMelee = \(ammoDry \|\| !fullSpaceCombat/);
  assert.match(battle, /const rangedAllowed = !ammoDry &&/);
  assert.match(battle, /RANGED AMMO EMPTY/);
});
