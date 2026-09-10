import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GALCEZON_CRUISE_MAX, GALCEZON_CRUISE_MIN,
  galcezonAttackRadial, galcezonCruiseAltitude, playerCanBoardGalcezon,
} from '../js/galcezon-logic.js';

test('Galcezon cruise stays between fifty and one hundred metres', () => {
  for (let phase = 0; phase < Math.PI * 2; phase += 0.05){
    const altitude = galcezonCruiseAltitude(phase);
    assert.ok(altitude >= GALCEZON_CRUISE_MIN && altitude <= GALCEZON_CRUISE_MAX);
  }
});

test('Galcezon combat steering never escapes from its target', () => {
  for (const range of [20, 300, 800, 1200, 2400]) assert.ok(galcezonAttackRadial(range, 820) >= 0);
  assert.equal(galcezonAttackRadial(300, 820), 0);
  assert.ok(galcezonAttackRadial(2400, 820) > galcezonAttackRadial(600, 820));
});

test('player boarding requires a living friendly Galcezon with a free nearby slot', () => {
  const valid = { sameTeam: true, alive: true, capacity: 2, occupied: 1, planarDistance: 70, verticalGap: 95 };
  assert.equal(playerCanBoardGalcezon(valid), true);
  assert.equal(playerCanBoardGalcezon({ ...valid, sameTeam: false }), false);
  assert.equal(playerCanBoardGalcezon({ ...valid, occupied: 2 }), false);
  assert.equal(playerCanBoardGalcezon({ ...valid, planarDistance: 81 }), false);
  assert.equal(playerCanBoardGalcezon({ ...valid, verticalGap: 111 }), false);
});
