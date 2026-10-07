import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUITS, AIRCRAFT } from '../js/data.js';
import {
  MS_TOTAL_MAGAZINES, allRangedAmmoSpent, createAmmoSupply, mobileSuitUsesFiniteAmmo,
} from '../js/ammo-supply.js';

const battle = readFileSync(new URL('../js/battle.js', import.meta.url), 'utf8');

test('every ordinary mobile suit deploys with exactly three finite magazines per ranged weapon', () => {
  assert.equal(MS_TOTAL_MAGAZINES, 3);
  const mobileSuits = SUITS.filter(mobileSuitUsesFiniteAmmo);
  assert.ok(mobileSuits.length > 0);
  for (const suit of mobileSuits){
    const supply = createAmmoSupply(suit);
    assert.equal(supply.limited, true, suit.id);
    suit.weapons.forEach((weapon, index) => {
      assert.equal(supply.clips[index], weapon.clip, `${suit.id} ${weapon.name} loaded`);
      assert.equal(supply.clips[index] + supply.reserves[index], weapon.clip * 3,
        `${suit.id} ${weapon.name} total`);
    });
  }
});

test('aircraft and vehicle chassis keep their existing reload behavior', () => {
  for (const suit of [...AIRCRAFT, ...SUITS.filter(suit => suit.vehicle)]){
    const supply = createAmmoSupply(suit);
    assert.equal(supply.limited, false, suit.id);
    assert.ok(supply.reserves.every(value => value === Infinity), suit.id);
  }
});

test('a depleted mobile suit has no ranged ammunition left', () => {
  const supply = createAmmoSupply(SUITS.find(suit => suit.id === 'gm'));
  const unit = { ammoLimited: true, weaponClips: supply.clips.map(() => 0), ammoReserves: supply.reserves.map(() => 0) };
  assert.equal(allRangedAmmoSpent(unit), true);
});

test('battle runtime transfers finite reserves and forces an empty player and AI into melee', () => {
  assert.match(battle, /function completeReload\(m\)[\s\S]*Math\.min\(needed, reserve\)[\s\S]*m\.ammoReserves\[wi\] = reserve - transfer/);
  assert.match(battle, /if \(allRangedAmmoSpent\(player\) && hasSaber\)[\s\S]*switchWeapon\(SABER_SLOT\)/);
  assert.match(battle, /const ammoDry = allRangedAmmoSpent\(m\)/);
  assert.match(battle, /const canMelee = \(ammoDry \|\| !fullSpaceCombat/);
  assert.match(battle, /const rangedAllowed = !ammoDry &&/);
  assert.match(battle, /RANGED AMMO EMPTY/);
});
