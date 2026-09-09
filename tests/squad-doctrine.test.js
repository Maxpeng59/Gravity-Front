import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SQUAD_ASSAULT_SLOTS, SQUAD_MAX_SIZE, SQUAD_MIN_SIZE,
  assignSquadRoles, groundTacticalDecision, squadSizes,
} from '../js/squad-doctrine.js';

test('large forces divide into normal five-to-seven unit combat groups', () => {
  for (let total = 10; total <= 200; total++){
    const sizes = squadSizes(total);
    assert.equal(sizes.reduce((sum, size) => sum + size, 0), total);
    assert.ok(sizes.every(size => size >= SQUAD_MIN_SIZE && size <= SQUAD_MAX_SIZE), `${total}: ${sizes}`);
  }
});

test('a six-unit squad puts three melee-capable machines in front and three support machines behind', () => {
  const roles = assignSquadRoles([
    { meleeCapable: true, meleeScore: 2 }, { meleeCapable: true, meleeScore: 1 },
    { meleeCapable: true }, { dedicatedSupport: true }, { dedicatedSupport: true }, { dedicatedSupport: true },
  ]);
  assert.equal(roles.filter(slot => slot.role === 'assault').length, SQUAD_ASSAULT_SLOTS);
  assert.equal(roles.filter(slot => slot.role === 'support').length, 3);
  assert.deepEqual(roles.slice(0, 3).map(slot => slot.role), ['assault', 'assault', 'assault']);
});

test('vehicles and gun-only machines remain fire support instead of receiving fake melee orders', () => {
  const roles = assignSquadRoles(Array.from({ length: 6 }, () => ({ meleeCapable: false, dedicatedSupport: true })));
  assert.ok(roles.every(slot => slot.role === 'support'));
});

test('rear support kneels on clear stable high ground but repositions when terrain masks the shot', () => {
  const clear = groundTacticalDecision({ role: 'support', range: 650, preferredRange: 700,
    highGround: 0.2, localSlope: 0.1, routeRise: 2, lineOfSight: true, anchorSupport: true });
  assert.equal(clear.kneel, true);
  assert.equal(clear.reposition, false);
  const masked = groundTacticalDecision({ role: 'support', range: 650, preferredRange: 700,
    highGround: -0.8, localSlope: 0.6, routeRise: 24, lineOfSight: false });
  assert.equal(masked.kneel, false);
  assert.equal(masked.reposition, true);
});

test('only an assault slot takes a traversable melee route', () => {
  const ground = { range: 360, preferredRange: 500, highGround: 0, localSlope: 0.2,
    routeRise: 4, lineOfSight: true, hasMelee: true };
  assert.equal(groundTacticalDecision({ ...ground, role: 'assault' }).melee, true);
  assert.equal(groundTacticalDecision({ ...ground, role: 'support' }).melee, false);
  assert.equal(groundTacticalDecision({ ...ground, role: 'assault', routeRise: 25 }).melee, false);
});
