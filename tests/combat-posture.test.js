import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KNEEL_TRANSITION_SECONDS,
  advanceKneelBlend,
  firingKneelPose,
  kneelAimErrorMultiplier,
  kneelSpreadMultiplier,
  kneelState,
  shouldAiKneel,
} from '../js/combat-posture.js';

test('kneeling and standing each take exactly two seconds', () => {
  let blend = 0;
  for (let i = 0; i < 19; i++) blend = advanceKneelBlend(blend, true, 0.1);
  assert.ok(blend < 1);
  blend = advanceKneelBlend(blend, true, 0.1);
  assert.equal(blend, 1);

  for (let i = 0; i < 19; i++) blend = advanceKneelBlend(blend, false, 0.1);
  assert.ok(blend > 0);
  blend = advanceKneelBlend(blend, false, 0.1);
  assert.equal(blend, 0);
  assert.equal(KNEEL_TRANSITION_SECONDS, 2);
});

test('kneeling steadily improves weapon spread and AI aim error', () => {
  assert.equal(kneelSpreadMultiplier(0), 1);
  assert.equal(kneelAimErrorMultiplier(0), 1);
  assert.ok(Math.abs(kneelSpreadMultiplier(1) - 0.42) < 1e-12);
  assert.equal(kneelAimErrorMultiplier(1), 0.5);
  assert.ok(kneelSpreadMultiplier(0.5) < kneelSpreadMultiplier(0.25));
});

test('posture labels distinguish the two transition directions', () => {
  assert.equal(kneelState(0, false), 'standing');
  assert.equal(kneelState(0.4, true), 'kneeling');
  assert.equal(kneelState(1, true), 'kneeling');
  assert.equal(kneelState(0.4, false), 'rising');
});

test('firing kneel is an asymmetric planted-foot and knee-down pose', () => {
  const standing = firingKneelPose(0);
  const kneeling = firingKneelPose(1);
  assert.equal(standing.bodyDrop, 0);
  assert.equal(standing.frontKnee, 0);
  assert.ok(kneeling.bodyDrop >= 5 && kneeling.bodyDrop < 5.5);
  assert.ok(kneeling.frontHip < -0.9 && kneeling.frontKnee > 2.2);
  assert.ok(kneeling.rearHip > 0 && kneeling.rearHip < 0.25 && kneeling.rearKnee < -1.5);
  assert.ok(kneeling.frontSpread < 0 && kneeling.rearSpread > 0);
});

test('AI kneels only in a ranged firing band and uses hysteresis', () => {
  const base = { preferredRange: 500, eligible: true, ranged: true, hasTarget: true, hasLineOfSight: true };
  assert.equal(shouldAiKneel({ ...base, range: 400 }), true);
  assert.equal(shouldAiKneel({ ...base, range: 300 }), false);
  assert.equal(shouldAiKneel({ ...base, range: 300, currentlyKneeling: true }), true);
  assert.equal(shouldAiKneel({ ...base, range: 690, currentlyKneeling: true }), false);
  assert.equal(shouldAiKneel({ ...base, range: 400, repositioning: true }), false);
  assert.equal(shouldAiKneel({ ...base, range: 400, eligible: false }), false);
  assert.equal(shouldAiKneel({ ...base, range: 400, ranged: false }), false);
});
