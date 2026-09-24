import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJECTIVE_TUNING, SECONDARY_CATALOG, STAGED_MISSION_TYPES, advanceHold, evaluateSecondaries,
  formatClock, isStagedMission, missionStages, pickSecondaries, secondaryPay, stageLabel,
} from '../js/mission-objectives.js';

test('hold progress builds only inside and never regresses', () => {
  let p = 0;
  p = advanceHold(p, { inside: true, dt: 1, duration: 4 });
  assert.equal(p, 0.25);
  p = advanceHold(p, { inside: false, dt: 3, duration: 4 });
  assert.equal(p, 0.25);
  for (let i = 0; i < 10; i++) p = advanceHold(p, { inside: true, dt: 1, duration: 4 });
  assert.equal(p, 1);
});

test('every staged type has labelled stages', () => {
  for (const type of STAGED_MISSION_TYPES){
    assert.ok(isStagedMission(type));
    const stages = missionStages(type);
    assert.ok(stages.length >= 2, type);
    for (const s of stages) assert.notEqual(stageLabel(s), s.toUpperCase() + 'x');
  }
  assert.deepEqual(missionStages('breakthrough'), ['aa', 'drop', 'commander']);
  assert.ok(!isStagedMission('destroy'));
});

test('tuning keeps the objectives physically sensible', () => {
  assert.ok(OBJECTIVE_TUNING.blastSafeDistance > OBJECTIVE_TUNING.plantRadius * 2);
  assert.ok(OBJECTIVE_TUNING.fuseTime * 40 > OBJECTIVE_TUNING.blastSafeDistance, 'a walking suit can clear the blast in time');
});

test('secondaries are deterministic, capped at two and fit the contract', () => {
  const seq = values => { let i = 0; return () => values[i++ % values.length]; };
  const contract = { mission: { type: 'hunt' }, danger: 4, enemies: [{ suitId: 'zaku2', ace: true }, { suitId: 'dom' }, { suitId: 'gouf', vip: true, ace: true }] };
  const a = pickSecondaries(contract, seq([0.1, 0.7, 0.3]));
  const b = pickSecondaries(contract, seq([0.1, 0.7, 0.3]));
  assert.deepEqual(a, b);
  assert.ok(a.length === 2);
  for (const s of a) assert.ok(SECONDARY_CATALOG[s.id] && s.label);
  assert.deepEqual(pickSecondaries({ mission: { type: 'odessa' } }), []);
  const solo = pickSecondaries({ mission: { type: 'survive', solo: true }, enemies: [] }, seq([0.5]));
  assert.ok(solo.every(s => s.id !== 'wing' && s.id !== 'clock'));
});

test('secondaries are judged against the battle result and pay a share', () => {
  const list = [{ id: 'integrity', target: 50, label: 'x' }, { id: 'clock', target: 300, label: 'y' }, { id: 'aces', label: 'z' }];
  const won = evaluateSecondaries(list, { victory: true, hpFrac: 0.62, elapsed: 280, acesTotal: 2, acesDown: 1 });
  assert.deepEqual(won.map(g => g.met), [true, true, false]);
  assert.equal(secondaryPay(10000, won), 3500);
  const lost = evaluateSecondaries(list, { victory: false, hpFrac: 1, elapsed: 10, acesTotal: 1, acesDown: 1 });
  assert.ok(lost.every(g => !g.met));
  assert.equal(secondaryPay(10000, lost), 0);
  assert.equal(formatClock(125), '2:05');
});
