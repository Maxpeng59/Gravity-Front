import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSAULT_SUPPORT_TETHER, PROTECTION_MAX_RANGE, PROTECTION_MELEE_RANGE,
  SQUAD_ASSAULT_SLOTS, SQUAD_MAX_SIZE, SQUAD_MIN_SIZE,
  assignRequestedSquadIds, assignSquadIds, assignSquadRoles, carrierRiderEligible, chooseRouteSide, formationSlotOffset, formationSteeringStrength,
  groundTacticalDecision, minimumAttackAdvance, minimumCombatMovementSpeed, shouldProtectAlly, squadSizes,
  targetPriorityScore,
} from '../js/squad-doctrine.js';

test('large forces divide into normal five-to-seven unit combat groups', () => {
  for (let total = 10; total <= 200; total++){
    const sizes = squadSizes(total);
    assert.equal(sizes.reduce((sum, size) => sum + size, 0), total);
    assert.ok(sizes.every(size => size >= SQUAD_MIN_SIZE && size <= SQUAD_MAX_SIZE), `${total}: ${sizes}`);
  }
});

test('custom battle roster receives stable faction squad IDs before deployment', () => {
  const assigned = assignSquadIds(Array.from({ length: 13 }, (_, index) => ({ index })), 'ZEON');
  assert.deepEqual([...new Set(assigned.map(unit => unit.squadId))], ['ZEON-1', 'ZEON-2']);
  assert.equal(assigned.filter(unit => unit.squadId === 'ZEON-1').length, 7);
  assert.equal(assigned.filter(unit => unit.squadId === 'ZEON-2').length, 6);
  assert.deepEqual(assigned.map(unit => unit.index), Array.from({ length: 13 }, (_, index) => index));
});

test('custom battle honors player-selected squads and assigns AUTO units around them', () => {
  const assigned = assignRequestedSquadIds([
    { id: 'gm', requestedSquad: 3 },
    { id: 'guncannon', requestedSquad: 3 },
    { id: 'gmbazooka', requestedSquad: 0 },
    { id: 'rgm79sp' },
  ], 'FED');
  assert.deepEqual(assigned.map(unit => unit.squadId), ['FED-3', 'FED-3', 'FED-1', 'FED-1']);
});

test('manual squads have no member cap', () => {
  const roster = Array.from({ length: 24 }, (_, index) => ({ index, requestedSquad: 2 }));
  const assigned = assignRequestedSquadIds(roster, 'ZEON');
  assert.ok(assigned.every(unit => unit.squadId === 'ZEON-2'));
});

test('AUTO balances assault and support types while keeping every squad at seven or fewer', () => {
  const roster = [
    ...Array.from({ length: 9 }, (_, index) => ({ index, meleeCapable: true })),
    ...Array.from({ length: 9 }, (_, index) => ({ index: index + 9, dedicatedSupport: true })),
  ];
  const assigned = assignRequestedSquadIds(roster, 'FED');
  const groups = new Map();
  for (const unit of assigned){
    if (!groups.has(unit.squadId)) groups.set(unit.squadId, []);
    groups.get(unit.squadId).push(unit);
  }
  for (const members of groups.values()){
    assert.ok(members.length <= 7);
    assert.ok(members.some(unit => unit.meleeCapable));
    assert.ok(members.some(unit => unit.dedicatedSupport));
  }
});

test('a Galcezon accepts only living ground MS from its own squad', () => {
  const valid = { carrierSquadId: 'ZEON-3', riderSquadId: 'ZEON-3', alive: true, ai: true };
  assert.equal(carrierRiderEligible(valid), true);
  assert.equal(carrierRiderEligible({ ...valid, riderSquadId: 'ZEON-4' }), false);
  assert.equal(carrierRiderEligible({ ...valid, vehicle: true }), false);
  assert.equal(carrierRiderEligible({ ...valid, air: true }), false);
  assert.equal(carrierRiderEligible({ ...valid, alreadyMounted: true }), false);
});

test('active combatants retain a movement floor unless deliberately kneeling', () => {
  const mobile = minimumCombatMovementSpeed({ walkSpeed: 60 });
  assert.equal(mobile, 16.8);
  assert.ok(minimumCombatMovementSpeed({ walkSpeed: 60, legDamage: 0.5, blocking: true }) > 0);
  assert.equal(minimumCombatMovementSpeed({ walkSpeed: 60, kneeling: true }), 0);
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

test('assault slots form a shallow forward wedge', () => {
  const leader = formationSlotOffset('assault', 0);
  const left = formationSlotOffset('assault', 1);
  const right = formationSlotOffset('assault', 2);
  assert.deepEqual(leader, { forward: 0, lateral: 0 });
  assert.equal(left.forward, right.forward);
  assert.equal(left.lateral, -right.lateral);
  assert.ok(left.forward < leader.forward);
});

test('support slots form a wide gun line behind the assault wedge', () => {
  const center = formationSlotOffset('support', 0);
  const left = formationSlotOffset('support', 1);
  const right = formationSlotOffset('support', 2);
  assert.ok(center.forward < formationSlotOffset('assault', 2).forward);
  assert.ok(left.forward <= center.forward);
  assert.equal(left.forward, right.forward);
  assert.equal(left.lateral, -right.lateral);
});

test('formation steering yields to attack approach and terrain repositioning', () => {
  const longApproach = formationSteeringStrength({ role: 'support', distanceToSlot: 300,
    targetRange: 1800, preferredRange: 500 });
  const inRange = formationSteeringStrength({ role: 'support', distanceToSlot: 300,
    targetRange: 600, preferredRange: 500 });
  assert.ok(longApproach < inRange);
  assert.equal(formationSteeringStrength({ role: 'support', distanceToSlot: 300,
    targetRange: 600, preferredRange: 500, reposition: true }), 0);
  assert.equal(formationSteeringStrength({ role: 'assault', distanceToSlot: 300,
    targetRange: 400, preferredRange: 500, meleeReady: true }), 0);
});

test('a distant target always retains a forward attack-speed floor', () => {
  assert.equal(minimumAttackAdvance(1500, 500), 0.72);
  assert.equal(minimumAttackAdvance(900, 500), 0.42);
  assert.equal(minimumAttackAdvance(600, 500), 0);
});

test('healthy low-value mobile suits protect more valuable squadmates', () => {
  assert.equal(shouldProtectAlly({ selfValue: 9000, allyValue: 40000, hpFraction: 0.51 }), true);
  assert.equal(shouldProtectAlly({ selfValue: 9000, allyValue: 40000, hpFraction: 0.5 }), false);
  assert.equal(shouldProtectAlly({ selfValue: 40000, allyValue: 9000, hpFraction: 1 }), false);
  assert.equal(PROTECTION_MAX_RANGE, 100);
  assert.equal(PROTECTION_MELEE_RANGE, 50);
});

test('target priority favors high value without ignoring a close threat', () => {
  assert.ok(targetPriorityScore(50000, 650) > targetPriorityScore(9000, 650));
  assert.ok(targetPriorityScore(9000, 40) > targetPriorityScore(18000, 900));
});

test('squads choose the clearer lower route and keep melee within support tether', () => {
  assert.equal(chooseRouteSide({ leftBlocked: true, rightBlocked: false, leftRise: 0, rightRise: 20 }), 1);
  assert.equal(chooseRouteSide({ leftRise: 4, rightRise: 18 }), -1);
  assert.ok(ASSAULT_SUPPORT_TETHER >= 200 && ASSAULT_SUPPORT_TETHER <= 250);
});
