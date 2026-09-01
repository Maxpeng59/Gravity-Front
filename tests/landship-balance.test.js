import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDSHIP_PROFILES,
  landshipProfile,
  landshipTravelState,
} from '../js/landship-balance.js';

test('landships are capital-strength combatants rather than structure-grade props', () => {
  for (const profile of Object.values(LANDSHIP_PROFILES)){
    assert.ok(profile.hp >= 30000);
    assert.ok(profile.mainDamage >= 600);
    assert.ok(profile.mainRange >= 2400);
    assert.ok(profile.shellSpeed * profile.shellLife > profile.mainRange);
    assert.ok(profile.speed > 0);
    assert.ok(profile.secondaryDamage > 0);
    assert.equal(profile.secondarySplash, 0);
  }
});

test('lore roles keep Gallop agile, Big Tray fast and heavily armed, and Dobday slowest', () => {
  const big = landshipProfile('bigtray');
  const dob = landshipProfile('dabude');
  const gal = landshipProfile('gallop');
  assert.ok(gal.speed > big.speed && big.speed > dob.speed);
  assert.ok(gal.turnRate > big.turnRate && big.turnRate > dob.turnRate);
  assert.ok(big.hp > gal.hp && dob.hp > gal.hp);
  assert.equal(big.fixedShots, 2);
  assert.equal(big.secondaryStations, 8);
  assert.equal(dob.secondaryStations, 6);
  assert.equal(gal.secondaryStations, 3);
  assert.ok(dob.mainRange > big.mainRange && big.mainRange > gal.mainRange);
});

test('landships advance into battery range and hold instead of retreating', () => {
  assert.equal(landshipTravelState(2200, 1000), 'advance');
  assert.equal(landshipTravelState(1081, 1000), 'advance');
  assert.equal(landshipTravelState(1080, 1000), 'hold');
  assert.equal(landshipTravelState(500, 1000), 'hold');
  assert.equal(landshipTravelState(0, 1000), 'hold');
});
